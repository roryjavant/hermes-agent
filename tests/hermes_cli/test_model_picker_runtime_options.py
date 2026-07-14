from types import SimpleNamespace
from unittest.mock import MagicMock

from cli import HermesCLI


def _picker_cli():
    cli_obj = HermesCLI.__new__(HermesCLI)
    cli_obj.agent = None
    cli_obj.reasoning_config = {"enabled": True, "effort": "medium"}
    cli_obj.show_reasoning = False
    cli_obj.service_tier = "priority"
    cli_obj._invalidate = MagicMock()
    cli_obj._close_model_picker = MagicMock()
    cli_obj._handle_reasoning_command = MagicMock()
    cli_obj._handle_fast_command = MagicMock()
    return cli_obj


def test_runtime_values_are_visible_from_current_session_settings():
    cli_obj = _picker_cli()

    assert cli_obj._model_picker_runtime_values() == ("medium", "off", "fast")


def test_provider_picker_opens_runtime_options_before_cancel():
    cli_obj = _picker_cli()
    cli_obj._model_picker_state = {
        "stage": "provider",
        "providers": [{"slug": "openai-codex", "is_current": True}],
        "selected": 1,
    }

    cli_obj._handle_model_picker_selection()

    assert cli_obj._model_picker_state["stage"] == "runtime"
    assert cli_obj._model_picker_state["selected"] == 0
    cli_obj._close_model_picker.assert_not_called()


def test_runtime_picker_changes_reasoning_display_and_speed():
    cli_obj = _picker_cli()
    cli_obj._cycle_model_picker_reasoning = MagicMock()
    cli_obj._model_picker_state = {"stage": "runtime", "providers": [], "selected": 0}

    cli_obj._handle_model_picker_selection()
    cli_obj._cycle_model_picker_reasoning.assert_called_once_with()

    cli_obj._model_picker_state["selected"] = 1
    cli_obj._handle_model_picker_selection()
    cli_obj._handle_reasoning_command.assert_called_once_with("/reasoning show")

    cli_obj._model_picker_state["selected"] = 2
    cli_obj._handle_model_picker_selection()
    cli_obj._handle_fast_command.assert_called_once_with("/fast normal")
