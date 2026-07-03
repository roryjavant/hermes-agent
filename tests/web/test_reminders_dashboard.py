from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_mission_control_and_reminders_routes_are_wired():
    app_source = read("web/src/App.tsx")
    en_source = read("web/src/i18n/en.ts")
    api_source = read("web/src/lib/api.ts")

    assert 'import MissionControlPage from "@/pages/MissionControlPage";' in app_source
    assert 'import RemindersPage from "@/pages/RemindersPage";' in app_source
    assert '"/mission-control": MissionControlPage' in app_source
    assert '"/reminders": RemindersPage' in app_source
    assert 'path: "/mission-control"' in app_source
    assert 'path: "/reminders"' in app_source
    assert 'labelKey: "missionControl"' in app_source
    assert 'labelKey: "reminders"' in app_source
    assert 'missionControl: "Mission Control"' in en_source
    assert 'reminders: "Reminders"' in en_source
    assert "getMissionControlActivity" in api_source
    assert "getReminders" in api_source
    assert "reorderReminders" in api_source


def test_reminders_page_preserves_drag_priority_and_compact_actions():
    source = read("web/src/pages/RemindersPage.tsx")

    assert "DndContext" in source
    assert "SortableContext" in source
    assert "priority" in source
    assert "reorderReminders" in source
    assert "Mark reminder priority" in source
    assert "aria-label=\"Delete reminder\"" in source


def test_mission_control_page_has_audio_and_embedded_terminal_surfaces():
    source = read("web/src/pages/MissionControlPage.tsx")

    assert "only-one-prompt-away.mp3" in source
    assert "mission-control-prompt-away" in source
    assert "Embedded terminals" in source
    assert "ChatPage" in source
    assert "getMissionControlActivity" in source
    assert "playMissionControlDing" in source


def test_backend_exposes_reminder_and_mission_control_endpoints():
    source = read("hermes_cli/web_server.py")

    assert '@app.get("/api/reminders")' in source
    assert '@app.post("/api/reminders/reorder")' in source
    assert '@app.get("/api/mission-control/activity")' in source
    assert '@app.post("/api/mission-control/ding")' in source
    assert '@app.post("/api/mission-control/announce")' in source
