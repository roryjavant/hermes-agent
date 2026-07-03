import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Maximize2,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useTeamDashboardData } from "@/hooks/useTeamDashboardData";
import type { TeamActivityIcon, TeamReadiness, TeamTone } from "@/lib/team";
import { computeMemberReadiness } from "@/lib/team";
import { timeAgo } from "@/lib/utils";

function statusTone(status: string): TeamTone {
  if (status === "running") return "success";
  if (status === "blocked") return "destructive";
  if (status === "review" || status === "ready") return "warning";
  if (status === "done") return "secondary";
  return "outline";
}

function readinessGlow(readiness: TeamReadiness): string {
  if (readiness.state === "blocked") return "from-destructive/80 via-destructive/25 to-transparent";
  if (readiness.state === "live") return "from-success/80 via-success/25 to-transparent";
  if (readiness.state === "queued" || readiness.state === "needs-auth") return "from-warning/80 via-warning/25 to-transparent";
  return "from-muted-foreground/40 via-muted/20 to-transparent";
}

function readinessDot(readiness: TeamReadiness): string {
  if (readiness.state === "blocked") return "bg-destructive";
  if (readiness.state === "live") return "bg-success motion-safe:animate-pulse";
  if (readiness.state === "queued" || readiness.state === "needs-auth") return "bg-warning";
  if (readiness.state === "idle") return "bg-secondary";
  return "bg-muted-foreground/40";
}

function activityIconGlyph(icon: TeamActivityIcon): string {
  if (icon === "heartbeat") return "♥";
  if (icon === "check") return "✓";
  if (icon === "block") return "!";
  if (icon === "claim") return "↗";
  if (icon === "play") return "▶";
  if (icon === "status") return "↔";
  return "•";
}

