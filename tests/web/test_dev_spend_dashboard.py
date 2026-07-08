from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_dev_spend_route_nav_title_i18n_and_api_are_wired():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    en_source = read("web/src/i18n/en.ts")
    types_source = read("web/src/i18n/types.ts")
    api_source = read("web/src/lib/api.ts")

    assert 'import DevSpendPage from "@/pages/DevSpendPage";' in app_source
    assert '"/dev-spend": DevSpendPage' in app_source
    assert 'path: "/dev-spend"' in app_source
    assert 'labelKey: "devSpend"' in app_source
    assert app_source.index('path: "/reminders"') < app_source.index('path: "/dev-spend"') < app_source.index('path: "/flow"')
    assert '"/dev-spend": "devSpend"' in title_source
    assert 'devSpend: "Dev Spend"' in title_source
    assert 'devSpend: "Dev Spend"' in en_source
    assert 'devSpend?: string' in types_source
    assert 'fetchJSON<DevSpendResponse>("/api/dev-spend"' in api_source
    assert 'createDevSpendItem' in api_source
    assert 'updateDevSpendItem' in api_source
    assert 'deleteDevSpendItem' in api_source


def test_dev_spend_page_tracks_subscription_categories_and_email_status():
    page_source = read("web/src/pages/DevSpendPage.tsx")
    server_source = read("hermes_cli/web_server.py")

    for vendor in ["OpenAI API", "Claude", "ElevenLabs", "Supabase", "AWS", "Gemini"]:
        assert vendor in server_source
    assert "roryjavant@gmail.com" in page_source or "roryjavant@gmail.com" in server_source
    assert "Monthly run rate" in page_source
    assert "Needs confirmation" in page_source
    assert "Subscription discovery sources" in page_source
    assert "email_scan_available" in page_source
    assert "monthlyEquivalent" in page_source
    assert "annual" in page_source
    assert "usage" in page_source
    assert "dashboard_dev_spend.json" in server_source
    assert "Gmail/IMAP credentials are not configured" in server_source
