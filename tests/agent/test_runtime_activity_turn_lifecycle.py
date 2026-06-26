from __future__ import annotations


def test_run_conversation_publishes_working_immediately_and_ready_at_end(monkeypatch):
    import agent.conversation_loop as conversation_loop
    from run_agent import AIAgent

    calls: list[tuple[str, str]] = []

    def fake_publish_activity(**kwargs):
        calls.append((kwargs["status"], kwargs["detail"]))
        return {"activity_id": "test-activity"}

    def fake_run_conversation(self, *args, **kwargs):
        assert calls[0] == ("working", "agent turn started")
        return {"final_response": "ok", "completed": True, "messages": [], "api_calls": 0}

    monkeypatch.setattr("hermes_cli.runtime_activity.publish_activity", fake_publish_activity)
    monkeypatch.setattr(conversation_loop, "run_conversation", fake_run_conversation)

    agent = AIAgent.__new__(AIAgent)
    setattr(agent, "session_id", "session-1")
    setattr(agent, "_delegate_depth", 0)

    result = agent.run_conversation("hello")

    assert result["final_response"] == "ok"
    assert calls[0] == ("working", "agent turn started")
    assert calls[-1] == ("ready", "waiting for input")


def test_run_conversation_restores_ready_when_turn_raises(monkeypatch):
    import agent.conversation_loop as conversation_loop
    from run_agent import AIAgent

    calls: list[tuple[str, str]] = []

    def fake_publish_activity(**kwargs):
        calls.append((kwargs["status"], kwargs["detail"]))
        return {"activity_id": "test-activity"}

    def fake_run_conversation(self, *args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr("hermes_cli.runtime_activity.publish_activity", fake_publish_activity)
    monkeypatch.setattr(conversation_loop, "run_conversation", fake_run_conversation)

    agent = AIAgent.__new__(AIAgent)
    setattr(agent, "session_id", "session-1")
    setattr(agent, "_delegate_depth", 0)

    try:
        agent.run_conversation("hello")
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected RuntimeError")

    assert calls[0] == ("working", "agent turn started")
    assert calls[-1] == ("ready", "waiting for input")
