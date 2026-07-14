"""Helpers for the /mac2 slash command.

/mac2 is a convenience dispatcher for Rory's second MacBook.  It starts a
separate Hermes run using the already-configured ``othermac-worker`` profile,
which routes terminal work to ``Rorys-MacBook-Pro.local`` via SSH while keeping
the main Mac/TUI as the control point.
"""

from __future__ import annotations

import os
import shlex
import sys
from dataclasses import dataclass

MAC2_PROFILE = "othermac-worker"
MAC2_HOST_LABEL = "Rorys-MacBook-Pro.local"
MAC2_SOURCE = "mac2"


@dataclass(frozen=True)
class Mac2Task:
    """Metadata for a started /mac2 background run."""

    session_id: str
    pid: int | None
    profile: str
    host_label: str
    prompt_preview: str
    command: str


def mac2_usage() -> str:
    return (
        "usage: /mac2 <prompt>\n"
        f"Runs one prompt on the other MacBook via profile `{MAC2_PROFILE}` "
        f"({MAC2_HOST_LABEL})."
    )


def _prompt_preview(prompt: str, limit: int = 120) -> str:
    compact = " ".join(prompt.strip().split())
    return compact[: limit - 1] + "…" if len(compact) > limit else compact


def build_mac2_argv(prompt: str, *, profile: str = MAC2_PROFILE) -> list[str]:
    """Return argv for the worker Hermes process.

    Keep this as argv until the final shell boundary so prompts containing
    quotes, semicolons, or newlines cannot become shell syntax.
    """
    return [
        sys.executable,
        "-m",
        "hermes_cli.main",
        "-p",
        profile,
        "chat",
        "-q",
        prompt,
        "--quiet",
        "--source",
        MAC2_SOURCE,
    ]


def build_mac2_command(prompt: str, *, profile: str = MAC2_PROFILE) -> str:
    """Return a shell-safe command string for ``process_registry.spawn_local``."""
    return shlex.join(build_mac2_argv(prompt, profile=profile))


def start_mac2_task(
    prompt: str,
    *,
    session_key: str = "",
    cwd: str | None = None,
    profile: str = MAC2_PROFILE,
) -> Mac2Task:
    """Start a tracked background Hermes run for the other MacBook.

    The process is local because the ``othermac-worker`` profile already owns
    the SSH terminal backend.  ``notify_on_complete`` is enabled so TUI/CLI
    notification pollers surface the result when the Mac2 run exits.
    """
    cleaned = prompt.strip()
    if not cleaned:
        raise ValueError(mac2_usage())

    command = build_mac2_command(cleaned, profile=profile)
    from tools.process_registry import process_registry  # type: ignore[import-not-found]

    proc_session = process_registry.spawn_local(
        command=command,
        cwd=cwd or os.getcwd(),
        task_id="mac2",
        session_key=session_key,
    )
    proc_session.notify_on_complete = True

    return Mac2Task(
        session_id=proc_session.id,
        pid=proc_session.pid,
        profile=profile,
        host_label=MAC2_HOST_LABEL,
        prompt_preview=_prompt_preview(cleaned),
        command=command,
    )


def format_mac2_started(task: Mac2Task) -> str:
    pid_part = f", pid {task.pid}" if task.pid is not None else ""
    return (
        f"🖥️ Mac2 task started on {task.host_label} via `{task.profile}`.\n"
        f"Process: {task.session_id}{pid_part}\n"
        f"Prompt: {task.prompt_preview}\n"
        "I’ll surface the result here when it finishes."
    )
