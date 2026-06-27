import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDot,
  GitBranch,
  GitCommit,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { api } from "@/lib/api";
import type { DevRepoInfo, DevReposResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; className: string; glow: string; textClassName: string; icon: typeof CheckCircle2 }> = {
  green: {
    label: "Synced",
    className: "border-success/40 bg-success/10 text-success",
    glow: "bg-success shadow-[0_0_24px_rgba(96,211,148,0.55)]",
    textClassName: "text-success",
    icon: CheckCircle2,
  },
  yellow: {
    label: "Local work",
    className: "border-warning/40 bg-warning/10 text-warning",
    glow: "bg-warning shadow-[0_0_24px_rgba(242,201,76,0.55)]",
    textClassName: "text-warning",
    icon: ArrowUpFromLine,
  },
  red: {
    label: "Needs pull",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    glow: "bg-destructive shadow-[0_0_24px_rgba(255,107,107,0.55)]",
    textClassName: "text-destructive",
    icon: AlertTriangle,
  },
  blue: {
    label: "No upstream",
    className: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
    glow: "bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.45)]",
    textClassName: "text-cyan-200",
    icon: CircleDot,
  },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.red;
}

function statusDetail(repo: DevRepoInfo): string {
  if (repo.error) return repo.error;
  if (repo.behind > 0 && repo.ahead > 0) return `Diverged: ${repo.ahead} ahead / ${repo.behind} behind`;
  if (repo.behind > 0) return `${repo.behind} commit${repo.behind === 1 ? "" : "s"} behind upstream`;
  const parts = [];
  if (repo.ahead > 0) parts.push(`${repo.ahead} ahead`);
  if (repo.changed > 0) parts.push(`${repo.changed} changed`);
  if (repo.untracked > 0) parts.push(`${repo.untracked} untracked`);
  if (parts.length > 0) return parts.join(" · ");
  if (!repo.upstream) return "No upstream branch configured";
  return "Clean and in sync";
}

