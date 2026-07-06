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
    mission_source = read("web/src/pages/MissionControlPage.tsx")
    api_source = read("web/src/lib/api.ts")

    assert "Knowledge Base" in source
    assert "MISSION_CONTROL_FINAL_OUTPUT_SEEN_KEY" in mission_source
    assert "KB added" in mission_source
    assert "finalOutput?.latest_base" in mission_source
    assert "markFinalOutputSeen" in mission_source
    assert '`/knowledge-base?base=${encodeURIComponent(latestKb.slug)}`' in mission_source
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
    assert "Start new research card" in source
    assert "File into existing bucket" in source
    assert "use_existing_base: researchUseExistingBase" in source
    assert "api.startKnowledgeBaseResearchJob" in source
    assert "handleStartResearch" in source
    assert "Folder hint:" in source
    assert "folder" in source
    assert "api.getKnowledgeBases" in source
    assert "api.createKnowledgeBase" in source
    assert "api.getKnowledgeBaseEntry" in source
    assert "api.createKnowledgeBaseEntry" in source
    assert "api.deleteKnowledgeBaseEntry" in source
    assert "Delete knowledge file" in source
    assert "Delete knowledge folder" in source
    assert "Delete knowledge base card" in source
    assert "api.deleteKnowledgeBase(deleteTarget.slug)" in source
    assert "base.deletable ?" in source
    assert "setExpandedFolders(new Set())" in source
    assert "This removes the entire custom Knowledge Base card" in source
    assert "This removes the" in source
    assert "Create knowledge base" in source
    assert "New workspace" in source
    list_view_source = source[source.index("/* List view */") : source.index("{loading ?")]
    assert "baseSummary" not in source
    assert ">Bases<" not in list_view_source
    assert ">Files<" not in list_view_source
    assert ">Folders<" not in list_view_source
    assert ">Custom<" not in list_view_source
    assert 'fetchJSON<KnowledgeBasesResponse>("/api/knowledge-bases")' in api_source
    assert "createKnowledgeBase" in api_source
    assert "deleteKnowledgeBase" in api_source
    assert "deleteKnowledgeBaseEntry" in api_source
    assert "KnowledgeBaseCreateResponse" in api_source
    assert "startKnowledgeBaseResearchJob" in api_source
    assert "KnowledgeBaseResearchJobResponse" in api_source
    assert "use_existing_base?: boolean" in api_source
    assert "created_base?: KnowledgeBaseSummary | null" in api_source
    assert 'research-jobs' in api_source
    assert 'storage: "markdown"' in api_source
    assert "KnowledgeBaseTreeNode" in api_source
    assert "folder_count" in api_source
    assert "folder?: string" in api_source


def test_knowledge_base_markdown_entry_modal_is_large_and_resizable():
    source = read("web/src/pages/KnowledgeBasePage.tsx")
    modal_source = source[source.index("selectedEntry ?") : source.index("</main>")]

    assert "lg:pl-72" in modal_source
    assert "w-full" in modal_source
    assert "h-[92vh]" in modal_source
    assert "max-w-[96rem]" in modal_source
    assert "resize flex-col" in modal_source
    assert "min-h-0 flex-1 overflow-auto" in modal_source
    assert "max-w-3xl" not in modal_source
    assert "max-h-[48vh]" not in modal_source


def test_research_workspace_links_to_knowledge_base_handoff():
    source = read("web/src/pages/ResearchPage.tsx")

    assert "Knowledge handoff" in source
    assert "Feed verified research into the Knowledge Base" in source
    assert 'href="/knowledge-base"' in source
