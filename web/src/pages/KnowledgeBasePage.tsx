import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { api } from "@/lib/api";
import type { KnowledgeBaseSummary, KnowledgeBaseTreeNode } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "amber" | "violet";

const TONES: Record<Tone, { card: string; glow: string; text: string }> = {
  amber: {
    card: "from-amber-300/24 via-orange-500/12 to-yellow-500/8 border-amber-200/20",
    glow: "bg-amber-200/20 text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.38)]",
    text: "text-amber-100",
  },
  cyan: {
    card: "from-cyan-300/26 via-sky-500/12 to-teal-500/8 border-cyan-200/20",
    glow: "bg-cyan-200/20 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.38)]",
    text: "text-cyan-100",
  },
  violet: {
    card: "from-violet-300/24 via-purple-500/12 to-fuchsia-500/8 border-violet-200/20",
    glow: "bg-violet-200/20 text-violet-100 shadow-[0_0_34px_rgba(168,85,247,0.38)]",
    text: "text-violet-100",
  },
};

const TONE_BY_SLUG: Record<string, Tone> = {
  "juror-research": "cyan",
  "hermes-research": "violet",
  "hermes-marketing": "amber",
};

function KnowledgeBaseCard({ base, onOpen }: { base: KnowledgeBaseSummary; onOpen: () => void }) {
  const tone = TONES[TONE_BY_SLUG[base.slug] ?? "cyan"];
  const firstFolder = base.tree.type === "folder" ? base.tree.children.find((child) => child.type === "folder")?.name : undefined;
  return (
    <Card className="group overflow-hidden rounded-none border-border/70 bg-background-base/72 shadow-2xl shadow-black/20 transition-transform duration-150 hover:-translate-y-0.5">
      <CardContent className="flex h-full flex-col p-0">
        <button type="button" onClick={onOpen} className="flex min-h-[23rem] flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/70">
          <div className={cn("relative min-h-[7.3rem] overflow-hidden border-b bg-gradient-to-br p-4", tone.card)}>
            <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-current/10 blur-2xl transition-transform duration-300 group-hover:scale-125" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge className="mb-4 max-w-full rounded-none border-current/10 bg-black/26 px-2.5 py-1 font-mono-ui text-[10px] tracking-[0.18em] text-current">
                  {base.kicker}
                </Badge>
                <h2 className={cn("font-expanded text-2xl font-black uppercase leading-none tracking-[0.08em]", tone.text)}>{base.title}</h2>
              </div>
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl border border-current/20 bg-black/28", tone.glow)}>
                <BookOpen className="size-6" />
              </span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <p className="min-h-[4.75rem] text-sm leading-6 text-text-secondary">{base.description}</p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border/70 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">Markdown</span>
              <span className="rounded-full border border-border/70 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">{base.entry_count} files</span>
              <span className="rounded-full border border-border/70 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">{base.folder_count} folders</span>
              {firstFolder ? <span className="rounded-full border border-border/70 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">/{firstFolder}</span> : null}
            </div>
            <div className="mt-auto border border-border/50 bg-black/20 px-3 py-2 font-mono text-xs text-text-tertiary">{base.path}</div>
            <div className="flex items-center justify-between border-t border-border/55 pt-3 text-sm font-black text-foreground">
              <span>Open knowledge base</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function FileTree({ node, depth = 0 }: { node: KnowledgeBaseTreeNode; depth?: number }) {
  if (node.type === "file") {
    return (
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-border/45 px-3 py-3 last:border-b-0" style={{ paddingLeft: `${12 + depth * 18}px` }}>
        <FileText className="mt-0.5 size-4 text-midground" />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-foreground">{node.entry.title}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-text-tertiary">{node.entry.relative_path}</div>
          {node.entry.excerpt ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">{node.entry.excerpt}</p> : null}
        </div>
        <span className="rounded-full border border-border/60 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">.md</span>
      </div>
    );
  }

  return (
    <div className={depth === 0 ? "" : "border-b border-border/45 last:border-b-0"}>
      {depth > 0 ? (
        <div className="flex items-center gap-2 bg-black/16 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-text-secondary" style={{ paddingLeft: `${12 + depth * 18}px` }}>
          <ChevronRight className="size-3 text-text-tertiary" />
          <FolderOpen className="size-4 text-midground" />
          {node.name}
        </div>
      ) : null}
      {node.children.length ? (
        node.children.map((child) => <FileTree key={child.relative_path} node={child} depth={depth + 1} />)
      ) : depth > 0 ? (
        <div className="px-3 py-3 text-xs text-text-tertiary" style={{ paddingLeft: `${30 + depth * 18}px` }}>Empty folder</div>
      ) : null}
    </div>
  );
}

export default function KnowledgeBasePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<KnowledgeBaseSummary[]>([]);
  const [root, setRoot] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("research-briefs");
  const [body, setBody] = useState("");

  const active = useMemo(() => data.find((base) => base.slug === activeSlug) ?? null, [data, activeSlug]);

  const refresh = async () => {
    setError("");
    const response = await api.getKnowledgeBases();
    setData(response.bases);
    setRoot(response.root);
  };

  useEffect(() => {
    void refresh()
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-96 rounded-full bg-midground/12 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <h1 className="font-expanded text-4xl font-black uppercase tracking-[0.08em] text-foreground sm:text-5xl">Knowledge Base</h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Each square opens a Markdown-backed knowledge base. Inside, files can be organized by folders and used as the durable destination for research workspace outputs.
              </p>
            </div>
            <Badge className="w-fit rounded-full border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-emerald-200">
              Markdown files only
            </Badge>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}

      {active ? (
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-none border-border/70 bg-card/72 shadow-2xl shadow-black/15">
            <CardContent className="p-5">
              <button type="button" onClick={() => setActiveSlug(null)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-text-secondary hover:text-foreground">
                <ArrowLeft className="size-4" /> Back to knowledge bases
              </button>
              <div className="mb-5 border-b border-border/60 pb-5">
                <Badge className="mb-3 rounded-none border-midground/25 bg-midground/10 text-midground">{active.kicker}</Badge>
                <h2 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground">{active.title}</h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{active.description}</p>
                <div className="mt-4 grid gap-2 text-xs text-text-tertiary sm:grid-cols-3">
                  <span className="rounded-full border border-border/70 bg-black/20 px-3 py-1.5 font-black uppercase tracking-[0.14em]">{active.entry_count} markdown files</span>
                  <span className="rounded-full border border-border/70 bg-black/20 px-3 py-1.5 font-black uppercase tracking-[0.14em]">{active.folder_count} folders</span>
                  <span className="truncate rounded-full border border-border/70 bg-black/20 px-3 py-1.5 font-mono">{active.path}</span>
                </div>
              </div>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-midground/25 bg-midground/10 text-midground"><FolderOpen className="size-5" /></span>
                <div>
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-text-tertiary">Folder tree</div>
                  <h3 className="font-expanded text-lg font-black uppercase tracking-[0.08em] text-foreground">Organized Markdown files</h3>
                </div>
              </div>
              <div className="max-h-[34rem] overflow-auto border border-border/60 bg-background-base/45">
                <FileTree node={active.tree} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border/70 bg-card/72 shadow-2xl shadow-black/15">
            <CardContent className="p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-midground/25 bg-midground/10 text-midground"><Plus className="size-5" /></span>
                <div>
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-text-tertiary">Add Markdown</div>
                  <h3 className="font-expanded text-lg font-black uppercase tracking-[0.08em] text-foreground">Save into {active.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">Pick a folder path like `research-briefs`, `sources`, or `synthesis`. New folders are created safely inside this knowledge base.</p>
                </div>
              </div>
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Note title"
                  className="w-full rounded-none border border-border/70 bg-background-base/70 px-4 py-3 text-sm text-foreground outline-none focus:border-midground/60"
                />
                <input
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="Folder path, e.g. research-briefs"
                  className="w-full rounded-none border border-border/70 bg-background-base/70 px-4 py-3 font-mono text-sm text-foreground outline-none focus:border-midground/60"
                />
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Markdown body…"
                  rows={12}
                  className="w-full rounded-none border border-border/70 bg-background-base/70 px-4 py-3 font-mono text-sm leading-6 text-foreground outline-none focus:border-midground/60"
                />
                <Button onClick={handleSave} disabled={saving || !title.trim() || !body.trim()} className="w-full justify-center gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  {saving ? "Saving Markdown…" : "Save Markdown note"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full flex items-center gap-2 rounded-2xl border border-border/70 bg-card/70 p-5 text-text-secondary"><Loader2 className="size-4 animate-spin" /> Loading knowledge bases…</div>
            ) : (
              data.map((base) => <KnowledgeBaseCard key={base.slug} base={base} onOpen={() => setActiveSlug(base.slug)} />)
            )}
          </section>

          <section className="rounded-[1.5rem] border border-border/70 bg-card/55 p-4 text-sm leading-6 text-text-secondary">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Database className="mb-3 size-5 text-midground" />
                Markdown-first storage at <span className="font-mono text-text-tertiary">{root || "…"}</span>.
              </div>
              <div>
                <Search className="mb-3 size-5 text-midground" />
                Research workspace outputs should land in Hermes Research after source review and fact-check.
              </div>
              <div>
                <Sparkles className="mb-3 size-5 text-midground" />
                Future slice: one-click promotion from a research brief into the selected knowledge base.
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
