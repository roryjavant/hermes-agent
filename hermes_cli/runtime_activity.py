"""Cross-process local Hermes runtime activity heartbeats.

This registry is intentionally small and profile-scoped.  It lets local
management surfaces (Mission Control/dashboard/TUI) see live Hermes work across
separate CLI/TUI/dashboard/kanban/delegate processes without adding model-tool
surface area.
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from agent.redact import redact_sensitive_text
from hermes_constants import get_hermes_home
from hermes_cli.active_sessions import _FileLock, _pid_alive, _process_start_time

logger = logging.getLogger(__name__)

VALID_SOURCES = frozenset({"cli", "tui", "dashboard", "kanban", "delegate"})
VALID_STATUSES = frozenset({"ready", "working", "review"})
DEFAULT_STALE_SECONDS = 300.0
_MAX_DETAIL_CHARS = 500
_MAX_CWD_CHARS = 500


def _state_dir() -> Path:
    return get_hermes_home() / "runtime"


def _state_path() -> Path:
    return _state_dir() / "activity.json"


def _lock_path() -> Path:
    return _state_dir() / "activity.lock"


def _paths_for_home(home: Path) -> tuple[Path, Path]:
    runtime_dir = home / "runtime"
    return runtime_dir / "activity.json", runtime_dir / "activity.lock"


def _read_entries(path: Path) -> list[dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return []
    except Exception:
        logger.warning("Ignoring corrupt runtime activity registry at %s", path)
        return []
    entries = data.get("activities") if isinstance(data, dict) else data
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def _write_entries(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"activities": entries}, fh, sort_keys=True)
    os.replace(tmp, path)


def _now() -> float:
    return time.time()


def _profile_name() -> str:
    try:
        from hermes_cli.profiles import get_active_profile_name

        return str(get_active_profile_name() or "default")
    except Exception:
        return "default"


def _sanitize_text(value: Any, *, max_chars: int) -> str:
    if value is None:
        return ""
    text = str(value).replace("\x00", " ")
    text = " ".join(text.split())
    text = redact_sensitive_text(text, force=True)
    if len(text) > max_chars:
        text = text[: max_chars - 1].rstrip() + "…"
    return text


def _normalize_source(source: Any) -> str:
    text = str(source or "").strip().lower()
    if ":" in text:
        text = text.split(":", 1)[0]
    return text if text in VALID_SOURCES else "cli"


def _normalize_status(status: Any) -> str:
    text = str(status or "").strip().lower()
    return text if text in VALID_STATUSES else "working"


def _default_activity_id(pid: int, source: str, session_id: str) -> str:
    return f"{pid}:{source}:{session_id}"


def _entry_alive(entry: dict[str, Any], *, now: float, stale_after_seconds: float) -> bool:
    try:
        last_seen = float(entry.get("last_seen") or 0)
    except (TypeError, ValueError):
        return False
    if stale_after_seconds > 0 and now - last_seen > stale_after_seconds:
        return False
    return _pid_alive(entry.get("pid"), entry.get("process_start_time"))


def _prune(entries: list[dict[str, Any]], *, now: float, stale_after_seconds: float) -> list[dict[str, Any]]:
    return [
        entry for entry in entries
        if _entry_alive(entry, now=now, stale_after_seconds=stale_after_seconds)
    ]


def publish_activity(
    *,
    source: str,
    status: str = "working",
    detail: str = "",
    session_id: str | None = None,
    cwd: str | os.PathLike[str] | None = None,
    profile: str | None = None,
    pid: int | None = None,
    now: float | None = None,
    activity_id: str | None = None,
    context_percent: int | float | None = None,
    context_tokens: int | None = None,
    context_length: int | None = None,
    compressions: int | None = None,
) -> dict[str, Any]:
    """Publish or refresh this process's runtime heartbeat record.

    Returns the sanitized record that was persisted.  Best-effort callers may
    ignore exceptions, but tests and dashboard code can use the return value.
    """
    ts = float(_now() if now is None else now)
    pid_int = int(pid or os.getpid())
    safe_source = _normalize_source(source)
    safe_status = _normalize_status(status)
    safe_session_id = _sanitize_text(session_id or "", max_chars=160)
    safe_cwd = _sanitize_text(cwd if cwd is not None else os.getcwd(), max_chars=_MAX_CWD_CHARS)
    safe_profile = _sanitize_text(profile or _profile_name(), max_chars=80) or "default"
    safe_detail = _sanitize_text(detail, max_chars=_MAX_DETAIL_CHARS)
    ident = activity_id or _default_activity_id(pid_int, safe_source, safe_session_id)

    state_path = _state_path()
    with _FileLock(_lock_path()):
        entries = _prune(
            _read_entries(state_path),
            now=ts,
            stale_after_seconds=DEFAULT_STALE_SECONDS,
        )
        prior = next((entry for entry in entries if str(entry.get("activity_id") or "") == ident), None)
        started_at: Any = prior.get("started_at") if prior is not None else ts
        try:
            started = float(started_at)
        except (TypeError, ValueError):
            started = ts
        record = {
            "activity_id": ident,
            "pid": pid_int,
            "process_start_time": _process_start_time(pid_int),
            "profile": safe_profile,
            "source": safe_source,
            "session_id": safe_session_id,
            "cwd": safe_cwd,
            "status": safe_status,
            "detail": safe_detail,
            "started_at": started,
            "last_seen": ts,
        }
        if context_percent is not None:
            try:
                record["context_percent"] = max(0, min(100, round(float(context_percent))))
            except (TypeError, ValueError):
                pass
        if context_tokens is not None:
            try:
                record["context_tokens"] = max(0, int(context_tokens))
            except (TypeError, ValueError):
                pass
        if context_length is not None:
            try:
                record["context_length"] = max(0, int(context_length))
            except (TypeError, ValueError):
                pass
        if compressions is not None:
            try:
                record["compressions"] = max(0, int(compressions))
            except (TypeError, ValueError):
                pass
        entries = [entry for entry in entries if str(entry.get("activity_id") or "") != ident]
        entries.append(record)
        _write_entries(state_path, entries)
        return record


def refresh_activity(*, activity_id: str, now: float | None = None) -> bool:
    """Refresh an existing heartbeat without changing its visible status/detail."""
    ident = str(activity_id or "")
    if not ident:
        return False
    ts = float(_now() if now is None else now)
    state_path = _state_path()
    with _FileLock(_lock_path()):
        entries = _prune(
            _read_entries(state_path),
            now=ts,
            stale_after_seconds=DEFAULT_STALE_SECONDS,
        )
        refreshed = False
        for entry in entries:
            if str(entry.get("activity_id") or "") != ident:
                continue
            try:
                pid_int = int(entry.get("pid") or os.getpid())
            except (TypeError, ValueError):
                pid_int = os.getpid()
            entry["last_seen"] = ts
            entry["process_start_time"] = _process_start_time(pid_int)
            refreshed = True
            break
        if refreshed:
            _write_entries(state_path, entries)
        return refreshed


def clear_activity(*, activity_id: str | None = None, source: str | None = None, session_id: str | None = None, pid: int | None = None) -> None:
    """Remove one heartbeat record for a cleanly closed local surface."""
    pid_int = int(pid or os.getpid())
    ident = activity_id
    if ident is None and source is not None:
        ident = _default_activity_id(
            pid_int,
            _normalize_source(source),
            _sanitize_text(session_id or "", max_chars=160),
        )
    state_path = _state_path()
    with _FileLock(_lock_path()):
        entries = _read_entries(state_path)
        if ident is not None:
            entries = [entry for entry in entries if str(entry.get("activity_id") or "") != ident]
        else:
            entries = [entry for entry in entries if int(entry.get("pid") or -1) != pid_int]
        _write_entries(state_path, entries)


def _read_activities_from_paths(
    state_path: Path,
    lock_path: Path,
    *,
    stale_after_seconds: float,
    write_empty: bool,
) -> list[dict[str, Any]]:
    ts = _now()
    with _FileLock(lock_path):
        entries = _prune(
            _read_entries(state_path),
            now=ts,
            stale_after_seconds=float(stale_after_seconds),
        )
        entries.sort(key=lambda row: float(row.get("last_seen") or 0), reverse=True)
        if entries or write_empty or state_path.exists():
            _write_entries(state_path, entries)
        return entries


def read_activities(*, stale_after_seconds: float = DEFAULT_STALE_SECONDS) -> list[dict[str, Any]]:
    """Return live, non-stale activity records and persist the pruned registry."""
    return _read_activities_from_paths(
        _state_path(),
        _lock_path(),
        stale_after_seconds=stale_after_seconds,
        write_empty=True,
    )


def _profile_activity_targets() -> list[tuple[str, Path]]:
    """Return candidate profile homes that have runtime activity registries.

    Mission Control polls this path frequently, so discovery must stay cheap.
    Avoid ``profiles.list_profiles()`` here: that command enriches profile rows
    with model/config/skill metadata and may recursively scan every installed
    skill tree, blocking the dashboard hot path.
    """
    current_home = get_hermes_home()
    default_home = current_home
    if current_home.parent.name == "profiles":
        default_home = current_home.parent.parent

    targets: list[tuple[str, Path]] = []

    def add_target(name: str, home: Path) -> None:
        if (home / "runtime" / "activity.json").exists() or home == current_home:
            targets.append((name, home))

    add_target("default", default_home)

    profiles_root = default_home / "profiles"
    if profiles_root.is_dir():
        for entry in sorted(profiles_root.iterdir()):
            if not entry.is_dir():
                continue
            add_target(entry.name, entry)

    if not targets:
        targets.append((_profile_name(), current_home))
    return targets


def read_all_profile_activities(*, stale_after_seconds: float = DEFAULT_STALE_SECONDS) -> list[dict[str, Any]]:
    """Return live activity records from every local Hermes profile.

    Mission Control runs under one dashboard profile, while local CLI/TUI
    windows and kanban workers often run under sibling profiles. Read those
    heartbeat registries directly from disk without mutating ``HERMES_HOME``.
    """
    try:
        targets = _profile_activity_targets()
    except Exception:
        logger.debug("Runtime activity profile discovery failed", exc_info=True)
        targets = []

    if not targets:
        targets = [(_profile_name(), get_hermes_home())]

    seen_paths: set[Path] = set()
    merged: list[dict[str, Any]] = []
    for profile_name, home in targets:
        try:
            state_path, lock_path = _paths_for_home(Path(home))
            resolved = state_path.resolve(strict=False)
            if resolved in seen_paths:
                continue
            seen_paths.add(resolved)
            if not state_path.exists():
                continue
            rows = _read_activities_from_paths(
                state_path,
                lock_path,
                stale_after_seconds=stale_after_seconds,
                write_empty=False,
            )
            for row in rows:
                item = dict(row)
                if not item.get("profile"):
                    item["profile"] = profile_name
                merged.append(item)
        except Exception:
            logger.debug(
                "Runtime activity read failed for profile %s at %s",
                profile_name,
                home,
                exc_info=True,
            )

    merged.sort(key=lambda row: float(row.get("last_seen") or 0), reverse=True)
    return merged


__all__ = [
    "DEFAULT_STALE_SECONDS",
    "VALID_SOURCES",
    "VALID_STATUSES",
    "publish_activity",
    "refresh_activity",
    "read_activities",
    "read_all_profile_activities",
    "clear_activity",
]
