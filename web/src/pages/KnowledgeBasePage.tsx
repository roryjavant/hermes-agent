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
  Trash2,
  X,
} from "lucide-react";
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

function latestEntry(base: KnowledgeBaseSummary): KnowledgeBaseEntrySummary | null {
  if (!base.entries.length) return null;
  return [...base.entries].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null;
}

function KnowledgeBaseRow({
  base,
  onOpen,
  onRequestDelete,
}: {
  base: KnowledgeBaseSummary;
  onOpen: () => void;
  onRequestDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const tone = TONES[TONE_BY_SLUG[base.slug] ?? "cyan"];
  const latest = latestEntry(base);
  return (
    <div className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-white/[0.03] sm:px-4">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open knowledge base: ${base.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/60"
      >
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-black/25", tone.text)}>
          <BookOpen className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-foreground">{base.title}</span>
          <span className="mt-0.5 block truncate text-xs text-text-tertiary">{base.description || base.kicker}</span>
        </span>
      </button>
      <div className="hidden shrink-0 text-right font-mono-ui text-[0.68rem] leading-5 text-text-tertiary md:block" title={base.path}>
        <div>{base.entry_count} files · {base.folder_count} folders</div>
        <div className="flex items-center justify-end gap-1.5 text-text-tertiary/70">
          <CalendarDays className="size-3 shrink-0" />
          {latest ? formatUpdatedAt(latest.updated_at) : "—"}
        </div>
      </div>
      {base.deletable ? (
        <button
          type="button"
          onClick={() => onRequestDelete({ path: base.path, slug: base.slug, label: base.title, kind: "base" })}
          aria-label={`Delete knowledge base card: ${base.title}`}
          title={`Delete ${base.title}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-text-tertiary opacity-0 transition-opacity hover:bg-white/8 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-text-tertiary/40 transition-colors group-hover:text-midground" aria-hidden="true" />
    </div>
  );
}

function folderPathFromRelativePath(relativePath: string) {
  return relativePath.split("/").slice(1).join("/");
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
  onRequestDelete,
}: {
  node: KnowledgeBaseTreeNode;
  depth?: number;
  expandedFolders: Set<string>;
  selectedFolder: string;
  onToggleFolder: (path: string) => void;
  onSelectFolder: (path: string) => void;
  onOpenEntry: (entry: KnowledgeBaseEntrySummary) => void;
  onRequestDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  if (node.type === "file") {
    return (
      <div
        className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <FileText className="size-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-midground" />
        <button
          type="button"
          onClick={() => onOpenEntry(node.entry)}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/60"
        >
          {node.entry.title}
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete({ path: node.entry.relative_path, label: node.entry.title, kind: "file" })}
          aria-label={`Delete knowledge file: ${node.entry.title}`}
          className="grid size-6 shrink-0 place-items-center rounded-md text-text-tertiary opacity-0 transition-opacity hover:bg-white/8 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    );
  }

  const isRoot = depth === 0;
  const folderPath = folderPathFromRelativePath(node.relative_path);
  const isExpanded = isRoot || expandedFolders.has(node.relative_path);
  const isSelected = Boolean(folderPath) && selectedFolder === folderPath;

  return (
    <div>
      {!isRoot ? (
        <div
          className={cn(
            "group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]",
            isSelected ? "bg-midground/10" : "",
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => {
              onSelectFolder(folderPath);
              onToggleFolder(node.relative_path);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/60"
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
          </button>
          {isSelected && <div className="size-1.5 shrink-0 rounded-full bg-midground/60" />}
          <button
            type="button"
            onClick={() => onRequestDelete({ path: node.relative_path, label: node.name, kind: "folder" })}
            aria-label={`Delete knowledge folder: ${node.name}`}
            className="grid size-6 shrink-0 place-items-center rounded-md text-text-tertiary opacity-0 transition-opacity hover:bg-white/8 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
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
              onRequestDelete={onRequestDelete}
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
type DeleteTarget =
  | { path: string; slug: string; label: string; kind: "base" }
  | { path: string; label: string; kind: "file" | "folder" }
  | null;

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
  const [researchUseExistingBase, setResearchUseExistingBase] = useState(false);
  const [launchingResearch, setLaunchingResearch] = useState(false);
  const [researchStatus, setResearchStatus] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("research");
  const [creatingBase, setCreatingBase] = useState(false);
  const [newBaseTitle, setNewBaseTitle] = useState("");
  const [newBaseSlug, setNewBaseSlug] = useState("");
  const [newBaseDescription, setNewBaseDescription] = useState("");
  const [baseQuery, setBaseQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeBaseEntrySummary | null>(null);
  const [entryDetail, setEntryDetail] = useState<KnowledgeBaseEntryDetail | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deletingPath, setDeletingPath] = useState("");

  const active = useMemo(() => data.find((base) => base.slug === activeSlug) ?? null, [data, activeSlug]);
  const visibleBases = useMemo(() => {
    const needle = baseQuery.trim().toLowerCase();
    const source = needle
      ? data.filter((base) =>
          `${base.title} ${base.kicker} ${base.description} ${base.path} ${base.slug}`.toLowerCase().includes(needle),
        )
      : data;
    return [...source].sort((a, b) => Number(a.deletable) - Number(b.deletable) || a.title.localeCompare(b.title));
  }, [baseQuery, data]);
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
    return response.bases;
  };

  useEffect(() => {
    void refresh()
      .then((bases) => {
        const params = new URLSearchParams(window.location.search);
        const requestedBase = params.get("base");
        if (requestedBase && bases.some((base) => base.slug === requestedBase)) {
          setActiveSlug(requestedBase);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active?.tree) return;
    setExpandedFolders(new Set());
    setFolder("research-briefs");
    setResearchStatus("");
    setResearchUseExistingBase(false);
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
        use_existing_base: researchUseExistingBase,
      });
      const destination = result.created_base?.title ?? active.title;
      setResearchStatus(`${result.message} Destination: ${destination}. Profile: ${result.profile}.`);
      setResearchSubject("");
      setResearchInstructions("");
      const bases = await refresh();
      if (result.created_base?.slug && bases.some((base) => base.slug === result.created_base?.slug)) {
        setActiveSlug(result.created_base.slug);
      }
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

  const handleDeleteTarget = async () => {
    if (!deleteTarget) return;
    setDeletingPath(deleteTarget.path);
    setError("");
    try {
      if (deleteTarget.kind === "base") {
        await api.deleteKnowledgeBase(deleteTarget.slug);
        if (activeSlug === deleteTarget.slug) setActiveSlug(null);
        setDeleteTarget(null);
        await refresh();
        return;
      }

      if (!active) return;
      const activeBase = active;
      await api.deleteKnowledgeBaseEntry(activeBase.slug, deleteTarget.path);
      if (selectedEntry?.relative_path === deleteTarget.path) closeEntryModal();
      if (folder && (folder === folderPathFromRelativePath(deleteTarget.path) || folder.startsWith(`${folderPathFromRelativePath(deleteTarget.path)}/`))) {
        setFolder("research-briefs");
      }
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingPath("");
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
            <h1 className="font-expanded text-2xl font-black uppercase tracking-[0.08em] text-foreground">
              Knowledge Base
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-text-secondary">Organized Markdown files for research handoff and reusable notes.</p>
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-xs leading-5 text-destructive">{error}</div>
      ) : null}

      {active ? (
        /* Detail view */
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          {/* Left: file tree */}
          <div className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-lg shadow-black/10">
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
                onRequestDelete={setDeleteTarget}
              />
            </div>
          </div>

          {/* Right: tabbed actions */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-lg shadow-black/10">
            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-border/40 px-2" role="tablist" aria-label="Knowledge base actions">
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "research"}
                onClick={() => setRightTab("research")}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-3 text-xs font-semibold transition-colors focus-visible:outline-none",
                  rightTab === "research" ? "text-foreground" : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                <Search className={cn("size-3.5", rightTab === "research" && "text-midground")} />
                Research
                {rightTab === "research" ? <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-midground" /> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "add"}
                onClick={() => setRightTab("add")}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-3 text-xs font-semibold transition-colors focus-visible:outline-none",
                  rightTab === "add" ? "text-foreground" : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                <Plus className={cn("size-3.5", rightTab === "add" && "text-midground")} />
                Add Note
              {rightTab === "add" ? <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-midground" /> : null}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex flex-1 flex-col gap-4 p-5">
              {rightTab === "research" ? (
                <>
                  <div>
                    <h3 className="font-expanded text-base font-black uppercase tracking-[0.07em] text-foreground">
                      Start new research card
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      By default this creates a new top-level Knowledge Base card for the subject. Choose the existing-bucket option only when you want to file into {active.title}.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <input
                      value={researchSubject}
                      onChange={(e) => setResearchSubject(e.target.value)}
                      placeholder="What should the agent research?"
                      className="w-full rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <textarea
                      value={researchInstructions}
                      onChange={(e) => setResearchInstructions(e.target.value)}
                      placeholder="Optional: sources to check, questions to answer, depth, constraints…"
                      rows={5}
                      className="w-full resize-none rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <div className="flex select-none items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-text-secondary">
                      <FolderClosed className="size-3 shrink-0 text-text-tertiary" />
                      <span className="text-text-tertiary">Folder hint:</span>
                      <code className="ml-1 rounded bg-black/30 px-2 py-0.5 font-mono text-midground">
                        {folder || "agent decides"}
                      </code>
                    </div>
                    <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg bg-black/20 px-3 py-3 text-xs leading-5 text-text-secondary transition-colors hover:bg-black/30">
                      <input
                        type="checkbox"
                        checked={researchUseExistingBase}
                        onChange={(event) => setResearchUseExistingBase(event.target.checked)}
                        className="mt-0.5 size-4 accent-midground"
                      />
                      <span>
                        <span className="block font-bold text-foreground">File into existing bucket</span>
                        <span className="block text-text-tertiary">
                          Off by default. Turn this on only when the result belongs inside {active.title} instead of becoming a new Knowledge Base card.
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={handleStartResearch}
                      disabled={launchingResearch || !researchSubject.trim()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-midground/14 px-4 py-2.5 text-xs font-semibold text-midground transition-colors hover:bg-midground/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {launchingResearch ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {launchingResearch ? "Starting…" : "Start research job"}
                    </button>
                    {researchStatus ? (
                      <div className="flex items-start gap-2.5 rounded-lg bg-emerald-500/10 px-3.5 py-3 text-xs leading-5 text-emerald-100">
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
                      className="w-full rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <input
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder="Folder path (e.g. research-briefs)"
                      className="w-full rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Markdown body…"
                      rows={9}
                      className="w-full resize-none rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 font-mono text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                    />
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !title.trim() || !body.trim()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-midground/14 px-4 py-2.5 text-xs font-semibold text-midground transition-colors hover:bg-midground/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                      {saving ? "Saving…" : "Save Markdown note"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <section className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-lg shadow-black/10">
            <div className="grid gap-3 p-4 lg:grid-cols-[minmax(11rem,0.7fr)_minmax(14rem,1fr)_minmax(16rem,1.35fr)_auto] lg:items-center">
              <div>
                <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-text-tertiary">New workspace</p>
                <h2 className="mt-1 text-sm font-bold text-foreground">
                  Create knowledge base
                </h2>
              </div>
              <input
                value={newBaseTitle}
                onChange={(e) => setNewBaseTitle(e.target.value)}
                placeholder="Name, e.g. Client Intake Research"
                className="w-full rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={newBaseSlug}
                  onChange={(e) => setNewBaseSlug(e.target.value)}
                  placeholder="Optional slug"
                  className="w-full rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                />
                <input
                  value={newBaseDescription}
                  onChange={(e) => setNewBaseDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-transparent bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-text-tertiary/60 focus:border-midground/50"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateBase}
                disabled={creatingBase || !newBaseTitle.trim()}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-midground/14 px-4 py-2.5 text-xs font-semibold text-midground transition-colors hover:bg-midground/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creatingBase ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {creatingBase ? "Creating…" : "Create"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-black/20 px-3.5 py-1">
            <Search className="size-4 shrink-0 text-text-tertiary" />
            <input
              value={baseQuery}
              onChange={(event) => setBaseQuery(event.target.value)}
              placeholder="Filter knowledge bases, paths, descriptions…"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-text-tertiary/70"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/60 p-10 text-xs text-text-tertiary">
              <Loader2 className="size-4 animate-spin" /> Loading knowledge bases…
            </div>
          ) : visibleBases.length > 0 ? (
            <section className="divide-y divide-border/30 overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-lg shadow-black/10">
              {visibleBases.map((base) => (
                <KnowledgeBaseRow
                  key={base.slug}
                  base={base}
                  onOpen={() => setActiveSlug(base.slug)}
                  onRequestDelete={setDeleteTarget}
                />
              ))}
            </section>
          ) : (
            <p className="rounded-2xl border border-border/50 bg-card/60 p-10 text-center text-xs text-text-tertiary">
              No knowledge bases matched.
            </p>
          )}
        </section>
      )}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="knowledge-delete-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-5 shadow-2xl shadow-black/45">
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-destructive/80">Delete {deleteTarget.kind}</p>
            <h2 id="knowledge-delete-title" className="mt-2 text-lg font-bold text-foreground">
              {deleteTarget.label}
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {deleteTarget.kind === "base"
                ? "This removes the entire custom Knowledge Base card and deletes its folder, including every Markdown file inside it. Built-in cards cannot be deleted."
                : `This removes the ${deleteTarget.kind === "folder" ? "folder and everything inside it" : "Markdown file"} from this Knowledge Base.`}
            </p>
            <div className="mt-3 break-all rounded-lg bg-black/25 px-3 py-2 font-mono text-[11px] text-text-tertiary">
              {deleteTarget.path}
            </div>
            <div className="mt-5 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingPath)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTarget}
                disabled={Boolean(deletingPath)}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive/15 px-3.5 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingPath ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {deletingPath ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEntry ? (
        <div
          ref={entryModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm lg:pl-72"
          onClick={(event) => event.target === event.currentTarget && closeEntryModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="knowledge-entry-title"
        >
          <div className="relative flex h-[92vh] min-h-[32rem] w-full min-w-0 max-w-[96rem] resize flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/45 sm:min-w-[44rem]">
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

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {entryLoading ? (
                <div className="flex items-center gap-2 border border-border/60 bg-background-base/60 p-4 text-sm text-text-secondary">
                  <Loader2 className="size-4 animate-spin" /> Loading note…
                </div>
              ) : entryError ? (
                <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{entryError}</div>
              ) : (
                <div className="grid min-h-full gap-4">
                  <div className="rounded-lg bg-black/25 px-3 py-2 font-mono text-[11px] text-text-tertiary">
                    {(entryDetail ?? selectedEntry).relative_path}
                  </div>
                  {entryDetail?.content ? (
                    <pre className="min-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-black/25 p-4 font-mono text-xs leading-6 text-text-secondary">
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
