"""Built-in model shortcut targets used by slash commands.

The shortcut table lives in code (not profile-local ``quick_commands``) so every
Hermes profile using this install gets the same model aliases.  Bare shortcuts
(``/5.5``, ``/sol``, ``/terra``) switch the current terminal/TUI session model.
The public ``/use-*`` commands are one-shot prompt runners: they select a model
for the next submitted prompt and then restore the session's prior model.  They
must not persist config.yaml or pin the session model.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelShortcut:
    """A named model target used by model-related slash shortcuts."""

    name: str
    model: str
    provider: str
    description: str

    @property
    def target_args(self) -> str:
        return f"{self.model} --provider {self.provider}"

    @property
    def use_command(self) -> str:
        return f"use-{self.name}"


MODEL_SHORTCUTS: tuple[ModelShortcut, ...] = (
    ModelShortcut(
        name="5.5",
        model="gpt-5.5",
        provider="openai-codex",
        description="GPT 5.5 via OpenAI Codex",
    ),
    ModelShortcut(
        name="sol",
        model="gpt-5.6-sol",
        provider="openai-codex",
        description="GPT 5.6 Sol via OpenAI Codex",
    ),
    ModelShortcut(
        name="terra",
        model="gpt-5.6-terra",
        provider="openai-codex",
        description="GPT 5.6 Terra via OpenAI Codex",
    ),
)

_MODEL_SHORTCUT_BY_NAME: dict[str, ModelShortcut] = {
    shortcut.name.lower(): shortcut for shortcut in MODEL_SHORTCUTS
}

_USE_MODEL_SHORTCUT_BY_NAME: dict[str, ModelShortcut] = {
    shortcut.use_command.lower(): shortcut for shortcut in MODEL_SHORTCUTS
}


USE_MODEL_COMMANDS: tuple[str, ...] = tuple(
    shortcut.use_command for shortcut in MODEL_SHORTCUTS
)

MODEL_SWITCH_COMMANDS: tuple[str, ...] = tuple(
    shortcut.name for shortcut in MODEL_SHORTCUTS
)


def model_shortcut_args(name: str | None, extra_args: str = "", *, default_session: bool = True) -> str:
    """Return ``/model`` arguments for a bare shortcut command.

    ``default_session`` appends ``--session`` unless the user explicitly passed
    ``--session`` or ``--global``.  This keeps `/sol`-style sugar scoped to the
    current terminal/TUI session while still allowing an explicit `/sol --global`.
    """

    import re

    shortcut = model_shortcut_for_name(name)
    if shortcut is None:
        return ""
    tail = str(extra_args or "").strip()
    args = shortcut.target_args
    if tail:
        args = f"{args} {tail}"
    if default_session and not re.search(r"(?:^|\s)--(?:global|session)(?:\s|$)", tail):
        args = f"{args} --session"
    return args


def model_shortcut_for_name(name: str | None) -> ModelShortcut | None:
    """Return the model shortcut matching *name*, accepting an optional slash."""

    if not name:
        return None
    return _MODEL_SHORTCUT_BY_NAME.get(str(name).lower().lstrip("/"))


def use_model_shortcut_for_name(name: str | None) -> ModelShortcut | None:
    """Return the one-shot shortcut for ``/use-*`` command names."""

    if not name:
        return None
    normalized = str(name).lower().lstrip("/")
    if normalized.startswith("use-"):
        return _USE_MODEL_SHORTCUT_BY_NAME.get(normalized)
    return None


def expand_model_shortcut_command(command: str) -> str:
    """Expand ``/sol``-style switch shortcuts into ``/model ...``."""

    stripped = (command or "").strip()
    if not stripped:
        return stripped

    has_slash = stripped.startswith("/")
    body = stripped[1:] if has_slash else stripped
    parts = body.split(None, 1)
    if not parts:
        return stripped

    shortcut = model_shortcut_for_name(parts[0])
    if shortcut is None:
        return stripped

    tail = parts[1].strip() if len(parts) > 1 else ""
    expanded = f"model {model_shortcut_args(parts[0], tail, default_session=False)}"
    return f"/{expanded}" if has_slash else expanded
