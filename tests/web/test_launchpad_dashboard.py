from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_launchpad_cards_keep_title_and_card_heights_aligned():
    source = read("web/src/pages/LaunchpadPage.tsx")

    assert "min-h-[23rem]" in source
    assert "h-[7.75rem]" in source
    assert "min-h-[3.35rem]" in source
    assert "leading-[1.1]" in source


def test_launchpad_header_and_action_buttons_match_requested_polish():
    source = read("web/src/pages/LaunchpadPage.tsx")

    assert "Fixed local commands only" not in source
    assert "ShieldCheck" not in source
    assert "bg-slate-950/72" not in source
    assert "Project launchpad" not in source
    assert "Start local projects" not in source
    assert "Each square starts the project" not in source
    assert "border border-border/70 bg-card/72" not in source
    assert "Play" in source
    assert "Stop" in source
    assert "aria-label={running ? `Stop ${project.title}` : `Play ${project.title}`}" in source
    assert "text-success" in source
    assert "text-destructive" in source
    assert "text-rose-100" not in source
    assert "from-fuchsia" not in source
    assert "from-lime" not in source
    assert "bottom-3 right-4" in source
    assert "size-8" in source
    assert "pr-12 pt-4" in source
    assert "Pause" not in source
    assert "Stopping…" not in source
    assert "  Square," in source
    assert "Mission Control Launchpad" in source


def test_launchpad_has_open_webui_card_without_moving_juror_research_to_its_port():
    source = read("web/src/pages/LaunchpadPage.tsx")

    assert 'fallbackUrl: "http://127.0.0.1:3010"' in source
    assert '"localhost:3010"' in source
    assert 'id: "open-webui"' in source
    assert 'fallbackUrl: "http://127.0.0.1:3000"' in source
    juror_block = source[source.index('id: "juror-research"') : source.index('id: "agent-arena"')]
    assert "localhost:3000" not in juror_block