export default function TeamPresentPage() {
  const { setEnd } = usePageHeader();
  const {
    activeWorkers,
    activity,
    board,
    currentBoard,
    currentBoardLabel,
    eventCursor,
    kanbanError,
    latestWork,
    liveConnected,
    liveError,
    loading,
    now,
    operationalCues,
    pipeline,
    readinessByRole,
    selectedBoard,
    selectedBoardLabel,
    team,
    totals,
  } = useTeamDashboardData();

  useLayoutEffect(() => {
    setEnd(
      <Link
        to="/team"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        Exit presentation
      </Link>,
    );
    return () => setEnd(null);
  }, [setEnd]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-background text-foreground">
        <Spinner />
      </div>
    );
  }

  const taskTotal = board?.columns.reduce((sum, column) => sum + column.tasks.length, 0) ?? 0;
  const topStory = latestWork[0];

  return (
    <div className="relative -m-4 min-h-[calc(100vh-4rem)] overflow-hidden bg-background p-4 text-foreground sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,hsl(var(--primary)/0.18),transparent_34%),radial-gradient(circle_at_80%_0%,hsl(var(--success)/0.14),transparent_30%),radial-gradient(circle_at_50%_100%,hsl(var(--warning)/0.10),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.18)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.18)_1px,transparent_1px)] bg-[size:48px_48px] opacity-25" />

      <main className="relative mx-auto flex w-full max-w-[96rem] flex-col gap-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
              <Maximize2 className="h-4 w-4" /> Team presentation mode
              <Badge tone={liveConnected ? "success" : liveError ? "warning" : "outline"}>{liveConnected ? "Live stream connected" : liveError ? "Cached live view" : "Awaiting stream"}</Badge>
              <Badge tone="outline">Board: {selectedBoardLabel}</Badge>
              {currentBoard && currentBoard !== selectedBoard && <Badge tone="secondary">Dashboard current: {currentBoardLabel}</Badge>}
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
              <div>
                <h1 className="font-mondwest text-5xl leading-none tracking-tight text-display sm:text-7xl lg:text-8xl">
                  Hermes Team Cockpit
                </h1>
                <p className="mt-4 max-w-4xl text-lg text-muted-foreground sm:text-xl">
                  A real-time, read-only story of the agent team: live workers, blocked lanes, review handoffs, and the current Kanban pipeline without inventing demo data.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-success/30 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><RadioTower className="h-4 w-4 text-success" /> Live workers</div>
                  <div className="mt-2 font-mono-ui text-4xl">{activeWorkers.length}</div>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Users className="h-4 w-4" /> Profiles</div>
                  <div className="mt-2 font-mono-ui text-4xl">{totals.profiles}/{team.length}</div>
                </div>
                <div className="rounded-2xl border border-warning/30 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-4 w-4 text-warning" /> Review/ready</div>
                  <div className="mt-2 font-mono-ui text-4xl">{operationalCues.needsReview + operationalCues.readyToDispatch}</div>
                </div>
                <div className="rounded-2xl border border-destructive/30 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><AlertTriangle className="h-4 w-4 text-destructive" /> Blocked/stale</div>
                  <div className="mt-2 font-mono-ui text-4xl">{totals.blocked}/{totals.staleHeartbeat}</div>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-border/70 bg-card/75 p-5 shadow-2xl shadow-primary/10 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-4 w-4" /> Status story
              </div>
              <Badge tone={operationalCues.blocked > 0 ? "destructive" : operationalCues.needsReview > 0 ? "warning" : "success"}>{operationalCues.cue}</Badge>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
              {topStory ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge tone={statusTone(topStory.task.status)}>{topStory.task.status}</Badge>
                    {topStory.needsReview && <Badge tone="warning">review handoff</Badge>}
                    <span>{topStory.roleLabel}</span>
                    <span className="font-mono-ui">{topStory.task.id}</span>
                  </div>
                  <div className="mt-3 text-lg font-semibold">{topStory.task.title}</div>
                  <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{topStory.summary}</p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> No current work summaries on this board yet.</div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="rounded-xl border border-border bg-background/60 p-3"><div className="uppercase tracking-wide">Tasks</div><div className="mt-1 font-mono-ui text-lg text-foreground">{taskTotal}</div></div>
              <div className="rounded-xl border border-border bg-background/60 p-3"><div className="uppercase tracking-wide">Assigned</div><div className="mt-1 font-mono-ui text-lg text-foreground">{totals.assigned}</div></div>
              <div className="rounded-xl border border-border bg-background/60 p-3"><div className="uppercase tracking-wide">Cursor</div><div className="mt-1 font-mono-ui text-lg text-foreground">{eventCursor}</div></div>
            </div>
            {liveError && <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">{liveError}; cached board data remains visible.</div>}
            {kanbanError && <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">Kanban summary unavailable: {kanbanError}</div>}
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><GitBranch className="h-4 w-4" /> Pipeline on screen</div>
              <Badge tone="outline">{team.length} lanes · {totals.running} running · {totals.blocked} blocked</Badge>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {pipeline.map((stage, index) => {
                const readiness = readinessByRole.get(stage.key) ?? computeMemberReadiness(team[index], now);
                return (
                  <div key={stage.key} className="relative overflow-hidden rounded-2xl border border-border bg-background/75 p-4 shadow-sm">
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${readinessGlow(readiness)}`} />
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Lane {index + 1}</div>
                        <div className="mt-1 text-xl font-semibold">{stage.label}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{stage.profileName}</div>
                      </div>
                      <span className={`mt-1 h-3 w-3 rounded-full ${readinessDot(readiness)}`} aria-hidden="true" />
                    </div>
                    <div className="relative mt-4 flex flex-wrap gap-2"><Badge tone={readiness.tone}>{readiness.label}</Badge></div>
                    <div className="relative mt-4 grid grid-cols-4 gap-1 text-center font-mono-ui text-xs text-muted-foreground">
                      <span>A{stage.activeCount}</span><span>Q{stage.queuedCount}</span><span>B{stage.blockedCount}</span><span>D{stage.doneCount}</span>
                    </div>
                    <div className="relative mt-3 line-clamp-3 min-h-[3rem] text-sm text-muted-foreground">{stage.currentTask ? stage.currentTask.title : "Lane clear"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Activity className="h-4 w-4" /> Live activity</div>
              <Badge tone={liveConnected ? "success" : liveError ? "warning" : "outline"}>{liveConnected ? "Live" : liveError ? "Cached" : "Idle"}</Badge>
            </div>
            <div className="mt-4 grid max-h-[31rem] gap-2 overflow-hidden">
              {activity.length > 0 ? activity.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-background/70 p-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono-ui text-xs">{activityIconGlyph(item.icon)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-2 font-medium">{item.summary}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge tone={item.tone}>{item.kind}</Badge><span className="font-mono-ui">{item.taskId}</span><span>{timeAgo(item.createdAt)}</span></span>
                    </span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No recent events loaded yet. The live stream will append real Kanban events as workers check in.</div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