function formatTime(timestamp: number | undefined): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
function RepoRow({ repo, onSync, syncing, syncMessage }: { repo: DevRepoInfo; onSync: (repo: DevRepoInfo) => void; syncing: boolean; syncMessage?: string }) {
  const meta = statusMeta(repo.status);
  const Icon = meta.icon;
  return (
    <div className="group grid gap-3 border-b border-border/50 bg-card/45 px-3 py-3 transition-colors hover:bg-card/75 md:grid-cols-[minmax(14rem,1.35fr)_minmax(9rem,0.7fr)_5rem_5rem_5rem_minmax(14rem,1fr)_5rem] md:items-center md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("h-3 w-3 shrink-0 rounded-full", meta.glow)} aria-label={meta.label} />
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl border", meta.className)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{repo.name}</h2>
          </div>
          <p className="mt-0.5 truncate font-mono-ui text-[0.68rem] text-muted-foreground">{repo.path}</p>
        </div>
      </div>

      <div className="min-w-0 font-mono-ui text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5 text-foreground">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{repo.branch ?? "detached"}</span>
        </div>
        <div className="mt-0.5 truncate">{repo.upstream ?? "no upstream"}</div>
      </div>

      <div className={cn("flex items-center gap-1.5 font-mono-ui text-sm", repo.ahead > 0 ? "text-warning" : "text-muted-foreground")}>
        <ArrowUpFromLine className="size-3.5" /> {repo.ahead}
      </div>
      <div className={cn("flex items-center gap-1.5 font-mono-ui text-sm", repo.behind > 0 ? "text-destructive" : "text-muted-foreground")}>
        <ArrowDownToLine className="size-3.5" /> {repo.behind}
      </div>
      <div className={cn("flex items-center gap-1.5 font-mono-ui text-sm", repo.dirty ? "text-warning" : "text-muted-foreground")}>
        <GitCompareArrows className="size-3.5" /> {repo.changed + repo.untracked}
      </div>

      <div className="min-w-0 text-xs">
        <p className={cn("truncate", repo.error ? "text-destructive" : "text-text-secondary")}>
          <span className={cn("mr-2 font-mono-ui uppercase tracking-[0.08em]", meta.textClassName)}>{meta.label}</span>
          {syncMessage ?? statusDetail(repo)}
        </p>
        {repo.last_commit ? (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
            <GitCommit className="size-3.5 shrink-0" />
            <span className="truncate">{repo.last_commit.subject}</span>
            <span className="shrink-0 font-mono-ui">{repo.last_commit.sha} · {formatTime(repo.last_commit.timestamp)}</span>
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onSync(repo)}
        disabled={syncing || Boolean(repo.error) || !repo.upstream || (repo.dirty && repo.behind > 0) || (repo.ahead > 0 && repo.behind > 0)}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background-base/60 px-2 font-expanded text-[0.65rem] font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-midground/50 hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
        title={repo.dirty && repo.behind > 0 ? "Commit or stash local changes before pulling" : repo.upstream ? "Fetch, fast-forward pull, then push if ahead" : "No upstream configured"}
      >
        {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        Sync
      </button>
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background-base/45 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono-ui text-2xl", tone)}>{value}</div>
    </div>
  );
}

export default function ReposPage() {
  const [data, setData] = useState<DevReposResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState<string | null>(null);
  const [syncMessages, setSyncMessages] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async (fetch = false) => {
    if (fetch) setFetching(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await api.getDevRepos(fetch, { timeoutMs: fetch ? 30000 : 12000 });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFetching(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  const syncRepo = async (repo: DevRepoInfo) => {
    setSyncingRepo(repo.name);
    setError(null);
    setSyncMessages((prev) => ({ ...prev, [repo.path]: "Syncing…" }));
    try {
      const result = await api.syncDevRepo(repo.name, { timeoutMs: 90000 });
      setSyncMessages((prev) => ({ ...prev, [repo.path]: result.message }));
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          repos: prev.repos.map((item) => (item.path === result.repo.path ? result.repo : item)),
        };
      });
      await load(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncMessages((prev) => ({ ...prev, [repo.path]: message }));
      setError(message);
    } finally {
      setSyncingRepo(null);
    }
  };

  const repos = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = data?.repos ?? [];
    const filtered = needle
      ? source.filter((repo) => `${repo.name} ${repo.path} ${repo.branch ?? ""} ${repo.upstream ?? ""}`.toLowerCase().includes(needle))
      : source;
    const rank: Record<string, number> = { red: 0, yellow: 1, blue: 2, green: 3 };
    return [...filtered].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name));
  }, [data?.repos, query]);

  const summary = data?.summary;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-80 rounded-full bg-midground/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-3 border-cyan-300/30 bg-cyan-400/10 text-cyan-200">Dev folder repo lights</Badge>
              <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">Repos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                Scans {data?.root ?? "/Users/roryavant/Dev"} for local Git checkouts and shows branch health with the same quick light language: green synced, yellow local work/ahead, red behind or errored, blue no upstream.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button ghost onClick={() => void load(false)} disabled={refreshing || fetching || Boolean(syncingRepo)} prefix={refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}>
                Refresh local
              </Button>
              <Button onClick={() => void load(true)} disabled={refreshing || fetching || Boolean(syncingRepo)} prefix={fetching ? <Loader2 className="size-4 animate-spin" /> : <GitCompareArrows className="size-4" />}>
                Fetch remotes
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <SummaryPill label="Total" value={summary?.total ?? 0} tone="text-foreground" />
        <SummaryPill label="Synced" value={summary?.green ?? 0} tone="text-success" />
        <SummaryPill label="Local" value={summary?.yellow ?? 0} tone="text-warning" />
        <SummaryPill label="Alerts" value={summary?.red ?? 0} tone="text-destructive" />
        <SummaryPill label="No upstream" value={summary?.blue ?? 0} tone="text-cyan-200" />
        <SummaryPill label="Dirty" value={summary?.dirty ?? 0} tone="text-warning" />
        <SummaryPill label="Ahead" value={summary?.ahead ?? 0} tone="text-warning" />
        <SummaryPill label="Pull" value={summary?.behind ?? 0} tone="text-destructive" />
      </section>

      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background-base/45 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter repos, branches, paths…"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-border/70 bg-card/70 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Scanning repos…
        </div>
      ) : repos.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-border/70 bg-background-base/35 shadow-2xl shadow-black/10">
          <div className="hidden border-b border-border/70 bg-card/70 px-4 py-2 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground md:grid md:grid-cols-[minmax(14rem,1.35fr)_minmax(9rem,0.7fr)_5rem_5rem_5rem_minmax(14rem,1fr)_5rem]">
            <span>Repo</span>
            <span>Branch</span>
            <span>Ahead</span>
            <span>Behind</span>
            <span>Dirty</span>
            <span>Status / latest commit</span>
            <span>Sync</span>
          </div>
          {repos.map((repo) => (
            <RepoRow
              key={repo.path}
              repo={repo}
              onSync={syncRepo}
              syncing={syncingRepo === repo.name}
              syncMessage={syncMessages[repo.path]}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-3xl border border-border/70 bg-card/70 p-10 text-center text-sm text-muted-foreground">
          No repositories matched.
        </div>
      )}
    </main>
  );
}
