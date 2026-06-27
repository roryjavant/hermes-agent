from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_research_dashboard_route_nav_title_and_i18n_are_wired():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    en_source = read("web/src/i18n/en.ts")
    types_source = read("web/src/i18n/types.ts")

    assert 'import ResearchPage from "@/pages/ResearchPage";' in app_source
    assert '"/research": ResearchPage' in app_source
    assert 'path: "/research"' in app_source
    assert 'labelKey: "research"' in app_source
    assert 'label: "Research"' in app_source
    assert '"/research": "research"' in title_source
    assert 'research: "Research"' in title_source
    assert 'research: "Research"' in en_source
    assert 'research?: string' in types_source


def test_research_page_is_read_only_local_fixture_workspace():
    source = read("web/src/pages/ResearchPage.tsx")

    for section in ["Pipeline", "Evidence", "Output", "Team", "Metrics", "Guardrails"]:
        assert section in source

    assert "Read-only Milestone 1" in source
    assert "local fixture/manual data only" in source
    assert "No crawler, scholar, citation, notes, or publishing integration" in source
    assert "Manual placeholder" in source
    assert "Dashboard roster" in source
    assert "hresearchstrategist" in source
    assert "hresearchfactcheck" in source

    assert "fetch(" not in source
    assert "api." not in source
    assert "useEffect" not in source
    assert "window.open" not in source
    assert "<button" not in source
