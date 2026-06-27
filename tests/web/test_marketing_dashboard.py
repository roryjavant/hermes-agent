from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_marketing_dashboard_route_nav_title_and_i18n_are_wired():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    en_source = read("web/src/i18n/en.ts")
    types_source = read("web/src/i18n/types.ts")

    assert 'import MarketingPage from "@/pages/MarketingPage";' in app_source
    assert '"/marketing": MarketingPage' in app_source
    assert 'path: "/marketing"' in app_source
    assert 'labelKey: "marketing"' in app_source
    assert 'label: "Marketing"' in app_source
    assert '"/marketing": "marketing"' in title_source
    assert 'marketing: "Marketing"' in title_source
    assert 'marketing: "Marketing"' in en_source
    assert 'marketing?: string' in types_source


def test_marketing_page_is_read_only_local_fixture_workspace():
    source = read("web/src/pages/MarketingPage.tsx")

    for section in ["Strategy", "Campaigns", "Content Pipeline", "Assets", "Metrics"]:
        assert section in source

    assert "Read-only Milestone 1" in source
    assert "local fixture/manual data only" in source
    assert "No integrations connected" in source
    assert "Manual placeholder" in source
    assert "Fixture data" in source
    assert "No CRM, email, or analytics integration connected" in source

    assert "fetch(" not in source
    assert "api." not in source
    assert "useEffect" not in source
    assert "window.open" not in source
    assert "<button" not in source
