import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  HardDrive,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { api } from "@/lib/api";
import type { KnowledgeBaseEntryDetail, KnowledgeBaseEntrySummary, KnowledgeBaseSummary, KnowledgeBaseTreeNode } from "@/lib/api";
import { useModalBehavior } from "@/hooks/useModalBehavior";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "amber" | "violet";

const TONES: Record<Tone, { card: string; glow: string; text: string; accent: string; tab: string }> = {
  amber: {
    card: "from-amber-300/24 via-orange-500/12 to-yellow-500/8 border-amber-200/20",
    glow: "bg-amber-200/20 text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.38)]",
    text: "text-amber-100",
    accent: "text-amber-200",
    tab: "border-amber-300/40 text-amber-100",
  },
  cyan: {
    card: "from-cyan-300/26 via-sky-500/12 to-teal-500/8 border-cyan-200/20",
    glow: "bg-cyan-200/20 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.38)]",
    text: "text-cyan-100",
    accent: "text-cyan-200",
    tab: "border-cyan-300/40 text-cyan-100",
  },
  violet: {
    card: "from-violet-300/24 via-purple-500/12 to-fuchsia-500/8 border-violet-200/20",
    glow: "bg-violet-200/20 text-violet-100 shadow-[0_0_34px_rgba(168,85,247,0.38)]",
    text: "text-violet-100",
    accent: "text-violet-200",
    tab: "border-violet-300/40 text-violet-100",
  },
};

const TONE_BY_SLUG: Record<string, Tone> = {
  "juror-research": "cyan",
  "hermes-research": "violet",
  "hermes-marketing": "amber",
};

