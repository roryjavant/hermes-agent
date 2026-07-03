from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_reminders_route_nav_title_and_i18n_are_wired_under_repos():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    en_source = read("web/src/i18n/en.ts")
    types_source = read("web/src/i18n/types.ts")

    assert 'import RemindersPage from "@/pages/RemindersPage";' in app_source
    assert '"/reminders": RemindersPage' in app_source
    assert 'path: "/reminders"' in app_source
    assert 'labelKey: "reminders"' in app_source
    assert app_source.index('path: "/repos"') < app_source.index('path: "/reminders"') < app_source.index('path: "/flow"')
    assert '"/reminders": "reminders"' in title_source
    assert 'reminders: "Reminders"' in title_source
    assert 'reminders: "Reminders"' in en_source
    assert 'reminders?: string' in types_source


def test_sidebar_keeps_rory_tabs_top_level_and_groups_builtin_puppeteers():
    app_source = read("web/src/App.tsx")

    assert "PRIMARY_DASHBOARD_TAB_PATHS" in app_source
    primary_block = app_source.split("const PRIMARY_DASHBOARD_TAB_PATHS", 1)[1].split("]);", 1)[0]
    assert '"/mission-control"' in primary_block
    assert '"/launchpad"' in primary_block
    assert '"/team"' in primary_block
    assert '"/knowledge-base"' in primary_block
    assert '"/marketing"' in primary_block
    assert '"/research"' in primary_block
    assert '"/repos"' in primary_block
    assert '"/reminders"' in primary_block
    assert '"/flow"' in primary_block
    assert '"/sessions"' not in primary_block
    assert '"/config"' not in primary_block
    assert "puppeteerItems" in app_source
    assert 'label="Puppeteers"' in app_source
    assert "SidebarNavGroup" in app_source


def test_reminders_page_supports_crud_and_due_date_light_language():
    source = read("web/src/pages/RemindersPage.tsx")
    api_source = read("web/src/lib/api.ts")

    assert "Personal reminder lights" in source
    assert "Past due" in source
    assert "Due soon" in source
    assert "Upcoming" in source
    assert "48 * 60 * 60 * 1000" in source
    assert 'type="datetime-local"' in source
    assert "api.getReminders" in source
    assert "api.createReminder" in source
    assert "api.updateReminder" in source
    assert "api.deleteReminder" in source
    assert "Priority !" in source
    assert "Mark reminder priority" in source
    assert "Priority reminder" in source
    assert "priority: !reminder.priority" in source
    assert "priority: form.priority" in source
    assert 'aria-label={reminder.completed ? "Mark reminder not done" : "Mark reminder done"}' in source
    assert 'title={reminder.completed ? "Undo done" : "Done"}' in source
    assert 'aria-label="Edit reminder"' in source
    assert 'aria-label="Delete reminder"' in source
    assert "DndContext" in source
    assert "SortableReminderRow" in source
    assert "Drag to reorder reminder" in source
    assert "api.reorderReminders" in source
    assert "order_index" in source
    assert "_10rem" in source
    assert "rounded-full" in source
    assert 'fetchJSON<RemindersResponse>("/api/reminders"' in api_source
    assert 'fetchJSON<RemindersResponse>("/api/reminders/reorder"' in api_source
    assert "ReminderCreate" in api_source
    assert "ReminderUpdate" in api_source
    assert "priority: boolean" in api_source
    assert "order_index: number" in api_source
