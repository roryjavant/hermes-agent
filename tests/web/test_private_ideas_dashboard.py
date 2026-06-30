from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_rory_route_title_and_i18n_are_wired_but_nav_is_hidden():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    en_source = read("web/src/i18n/en.ts")
    types_source = read("web/src/i18n/types.ts")

    assert 'import PrivateIdeasPage from "@/pages/PrivateIdeasPage";' in app_source
    assert '"/rory": PrivateIdeasPage' in app_source
    assert 'path: "/rory"' not in app_source
    assert 'labelKey: "rory"' not in app_source
    assert 'label: "RORY"' not in app_source
    assert '"/rory": "rory"' in title_source
    assert 'rory: "RORY"' in title_source
    assert 'rory: "RORY"' in en_source
    assert 'rory?: string' in types_source


def test_private_ideas_page_supports_auth_crud_and_inactivity_lock():
    source = read("web/src/pages/PrivateIdeasPage.tsx")
    api_source = read("web/src/lib/api.ts")

    assert "Rory list" in source
    assert "RORY" in source
    assert "Password required" in source
    assert "PIN required" in source
    assert "INACTIVITY_MS = 60_000" in source
    assert 'window.location.assign("/")' in source
    assert "api.verifyPrivateIdeasPassword" in source
    assert "api.unlockPrivateIdeas" in source
    assert "api.getPrivateIdeas" in source
    assert "api.createPrivateIdea" in source
    assert "api.updatePrivateIdea" in source
    assert "api.deletePrivateIdea" in source
    assert 'fetchJSON<PrivateIdeasResponse>("/api/private-ideas"' in api_source
    assert "X-Hermes-Private-Ideas-Token" in api_source
    assert "PrivateIdeaCreate" in api_source
    assert "PrivateIdeaUpdate" in api_source
