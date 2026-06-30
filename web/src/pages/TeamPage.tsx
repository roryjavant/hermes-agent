import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  GitBranch,
  Layers3,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Toast } from "@nous-research/ui/ui/components/toast";
import { useToast } from "@nous-research/ui/hooks/use-toast";
import { usePageHeader } from "@/contexts/usePageHeader";
import { api } from "@/lib/api";
import type { KanbanDispatchCandidate, KanbanDispatchResponse, KanbanTaskSummary, ProfileInfo } from "@/lib/api";
import { useTeamDashboardData } from "@/hooks/useTeamDashboardData";
import {
  computeMemberReadiness,
  formatTeamBoardName,
} from "@/lib/team";
import type { TeamActivityIcon, TeamMemberOverview, TeamOperationalCues, TeamReadiness } from "@/lib/team";
import { timeAgo } from "@/lib/utils";

function modelLabel(profile: ProfileInfo | null): string {
  if (!profile) return "Profile not installed";
  if (profile.provider && profile.model) return `${profile.provider} · ${profile.model}`;
  if (profile.model) return profile.model;
  if (profile.provider) return profile.provider;
  return "Model inherits default";
}

function profileDescription(member: TeamMemberOverview): string {
  const description = member.profile?.description?.trim();
  return description || member.role.description;
}

function statusTone(status: string): "success" | "warning" | "destructive" | "secondary" | "outline" {
  if (status === "running") return "success";
  if (status === "blocked") return "destructive";
  if (status === "review" || status === "ready") return "warning";
  if (status === "done") return "secondary";
  return "outline";
}

type BadgeTone = "success" | "warning" | "destructive" | "secondary" | "outline";

const WORKLOAD_STATUSES = ["running", "ready", "review", "blocked", "done"] as const;

function memberOperationalTone(member: TeamMemberOverview): BadgeTone {
  if (member.byStatus.blocked > 0) return "destructive";
  if (member.byStatus.running > 0) return "success";
  if (member.byStatus.ready > 0 || member.byStatus.review > 0) return "warning";
  if (member.byStatus.done > 0) return "secondary";
  return "outline";
}

function memberStateLabel(member: TeamMemberOverview): string {
  if (member.byStatus.blocked > 0) return `${member.byStatus.blocked} blocked`;
  if (member.byStatus.running > 0) return `${member.byStatus.running} running`;
  if (member.byStatus.ready > 0) return `${member.byStatus.ready} ready`;
  if (member.byStatus.review > 0) return `${member.byStatus.review} in review`;
  if (member.assignedTotal > 0) return `${member.assignedTotal} assigned`;
  return "clear";
}