function KnowledgeBaseCard({ base, onOpen }: { base: KnowledgeBaseSummary; onOpen: () => void }) {
  const tone = TONES[TONE_BY_SLUG[base.slug] ?? "cyan"];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open knowledge base: ${base.title}`}
      className="group relative overflow-hidden border border-border/70 bg-background-base/72 text-left shadow-2xl shadow-black/20 transition-all duration-200 hover:-translate-y-1 hover:border-border/90 hover:shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/70"
    >
      <div className={cn("relative overflow-hidden border-b bg-gradient-to-br p-5", tone.card)}>
        <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-current/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-2 font-mono-ui text-[10px] tracking-[0.2em] text-current/60 uppercase">{base.kicker}</p>
            <h2 className={cn("font-expanded text-2xl font-black uppercase leading-none tracking-[0.08em]", tone.text)}>{base.title}</h2>
          </div>
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl border border-current/20 bg-black/28", tone.glow)}>
            <BookOpen className="size-5" />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm leading-6 text-text-secondary">{base.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/60 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">
            {base.entry_count} files
          </span>
          <span className="rounded-full border border-border/60 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">
            {base.folder_count} folders
          </span>
          <span className="ml-auto text-xs font-black text-text-tertiary transition-colors group-hover:text-foreground">
            Open <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function folderPathFromRelativePath(relativePath: string) {
  return relativePath.split("/").slice(1).join("/");
}

function collectFolderPaths(node: KnowledgeBaseTreeNode): string[] {
  if (node.type === "file") return [];
  return [node.relative_path, ...node.children.flatMap((child) => collectFolderPaths(child))];
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FileTree({
  node,
  depth = 0,
  expandedFolders,
  selectedFolder,
  onToggleFolder,
  onSelectFolder,
  onOpenEntry,
}: {
  node: KnowledgeBaseTreeNode;
  depth?: number;
  expandedFolders: Set<string>;
  selectedFolder: string;
  onToggleFolder: (path: string) => void;
  onSelectFolder: (path: string) => void;
  onOpenEntry: (entry: KnowledgeBaseEntrySummary) => void;
}) {
  if (node.type === "file") {
    return (
      <button
        type="button"
        onClick={() => onOpenEntry(node.entry)}
        className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-midground/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-midground/60"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <FileText className="size-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-midground" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">{node.entry.title}</div>
        </div>
        <span className="rounded-full border border-border/50 bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-text-tertiary transition-colors group-hover:border-midground/40 group-hover:text-foreground">
          Open
        </span>
      </button>
    );
  }

  const isRoot = depth === 0;
  const folderPath = folderPathFromRelativePath(node.relative_path);
  const isExpanded = isRoot || expandedFolders.has(node.relative_path);
  const isSelected = Boolean(folderPath) && selectedFolder === folderPath;

  return (
    <div className={isRoot ? "" : "border-b border-border/40 last:border-b-0"}>
      {!isRoot ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => {
            onSelectFolder(folderPath);
            onToggleFolder(node.relative_path);
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-midground/8 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-midground/60",
            isSelected ? "bg-midground/10" : "",
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <ChevronRight
            className={cn("size-3 shrink-0 text-text-tertiary transition-transform duration-150", isExpanded ? "rotate-90" : "")}
          />
          {isExpanded ? (
            <FolderOpen className={cn("size-3.5 shrink-0", isSelected ? "text-midground" : "text-text-tertiary")} />
          ) : (
            <FolderClosed className={cn("size-3.5 shrink-0", isSelected ? "text-midground" : "text-text-tertiary")} />
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-[0.12em]",
              isSelected ? "text-foreground" : "text-text-secondary",
            )}
          >
            {node.name}
          </span>
          {isSelected && <div className="size-1.5 shrink-0 rounded-full bg-midground/60" />}
        </button>
      ) : null}
      {isExpanded ? (
        node.children.length ? (
          node.children.map((child) => (
            <FileTree
              key={child.relative_path}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              selectedFolder={selectedFolder}
              onToggleFolder={onToggleFolder}
              onSelectFolder={onSelectFolder}
              onOpenEntry={onOpenEntry}
            />
          ))
        ) : !isRoot ? (
          <div
            className="py-3 text-xs italic text-text-tertiary/60"
            style={{ paddingLeft: `${44 + depth * 16}px` }}
          >
            Empty
          </div>
        ) : null
      ) : null}
    </div>
  );
}

type RightTab = "research" | "add";

export default function KnowledgeBasePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<KnowledgeBaseSummary[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("research-briefs");
  const [body, setBody] = useState("");
  const [researchSubject, setResearchSubject] = useState("");
  const [researchInstructions, setResearchInstructions] = useState("");
  const [launchingResearch, setLaunchingResearch] = useState(false);
  const [researchStatus, setResearchStatus] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("research");
  const [creatingBase, setCreatingBase] = useState(false);
  const [newBaseTitle, setNewBaseTitle] = useState("");
  const [newBaseSlug, setNewBaseSlug] = useState("");
  const [newBaseDescription, setNewBaseDescription] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeBaseEntrySummary | null>(null);
  const [entryDetail, setEntryDetail] = useState<KnowledgeBaseEntryDetail | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState("");

  const active = useMemo(() => data.find((base) => base.slug === activeSlug) ?? null, [data, activeSlug]);
  const tone = TONES[TONE_BY_SLUG[active?.slug ?? ""] ?? "cyan"];
  const closeEntryModal = useCallback(() => {
    setSelectedEntry(null);
    setEntryDetail(null);
    setEntryError("");
  }, []);
  const entryModalRef = useModalBehavior({ open: selectedEntry !== null, onClose: closeEntryModal });

  const refresh = async () => {
    setError("");
    const response = await api.getKnowledgeBases();
    setData(response.bases);
  };

  useEffect(() => {
    void refresh()
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active?.tree) return;
    setExpandedFolders(new Set(collectFolderPaths(active.tree).filter((path) => path !== active.tree.relative_path)));
    setFolder("research-briefs");
    setResearchStatus("");
  }, [active?.slug]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectFolder = (path: string) => {
    if (path) setFolder(path);
  };

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    setError("");
    try {
      await api.createKnowledgeBaseEntry(active.slug, {
        title,
        body,
        folder,
        source: "Knowledge Base dashboard tab",
      });
      setTitle("");
      setBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStartResearch = async () => {
    if (!active) return;
    setLaunchingResearch(true);
    setError("");
    setResearchStatus("");
    try {
      const result = await api.startKnowledgeBaseResearchJob(active.slug, {
        subject: researchSubject,
        instructions: researchInstructions,
        folder_hint: folder,
      });
      setResearchStatus(`${result.message} Profile: ${result.profile}.`);
      setResearchSubject("");
      setResearchInstructions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunchingResearch(false);
    }
  };

  const handleCreateBase = async () => {
    setCreatingBase(true);
    setError("");
    try {
      const result = await api.createKnowledgeBase({
        title: newBaseTitle,
        slug: newBaseSlug,
        description: newBaseDescription,
      });
      setNewBaseTitle("");
      setNewBaseSlug("");
      setNewBaseDescription("");
      await refresh();
      setActiveSlug(result.base.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingBase(false);
    }
  };

  const handleOpenEntry = async (entry: KnowledgeBaseEntrySummary) => {
    if (!active) return;
    setSelectedEntry(entry);
    setEntryDetail(null);
    setEntryError("");
    setEntryLoading(true);
    try {
      const detail = await api.getKnowledgeBaseEntry(active.slug, entry.relative_path);
      setEntryDetail(detail.entry);
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : String(err));
    } finally {
      setEntryLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {active ? (
          <>
            <button
              type="button"
              onClick={() => setActiveSlug(null)}
              aria-label="Back to knowledge bases"
              className="flex items-center gap-1.5 text-text-tertiary transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              <span className="text-xs font-black uppercase tracking-[0.14em]">Knowledge Base</span>
            </button>
            <ChevronRight className="size-3.5 text-border/60" />
            <span className={cn("text-xs font-black uppercase tracking-[0.14em]", tone.accent)}>{active.title}</span>
          </>
        ) : (
          <div>
            <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">
              Knowledge Base
            </h1>
            <p className="mt-2 text-sm text-text-secondary">Organized Markdown files for research handoff and reusable notes.</p>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      {active ? (
        /* Detail view */
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          {/* Left: file tree */}
          <div className="flex flex-col gap-0 overflow-hidden border border-border/60 bg-card/72 shadow-2xl shadow-black/15">
            {/* KB identity strip */}
            <div className={cn("flex items-center gap-3 border-b bg-gradient-to-r p-4", tone.card)}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border border-current/20 bg-black/28", tone.glow)}>
                <BookOpen className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-mono-ui text-[9px] tracking-[0.2em] uppercase text-current/60">{active.kicker}</p>
                <h2 className={cn("truncate font-expanded text-lg font-black uppercase leading-tight tracking-[0.07em]", tone.text)}>
                  {active.title}
                </h2>
              </div>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1 text-[10px] text-current/50">
                <span>{active.entry_count} files</span>
                <span>{active.folder_count} folders</span>
              </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-auto" aria-label="Folder tree">
              <FileTree
                node={active.tree}
                expandedFolders={expandedFolders}
                selectedFolder={folder}
                onToggleFolder={toggleFolder}
                onSelectFolder={selectFolder}
                onOpenEntry={handleOpenEntry}
              />
            </div>
          </div>

          {/* Right: tabbed actions */}
          <div className="flex flex-col overflow-hidden border border-border/60 bg-card/72 shadow-2xl shadow-black/15">
            {/* Tab bar */}
            <div className="flex border-b border-border/60">
              <button
                type="button"
                onClick={() => setRightTab("research")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 border-r border-border/60 py-3.5 text-xs font-black uppercase tracking-[0.14em] transition-colors",
                  rightTab === "research"
                    ? "bg-midground/8 text-foreground"
                    : "text-text-tertiary hover:bg-midground/5 hover:text-text-secondary",
                )}
              >
                <Search className="size-3.5" />
                Research
              </button>
              <button
                type="button"
                onClick={() => setRightTab("add")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 py-3.5 text-xs font-black uppercase tracking-[0.14em] transition-colors",
                  rightTab === "add"
                    ? "bg-midground/8 text-foreground"
                    : "text-text-tertiary hover:bg-midground/5 hover:text-text-secondary",
                )}
              >
                <Plus className="size-3.5" />
                Add Note
              </button>
            </div>

            {/* Tab content */}
            <div className="flex flex-1 flex-col gap-4 p-5">
              {rightTab === "research" ? (
                <>
                  <div>
                    <h3 className="font-expanded text-base font-black uppercase tracking-[0.07em] text-foreground">
                      Research {active.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      A background agent will research the subject and write Markdown directly into this knowledge base.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <input
                      value={researchSubject}
                      onChange={(e) => setResearchSubject(e.target.value)}
                      placeholder="What should the agent research?"
                      className="w-full border border-border/60 bg-background-base/70 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <textarea
                      value={researchInstructions}
                      onChange={(e) => setResearchInstructions(e.target.value)}
                      placeholder="Optional: sources to check, questions to answer, depth, constraints…"
                      rows={5}
                      className="w-full resize-none border border-border/60 bg-background-base/70 px-3.5 py-2.5 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <div className="flex select-none items-center gap-2 border border-border/60 bg-background-base/60 px-3 py-2 text-xs text-text-secondary">
                      <FolderClosed className="size-3 shrink-0 text-text-tertiary" />
                      <span className="text-text-tertiary">Folder hint:</span>
                      <code className="ml-1 rounded border border-border/60 bg-card/80 px-2 py-0.5 font-mono text-midground shadow-inner shadow-black/20">
                        {folder || "agent decides"}
                      </code>
                    </div>
                    <Button
                      onClick={handleStartResearch}
                      disabled={launchingResearch || !researchSubject.trim()}
                      className="w-full justify-center gap-2"
                    >
                      {launchingResearch ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {launchingResearch ? "Starting…" : "Start research job"}
                    </Button>
                    {researchStatus ? (
                      <div className="flex items-start gap-2.5 border border-emerald-300/25 bg-emerald-500/10 px-3.5 py-3 text-xs leading-5 text-emerald-100">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                        {researchStatus}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-expanded text-base font-black uppercase tracking-[0.07em] text-foreground">
                      Add to {active.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      Write a Markdown note and save it directly into this knowledge base.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Note title"
                      className="w-full border border-border/60 bg-background-base/70 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <input
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder="Folder path (e.g. research-briefs)"
                      className="w-full border border-border/60 bg-background-base/70 px-3.5 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Markdown body…"
                      rows={9}
                      className="w-full resize-none border border-border/60 bg-background-base/70 px-3.5 py-2.5 font-mono text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <Button
                      onClick={handleSave}
                      disabled={saving || !title.trim() || !body.trim()}
                      className="w-full justify-center gap-2"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                      {saving ? "Saving…" : "Save Markdown note"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden border border-dashed border-border/70 bg-background-base/60 p-5 shadow-2xl shadow-black/15">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-[0.2em] text-text-tertiary">New workspace</p>
                <h2 className="font-expanded text-xl font-black uppercase leading-tight tracking-[0.08em] text-foreground">
                  Create knowledge base
                </h2>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border/60 bg-black/24 text-text-secondary">
                <Plus className="size-5" />
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <input
                value={newBaseTitle}
                onChange={(e) => setNewBaseTitle(e.target.value)}
                placeholder="Name, e.g. Client Intake Research"
                className="w-full border border-border/60 bg-background-base/70 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
              />
              <input
                value={newBaseSlug}
                onChange={(e) => setNewBaseSlug(e.target.value)}
                placeholder="Optional slug"
                className="w-full border border-border/60 bg-background-base/70 px-3.5 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
              />
              <textarea
                value={newBaseDescription}
                onChange={(e) => setNewBaseDescription(e.target.value)}
                placeholder="Optional description for the card"
                rows={3}
                className="w-full resize-none border border-border/60 bg-background-base/70 px-3.5 py-2.5 text-sm leading-5 text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
              />
              <Button
                onClick={handleCreateBase}
                disabled={creatingBase || !newBaseTitle.trim()}
                className="w-full justify-center gap-2"
              >
                {creatingBase ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {creatingBase ? "Creating…" : "Create knowledge base"}
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 border border-border/60 bg-card/70 p-5 text-sm text-text-secondary">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            data.map((base) => (
              <KnowledgeBaseCard key={base.slug} base={base} onOpen={() => setActiveSlug(base.slug)} />
            ))
          )}
        </section>
      )}

      {selectedEntry ? (
        <div
          ref={entryModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && closeEntryModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="knowledge-entry-title"
        >
          <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden border border-border/70 bg-card shadow-2xl shadow-black/45">
            <button
              type="button"
              onClick={closeEntryModal}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-border/60 bg-background-base/80 text-text-tertiary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/60"
              aria-label="Close knowledge entry"
            >
              <X className="size-4" />
            </button>

            <header className={cn("border-b bg-gradient-to-r p-5 pr-14", tone.card)}>
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-current/60">Markdown entry</p>
              <h2 id="knowledge-entry-title" className={cn("mt-2 font-expanded text-2xl font-black uppercase leading-tight tracking-[0.07em]", tone.text)}>
                {entryDetail?.title ?? selectedEntry.title}
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-current/60">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-black/20 px-2.5 py-1">
                  <FolderClosed className="size-3" />
                  {(entryDetail ?? selectedEntry).folder_path || "root"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-black/20 px-2.5 py-1">
                  <CalendarDays className="size-3" />
                  {formatUpdatedAt((entryDetail ?? selectedEntry).updated_at)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-black/20 px-2.5 py-1">
                  <HardDrive className="size-3" />
                  {formatBytes((entryDetail ?? selectedEntry).size_bytes)}
                </span>
              </div>
            </header>

            <div className="flex-1 overflow-auto p-5">
              {entryLoading ? (
                <div className="flex items-center gap-2 border border-border/60 bg-background-base/60 p-4 text-sm text-text-secondary">
                  <Loader2 className="size-4 animate-spin" /> Loading note…
                </div>
              ) : entryError ? (
                <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{entryError}</div>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded border border-border/60 bg-background-base/60 px-3 py-2 font-mono text-[11px] text-text-tertiary">
                    {(entryDetail ?? selectedEntry).relative_path}
                  </div>
                  {entryDetail?.content ? (
                    <pre className="max-h-[48vh] overflow-auto whitespace-pre-wrap border border-border/60 bg-background-base/70 p-4 font-mono text-xs leading-6 text-text-secondary">
                      {entryDetail.content}
                    </pre>
                  ) : selectedEntry.excerpt ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">{selectedEntry.excerpt}</p>
                  ) : (
                    <p className="text-sm italic text-text-tertiary">No preview available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
