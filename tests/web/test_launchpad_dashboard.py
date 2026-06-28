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
    assert "border border-border/70 bg-card/72" in source
    assert "Play" in source
    assert "Stop" in source
    assert "aria-label={running ? `Stop ${project.title}` : `Play ${project.title}`}" in source
    assert "text-success" in source
    assert "text-rose-100" in source
    assert "bottom-3 right-4" in source
    assert "size-8" in source
    assert "pr-12 pt-4" in source
    assert "Pause" not in source
    assert "Stopping…" not in source
    assert "  Square," in source
