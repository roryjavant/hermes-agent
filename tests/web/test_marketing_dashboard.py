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


def test_marketing_page_is_local_first_workspace():
    source = read("web/src/pages/MarketingPage.tsx")

    assert "Marketing workspace" in source
    assert "MARKETING_PROJECTS" in source
    assert "ProjectSwitcher" in source
    assert "SectionTabs" in source
    assert 'STORAGE_KEY = "hermes.marketing.workspace.v1"' in source
    assert "loadWorkspaces" in source
    assert "seedWorkspaces" in source
    assert "window.localStorage.setItem(STORAGE_KEY" in source
    assert "Local-only · saves in this browser" in source
    assert "No analytics, CRM, or publishing sources are connected" in source

    # Local-first: no direct network calls or external window control.
    assert "fetch(" not in source
    assert "window.open" not in source


def test_marketing_workspace_has_all_projects_and_sections():
    source = read("web/src/pages/MarketingPage.tsx")

    for project_id in ["savant-ai-systems", "hermes-marketing", "automation-case-studies", "home-hub-systems"]:
        assert f'id: "{project_id}"' in source

    for project_title in ["Savant AI Systems", "Hermes Marketing", "Automation Case Studies", "Home Hub Systems"]:
        assert project_title in source

    for section_id in ["pipeline", "campaigns", "strategy", "assets", "metrics"]:
        assert f'id: "{section_id}"' in source

    for component in [
        "PipelineSection",
        "CampaignsSection",
        "StrategySection",
        "AssetsSection",
        "MetricsSection",
        "NotesCard",
    ]:
        assert component in source

    assert 'const [selectedProject, setSelectedProject] = useState<MarketingProjectId>("savant-ai-systems");' in source
    assert 'const [activeSection, setActiveSection] = useState<SectionId>("pipeline");' in source


def test_marketing_pipeline_is_editable_and_persisted():
    source = read("web/src/pages/MarketingPage.tsx")

    for lane_id in ["idea", "draft", "review", "published"]:
        assert f'"{lane_id}"' in source

    assert "addPipelineCard" in source
    assert "movePipelineCard" in source
    assert "movePipelineCardToLane" in source
    assert "deletePipelineCard" in source

    # Cards are draggable between lanes, with button fallbacks for keyboard/touch.
    assert "draggable" in source
    assert "onDragStart" in source
    assert "onDrop" in source
    assert "onMoveToLane" in source
    assert "toggleCampaignAction" in source
    assert "addAsset" in source
    assert "deleteAsset" in source
    assert "setNotes" in source
    assert "updateWorkspace" in source
    assert "doneActions" in source
    assert "notesUpdatedAt" in source


def test_marketing_agent_team_panel_uses_mission_control_profile_teams():
    source = read("web/src/pages/MarketingPage.tsx")

    assert 'import { api } from "@/lib/api";' in source
    assert "api.getMissionControlActivity" in source
    assert "useEffect" in source
    assert "profile_teams" in source
    assert '"hermes-marketing"' in source
    assert '"hermes-marketing-dev"' in source
    assert "MARKETING_TEAM_POLL_MS = 15_000" in source
    assert "MarketingAgentTeamPanel" in source
    assert "MarketingAgentRow" in source
    assert 'to={`/chat?profile=${encodeURIComponent(agent.profile)}`}' in source
    assert "Launch chat" in source
    assert "Refresh" in source

    assert "fetch(" not in source
    assert "window.open" not in source
