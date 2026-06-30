from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_knowledge_base_route_nav_title_and_i18n_are_wired():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    en_source = read("web/src/i18n/en.ts")
    types_source = read("web/src/i18n/types.ts")

    assert 'import KnowledgeBasePage from "@/pages/KnowledgeBasePage";' in app_source
    assert '"/knowledge-base": KnowledgeBasePage' in app_source
    assert 'path: "/knowledge-base"' in app_source
    assert 'labelKey: "knowledgeBase"' in app_source
    assert 'label: "Knowledge Base"' in app_source
    assert '"/knowledge-base": "knowledgeBase"' in title_source
    assert 'knowledgeBase: "Knowledge Base"' in title_source
    assert 'knowledgeBase: "Knowledge Base"' in en_source
    assert 'knowledgeBase?: string' in types_source


def test_knowledge_base_page_is_markdown_first_and_seeded_with_research_bases():
    source = read("web/src/pages/KnowledgeBasePage.tsx")
    api_source = read("web/src/lib/api.ts")

    assert "Knowledge Base" in source
    for slug in ["juror-research", "hermes-research", "hermes-marketing"]:
        assert slug in source or slug in api_source
    assert "Open knowledge base" in source
    assert "Folder tree" in source
    assert "Back to knowledge bases" in source
    assert "Organized Markdown files" in source
    assert "aria-expanded={isExpanded}" in source
    assert "onToggleFolder(node.relative_path)" in source
    assert "onSelectFolder(folderPath)" in source
    assert "setExpandedFolders" in source
    assert "selected" in source
    assert "Save Markdown note" in source
    assert "Start research job" in source
    assert "api.startKnowledgeBaseResearchJob" in source
    assert "handleStartResearch" in source
    assert "Folder hint:" in source
    assert "folder" in source
    assert "api.getKnowledgeBases" in source
    assert "api.createKnowledgeBase" in source
    assert "api.createKnowledgeBaseEntry" in source
    assert "Create knowledge base" in source
    assert "New workspace" in source
    assert 'fetchJSON<KnowledgeBasesResponse>("/api/knowledge-bases")' in api_source
    assert "createKnowledgeBase" in api_source
    assert "KnowledgeBaseCreateResponse" in api_source
    assert "startKnowledgeBaseResearchJob" in api_source
    assert "KnowledgeBaseResearchJobResponse" in api_source
    assert 'research-jobs' in api_source
    assert 'storage: "markdown"' in api_source
    assert "KnowledgeBaseTreeNode" in api_source
    assert "folder_count" in api_source
    assert "folder?: string" in api_source


def test_research_workspace_links_to_knowledge_base_handoff():
    source = read("web/src/pages/ResearchPage.tsx")

    assert "Knowledge handoff" in source
    assert "Feed verified research into the Knowledge Base" in source
    assert 'href="/knowledge-base"' in source
