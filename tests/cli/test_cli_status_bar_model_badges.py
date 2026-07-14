from datetime import datetime
from types import SimpleNamespace

from cli import HermesCLI


def _minimal_cli():
    cli = HermesCLI.__new__(HermesCLI)
    cli.model = "openai/gpt-5.5"
    cli.agent = SimpleNamespace(
        model="openai/gpt-5.5",
        reasoning_config={"enabled": True, "effort": "medium"},
        service_tier="priority",
        session_input_tokens=0,
        session_output_tokens=0,
        session_cache_read_tokens=0,
        session_cache_write_tokens=0,
        session_prompt_tokens=0,
        session_completion_tokens=0,
        session_total_tokens=0,
        session_api_calls=0,
        context_compressor=None,
    )
    cli.reasoning_config = {"enabled": True, "effort": "medium"}
    cli.service_tier = "priority"
    cli.session_start = datetime.now()
    cli._prompt_start_time = None
    cli._prompt_duration = 0.0
    cli._last_turn_finished_at = None
    cli._background_tasks = {}
    return cli


def test_status_bar_snapshot_includes_speed_and_reasoning_badges():
    cli = _minimal_cli()

    snapshot = cli._get_status_bar_snapshot()

    assert snapshot["model_short"] == "gpt-5.5"
    assert snapshot["reasoning_effort"] == "medium"
    assert snapshot["service_tier"] == "priority"
    assert snapshot["model_status_short"] == "gpt-5.5 fast, medium"


def test_status_bar_text_renders_speed_and_reasoning_badges(monkeypatch):
    cli = _minimal_cli()
    monkeypatch.setattr(cli, "_is_session_yolo_active", lambda: False)

    text = cli._build_status_bar_text(width=120)

    assert "gpt-5.5 fast, medium" in text
