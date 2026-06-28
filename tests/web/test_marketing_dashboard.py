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


def test_marketing_page_is_read_only_workspace_with_live_team_panel():
    source = read("web/src/pages/MarketingPage.tsx")

    for section in ["Strategy", "Campaigns", "Content Pipeline", "Assets", "Metrics"]:
        assert section in source

    assert "Marketing project launchpad" in source
    assert "MARKETING_PROJECTS" in source
    assert "ProjectSquare" in source
    assert "Marketing portal" in source
    assert "Marketing project launchpad" in source
    assert "Portal sections" in source
    assert "Interactive portal view" in source
    assert "Read-only Milestone 1" in source
    assert "local fixture/manual data only" in source
    assert "No integrations connected" in source
    assert "Manual placeholder" in source
    assert "Fixture data" in source
    assert "No CRM, email, or analytics integration connected" in source
    assert "MarketingAgentTeamPanel" in source

    assert "fetch(" not in source
    assert "window.open" not in source


def test_marketing_agent_team_panel_uses_mission_control_profile_teams():
    source = read("web/src/pages/MarketingPage.tsx")

    assert 'import { api } from "@/lib/api";' in source
    assert "api.getMissionControlActivity" in source
    assert "useEffect" in source
    assert "profile_teams" in source
    assert '"hermes-marketing"' in source
    assert '"hermes-marketing-dev"' in source
    assert "Project path:" in source
    assert "Configured {configuredCount} / {team.agents.length}" in source
    assert "Active {activeCount}" in source
    assert "Status: {statusLabel}" in source
    assert "Launch chat" in source
    assert 'to={`/chat?profile=${encodeURIComponent(agent.profile)}`}' in source
    assert "Configure profile before launch" in source
    assert "Refresh" in source
    assert "MARKETING_TEAM_POLL_MS = 15_000" in source

    assert "fetch(" not in source
    assert "window.open" not in source


def test_marketing_launchpad_cards_are_projects_that_open_in_place_portal():
    source = read("web/src/pages/MarketingPage.tsx")

    for project_id in ["savant-ai-systems", "hermes-marketing", "automation-case-studies", "home-hub-systems"]:
        assert f'id: "{project_id}"' in source

    for project_title in ["Savant AI Systems", "Hermes Marketing", "Automation Case Studies", "Home Hub Systems"]:
        assert project_title in source

    for component in [
        "StrategyWorkspace",
        "CampaignsWorkspace",
        "ContentWorkspace",
        "AssetsWorkspace",
        "MetricsWorkspace",
    ]:
        assert component in source

    assert 'const [selectedProject, setSelectedProject] = useState<MarketingProjectId>("savant-ai-systems");' in source
    assert "<MarketingPortal key={selected.id} project={selected} />" in source
    assert "Select a project square above to launch that project's marketing portal in-place below" in source


def test_marketing_portal_has_interactive_section_picker():
    source = read("web/src/pages/MarketingPage.tsx")

    assert "PORTAL_SECTIONS" in source
    assert 'const [activeSection, setActiveSection] = useState<PortalSectionId>("strategy");' in source
    assert "<PortalPanel sectionId={activeSection} />" in source
    assert "aria-pressed={active}" in source
    assert "onClick={() => setActiveSection(section.id)}" in source

    for section_id in ["strategy", "campaigns", "content", "assets", "metrics"]:
        assert f'id: "{section_id}"' in source
