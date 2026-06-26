import os
import time

from hermes_cli import runtime_activity


def test_publish_and_read_activity_record(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    monkeypatch.setenv("HERMES_HOME", str(home))

    record = runtime_activity.publish_activity(
        source="cli",
        status="ready",
        detail="waiting for input",
        session_id="session-1",
        cwd="/tmp/project",
        profile="builder",
        now=1000.0,
    )

    assert record["pid"] == os.getpid()
    assert record["profile"] == "builder"
    assert record["source"] == "cli"
    assert record["session_id"] == "session-1"
    assert record["cwd"] == "/tmp/project"
    assert record["status"] == "ready"
    assert record["detail"] == "waiting for input"
    assert record["started_at"] == 1000.0
    assert record["last_seen"] == 1000.0

    monkeypatch.setattr(runtime_activity, "_now", lambda: 1001.0)
    assert [row["activity_id"] for row in runtime_activity.read_activities()] == [
        record["activity_id"]
    ]


def test_publish_updates_existing_record_preserving_started_at(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    monkeypatch.setenv("HERMES_HOME", str(home))

    first = runtime_activity.publish_activity(
        source="kanban",
        status="working",
        detail="tool call",
        session_id="task-session",
        now=10.0,
    )
    second = runtime_activity.publish_activity(
        source="kanban",
        status="review",
        detail="awaiting review",
        session_id="task-session",
        now=20.0,
    )

    assert first["activity_id"] == second["activity_id"]
    assert second["started_at"] == 10.0
    assert second["last_seen"] == 20.0
    assert second["status"] == "review"

    monkeypatch.setattr(runtime_activity, "_now", lambda: 21.0)
    rows = runtime_activity.read_activities()
    assert len(rows) == 1
    assert rows[0]["detail"] == "awaiting review"


def test_refresh_activity_preserves_status_and_prevents_stale_prune(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    monkeypatch.setenv("HERMES_HOME", str(home))

    record = runtime_activity.publish_activity(
        source="dashboard",
        status="ready",
        detail="dashboard backend ready",
        session_id="dashboard",
        now=10.0,
    )

    assert runtime_activity.refresh_activity(
        activity_id=record["activity_id"],
        now=250.0,
    )
    monkeypatch.setattr(runtime_activity, "_now", lambda: 500.0)

    rows = runtime_activity.read_activities(stale_after_seconds=300)
    assert len(rows) == 1
    assert rows[0]["activity_id"] == record["activity_id"]
    assert rows[0]["status"] == "ready"
    assert rows[0]["detail"] == "dashboard backend ready"
    assert rows[0]["started_at"] == 10.0
    assert rows[0]["last_seen"] == 250.0


def test_read_filters_stale_and_dead_pid_records(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr("gateway.status._pid_exists", lambda pid: int(pid) != 99999999)
    monkeypatch.setattr(runtime_activity, "_now", lambda: 200.0)

    runtime = home / "runtime"
    runtime.mkdir(parents=True)
    runtime_activity._write_entries(
        runtime / "activity.json",
        [
            {
                "activity_id": "dead",
                "pid": 99999999,
                "profile": "builder",
                "source": "cli",
                "session_id": "dead-session",
                "cwd": "/tmp",
                "status": "working",
                "detail": "dead pid",
                "started_at": 190.0,
                "last_seen": 199.0,
            },
            {
                "activity_id": "stale",
                "pid": os.getpid(),
                "profile": "builder",
                "source": "cli",
                "session_id": "stale-session",
                "cwd": "/tmp",
                "status": "working",
                "detail": "stale",
                "started_at": 1.0,
                "last_seen": 1.0,
            },
            {
                "activity_id": "live",
                "pid": os.getpid(),
                "profile": "builder",
                "source": "cli",
                "session_id": "live-session",
                "cwd": "/tmp",
                "status": "ready",
                "detail": "live",
                "started_at": 198.0,
                "last_seen": 199.0,
            },
        ],
    )

    rows = runtime_activity.read_activities(stale_after_seconds=60)

    assert [row["activity_id"] for row in rows] == ["live"]
    assert runtime_activity._read_entries(runtime / "activity.json") == rows


def test_activity_records_force_redact_secrets(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    monkeypatch.setenv("HERMES_HOME", str(home))

    record = runtime_activity.publish_activity(
        source="cli",
        status="working",
        detail="OPENAI_API_KEY=super-sensitive-value should not persist",
        session_id="session-secret",
        cwd="/tmp/project",
        profile="builder",
    )

    payload = " ".join(str(value) for value in record.values())
    assert "super-sensitive-value" not in payload
    assert "OPENAI_API_KEY=" in record["detail"]


def test_clear_activity_removes_clean_shutdown_record(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    monkeypatch.setenv("HERMES_HOME", str(home))

    record = runtime_activity.publish_activity(
        source="dashboard",
        status="ready",
        detail="dashboard backend ready",
        session_id="dashboard",
    )
    assert runtime_activity.read_activities()

    runtime_activity.clear_activity(activity_id=record["activity_id"])

    assert runtime_activity.read_activities() == []


def test_read_all_profile_activities_merges_sibling_profile_records(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    sibling = home / "profiles" / "builder"
    sibling_runtime = sibling / "runtime"
    sibling_runtime.mkdir(parents=True)
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(runtime_activity, "_now", lambda: 200.0)

    default_record = runtime_activity.publish_activity(
        source="cli",
        status="ready",
        detail="default CLI idle",
        session_id="default-session",
        profile="default",
        now=100.0,
    )
    runtime_activity._write_entries(
        sibling_runtime / "activity.json",
        [
            {
                "activity_id": "stale-builder",
                "pid": os.getpid(),
                "process_start_time": runtime_activity._process_start_time(os.getpid()),
                "source": "tui",
                "session_id": "stale-session",
                "cwd": "/tmp/stale",
                "status": "working",
                "detail": "stale TUI",
                "started_at": -200.0,
                "last_seen": -200.0,
            },
            {
                "activity_id": "live-builder",
                "pid": os.getpid(),
                "process_start_time": runtime_activity._process_start_time(os.getpid()),
                "source": "tui",
                "session_id": "builder-session",
                "cwd": "/tmp/builder",
                "status": "working",
                "detail": "builder TUI running",
                "started_at": 120.0,
                "last_seen": 150.0,
            },
        ],
    )

    rows = runtime_activity.read_all_profile_activities(stale_after_seconds=300)

    assert [row["activity_id"] for row in rows] == ["live-builder", default_record["activity_id"]]
    assert rows[0]["profile"] == "builder"
    assert rows[0]["source"] == "tui"
    assert rows[1]["profile"] == "default"
    assert [
        row["activity_id"] for row in runtime_activity._read_entries(sibling_runtime / "activity.json")
    ] == ["live-builder"]