function visibleStatusCounts(member: TeamMemberOverview) {
  return WORKLOAD_STATUSES.map((status) => ({ status, count: member.byStatus[status] })).filter(
    ({ count, status }) => count > 0 || status === "done",
  );
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

function readinessDotClass(readiness: TeamReadiness): string {
  if (readiness.state === "blocked") return "bg-destructive";
  if (readiness.state === "live") return "bg-success motion-safe:animate-pulse";
  if (readiness.state === "queued" || readiness.state === "needs-auth") return "bg-warning";
  if (readiness.state === "idle") return "bg-secondary";
  return "bg-muted-foreground/40";
}

function dispatchResultCount(result: KanbanDispatchResponse | null): number {
  if (!result) return 0;
  return (result.spawned?.length ?? 0) + (result.candidates?.length ?? 0);
}

function dispatchResultLabel(result: KanbanDispatchResponse | null): string {
  if (!result) return "No dispatch preview loaded.";
  const spawned = result.spawned?.length ?? 0;
  const candidates = result.candidates?.length ?? 0;
  const skipped = result.skipped?.length ?? 0;
  const errors = result.errors?.length ?? 0;
  if (result.result && spawned + candidates + skipped + errors === 0) return result.result;
  return `${candidates} candidate${candidates === 1 ? "" : "s"}, ${spawned} spawned, ${skipped} skipped, ${errors} error${errors === 1 ? "" : "s"}`;
}

function dispatchCandidateId(candidate: KanbanDispatchCandidate): string {
  return candidate.task_id || candidate.id || "task";
}

function dispatchCandidateLabel(candidate: KanbanDispatchCandidate): string {
  const id = dispatchCandidateId(candidate);
  const title = candidate.title?.trim();
  const assignee = candidate.profile || candidate.assignee;
  const suffix = assignee ? ` · ${assignee}` : "";
  return `${id}${title ? ` — ${title}` : ""}${suffix}`;
}

function dispatchActionHint(selectedBoard: string, dispatchPreview: KanbanDispatchResponse | null, dispatching: boolean): string {
  if (!selectedBoard) return "Select a board before dispatching.";
  if (dispatching) return "Working on the current safe dispatch request…";
  if (!dispatchPreview) return "Run Preview dispatch first so you can see exactly what would spawn.";
  if (dispatchResultCount(dispatchPreview) === 0) return "Preview found no ready assigned task to spawn.";
  return "Preview has a candidate. Dispatch one will spawn at most one worker after confirmation.";
}

interface RecommendedNextStep {
  tone: BadgeTone;
  title: string;
  body: string;
  label: string;
  to: string;
}

interface UserNeededCue {
  title: string;
  body: string;
  detail: string;
  action: string;
}

interface ProfileSoulState {
  loading: boolean;
  exists: boolean;
  content: string;
  error: string | null;
}

function cleanSoulPreview(content: string): string {
  return content
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#\s+/gm, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function soulPreviewLabel(soul: ProfileSoulState | undefined): string {
  if (!soul || soul.loading) return "Loading SOUL.md…";
  if (soul.error) return "SOUL.md could not be read.";
  if (!soul.exists || !soul.content.trim()) return "No SOUL.md set for this profile yet.";
  const cleaned = cleanSoulPreview(soul.content);
  return cleaned.length > 240 ? `${cleaned.slice(0, 240).trim()}…` : cleaned;
}

function cleanTaskSummary(summary: string | null | undefined): string {
  return (summary ?? "")
    .replace(/^review-required:\s*/i, "")
    .replace(/^blocked:\s*/i, "")
    .trim();
}

function userNeededCue(task: KanbanTaskSummary): UserNeededCue | null {
  if (task.status !== "blocked" && task.status !== "review") return null;
  const reviewRequired = isReviewRequiredBlocker(task) || task.status === "review";
  const detail = cleanTaskSummary(task.latest_summary) || "No worker summary was captured yet. Open the task before changing its status.";

  if (reviewRequired) {
    return {
      title: "Needs you: review and accept the handoff",
      body: "A worker is saying this slice is ready for human review. Check the task or diff if needed, then accept the handoff to mark it done and let one dependent task move next.",
      detail,
      action: "Click Accept handoff after you are comfortable with the result.",
    };
  }

  return {
    title: "Needs you: unblock or provide direction",
    body: "The worker is stopped because it needs input, a decision, or permission to continue. Read the blocker note, then only resolve it after the missing input is handled.",
    detail,
    action: "Click Resolve blocker only after the blocker note is no longer true.",
  };
}

function buildRecommendedNextStep({
  boards,
  kanbanError,
  latestWorkCount,
  operationalCues,
  selectedBoard,
  team,
  totals,
}: {
  boards: unknown[];
  kanbanError: string | null;
  latestWorkCount: number;
  operationalCues: TeamOperationalCues;
  selectedBoard: string;
  team: TeamMemberOverview[];
  totals: { profiles: number; authReady: number; blocked: number; staleHeartbeat: number };
}): RecommendedNextStep {
  if (kanbanError) {
    return {
      tone: "warning",
      title: "Reconnect Kanban before dispatching",
      body: "Profiles are visible, but the Team tab could not read the Kanban dashboard endpoint. Refresh or open the board to inspect the plugin status.",
      label: "Open Kanban",
      to: "/kanban",
    };
  }
  if (boards.length === 0 || !selectedBoard) {
    return {
      tone: "warning",
      title: "Create or pick a Kanban board",
      body: "The Team tab needs a board before it can show assignments, live workers, or safe dispatch candidates.",
      label: "Open Kanban",
      to: "/kanban",
    };
  }
  if (totals.profiles < team.length) {
    const missing = team.length - totals.profiles;
    return {
      tone: "warning",
      title: "Install the missing team profiles",
      body: `${missing} roster slot${missing === 1 ? "" : "s"} are using fallback definitions. Add matching profiles for better auth, model, and skill visibility.`,
      label: "Open Profiles",
      to: "/profiles",
    };
  }
  if (totals.authReady < team.length) {
    const missing = team.length - totals.authReady;
    return {
      tone: "warning",
      title: "Check profile auth before spawning",
      body: `${missing} profile${missing === 1 ? "" : "s"} need env/model attention. Dispatch stays manual so you can fix credentials first.`,
      label: "Open Profiles",
      to: "/profiles",
    };
  }
  if (operationalCues.blocked > 0) {
    return {
      tone: "destructive",
      title: "Read the Needs you box on the blocked card",
      body: `${operationalCues.blocked} blocked task${operationalCues.blocked === 1 ? "" : "s"} need a human review, decision, or missing input. The blocked agent card now spells out exactly what is being asked of you.`,
      label: "View blocked tasks",
      to: "/kanban?status=blocked",
    };
  }
  if (operationalCues.needsReview > 0) {
    return {
      tone: "warning",
      title: "Review the handoff queue",
      body: `${operationalCues.needsReview} task${operationalCues.needsReview === 1 ? "" : "s"} look ready for review or acceptance before the next worker is spawned.`,
      label: "Open Kanban",
      to: "/kanban?status=review",
    };
  }
  if (operationalCues.readyToDispatch > 0) {
    return {
      tone: "success",
      title: "Preview and spawn the next worker",
      body: `${operationalCues.readyToDispatch} assigned ready task${operationalCues.readyToDispatch === 1 ? "" : "s"} can be safely dispatched from the controls on this page.`,
      label: "Preview dispatch",
      to: "#safe-controls",
    };
  }
  if (operationalCues.liveWorkers > 0 || totals.staleHeartbeat > 0) {
    return {
      tone: totals.staleHeartbeat > 0 ? "warning" : "success",
      title: totals.staleHeartbeat > 0 ? "Check stale worker heartbeats" : "Workers are active now",
      body: totals.staleHeartbeat > 0
        ? `${totals.staleHeartbeat} lane${totals.staleHeartbeat === 1 ? "" : "s"} have stale heartbeats. Use the activity feed and agent cards to decide whether to wait or intervene.`
        : `${operationalCues.liveWorkers} worker${operationalCues.liveWorkers === 1 ? "" : "s"} are checked in. Watch the activity feed for summaries and blockers.`,
      label: "Watch activity",
      to: "#team-activity",
    };
  }
  if (latestWorkCount > 0) {
    return {
      tone: "secondary",
      title: "Review the latest completed context",
      body: "No lane needs intervention right now. The latest work summary is the best place to catch up on what happened.",
      label: "Latest work",
      to: "#latest-work",
    };
  }
  return {
    tone: "outline",
    title: "Board is quiet",
    body: "No assigned, live, blocked, or review-ready team work is visible on this board yet. Add assigned Kanban tasks to start the team loop.",
    label: "Open Kanban",
    to: "/kanban",
  };
}

function isReviewRequiredBlocker(task: KanbanTaskSummary): boolean {
  const summary = task.latest_summary?.toLowerCase() ?? "";
  return task.status === "blocked" && summary.includes("review-required");
}

function TeamMemberDetails({
  boardLabel,
  member,
  onResolveBlocker,
  readiness,
  resolvingTaskId,
  soul,
}: {
  boardLabel: string;
  member: TeamMemberOverview;
  onResolveBlocker: (task: KanbanTaskSummary) => void;
  readiness: TeamReadiness;
  resolvingTaskId: string | null;
  soul: ProfileSoulState | undefined;
}) {
  const userCue = member.latestTask ? userNeededCue(member.latestTask) : null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Model / provider</div>
          <div className="mt-1 break-words font-medium text-foreground">{modelLabel(member.profile)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Skills</div>
          <div className="mt-1 text-foreground">
            {member.attachedSkills.length > 0
              ? member.attachedSkills.slice(0, 4).join(", ")
              : member.profile
                ? `${member.profile.skill_count} installed`
                : "Unknown"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Health</div>
          <div className="mt-1 text-foreground">{readiness.reasons[0] ?? "No signal"}</div>
          {readiness.lastHeartbeatAt && <div className="mt-1 text-xs text-muted-foreground">heartbeat {timeAgo(readiness.lastHeartbeatAt)}</div>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/60 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> Workload strip
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleStatusCounts(member).some(({ count }) => count > 0) ? (
            visibleStatusCounts(member).map(({ status, count }) => (
              <Badge key={status} tone={count > 0 ? statusTone(status) : "outline"}>
                {status}: {count}
              </Badge>
            ))
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> All clear on this board.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/60 p-3">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>SOUL.md</span>
          {soul?.exists && <Badge tone="outline">profile identity</Badge>}
        </div>
        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground/90">{soulPreviewLabel(soul)}</p>
      </div>

      <div className="rounded-xl border border-border bg-background/70 p-3 text-sm shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Current assignment
          </div>
          <Badge tone="outline">{boardLabel}</Badge>
        </div>
        {member.latestTask ? (
          <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-card/40 p-3">
            <div className="font-medium text-foreground">{member.latestTask.title}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge tone={statusTone(member.latestTask.status)}>{member.latestTask.status}</Badge>
              <span className="font-mono-ui">{member.latestTask.id}</span>
              {member.latestTask.skills && member.latestTask.skills.length > 0 && (
                member.latestTask.skills.slice(0, 4).map((skill) => (
                  <Badge key={skill} tone="outline">{skill}</Badge>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link
                to={`/kanban?task=${encodeURIComponent(member.latestTask.id)}`}
                className="inline-flex items-center gap-1 text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
              >
                Open task <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                to="/profiles"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
              >
                Open profile
              </Link>
            </div>
            {userCue && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <div className="font-semibold text-foreground">{userCue.title}</div>
                </div>
                <p className="mt-2 text-muted-foreground">{userCue.body}</p>
                <div className="mt-3 rounded-md border border-border/70 bg-background/70 p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Worker note</div>
                  <p className="mt-1 line-clamp-4 text-foreground">{userCue.detail}</p>
                </div>
                <div className="mt-2 text-xs font-medium text-warning">{userCue.action}</div>
              </div>
            )}
            {member.latestTask.status === "blocked" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onResolveBlocker(member.latestTask!)}
                  disabled={resolvingTaskId === member.latestTask.id}
                  prefix={resolvingTaskId === member.latestTask.id ? <Spinner /> : undefined}
                >
                  {isReviewRequiredBlocker(member.latestTask) ? "Accept handoff" : "Resolve blocker"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {isReviewRequiredBlocker(member.latestTask)
                    ? "Marks this handoff done and dispatches one dependent task."
                    : "Moves this blocker back to ready; dispatch stays manual."}
                </span>
              </div>
            )}
            {member.latestTask.latest_summary && (
              <p className="line-clamp-3 text-xs text-muted-foreground">{member.latestTask.latest_summary}</p>
            )}
          </div>
        ) : (
          <div className="mt-2 text-muted-foreground">
            No current assignments on {boardLabel}.
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { setEnd } = usePageHeader();
  const { toast, showToast } = useToast();
  const handleLoadError = useCallback(
    (error: unknown) => showToast(`Failed to load Team data: ${error}`, "error"),
    [showToast],
  );
  const {
    activeWorkers,
    activity,
    board,
    boards,
    currentBoard,
    currentBoardLabel,
    eventCursor,
    handleBoardChange: handleSharedBoardChange,
    kanbanError,
    latestWork,
    liveConnected,
    liveError,
    load,
    loadLiveSummary,
    loading,
    now,
    operationalCues,
    pipeline,
    readinessByRole,
    refreshing,
    selectedBoard,
    selectedBoardLabel,
    selectedBoardMeta,
    setLiveError,
    team,
    totals,
  } = useTeamDashboardData({ onLoadError: handleLoadError });
  const [dispatching, setDispatching] = useState(false);
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [dispatchPreview, setDispatchPreview] = useState<KanbanDispatchResponse | null>(null);
  const [profileSouls, setProfileSouls] = useState<Record<string, ProfileSoulState>>({});
  const [selectedTeamMemberKey, setSelectedTeamMemberKey] = useState<string | null>(null);
  const profileNamesKey = useMemo(
    () =>
      [...new Set(team.map((member) => member.profile?.name).filter((name): name is string => Boolean(name)))]
        .sort()
        .join("|"),
    [team],
  );
  const recommendedNextStep = buildRecommendedNextStep({
    boards,
    kanbanError,
    latestWorkCount: latestWork.length,
    operationalCues,
    selectedBoard,
    team,
    totals,
  });
  const selectedTeamMember = selectedTeamMemberKey
    ? team.find((member) => member.role.key === selectedTeamMemberKey) ?? null
    : null;

  useEffect(() => {
    const profileNames = profileNamesKey ? profileNamesKey.split("|") : [];
    if (profileNames.length === 0) return undefined;
    let cancelled = false;

    void Promise.all(
      profileNames.map(async (name) => {
        try {
          const soul = await api.getProfileSoul(name);
          return { name, soul: { loading: false, exists: soul.exists, content: soul.content, error: null } };
        } catch (error) {
          return {
            name,
            soul: {
              loading: false,
              exists: false,
              content: "",
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setProfileSouls((current) => {
        const next = { ...current };
        for (const { name, soul } of results) next[name] = soul;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [profileNamesKey]);

  useLayoutEffect(() => {
    setEnd(
      <Button size="sm" ghost onClick={load} disabled={refreshing} prefix={refreshing ? <Spinner /> : <RefreshCw className="h-4 w-4" />}>
        Refresh
      </Button>,
    );
    return () => setEnd(null);
  }, [load, refreshing, setEnd]);

  const handleBoardChange = (slug: string) => {
    setDispatchPreview(null);
    handleSharedBoardChange(slug);
  };

  const handlePreviewDispatch = async () => {
    if (!selectedBoard || dispatching) return;
    setDispatching(true);
    try {
      const preview = await api.dispatchKanban(selectedBoard, true, 1);
      setDispatchPreview(preview);
      showToast(`Dispatch preview: ${dispatchResultLabel(preview)}`, "success");
    } catch (error) {
      showToast(`Dispatch preview failed: ${error}`, "error");
    } finally {
      setDispatching(false);
    }
  };

  const handleDispatchOne = async () => {
    if (!selectedBoard || dispatching || dispatchResultCount(dispatchPreview) === 0) return;
    const ok = window.confirm("Dispatch at most one ready assigned task on this board? This will not commit, push, delete, archive, or reassign anything.");
    if (!ok) return;
    setDispatching(true);
    try {
      const result = await api.dispatchKanban(selectedBoard, false, 1);
      setDispatchPreview(result);
      showToast(`Dispatch result: ${dispatchResultLabel(result)}`, "success");
      void loadLiveSummary(selectedBoard).catch(() => setLiveError("Live summary refresh failed"));
    } catch (error) {
      showToast(`Dispatch failed: ${error}`, "error");
    } finally {
      setDispatching(false);
    }
  };

  const handleCopyNudge = async () => {
    const message = `Team nudge for ${selectedBoardLabel}: ${operationalCues.cue} Open board: /kanban`;
    try {
      await navigator.clipboard.writeText(message);
      showToast("Copied safe team nudge text. Nothing was sent automatically.", "success");
    } catch (error) {
      showToast(`Could not copy nudge text: ${error}`, "error");
    }
  };

  const handleResolveBlocker = async (task: KanbanTaskSummary) => {
    if (!selectedBoard || resolvingTaskId) return;
    const reviewRequired = isReviewRequiredBlocker(task);
    const ok = window.confirm(
      reviewRequired
        ? `Accept the review-required handoff for ${task.id}, mark it done, and dispatch at most one dependent task? This will not commit, push, delete, archive, or reassign anything.`
        : `Unblock ${task.id} back to ready? This will not commit, push, delete, archive, reassign, or spawn anything by itself.`,
    );
    if (!ok) return;
    setResolvingTaskId(task.id);
    try {
      if (reviewRequired) {
        await api.updateKanbanTaskStatus(
          task.id,
          "done",
          selectedBoard,
          "Resolved from Team UI: accepted review-required worker handoff.",
        );
        const result = await api.dispatchKanban(selectedBoard, false, 1);
        setDispatchPreview(result);
        showToast(`Resolved ${task.id} and dispatched: ${dispatchResultLabel(result)}`, "success");
      } else {
        await api.updateKanbanTaskStatus(task.id, "ready", selectedBoard);
        showToast(`Resolved ${task.id}: moved back to ready.`, "success");
      }
      await loadLiveSummary(selectedBoard);
    } catch (error) {
      showToast(`Could not resolve ${task.id}: ${error}`, "error");
    } finally {
      setResolvingTaskId(null);
    }
  };

  const teamRosterSection = (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/70 p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <span>Meet the Team</span>
              <Badge tone="outline">{team.length} role agents</Badge>
              <Badge tone={liveConnected ? "success" : liveError ? "warning" : "secondary"}>
                {liveConnected ? "Live" : liveError ? "Reconnecting" : "Offline"}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Blue profile-agent circles keep the roster compact and fixed at the top. Click an agent for dossier, workload, SOUL.md, and assignment.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] text-muted-foreground">
          <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 font-mono-ui text-foreground">{totals.profiles}/{team.length} profiles</span>
          <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 font-mono-ui text-foreground">{activeWorkers.length} live</span>
          <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 font-mono-ui text-foreground">{totals.blocked} blocked</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-3">
        {team.map((member) => {
          const readiness = readinessByRole.get(member.role.key) ?? computeMemberReadiness(member, now);
          const hasAttention = member.byStatus.blocked > 0 || member.byStatus.review > 0;
          const isWorking = member.byStatus.running > 0 || readiness.state === "live";
          return (
            <button
              key={member.role.key}
              type="button"
              onClick={() => setSelectedTeamMemberKey(member.role.key)}
              className="group relative flex w-[4.75rem] flex-col items-center gap-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 sm:w-20"
              aria-label={`Open ${member.role.label} agent dossier`}
            >
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/55 bg-cyan-500/10 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.28)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:border-cyan-300/80 group-hover:bg-cyan-400/15 sm:h-14 sm:w-14">
                <span className="absolute inset-1 rounded-full border border-cyan-200/20 opacity-70" />
                <span className="relative z-10 font-mono-ui text-base font-semibold uppercase tracking-[0.04em] text-foreground sm:text-lg">
                  {member.role.label.slice(0, 1)}
                </span>
                <span
                  className={`absolute -right-0.5 top-1.5 h-2.5 w-2.5 rounded-full border border-background sm:h-3 sm:w-3 ${hasAttention ? "bg-warning" : isWorking ? "bg-success motion-safe:animate-pulse" : "bg-cyan-300"}`}
                  aria-hidden="true"
                />
              </span>
              <span className="max-w-full truncate font-mondwest text-display text-[0.66rem] uppercase tracking-[0.1em] text-foreground sm:text-xs">
                {member.role.label}
              </span>
              <span className="max-w-full truncate font-mono-ui text-[0.56rem] uppercase tracking-[0.06em] text-muted-foreground sm:text-[0.62rem]">
                {memberStateLabel(member)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-5 lg:p-6">
      <Toast toast={toast} />

      {teamRosterSection}

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">Viewing board: {selectedBoardLabel}</Badge>
              <Badge tone={liveConnected ? "success" : liveError ? "warning" : "secondary"}>
                {liveConnected ? "Live" : liveError ? "Reconnecting" : "Offline"}
              </Badge>
              <Badge tone="secondary">Hermes agent-team roster</Badge>
              <Link to="/team/present" className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:border-primary/60 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30">
                Presentation mode
              </Link>
              {currentBoard && currentBoard !== selectedBoard && (
                <Badge tone="outline">dashboard current: {currentBoardLabel}</Badge>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Live roster, active workers, role responsibilities, current Kanban assignments, and safe readiness signals.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-border bg-background/60 p-2.5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Profiles installed
                </div>
                <div className="mt-1 font-mono-ui text-xl text-foreground">{totals.profiles}/{team.length}</div>
              </div>
              <div className="rounded-xl border border-warning/30 bg-background/60 p-2.5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-warning" /> Auth ready
                </div>
                <div className="mt-1 font-mono-ui text-xl text-foreground">{totals.authReady}/{team.length}</div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-2.5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Layers3 className="h-3.5 w-3.5" /> Assigned
                </div>
                <div className="mt-1 font-mono-ui text-xl text-foreground">{totals.assigned}</div>
              </div>
              <div className="rounded-xl border border-success/30 bg-background/60 p-2.5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <RadioTower className="h-3.5 w-3.5 text-success" /> Workers live
                </div>
                <div className="mt-1 font-mono-ui text-xl text-foreground">{activeWorkers.length}</div>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-background/60 p-2.5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Blocked / stale
                </div>
                <div className="mt-1 font-mono-ui text-xl text-foreground">{totals.blocked}/{totals.staleHeartbeat}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4 backdrop-blur-sm">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended next step</div>
                  <div className="mt-1 font-semibold text-foreground">{recommendedNextStep.title}</div>
                </div>
                <Badge tone={recommendedNextStep.tone}>{recommendedNextStep.tone === "outline" ? "status" : recommendedNextStep.tone}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{recommendedNextStep.body}</p>
              <Link
                to={recommendedNextStep.to}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
              >
                {recommendedNextStep.label} <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="team-board-select">
              Active board
            </label>
            <select
              id="team-board-select"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
              value={selectedBoard}
              onChange={(event) => handleBoardChange(event.target.value)}
            >
              {boards.length === 0 && <option value="">No Kanban boards</option>}
              {boards.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {formatTeamBoardName(b, b.slug)}{b.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="rounded-lg border border-border/70 bg-card/40 p-2">
                <div className="uppercase tracking-wide">Tasks</div>
                <div className="mt-1 font-mono-ui text-foreground">{selectedBoardMeta?.total ?? board?.columns.reduce((sum, column) => sum + column.tasks.length, 0) ?? 0}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/40 p-2">
                <div className="uppercase tracking-wide">Cursor</div>
                <div className="mt-1 font-mono-ui text-foreground">{eventCursor}</div>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/40 p-2">
                <div className="uppercase tracking-wide">Roles</div>
                <div className="mt-1 font-mono-ui text-foreground">{team.length}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link to="/profiles" className="inline-flex items-center gap-1 text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30">Profiles</Link>
              <Link to="/kanban" className="inline-flex items-center gap-1 text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30">Kanban board <ExternalLink className="h-3 w-3" /></Link>
            </div>
            <div id="safe-controls" className="rounded-lg border border-border/70 bg-card/40 p-3 text-xs text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium uppercase tracking-wide text-foreground">
                <Send className="h-3.5 w-3.5" /> Safe controls
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" ghost onClick={handlePreviewDispatch} disabled={!selectedBoard || dispatching} prefix={dispatching ? <Spinner /> : undefined}>
                  Preview dispatch
                </Button>
                <Button size="sm" onClick={handleDispatchOne} disabled={!selectedBoard || dispatching || dispatchResultCount(dispatchPreview) === 0}>
                  Dispatch one
                </Button>
                <Button size="sm" ghost onClick={handleCopyNudge} disabled={!selectedBoard} prefix={<Clipboard className="h-3.5 w-3.5" />}>
                  Copy nudge
                </Button>
              </div>
              <div className="mt-2 font-medium text-foreground">{dispatchActionHint(selectedBoard, dispatchPreview, dispatching)}</div>
              <div className="mt-1">{dispatchResultLabel(dispatchPreview)}</div>
              {dispatchPreview && (
                <div className="mt-2 grid gap-1">
                  {(dispatchPreview.candidates ?? []).slice(0, 3).map((candidate) => (
                    <div key={`candidate-${dispatchCandidateId(candidate)}`} className="rounded-md border border-success/20 bg-success/5 px-2 py-1 text-[11px] text-foreground">
                      Candidate: {dispatchCandidateLabel(candidate)}
                    </div>
                  ))}
                  {(dispatchPreview.spawned ?? []).slice(0, 3).map((candidate) => (
                    <div key={`spawned-${dispatchCandidateId(candidate)}`} className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] text-foreground">
                      Spawned: {dispatchCandidateLabel(candidate)}
                    </div>
                  ))}
                  {(dispatchPreview.skipped ?? []).slice(0, 2).map((candidate) => (
                    <div key={`skipped-${dispatchCandidateId(candidate)}`} className="rounded-md border border-border bg-background/60 px-2 py-1 text-[11px]">
                      Skipped: {dispatchCandidateLabel(candidate)}{candidate.reason ? ` · ${candidate.reason}` : ""}
                    </div>
                  ))}
                  {(dispatchPreview.errors ?? []).slice(0, 2).map((error) => (
                    <div key={error} className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
                      Error: {error}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-1">No destructive actions, no commits/pushes, and no messages are sent automatically.</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <Card className="overflow-hidden border-border bg-card/70 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  <Activity className="h-4 w-4" /> Pipeline status
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Horizontal worker lanes, active coverage, and current Kanban pressure for {selectedBoardLabel}.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={liveConnected ? "success" : liveError ? "warning" : "outline"}>{liveConnected ? "Live stream" : liveError ? "Cached stream" : "Stream idle"}</Badge>
                <Badge tone={activeWorkers.length > 0 ? "success" : "outline"}>{activeWorkers.length} active worker{activeWorkers.length === 1 ? "" : "s"}</Badge>
                <Badge tone={operationalCues.needsReview > 0 ? "warning" : operationalCues.readyToDispatch > 0 ? "success" : "outline"}>{operationalCues.cue}</Badge>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto pb-1">
              <div className="grid min-w-[62rem] grid-cols-5 gap-3">
                {pipeline.map((stage, index) => {
                  const member = team[index];
                  const readiness = readinessByRole.get(stage.key) ?? computeMemberReadiness(member, now);
                  const isActive = stage.activeCount > 0 || readiness.state === "live";
                  return (
                    <div key={stage.key} className="relative overflow-hidden rounded-xl border border-border bg-background/70 p-3">
                      <div className={`absolute inset-x-0 top-0 h-1 ${stage.blockedCount > 0 ? "bg-destructive/70" : isActive ? "bg-success/70" : stage.queuedCount > 0 ? "bg-warning/70" : "bg-border"}`} />
                      <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Lane {index + 1}</div>
                          <div className="mt-1 truncate text-lg font-semibold text-foreground">{stage.label}</div>
                          <div className="truncate text-xs text-muted-foreground">{stage.profileName}</div>
                        </div>
                        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${readinessDotClass(readiness)}`} aria-hidden="true" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone={readiness.tone}>{readiness.label}</Badge>
                        {isActive && <Badge tone="success">active</Badge>}
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-1 text-center font-mono-ui text-xs text-muted-foreground">
                        <div className="rounded-md border border-border/70 bg-card/40 px-1.5 py-1"><div>A</div><div className="text-foreground">{stage.activeCount}</div></div>
                        <div className="rounded-md border border-border/70 bg-card/40 px-1.5 py-1"><div>Q</div><div className="text-foreground">{stage.queuedCount}</div></div>
                        <div className="rounded-md border border-border/70 bg-card/40 px-1.5 py-1"><div>B</div><div className="text-foreground">{stage.blockedCount}</div></div>
                        <div className="rounded-md border border-border/70 bg-card/40 px-1.5 py-1"><div>D</div><div className="text-foreground">{stage.doneCount}</div></div>
                      </div>
                      <div className="mt-3 min-h-[2.5rem] line-clamp-2 text-sm text-muted-foreground">
                        {stage.currentTask ? stage.currentTask.title : "Lane clear"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card id="latest-work" className="overflow-hidden border-border bg-card/70 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <GitBranch className="h-4 w-4" /> Latest handoffs
              </div>
              <Badge tone={operationalCues.needsReview > 0 ? "warning" : operationalCues.readyToDispatch > 0 ? "success" : "outline"}>
                {operationalCues.cue}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2">
              {latestWork.length > 0 ? (
                latestWork.map((item) => (
                  <Link
                    key={`${item.task.id}-${item.roleLabel}`}
                    to={`/kanban?task=${encodeURIComponent(item.task.id)}`}
                    className="rounded-xl border border-border bg-background/70 p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={statusTone(item.task.status)}>{item.task.status}</Badge>
                      {item.needsReview && <Badge tone="warning">review cue</Badge>}
                      {!item.hasSummary && <Badge tone="outline">no summary yet</Badge>}
                      <span>{item.roleLabel}</span>
                      <span className="font-mono-ui">{item.task.id}</span>
                    </div>
                    <div className="mt-2 font-medium text-foreground">{item.task.title}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">No current work summaries on this board yet.</div>
                  <div className="mt-1">Assign ready tasks to team profiles, then use Preview dispatch to start one worker at a time.</div>
                  <Link to="/kanban" className="mt-2 inline-flex text-primary underline underline-offset-4">Open Kanban</Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card id="team-activity" className="overflow-hidden border-border bg-card/70 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <Activity className="h-4 w-4" /> Team activity feed
              </div>
              <Badge tone={liveConnected ? "success" : liveError ? "warning" : "outline"}>{liveConnected ? "Live" : liveError ? "Reconnecting" : "Idle"}</Badge>
            </div>
            {liveError && <div className="mt-2 text-xs text-warning">{liveError}; cached board data remains visible.</div>}
            <div className="mt-4 grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
              {activity.length > 0 ? (
                activity.map((item) => (
                  <Link
                    key={item.id}
                    to={`/kanban?task=${encodeURIComponent(item.taskId)}`}
                    className="group rounded-xl border border-border bg-background/70 p-3 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 motion-safe:animate-in motion-safe:fade-in"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono-ui text-xs text-foreground">
                        {activityIconGlyph(item.icon)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">{item.summary}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge tone={item.tone}>{item.kind}</Badge>
                          <span className="font-mono-ui">{item.taskId}</span>
                          {item.profile && <span>{item.profile}</span>}
                          {item.status && <span>{item.status}</span>}
                          <span>{timeAgo(item.createdAt)}</span>
                        </span>
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No recent events loaded yet. The live stream will append new Kanban events when workers check in.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {kanbanError && (
        <Card className="border-warning/50">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <div className="font-medium text-foreground">Kanban summary unavailable</div>
              <div className="mt-1 text-muted-foreground">
                Team profiles loaded, but the Kanban dashboard plugin endpoint could not be read. No secrets or config files were inspected. Error: {kanbanError}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTeamMember && (() => {
        const readiness = readinessByRole.get(selectedTeamMember.role.key) ?? computeMemberReadiness(selectedTeamMember, now);
        const soul = selectedTeamMember.profile?.name ? profileSouls[selectedTeamMember.profile.name] : undefined;
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background-base/80 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-modal-title"
            onClick={() => setSelectedTeamMemberKey(null)}
          >
            <div
              className="relative max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-midground/30 bg-card shadow-[0_0_60px_rgba(0,0,0,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <div className="flex items-start justify-between gap-4 border-b border-border bg-background-base/35 p-4">
                <div className="min-w-0">
                  <p className="font-mondwest text-display text-xs uppercase tracking-[0.18em] text-muted-foreground">Agent dossier</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/55 bg-cyan-500/10 font-mono-ui text-lg text-foreground shadow-[0_0_24px_rgba(34,211,238,0.28)]">
                      {selectedTeamMember.role.label.slice(0, 1)}
                      <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-background ${readinessDotClass(readiness)}`} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 id="team-member-modal-title" className="truncate font-mondwest text-display text-2xl uppercase tracking-[0.08em] text-foreground">
                        {selectedTeamMember.role.label}
                      </h2>
                      <p className="mt-0.5 truncate font-mono-ui text-sm text-midground">
                        {selectedTeamMember.profile?.name ?? selectedTeamMember.role.profileName}
                      </p>
                    </div>
                    {selectedTeamMember.profile ? <Badge tone="success">profile</Badge> : <Badge tone="warning">fallback</Badge>}
                    <Badge tone={readiness.tone}>{readiness.label}</Badge>
                    <Badge tone={memberOperationalTone(selectedTeamMember)}>{memberStateLabel(selectedTeamMember)}</Badge>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{profileDescription(selectedTeamMember)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTeamMemberKey(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background-base/60 text-muted-foreground transition-colors hover:border-current/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close agent dossier"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[calc(86vh-8rem)] overflow-y-auto p-4">
                <TeamMemberDetails
                  boardLabel={formatTeamBoardName(selectedBoardMeta, selectedBoard || currentBoard)}
                  member={selectedTeamMember}
                  onResolveBlocker={handleResolveBlocker}
                  readiness={readiness}
                  resolvingTaskId={resolvingTaskId}
                  soul={soul}
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
