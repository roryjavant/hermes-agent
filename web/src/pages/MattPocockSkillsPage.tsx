import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Github,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";
import { useToast } from "@nous-research/ui/hooks/use-toast";
import { Toast } from "@nous-research/ui/ui/components/toast";
import { usePageHeader } from "@/contexts/usePageHeader";
import { cn } from "@/lib/utils";

const REPO_OWNER = "mattpocock";
const REPO_NAME = "skills";
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const SKILLS_URL = `${REPO_URL}/tree/main/skills`;
const INSTALL_COMMAND = `npx skills@latest add ${REPO_OWNER}/${REPO_NAME}`;
const GITHUB_TREE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/main?recursive=1`;

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  truncated: boolean;
  tree: GitHubTreeItem[];
}

interface SkillEntry {
  name: string;
  category: string;
  path: string;
  url: string;
}

const CATEGORY_ORDER = [
  "engineering",
  "productivity",
  "personal",
  "misc",
  "in-progress",
  "deprecated",
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  engineering: "Design, implementation, TDD, bug diagnosis, code review, research, triage, and ticket shaping.",
  productivity: "Grilling sessions, handoffs, teaching, and writing better reusable skills.",
  personal: "Personal writing and knowledge-work helpers.",
  misc: "Utility skills and agent setup helpers that do not fit the main lanes.",
  "in-progress": "Experimental skills from the repo; useful to browse, but treat as draft quality.",
  deprecated: "Older skills kept for reference.",
};

function prettySkillName(raw: string): string {
  return raw
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractSkills(items: GitHubTreeItem[]): SkillEntry[] {
  return items
    .filter((item) => item.type === "blob" && /^skills\/[^/]+\/[^/]+\/SKILL\.md$/.test(item.path))
    .map((item) => {
      const [, category, name] = item.path.split("/");
      return {
        name,
        category,
        path: item.path,
        url: `${REPO_URL}/blob/main/${item.path}`,
      };
    })
    .sort((a, b) => {
      const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (categoryDelta !== 0) return categoryDelta;
      return a.name.localeCompare(b.name);
    });
}

function categoryRank(category: string): number {
  const rank = CATEGORY_ORDER.indexOf(category);
  return rank === -1 ? CATEGORY_ORDER.length : rank;
}

export default function MattPocockSkillsPage() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const { setEnd, setTitle } = usePageHeader();
  const { toast, showToast } = useToast();

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(GITHUB_TREE_URL, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        throw new Error(`GitHub returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as GitHubTreeResponse;
      setSkills(extractSkills(data.tree));
      if (data.truncated) {
        showToast("GitHub returned a truncated tree; some skills may be missing.", "error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load the GitHub repository.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSkills();
  }, []);

  useEffect(() => {
    setTitle("Matt Skills");
    setEnd(
      <div className="flex flex-wrap items-center gap-2">
        <a href={SKILLS_URL} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="gap-2 uppercase tracking-[0.16em]">
            <Github className="size-3.5" />
            GitHub
          </Button>
        </a>
        <a href="https://skills.sh/mattpocock/skills" target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="gap-2 uppercase tracking-[0.16em]">
            <ExternalLink className="size-3.5" />
            skills.sh
          </Button>
        </a>
      </div>,
    );
    return () => {
      setEnd(null);
      setTitle(null);
    };
  }, [setEnd, setTitle]);

  const filteredSkills = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return skills;
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(needle) ||
        skill.category.toLowerCase().includes(needle) ||
        prettySkillName(skill.name).toLowerCase().includes(needle),
    );
  }, [skills, query]);

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, SkillEntry[]>();
    for (const skill of filteredSkills) {
      const bucket = groups.get(skill.category) ?? [];
      bucket.push(skill);
      groups.set(skill.category, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => categoryRank(a) - categoryRank(b));
  }, [filteredSkills]);

  const copyInstallCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      showToast("Install command copied", "success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Could not copy command", "error");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-3 py-3 sm:px-5 lg:px-6">
      <section className="rounded-2xl border border-orange-300/20 bg-black/45 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-orange-300/30 bg-orange-500/10 text-orange-100">
                Matt Pocock
              </Badge>
              <Badge className="border-cyan-300/25 bg-cyan-500/10 text-cyan-100">
                Skills for Real Engineers
              </Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Matt Pocock Skills
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A quick in-dashboard index for mattpocock/skills: composable engineering, productivity,
                and agent-workflow skills from Matt Pocock&apos;s public GitHub repo.
              </p>
            </div>
          </div>

          <Card className="w-full border-orange-300/20 bg-orange-500/[0.06] lg:w-[29rem]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-orange-100">
                <Wrench className="size-4" />
                Install via skills.sh
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <code className="block overflow-x-auto rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-orange-100">
                {INSTALL_COMMAND}
              </code>
              <Button size="sm" className="gap-2" onClick={copyInstallCommand}>
                {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy command"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-orange-100">{skills.length || "—"}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Indexed skills</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-orange-100">{groupedSkills.length || "—"}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Visible categories</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-orange-100">GitHub</div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Live public repo index</div>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills or categories…"
            className="pl-9"
          />
        </div>
        <Button size="sm" className="gap-2" onClick={() => void loadSkills()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-amber-300/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-medium">Could not load live GitHub data.</div>
              <div className="mt-1 text-amber-100/80">{error}</div>
              <a className="mt-3 inline-flex items-center gap-1 underline" href={SKILLS_URL} target="_blank" rel="noopener noreferrer">
                Open the skills folder on GitHub <ArrowUpRight className="size-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && !skills.length ? (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="flex items-center gap-3 p-5 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading mattpocock/skills from GitHub…
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {groupedSkills.map(([category, entries]) => (
          <section key={category} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold capitalize text-foreground">{category.replaceAll("-", " ")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {CATEGORY_DESCRIPTIONS[category] ?? "Skills from the public repository."}
                </p>
              </div>
              <Badge className="w-fit border-white/15 bg-black/30 text-muted-foreground">
                {entries.length} {entries.length === 1 ? "skill" : "skills"}
              </Badge>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {entries.map((skill) => (
                <a
                  key={skill.path}
                  href={skill.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "group rounded-xl border border-white/10 bg-black/30 p-3 transition",
                    "hover:border-orange-300/35 hover:bg-orange-500/[0.07] focus:outline-none focus:ring-2 focus:ring-orange-300/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-orange-300/20 bg-orange-500/10 p-2 text-orange-100">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-foreground">{prettySkillName(skill.name)}</h3>
                        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition group-hover:text-orange-100" />
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/{skill.name}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && !error && !filteredSkills.length ? (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="p-5 text-sm text-muted-foreground">
            No Matt Pocock skills match “{query}”.
          </CardContent>
        </Card>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
