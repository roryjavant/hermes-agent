from hermes_cli.commands import COMMANDS, resolve_command
from hermes_cli.model_shortcuts import (
    MODEL_SWITCH_COMMANDS,
    USE_MODEL_COMMANDS,
    expand_model_shortcut_command,
    model_shortcut_args,
    model_shortcut_for_name,
    use_model_shortcut_for_name,
)


def test_use_model_shortcut_commands_are_registered():
    expected = {
        "use-5.5": "gpt-5.5 --provider openai-codex",
        "use-sol": "gpt-5.6-sol --provider openai-codex",
        "use-terra": "gpt-5.6-terra --provider openai-codex",
    }

    assert set(USE_MODEL_COMMANDS) == set(expected)
    for name, target in expected.items():
        cmd = resolve_command(name)
        assert cmd is not None
        assert cmd.name == name
        assert cmd.cli_only is False
        assert f"/{name}" in COMMANDS
        shortcut = use_model_shortcut_for_name(f"/{name}")
        assert shortcut is not None
        assert shortcut.target_args == target


def test_bare_model_switch_shortcuts_are_registered_commands():
    expected = {
        "5.5": "gpt-5.5 --provider openai-codex --session",
        "sol": "gpt-5.6-sol --provider openai-codex --session",
        "terra": "gpt-5.6-terra --provider openai-codex --session",
    }

    assert set(MODEL_SWITCH_COMMANDS) == set(expected)
    for name, target in expected.items():
        cmd = resolve_command(name)
        assert cmd is not None
        assert cmd.name == name
        assert cmd.cli_only is True
        assert f"/{name}" in COMMANDS
        assert model_shortcut_for_name(name) is not None
        assert model_shortcut_args(name) == target


def test_bare_model_switch_shortcuts_can_opt_into_global_scope():
    assert model_shortcut_args("sol", "--global") == "gpt-5.6-sol --provider openai-codex --global"
    assert model_shortcut_args("terra", "--session") == "gpt-5.6-terra --provider openai-codex --session"


def test_expand_model_shortcut_command_remains_available():
    assert expand_model_shortcut_command("sol") == "model gpt-5.6-sol --provider openai-codex"
    assert expand_model_shortcut_command("/terra --session") == (
        "/model gpt-5.6-terra --provider openai-codex --session"
    )
    assert expand_model_shortcut_command("/5.5 --provider openrouter --global") == (
        "/model gpt-5.5 --provider openai-codex --provider openrouter --global"
    )
    assert expand_model_shortcut_command("/model gpt-5.5") == "/model gpt-5.5"
