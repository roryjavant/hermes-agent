"""Cross-process active chat session leases.

The session database records persisted conversations.  This module records
currently open chat surfaces, including idle CLI/TUI sessions that have not
written a transcript row yet.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from hermes_constants import get_hermes_home

logger = logging.getLogger(__name__)


def coerce_max_concurrent_sessions(value: Any, key: str = "max_concurrent_sessions") -> Optional[int]:
    """Return a positive integer cap, or None when disabled/invalid."""
    if value is None:
        return None
    if isinstance(value, bool):
        logger.warning(
            "Ignoring invalid %s=%r (expected a positive integer; 0/null disables)",
            key,
            value,
        )
        return None
    try:
        if isinstance(value, float):
            if not value.is_integer():
                raise ValueError(value)
            parsed = int(value)
        elif isinstance(value, str):
            parsed = int(value.strip(), 10)
        else:
            parsed = int(value)
    except (TypeError, ValueError):
        logger.warning(
            "Ignoring invalid %s=%r (expected a positive integer; 0/null disables)",
            key,
            value,
        )
        return None
    if parsed <= 0:
        return None
    return parsed


def resolve_max_concurrent_sessions(config: Any) -> Optional[int]:
    """Resolve top-level max_concurrent_sessions with gateway.* fallback."""
    raw: Any = None
    key = "max_concurrent_sessions"
    if isinstance(config, dict):
        if "max_concurrent_sessions" in config:
            raw = config.get("max_concurrent_sessions")
        else:
            gateway_cfg = config.get("gateway")
            if isinstance(gateway_cfg, dict):
                raw = gateway_cfg.get("max_concurrent_sessions")
                key = "gateway.max_concurrent_sessions"
    else:
        raw = getattr(config, "max_concurrent_sessions", None)
    return coerce_max_concurrent_sessions(raw, key=key)


def active_session_limit_message(active_count: int, max_sessions: int) -> str:
    return (
        f"Hermes is at the active session limit ({active_count}/{max_sessions}). "
        "Try again when another session finishes."
    )


def _state_dir() -> Path:
    return get_hermes_home() / "runtime"


def _state_path() -> Path:
    return _state_dir() / "active_sessions.json"


def _lock_path() -> Path:
    return _state_dir() / "active_sessions.lock"


class _FileLock:
    def __init__(self, path: Path):
        self.path = path
        self._fh = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = open(self.path, "a+b")
        if os.name == "nt":
            try:
                import msvcrt

                self._fh.seek(0)
                msvcrt.locking(self._fh.fileno(), msvcrt.LK_LOCK, 1)
            except Exception as exc:
                self._fh.close()
                self._fh = None
                raise RuntimeError("active session file lock unavailable") from exc
        else:
            try:
                import fcntl

                fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX)
            except Exception as exc:
                self._fh.close()
                self._fh = None
                raise RuntimeError("active session file lock unavailable") from exc
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._fh is None:
            return
        if os.name == "nt":
            try:
                import msvcrt

                self._fh.seek(0)
                msvcrt.locking(self._fh.fileno(), msvcrt.LK_UNLCK, 1)
            except Exception:
                pass
        else:
            try:
                import fcntl

                fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
        try:
            self._fh.close()
        finally:
            self._fh = None


def _read_entries(path: Path) -> list[dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return []
    except Exception:
        logger.warning("Ignoring corrupt active session registry at %s", path)
        return []
    entries = data.get("entries") if isinstance(data, dict) else data
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def _write_entries(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"entries": entries}, fh, sort_keys=True)
    os.replace(tmp, path)


def _process_start_time(pid: int) -> Optional[float]:
    # Pair pid with process create_time when psutil can read it, so a recycled
    # pid does not keep a stale lease alive indefinitely.
    try:
        import psutil  # type: ignore

        return float(psutil.Process(pid).create_time())
    except Exception:
        return None


def _optional_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _pid_alive(pid: Any, process_start_time: Any = None) -> bool:
    try:
        pid_int = int(pid)
    except (TypeError, ValueError):
        return False
    if pid_int <= 0:
        return False
    try:
        from gateway.status import _pid_exists

        exists = bool(_pid_exists(pid_int))
    except Exception:
        return False
    if not exists:
        return False
    expected_start = _optional_float(process_start_time)
    if expected_start is None:
        return True
    current_start = _process_start_time(pid_int)
    if current_start is None:
        return True
    return abs(current_start - expected_start) < 0.001


def _prune_dead(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        entry
        for entry in entries
        if _pid_alive(entry.get("pid"), entry.get("process_start_time"))
    ]


@dataclass
class ActiveSessionLease:
    lease_id: str
    session_id: str
    surface: str
    enabled: bool = True
    activity_id: str | None = None
    _activity_stop: threading.Event | None = field(default=None, repr=False)
    _activity_thread: threading.Thread | None = field(default=None, repr=False)
    released: bool = False

    def release(self) -> None:
        if self.released:
            return
        if self.enabled:
            release_active_session(self)
        else:
            _clear_runtime_activity(self)
            self.released = True


def _runtime_activity_source(surface: str) -> str:
    return (
        "dashboard"
        if surface == "dashboard"
        else "tui" if surface == "tui" else "cli"
    )


def _publish_runtime_activity(
    *,
    session_id: str,
    surface: str,
    metadata: Optional[dict[str, Any]] = None,
) -> str | None:
    try:
        from hermes_cli.runtime_activity import publish_activity

        source = _runtime_activity_source(surface)
        detail = "ready"
        if metadata and metadata.get("detail"):
            detail = str(metadata.get("detail") or "ready")
        record = publish_activity(
            source=source,
            status="ready",
            detail=detail,
            session_id=session_id,
            cwd=metadata.get("cwd") if metadata else None,
            profile=metadata.get("profile") if metadata else None,
        )
        return str(record.get("activity_id") or "") or None
    except Exception:
        logger.debug("Failed to publish runtime activity heartbeat", exc_info=True)
        return None


def publish_active_session_activity(
    lease: ActiveSessionLease | None,
    *,
    status: str,
    detail: str = "",
    cwd: str | os.PathLike[str] | None = None,
    profile: str | None = None,
) -> None:
    """Best-effort visible activity status update for an acquired local session.

    The active-session lease owns the stable runtime activity id. CLI/TUI
    surfaces call this around local agent-loop state changes so Mission Control
    can show idle/working/review without touching model context or tool schemas.
    """
    if lease is None:
        return
    try:
        from hermes_cli.runtime_activity import publish_activity

        record = publish_activity(
            source=_runtime_activity_source(str(lease.surface)),
            status=status,
            detail=detail,
            session_id=str(lease.session_id),
            activity_id=lease.activity_id,
            cwd=cwd,
            profile=profile,
        )
        lease.activity_id = str(record.get("activity_id") or "") or lease.activity_id
    except Exception:
        logger.debug("Failed to update runtime activity status", exc_info=True)


def _clear_runtime_activity(lease: ActiveSessionLease) -> None:
    _stop_runtime_activity_heartbeat(lease)
    try:
        from hermes_cli.runtime_activity import clear_activity

        if lease.activity_id:
            clear_activity(activity_id=lease.activity_id)
        else:
            clear_activity(source=lease.surface, session_id=lease.session_id)
    except Exception:
        logger.debug("Failed to clear runtime activity heartbeat", exc_info=True)


def _start_runtime_activity_heartbeat(lease: ActiveSessionLease) -> None:
    if not lease.activity_id:
        return
    stop = threading.Event()

    def _run() -> None:
        while not stop.wait(60.0):
            try:
                from hermes_cli.runtime_activity import refresh_activity

                if not refresh_activity(activity_id=lease.activity_id or ""):
                    return
            except Exception:
                logger.debug("Failed to refresh runtime activity heartbeat", exc_info=True)

    thread = threading.Thread(
        target=_run,
        name=f"hermes-runtime-activity-{lease.surface}",
        daemon=True,
    )
    lease._activity_stop = stop
    lease._activity_thread = thread
    thread.start()


def _stop_runtime_activity_heartbeat(lease: ActiveSessionLease) -> None:
    stop = lease._activity_stop
    if stop is None:
        return
    stop.set()
    thread = lease._activity_thread
    if thread is not None and thread is not threading.current_thread():
        thread.join(timeout=1.0)
    lease._activity_stop = None
    lease._activity_thread = None


def try_acquire_active_session(
    *,
    session_id: str,
    surface: str,
    config: Any,
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[Optional[ActiveSessionLease], Optional[str]]:
    """Acquire an active-session slot.

    Returns ``(lease, None)`` on success.  When the cap is disabled, the lease is
    a no-op object so callers can unconditionally call ``release()``.
    """
    max_sessions = resolve_max_concurrent_sessions(config)
    lease_id = uuid.uuid4().hex
    if max_sessions is None:
        activity_id = _publish_runtime_activity(
            session_id=str(session_id),
            surface=str(surface),
            metadata=metadata,
        )
        lease = ActiveSessionLease(
            lease_id=lease_id,
            session_id=session_id,
            surface=surface,
            enabled=False,
            activity_id=activity_id,
        )
        _start_runtime_activity_heartbeat(lease)
        return lease, None

    now = time.time()
    entry = {
        "lease_id": lease_id,
        "session_id": str(session_id),
        "surface": str(surface),
        "pid": os.getpid(),
        "process_start_time": _process_start_time(os.getpid()),
        "started_at": now,
        "updated_at": now,
    }
    if metadata:
        entry["metadata"] = {
            str(k): v for k, v in metadata.items() if isinstance(k, str)
        }

    state_path = _state_path()
    with _FileLock(_lock_path()):
        raw_entries = _read_entries(state_path)
        entries = _prune_dead(raw_entries)
        pruned = len(raw_entries) - len(entries)
        if pruned:
            logger.info("Pruned %d stale active session lease(s)", pruned)
        active_count = len(entries)
        if active_count >= max_sessions:
            _write_entries(state_path, entries)
            logger.info(
                "Active session limit reached: active=%d max=%d surface=%s",
                active_count,
                max_sessions,
                surface,
            )
            return None, active_session_limit_message(active_count, max_sessions)
        entries.append(entry)
        _write_entries(state_path, entries)

    activity_id = _publish_runtime_activity(
        session_id=str(session_id),
        surface=str(surface),
        metadata=metadata,
    )

    lease = ActiveSessionLease(
        lease_id=lease_id,
        session_id=str(session_id),
        surface=str(surface),
        activity_id=activity_id,
    )
    _start_runtime_activity_heartbeat(lease)
    return lease, None


def release_active_session(lease: ActiveSessionLease) -> None:
    state_path = _state_path()
    try:
        with _FileLock(_lock_path()):
            entries = _prune_dead(_read_entries(state_path))
            kept = [
                entry
                for entry in entries
                if str(entry.get("lease_id") or "") != lease.lease_id
            ]
            if len(kept) != len(entries):
                _write_entries(state_path, kept)
    finally:
        _clear_runtime_activity(lease)
        lease.released = True


def active_session_registry_snapshot() -> list[dict[str, Any]]:
    """Return the pruned active-session registry for diagnostics/tests."""
    state_path = _state_path()
    with _FileLock(_lock_path()):
        entries = _prune_dead(_read_entries(state_path))
        _write_entries(state_path, entries)
        return entries
