import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cpu,
  Gauge,
  MessageSquare,
  Radio,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { usePageHeader } from "@/contexts/usePageHeader";
import { api } from "@/lib/api";
import type {
  CronJob,
  KanbanBoardResponse,
  KanbanTaskSummary,
  MissionControlActivityResponse,
  MissionControlProfileTeam,
  PaginatedSessions,
  ProfileInfo,
  SessionInfo,
  StatusResponse,
} from "@/lib/api";
import { PluginSlot } from "@/plugins";
import { cn, timeAgo } from "@/lib/utils";

type LoadState = {
  status: StatusResponse | null;
  sessions: PaginatedSessions | null;
  cronJobs: CronJob[];
  profiles: ProfileInfo[];
  kanban: KanbanBoardResponse | null;
  activity: MissionControlActivityResponse | null;
  kanbanUnavailable: boolean;
};

type BadgeTone = "success" | "warning" | "destructive" | "secondary" | "outline";
type MissionView = "overview" | "work" | "ops";

type MissionMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: BadgeTone;
  icon: LucideIcon;
  href: string;
  accent: string;
};

type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: BadgeTone;
  icon: LucideIcon;
  href: string;
};

type ReadinessTone = "ready" | "working" | "review";

type OperationsItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  meta: string;
  tone: ReadinessTone;
  href: string;
  icon: LucideIcon;
};

const MISSION_CONTROL_ACTIVITY_REFRESH_MS = 1000;
const MISSION_CONTROL_FULL_REFRESH_MS = 15000;
const MISSION_CONTROL_ACTIVITY_TIMEOUT_MS = 3000;
const MISSION_CONTROL_FULL_SOURCE_TIMEOUT_MS = 6000;

const emptyState: LoadState = {
  status: null,
  sessions: null,
  cronJobs: [],
  profiles: [],
  kanban: null,
  activity: null,
  kanbanUnavailable: false,
};

function formatCount(value: number | null | undefined): string {
  return String(value ?? 0);
}

function formatTime(value: number | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return timeAgo(date.getTime() / 1000);
}

function getJobTitle(job: CronJob): string {
  const name = job.name?.trim();
  if (name) return name;
  const prompt = job.prompt?.trim();
  if (prompt) return prompt.length > 80 ? `${prompt.slice(0, 80).trim()}…` : prompt;
  const script = job.script?.trim();
  if (script) return script.length > 80 ? `${script.slice(0, 80).trim()}…` : script;
  return job.id;
}

function getJobState(job: CronJob): string {
  return job.state || (job.enabled ? "scheduled" : "paused");
}

function jobTone(job: CronJob): BadgeTone {
  if (job.last_error) return "destructive";
  const state = getJobState(job).toLowerCase();
  if (!job.enabled || state === "paused" || state === "disabled") return "warning";
  if (state === "error" || state === "failed") return "destructive";
  return "success";
}

function taskTone(task: KanbanTaskSummary): BadgeTone {
  if (task.status === "blocked") return "destructive";
  if (task.status === "running") return "success";
  if (task.status === "review" || task.status === "ready") return "warning";
  if (task.status === "done") return "secondary";
  return "outline";
}

function gatewayTone(status: StatusResponse | null): BadgeTone {
  if (status?.gateway_exit_reason) return "destructive";
  return status?.gateway_running ? "success" : "warning";
}

function allTasks(data: LoadState): Array<KanbanTaskSummary & { column: string }> {
  return (
    data.kanban?.columns.flatMap((column) =>
      column.tasks.map((task) => ({ ...task, column: column.name })),
    ) ?? []
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-success, #60d394)";
  if (score >= 55) return "var(--color-warning, #f2c94c)";
  return "var(--color-destructive, #ff6b6b)";
}

function computeMissionScore(data: LoadState): number {
  const tasks = allTasks(data);
  let score = 100;
  if (!data.status?.gateway_running) score -= 18;
  if (data.status?.gateway_exit_reason) score -= 25;
  if (data.kanbanUnavailable) score -= 12;
  score -= Math.min(tasks.filter((task) => task.status === "blocked").length * 14, 28);
  score -= Math.min(data.cronJobs.filter((job) => job.last_error).length * 12, 24);
  score -= Math.min(data.profiles.filter((profile) => !profile.has_env).length * 4, 16);
  return Math.max(0, Math.min(100, score));
}

function buildMetrics(data: LoadState): MissionMetric[] {
  const tasks = allTasks(data);
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const liveWorkers = tasks.filter((task) => task.status === "running").length;
  const activeSessions =
    data.status?.active_sessions ??
    data.sessions?.sessions.filter((session) => session.is_active).length ??
    0;
  const nextCron = data.cronJobs
    .filter((job) => job.enabled && job.next_run_at)
    .sort((a, b) => String(a.next_run_at).localeCompare(String(b.next_run_at)))[0];

  return [
    {
      id: "gateway",
      label: "Gateway",
      value: data.status?.gateway_running
        ? "Running"
        : data.status?.gateway_exit_reason
          ? "Failed"
          : "Stopped",
      detail: data.status?.gateway_state || data.status?.gateway_updated_at || "No gateway heartbeat",
      tone: gatewayTone(data.status),
      icon: Radio,
      href: "/system",
      accent: "from-emerald-400/25 via-cyan-300/10 to-transparent",
    },
    {
      id: "sessions",
      label: "Active sessions",
      value: formatCount(activeSessions),
      detail: `${formatCount(data.sessions?.total)} total conversations tracked`,
      tone: activeSessions > 0 ? "success" : "secondary",
      icon: MessageSquare,
      href: "/sessions",
      accent: "from-sky-400/25 via-indigo-300/10 to-transparent",
    },
    {
      id: "team",
      label: "Team work",
      value: `${formatCount(liveWorkers)} live`,
      detail: data.kanbanUnavailable
        ? "Kanban unavailable"
        : `${formatCount(blockedTasks)} blocked · ${formatCount(tasks.length)} total`,
      tone: blockedTasks > 0 ? "destructive" : liveWorkers > 0 ? "success" : "secondary",
      icon: Users,
      href: "/team",
      accent: "from-fuchsia-400/25 via-violet-300/10 to-transparent",
    },
    {
      id: "automation",
      label: "Next automation",
      value: nextCron ? formatTime(nextCron.next_run_at) : "None queued",
      detail: nextCron ? getJobTitle(nextCron) : `${formatCount(data.cronJobs.length)} cron jobs configured`,
      tone: nextCron ? jobTone(nextCron) : "secondary",
      icon: CalendarClock,
      href: "/cron",
      accent: "from-amber-300/25 via-orange-300/10 to-transparent",
    },
  ];
}

function buildTimeline(data: LoadState): TimelineItem[] {
  const taskItems = allTasks(data)
    .filter((task) => ["blocked", "review", "running", "ready"].includes(task.status))
    .slice(0, 4)
    .map((task) => ({
      id: `task:${task.id}`,
      title: task.title || task.id,
      detail: task.latest_summary || task.body || `${task.column}${task.assignee ? ` · ${task.assignee}` : ""}`,
      meta: task.status,
      tone: taskTone(task),
      icon: task.status === "blocked" ? AlertTriangle : CircleDot,
      href: "/team",
    }));

  const sessionItems = (data.sessions?.sessions ?? []).slice(0, 3).map((session: SessionInfo) => ({
    id: `session:${session.id}`,
    title: session.title || session.preview || "Untitled session",
    detail: `${session.message_count} messages · ${session.tool_call_count} tools`,
    meta: formatTime(session.last_active),
    tone: session.is_active ? "success" : "secondary" as BadgeTone,
    icon: MessageSquare,
    href: "/sessions",
  }));

  const jobItems = data.cronJobs
    .filter((job) => job.last_error || !job.enabled || job.next_run_at)
    .slice(0, 3)
    .map((job) => ({
      id: `job:${job.profile ?? "default"}:${job.id}`,
      title: getJobTitle(job),
      detail: job.last_error || job.schedule_display || job.schedule?.display || "Scheduled automation",
      meta: job.next_run_at ? formatTime(job.next_run_at) : getJobState(job),
      tone: jobTone(job),
      icon: Zap,
      href: "/cron",
    }));

  return [...taskItems, ...sessionItems, ...jobItems].slice(0, 8);
}

function readinessBadgeTone(tone: ReadinessTone): BadgeTone {
  if (tone === "ready") return "success";
  if (tone === "working") return "warning";
  return "destructive";
}

function readinessLabel(tone: ReadinessTone): string {
  if (tone === "ready") return "Ready";
  if (tone === "working") return "Working";
  return "Review";
}

function terminalTone(status: string, lastInputAt: number | null | undefined, checkedAt: number | null | undefined): ReadinessTone {
  const now = checkedAt || Date.now() / 1000;
  const recentlySubmitted = Boolean(lastInputAt && now - lastInputAt < 120);
  if (status === "working" || recentlySubmitted) return "working";
  if (status === "running") return "ready";
  return "review";
}

function runtimeSourceLabel(source: string): string {
  if (source === "cli") return "Local Hermes CLI";
  if (source === "tui") return "Local Hermes TUI";
  if (source === "dashboard") return "Dashboard backend";
  if (source === "kanban") return "Kanban worker";
  if (source === "delegate") return "Delegate agent";
  return "Local Hermes process";
}

type ActivitySegment = "terminals" | "teams" | "agents" | "subagents";

function activitySegment(item: OperationsItem): ActivitySegment {
  if (item.kind === "Delegate agent") return "subagents";
  if (item.kind === "Profile agent" || item.kind === "Agent session") return "agents";
  return "terminals";
}

function projectPathLabel(value: string): string {
  const match = value.match(/(?:\/Users\/roryavant\/(?:Dev(?:\/[^\s·]+)?|\.hermes\/[^\s·]+)|\/var\/folders\/[^\s·]+)/);
  if (!match) return "Local machine";
  const path = match[0];
  if (path === "/Users/roryavant/Dev") return `Dev · ${path}`;
  const devMatch = path.match(/\/Users\/roryavant\/Dev\/([^/]+)/);
  if (devMatch) return `${devMatch[1]} · /Users/roryavant/Dev/${devMatch[1]}`;
  if (path.includes("/.hermes/hermes-agent")) return `Hermes install · ${path}`;
  const parts = path.split("/").filter(Boolean);
  return `${parts.at(-1) || "Hermes"} · ${path}`;
}

function teamLabel(item: OperationsItem): string {
  const title = item.title || "";
  if (title.startsWith("AA-")) return "Agent Arena";
  if (title.startsWith("JR-") || title.includes("Juror")) return "Juror Research";
  if (title.startsWith("HERMES-TEAM") || title.includes("Mission Control")) return "Hermes Team UI";
  const prefix = title.match(/^([A-Z][A-Z0-9]+)-/);
  return prefix ? prefix[1] : "Team work";
}

function activityGroupLabel(segment: ActivitySegment, item: OperationsItem): string {
  if (segment === "terminals") return projectPathLabel(`${item.detail} ${item.meta}`);
  if (segment === "teams") return teamLabel(item);
  return projectPathLabel(`${item.detail} ${item.meta}`) === "Local machine"
    ? item.kind
    : projectPathLabel(`${item.detail} ${item.meta}`);
}

function readinessToneRank(tone: ReadinessTone): number {
  return { working: 0, review: 1, ready: 2 }[tone];
}

function groupedActivityRows(segment: ActivitySegment, items: OperationsItem[]) {
  const rows = new Map<string, OperationsItem[]>();
  for (const item of items) {
    const label = activityGroupLabel(segment, item);
    rows.set(label, [...(rows.get(label) ?? []), item]);
  }
  const sortedRows = [...rows.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (segment === "terminals") {
    return sortedRows.map(([label, rowItems]) => {
      const ordered = [...rowItems].sort(
        (a, b) => readinessToneRank(a.tone) - readinessToneRank(b.tone) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
      );
      const primary = ordered[0];
      return {
        label,
        items: [{
          ...primary,
          id: `terminal-group:${label}`,
          title: primary.title,
          meta: rowItems.length > 1 ? `${primary.meta} · ${rowItems.length} records collapsed` : primary.meta,
        }],
      };
    });
  }
  return sortedRows.map(([label, rowItems]) => ({
    label,
    items: [...rowItems].sort(
      (a, b) => readinessToneRank(a.tone) - readinessToneRank(b.tone) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    ),
  }));
}

function toneFromProfileStatus(status: string, configured: boolean): ReadinessTone {
  if (!configured || status === "review") return "review";
  if (status === "working") return "working";
  return "ready";
}

function teamRowsFromProfileTeams(profileTeams: MissionControlProfileTeam[]) {
  return profileTeams.map((team) => ({
    label: `${team.label} · ${team.project_path}`,
    items: team.agents.map((agent) => ({
      id: `team-profile:${team.team_id}:${agent.profile}`,
      kind: "Team profile",
      title: `${agent.role} · ${agent.profile}`,
      detail: agent.detail || (agent.active ? "live profile agent" : "profile standby"),
      meta: agent.active
        ? [agent.source, agent.pid ? `pid ${agent.pid}` : ""].filter(Boolean).join(" · ")
        : agent.configured ? "standby profile" : "missing profile",
      tone: toneFromProfileStatus(agent.status, agent.configured),
      href: "/profiles",
      icon: Users,
    })),
  }));
}

function buildOperationsItems(data: LoadState): OperationsItem[] {
  const activity = data.activity;
  const profileTeamProfiles = new Set(
    (activity?.profile_teams ?? []).flatMap((team) => team.agents.map((agent) => agent.profile)),
  );
  const runtimeItems: OperationsItem[] = (activity?.activities ?? [])
    .filter((record) => record.source !== "dashboard")
    .map((record) => ({
      id: `activity:${record.activity_id}`,
      kind: profileTeamProfiles.has(record.profile) ? "Profile agent" : runtimeSourceLabel(record.source) === "Local Hermes CLI" || runtimeSourceLabel(record.source) === "Local Hermes TUI" ? "Hermes terminal" : runtimeSourceLabel(record.source),
      title: record.detail || record.session_id || `${record.source} activity`,
      detail: [record.profile, record.cwd].filter(Boolean).join(" · ") || "Local Hermes runtime heartbeat",
      meta: record.pid ? `pid ${record.pid} · ${formatTime(record.last_seen)}` : formatTime(record.last_seen),
      tone: record.status === "ready" ? "ready" : record.status === "working" ? "working" : "review",
      href: record.source === "kanban" ? "/team" : "/sessions",
      icon: record.source === "kanban" || record.source === "delegate" ? Users : Activity,
    }));

  const terminalItems: OperationsItem[] = (activity?.terminals ?? [])
    .filter((terminal) => {
      const marker = `${terminal.cwd ?? ""} ${terminal.command ?? ""}`.toLowerCase();
      return !marker.includes("ui-tui") && !marker.includes("hermes_cli.main") && !marker.includes("/bin/hermes");
    })
    .map((terminal, index) => ({
      id: `terminal:${terminal.id}`,
      kind: "Terminal",
      title: terminal.resume_session_id ? `Terminal ${index + 1} · resumed` : `Terminal ${index + 1}`,
      detail: terminal.cwd || terminal.command || "Dashboard PTY session",
      meta: terminal.pid ? `pid ${terminal.pid}` : terminal.status,
      tone: terminalTone(terminal.status, terminal.last_input_at, activity?.checked_at),
      href: "/chat",
      icon: Terminal,
    }));

  const processItems: OperationsItem[] = (activity?.background_processes ?? [])
    .filter((process) => {
      if (!(process.status === "running" || process.exit_code !== undefined)) return false;
      const marker = `${process.cwd ?? ""} ${process.command ?? ""}`.toLowerCase();
      if (marker.includes("hermes_cli.main") || marker.includes("/bin/hermes") || marker.includes("ui-tui")) return false;
      if (marker.includes("slash_worker") || marker.includes("tools_mcp_server")) return false;
      if (marker.includes("pyright-langserver") || marker.includes("typescript-language-server") || marker.includes("tsserver.js")) return false;
      return true;
    })
    .slice(0, 6)
    .map((process) => ({
      id: `process:${process.session_id}`,
      kind: "Terminal process",
      title: process.command || process.session_id,
      detail: process.cwd || process.output_preview || "Managed background process",
      meta: process.status === "running" ? `${process.uptime_seconds}s` : `exit ${process.exit_code ?? "?"}`,
      tone: process.status === "running" ? "working" : process.exit_code === 0 ? "ready" : "review",
      href: "/chat",
      icon: Terminal,
    }));

  const subagentItems: OperationsItem[] = (activity?.subagents ?? []).map((agent) => ({
    id: `subagent:${agent.subagent_id}`,
    kind: "Delegate agent",
    title: agent.goal || agent.subagent_id,
    detail: [agent.model, agent.provider].filter(Boolean).join(" · ") || "Delegated subagent",
    meta: agent.status || `${agent.tool_count ?? 0} tools`,
    tone: "working",
    href: "/sessions",
    icon: Users,
  }));

  const sessionItems: OperationsItem[] = (data.sessions?.sessions ?? [])
    .filter((session) => session.is_active)
    .map((session) => ({
      id: `session:${session.id}`,
      kind: "Agent session",
      title: session.title || session.preview || "Untitled session",
      detail: `${session.message_count} msgs · ${session.tool_call_count} tools${session.model ? ` · ${session.model}` : ""}`,
      meta: formatTime(session.last_active),
      tone: "ready",
      href: "/sessions",
      icon: MessageSquare,
    }));

  const taskItems: OperationsItem[] = allTasks(data)
    .filter((task) => ["running", "ready", "review", "blocked"].includes(task.status))
    .slice(0, 10)
    .map((task) => ({
      id: `kanban:${task.id}`,
      kind: "Kanban swarm",
      title: task.title || task.id,
      detail: task.latest_summary || task.body || `${task.column}${task.assignee ? ` · ${task.assignee}` : ""}`,
      meta: task.assignee || task.status,
      tone: task.status === "running" ? "working" : task.status === "ready" ? "ready" : "review",
      href: "/team",
      icon: task.status === "blocked" || task.status === "review" ? AlertTriangle : Users,
    }));

  // Kanban tasks already have a dedicated Mission Queue below.  Keeping them
  // out of the signal board prevents task cards from masquerading as team or
  // terminal lights.
  void taskItems;
  return [...runtimeItems, ...terminalItems, ...processItems, ...subagentItems, ...sessionItems];
}

function MissionOrb({
  metrics,
  score,
  selectedMetric,
  onSelectMetric,
}: {
  metrics: MissionMetric[];
  score: number;
  selectedMetric: string;
  onSelectMetric: (id: string) => void;
}) {
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const active = metrics.find((metric) => metric.id === selectedMetric) ?? metrics[0];

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[19.5rem] items-center justify-center">
      <div className="absolute inset-3 rounded-full border border-current/10 bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_62%)]" />
      <div className="absolute inset-8 rounded-full border border-current/15" />
      <div className="absolute inset-16 rounded-full border border-current/20" />
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 240 240" aria-hidden="true">
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="10"
        />
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke={scoreColor(score)}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (score / 100) * circumference}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-full border border-current/20 bg-background-base/80 text-center shadow-[0_0_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <span className="font-mondwest text-display text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Mission score
        </span>
        <span className="mt-1 font-mono-ui text-4xl text-foreground">{score}</span>
        <span className="mt-0.5 max-w-24 truncate text-xs text-muted-foreground">{active.label}</span>
      </div>
      {metrics.map((metric, index) => {
        const angle = -90 + index * (360 / metrics.length);
        const x = 50 + Math.cos((angle * Math.PI) / 180) * 42;
        const y = 50 + Math.sin((angle * Math.PI) / 180) * 42;
        const Icon = metric.icon;
        return (
          <button
            key={metric.id}
            type="button"
            onClick={() => onSelectMetric(metric.id)}
            className={cn(
              "absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200",
              selectedMetric === metric.id
                ? "scale-110 border-midground bg-midground/20 text-midground shadow-[0_0_24px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]"
                : "border-current/20 bg-background-base/70 text-muted-foreground hover:scale-105 hover:text-foreground",
            )}
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-label={`Focus ${metric.label}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({
  metric,
  selected,
  onSelect,
}: {
  metric: MissionMetric;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = metric.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden border p-3 text-left transition-all duration-200",
        "bg-card/70 hover:-translate-y-0.5 hover:bg-card/90",
        selected
          ? "border-midground/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_40%,transparent)]"
          : "border-border hover:border-current/30",
      )}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent} opacity-70`} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current/30 to-transparent" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-current/20 bg-background-base/60">
          <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-mondwest text-display text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {metric.label}
            </p>
            <Badge tone={metric.tone}>{metric.tone === "success" ? "live" : metric.tone}</Badge>
          </div>
          <p className="mt-1.5 truncate font-mono-ui text-xl text-foreground">{metric.value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{metric.detail}</p>
        </div>
      </div>
    </button>
  );
}

function ViewSwitch({ view, onChange }: { view: MissionView; onChange: (view: MissionView) => void }) {
  const items: Array<{ id: MissionView; label: string; icon: LucideIcon }> = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "work", label: "Work", icon: Users },
    { id: "ops", label: "Ops", icon: Terminal },
  ];

  return (
    <div className="inline-flex rounded-full border border-current/15 bg-background-base/55 p-1 backdrop-blur-md">
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors",
              active
                ? "bg-midground text-background-base shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Live mission feed</CardTitle>
          </div>
          <Badge tone="outline">{items.length} signals</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            Quiet board. No urgent task, session, or automation activity is currently surfacing.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-3 left-[1.05rem] top-3 w-px bg-gradient-to-b from-midground/60 via-current/15 to-transparent" />
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className="group relative flex gap-3 border border-transparent p-2 transition-colors hover:border-current/15 hover:bg-muted/20"
                  >
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 bg-background-base">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                        <Badge tone={item.tone}>{item.meta}</Badge>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MissionQueue({ data }: { data: LoadState }) {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const tasks = allTasks(data);
  const visibleTasks = (filter === "attention"
    ? tasks.filter((task) => ["blocked", "review", "running", "ready"].includes(task.status))
    : tasks
  ).slice(0, 8);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Mission queue</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex border border-border bg-muted/10 p-0.5">
              {(["attention", "all"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "px-2.5 py-1 text-xs capitalize transition-colors",
                    filter === id ? "bg-midground text-background-base" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
            <SectionLink to="/team" label="Open Team" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.kanbanUnavailable ? (
          <EmptySignal
            icon={AlertTriangle}
            tone="warning"
            title="Kanban unavailable"
            body="Open Team or Kanban to inspect the plugin connection."
          />
        ) : visibleTasks.length === 0 ? (
          <EmptySignal
            icon={CheckCircle2}
            tone="success"
            title="No attention work"
            body="No running, blocked, review, or ready task needs attention right now."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleTasks.map((task) => (
              <Link
                key={task.id}
                to="/team"
                className="group border border-border bg-muted/10 p-4 transition-all hover:-translate-y-0.5 hover:border-current/30 hover:bg-muted/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono-ui text-sm text-foreground">{task.title || task.id}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      {task.column}{task.assignee ? ` · ${task.assignee}` : ""}
                    </p>
                  </div>
                  <Badge tone={taskTone(task)}>{task.status}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                  {task.latest_summary || task.body || "No worker summary captured yet."}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground">
                  Open lane <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveOperationsBoard({ items, profileTeams }: { items: OperationsItem[]; profileTeams: MissionControlProfileTeam[] }) {
  const sortedItems = [...items].sort((a, b) => {
    const order: Record<ReadinessTone, number> = { review: 0, working: 1, ready: 2 };
    return order[a.tone] - order[b.tone] || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
  });
  const agentItems = sortedItems.filter((item) => activitySegment(item) === "agents");
  const agentRows = groupedActivityRows("agents", agentItems);
  const teamRows = teamRowsFromProfileTeams(profileTeams);
  const subagentItems = sortedItems.filter((item) => activitySegment(item) === "subagents");
  const subagentRows = groupedActivityRows("subagents", subagentItems);
  const terminalSignalItems = sortedItems.filter((item) => activitySegment(item) === "terminals");
  const signalItems = [...terminalSignalItems, ...teamRows.flatMap((row) => row.items), ...agentItems, ...subagentItems];
  const counts = {
    ready: signalItems.filter((item) => item.tone === "ready").length,
    working: signalItems.filter((item) => item.tone === "working").length,
    review: signalItems.filter((item) => item.tone === "review").length,
  };
  const segments: Array<{ id: ActivitySegment; label: string; helper: string }> = [
    { id: "terminals", label: "Terminals", helper: "Local Hermes/PTY shells and dashboard surfaces" },
    { id: "teams", label: "Teams", helper: "Five profile-backed role agents per coding team" },
    { id: "agents", label: "Agents", helper: "Live profile-backed Hermes agents" },
    { id: "subagents", label: "Subagents", helper: "Ephemeral delegate children spawned by an agent" },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Live activity lights</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Quick status at a glance. Open a light when you need details.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="success">{counts.ready} green</Badge>
            <Badge tone="warning">{counts.working} working</Badge>
            <Badge tone="destructive">{counts.review} review</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptySignal
            icon={CheckCircle2}
            tone="success"
            title="No active terminals or agents detected"
            body="Open Chat, run a background terminal command, delegate work, or dispatch Kanban tasks and they will appear here."
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded border border-border bg-background-base/25 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-mondwest text-display text-sm uppercase tracking-[0.14em] text-foreground">
                  Signal board
                </p>
                <p className="text-xs text-muted-foreground">click a light to drill in</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-3">
                {segments.map((segment) => {
                  const segmentItems = segment.id === "teams"
                    ? teamRows.flatMap((row) => row.items)
                    : segment.id === "agents"
                      ? agentItems
                      : segment.id === "subagents"
                        ? subagentItems
                        : sortedItems.filter((item) => activitySegment(item) === segment.id);
                  const groupedRows = segment.id === "teams"
                    ? teamRows
                    : segment.id === "agents"
                      ? agentRows
                      : segment.id === "subagents"
                        ? subagentRows
                        : groupedActivityRows(segment.id, segmentItems);
                  const segmentCount = segment.id === "teams" || segment.id === "terminals" ? groupedRows.length : segmentItems.length;
                  return (
                    <div key={segment.id} className="min-h-24 border border-border/80 bg-background-base/20 p-3 xl:col-span-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mondwest text-display text-xs uppercase tracking-[0.16em] text-foreground">
                            {segment.label}
                          </p>
                          <p className="mt-1 truncate text-[0.68rem] text-muted-foreground">{segment.helper}</p>
                        </div>
                        <Badge tone="secondary">{segmentCount}</Badge>
                      </div>
                      {segmentItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No live {segment.label.toLowerCase()}.</p>
                      ) : (
                        <div className="space-y-3">
                          {groupedRows.map((row) => (
                            <div key={row.label} className="grid gap-2 border-t border-border/60 pt-3 md:grid-cols-[minmax(12rem,18rem)_1fr]">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-foreground">{row.label.split(" · ")[0]}</p>
                                {row.label.includes(" · ") && (
                                  <p className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">{row.label.split(" · ").slice(1).join(" · ")}</p>
                                )}
                                {segment.id === "teams" && (
                                  <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                                    {row.items.length} profile agents
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                {row.items.map((item) => {
                                  const Icon = item.icon;
                                  return (
                                    <Link
                                      key={item.id}
                                      to={item.href}
                                      title={`${row.label} · ${readinessLabel(item.tone)} · ${item.kind} · ${item.title} · ${item.meta}`}
                                      aria-label={`${row.label} ${readinessLabel(item.tone)} ${item.kind}: ${item.title}`}
                                      className={cn(
                                        "group relative flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200",
                                        "hover:-translate-y-0.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        item.tone === "ready" && "border-success/50 bg-success/10 text-success shadow-[0_0_16px_color-mix(in_srgb,var(--color-success)_22%,transparent)]",
                                        item.tone === "working" && "border-warning/50 bg-warning/10 text-warning shadow-[0_0_16px_color-mix(in_srgb,var(--color-warning)_24%,transparent)]",
                                        item.tone === "review" && "border-destructive/55 bg-destructive/10 text-destructive shadow-[0_0_16px_color-mix(in_srgb,var(--color-destructive)_24%,transparent)]",
                                      )}
                                    >
                                      <span className={cn(
                                        "absolute inset-1 rounded-full border border-current/20 opacity-60",
                                        item.tone === "working" && "animate-pulse",
                                        item.tone === "review" && "animate-pulse",
                                      )} />
                                      <Icon className="relative h-3.5 w-3.5" />
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <details className="group border border-border bg-background-base/20 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-foreground">
                <span className="font-mondwest text-display uppercase tracking-[0.14em]">Details</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {items.length} signals <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                </span>
              </summary>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {sortedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={`detail:${item.id}`}
                      to={item.href}
                      className="group/item flex items-start gap-3 border border-current/10 bg-card/45 p-3 transition-colors hover:border-current/30 hover:bg-muted/20"
                    >
                      <span className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                        item.tone === "ready" && "border-success/40 bg-success/10 text-success",
                        item.tone === "working" && "border-warning/40 bg-warning/10 text-warning",
                        item.tone === "review" && "border-destructive/40 bg-destructive/10 text-destructive",
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                          <Badge tone={readinessBadgeTone(item.tone)}>{readinessLabel(item.tone)}</Badge>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
                          <span>{item.kind}</span>
                          <span>·</span>
                          <span>{item.meta}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpsDeck({ data }: { data: LoadState }) {
  const attentionJobs = data.cronJobs
    .filter((job) => job.last_error || !job.enabled || getJobState(job).toLowerCase() === "paused")
    .slice(0, 5);
  const gatewayProfiles = data.profiles.filter((profile) => profile.gateway_running).length;
  const envReady = data.profiles.filter((profile) => profile.has_env).length;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Automation console</CardTitle>
            </div>
            <SectionLink to="/cron" label="Open Cron" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 pb-4">
            <MiniMetric label="Total" value={data.cronJobs.length} />
            <MiniMetric label="Enabled" value={data.cronJobs.filter((job) => job.enabled).length} />
            <MiniMetric label="Attention" value={attentionJobs.length} />
          </div>
          {attentionJobs.length === 0 ? (
            <EmptySignal
              icon={CheckCircle2}
              tone="success"
              title="Automation board clean"
              body="No paused or failed automations need attention."
            />
          ) : (
            <div className="divide-y divide-border">
              {attentionJobs.map((job) => (
                <Link
                  key={`${job.profile ?? "default"}:${job.id}`}
                  to="/cron"
                  className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-muted/20"
                >
                  <div className="min-w-0 px-1">
                    <p className="truncate text-sm text-foreground">{getJobTitle(job)}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {job.last_error || job.schedule_display || job.schedule?.display || job.id}
                    </p>
                  </div>
                  <Badge tone={jobTone(job)}>{getJobState(job)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Profile readiness</CardTitle>
            </div>
            <SectionLink to="/profiles" label="Open Profiles" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 pb-4">
            <MiniMetric label="Installed" value={data.profiles.length} />
            <MiniMetric label="Env ready" value={envReady} />
            <MiniMetric label="Gateways" value={gatewayProfiles} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.profiles.slice(0, 8).map((profile) => (
              <Link
                key={profile.name}
                to="/profiles"
                className="group border border-border bg-muted/10 p-3 transition-colors hover:border-current/30 hover:bg-muted/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono-ui text-sm text-foreground">{profile.name}</p>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      profile.gateway_running ? "bg-success shadow-[0_0_12px_var(--color-success)]" : "bg-muted-foreground/40",
                    )}
                  />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {profile.provider || "provider default"} · {profile.model || "model default"}
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommandDock() {
  const commands = [
    { label: "Launch chat", detail: "Start hands-on agent work", href: "/chat", icon: Rocket },
    { label: "System doctor", detail: "Health, credentials, hooks", href: "/system", icon: ShieldCheck },
    { label: "Channels", detail: "Gateway and platforms", href: "/channels", icon: Radio },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {commands.map((command) => {
        const Icon = command.icon;
        return (
          <Link
            key={command.href}
            to={command.href}
            className="group relative overflow-hidden border border-border bg-card/65 p-4 transition-all hover:-translate-y-0.5 hover:border-current/30 hover:bg-card/90"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-midground/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <Icon className="mb-3 h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                <p className="text-sm font-medium text-foreground">{command.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{command.detail}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SectionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      to={to}
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function EmptySignal({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: LucideIcon;
  tone: BadgeTone;
  title: string;
  body: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success border-success/30 bg-success/5"
      : tone === "warning"
        ? "text-warning border-warning/30 bg-warning/5"
        : "text-muted-foreground border-border bg-muted/20";
  return (
    <div className={cn("flex items-center gap-3 border p-4 text-sm", toneClass)}>
      <Icon className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-background-base/35 p-2.5 backdrop-blur-sm">
      <p className="font-mondwest text-display text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono-ui text-lg text-foreground">{value}</p>
    </div>
  );
}

export default function MissionControlPage() {
  const [data, setData] = useState<LoadState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<MissionView>("overview");
  const [spotlight, setSpotlight] = useState({ x: 72, y: 18 });
  const [selectedMetric, setSelectedMetric] = useState("gateway");
  const { setEnd } = usePageHeader();

  const loadActivity = useCallback(async () => {
    try {
      const activity = await api.getMissionControlActivity({ timeoutMs: MISSION_CONTROL_ACTIVITY_TIMEOUT_MS });
      setData((previous) => ({ ...previous, activity }));
      setLoading(false);
    } catch {
      setError("Mission-control live activity failed to load.");
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const timeout = { timeoutMs: MISSION_CONTROL_FULL_SOURCE_TIMEOUT_MS };
    const [status, sessions, cronJobs, profiles, kanbanBoards] = await Promise.allSettled([
      api.getStatus(timeout),
      api.getSessions(30, 0, timeout),
      api.getCronJobs("all", timeout),
      api.getProfiles(timeout),
      api.getKanbanBoards(timeout),
    ]);

    const selectedBoard =
      kanbanBoards.status === "fulfilled"
        ? kanbanBoards.value.current || kanbanBoards.value.boards[0]?.slug
        : undefined;
    const kanban = selectedBoard
      ? await api
          .getKanbanBoard(selectedBoard)
          .then((value) => ({ status: "fulfilled" as const, value }))
          .catch((reason) => ({ status: "rejected" as const, reason }))
      : kanbanBoards;

    setData((previous) => ({
      status: status.status === "fulfilled" ? status.value : previous.status,
      sessions: sessions.status === "fulfilled" ? sessions.value : previous.sessions,
      cronJobs: cronJobs.status === "fulfilled" ? cronJobs.value : previous.cronJobs,
      profiles: profiles.status === "fulfilled" ? profiles.value.profiles : previous.profiles,
      kanban: kanban.status === "fulfilled" && "columns" in kanban.value ? kanban.value : previous.kanban,
      activity: previous.activity,
      kanbanUnavailable: kanban.status === "rejected" || kanbanBoards.status === "rejected",
    }));
    const hardFailures = [status, sessions, cronJobs, profiles].filter(
      (result) => result.status === "rejected",
    );
    if (hardFailures.length > 0) {
      setError(
        `${hardFailures.length} mission-control data source${hardFailures.length === 1 ? "" : "s"} failed to load.`,
      );
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useLayoutEffect(() => {
    setEnd(
      <div className="flex items-center gap-2">
        <ViewSwitch view={view} onChange={setView} />
        <Button
          type="button"
          ghost
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            void load();
            void loadActivity();
          }}
          disabled={refreshing}
          aria-label="Refresh mission control"
        >
          {refreshing ? <Spinner /> : <RefreshCw />}
        </Button>
      </div>,
    );
    return () => setEnd(null);
  }, [load, loadActivity, refreshing, setEnd, view]);

  useEffect(() => {
    void Promise.resolve().then(load);
    void Promise.resolve().then(loadActivity);
  }, [load, loadActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void loadActivity();
      }
    }, MISSION_CONTROL_ACTIVITY_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadActivity]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void load();
      }
    }, MISSION_CONTROL_FULL_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  const metrics = useMemo(() => buildMetrics(data), [data]);
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const operations = useMemo(() => buildOperationsItems(data), [data]);
  const score = useMemo(() => computeMissionScore(data), [data]);
  const selectedMetricData =
    metrics.find((metric) => metric.id === selectedMetric) ?? metrics[0];
  const readiness = useMemo(() => {
    if (data.status?.gateway_exit_reason) {
      return { tone: "destructive" as BadgeTone, label: "Gateway needs attention" };
    }
    if (allTasks(data).some((task) => task.status === "blocked")) {
      return { tone: "warning" as BadgeTone, label: "Blocked work waiting" };
    }
    if (data.status?.gateway_running || (data.status?.active_sessions ?? 0) > 0) {
      return { tone: "success" as BadgeTone, label: "Systems live" };
    }
    return { tone: "secondary" as BadgeTone, label: "Standing by" };
  }, [data]);

  const heroStyle = {
    "--spotlight-x": `${spotlight.x}%`,
    "--spotlight-y": `${spotlight.y}%`,
  } as CSSProperties;

  if (loading) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden border border-border bg-card/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_55%)]" />
        <div className="relative flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="text-3xl text-primary" />
          <p className="font-mondwest text-display text-xs uppercase tracking-[0.18em]">Booting mission control</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PluginSlot name="mission-control:top" />

      <section
        className="group relative overflow-hidden border border-current/15 bg-card/70 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-5"
        style={heroStyle}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setSpotlight({
            x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
            y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
          });
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--spotlight-x)_var(--spotlight-y),color-mix(in_srgb,var(--color-primary)_24%,transparent),transparent_34%),linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_46%)] transition-opacity" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-current/10" />
        <div className="absolute -right-6 top-16 h-24 w-24 rounded-full border border-current/15" />

        <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-center">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={readiness.tone}>{readiness.label}</Badge>
              <Badge tone={data.status?.auth_required ? "success" : "outline"}>
                {data.status?.auth_required ? "gated" : "loopback"}
              </Badge>
              <Badge tone="outline">Config v{data.status?.config_version ?? "—"}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 items-center justify-center border border-current/20 bg-background-base/40 sm:flex">
                <Sparkles className="h-5 w-5 text-midground" />
              </div>
              <div>
                <h2 className="font-mondwest text-display text-4xl uppercase leading-none tracking-[0.08em] text-foreground sm:text-5xl">
                  Mission Control
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">
                  A live command surface for Hermes: system health, current conversations,
                  team queue, automations, profile readiness, and the next thing that needs you.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <MiniMetric label="Platforms" value={Object.keys(data.status?.gateway_platforms ?? {}).length} />
              <MiniMetric label="Profiles" value={data.profiles.length} />
              <MiniMetric label="Cron" value={data.cronJobs.length} />
              <MiniMetric label="Signals" value={timeline.length} />
            </div>
          </div>
          <MissionOrb
            metrics={metrics}
            score={score}
            selectedMetric={selectedMetric}
            onSelectMetric={setSelectedMetric}
          />
        </div>
      </section>

      {error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-sm text-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 border border-current/15 bg-card/55 p-2.5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <ViewSwitch view={view} onChange={setView} />
          {selectedMetricData && (
            <Badge tone={selectedMetricData.tone}>
              Focus: {selectedMetricData.label} · {selectedMetricData.value}
            </Badge>
          )}
        </div>
        {selectedMetricData && (
          <Link
            to={selectedMetricData.href}
            className="inline-flex items-center justify-center gap-2 border border-current/20 bg-background-base/35 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            Open {selectedMetricData.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            selected={selectedMetric === metric.id}
            onSelect={() => setSelectedMetric(metric.id)}
          />
        ))}
      </div>

      <ActiveOperationsBoard items={operations} profileTeams={data.activity?.profile_teams ?? []} />

      {view === "overview" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <MissionQueue data={data} />
          <Timeline items={timeline} />
        </div>
      )}

      {view === "work" && <MissionQueue data={data} />}

      {view === "ops" && <OpsDeck data={data} />}

      <CommandDock />
      <PluginSlot name="mission-control:bottom" />
    </div>
  );
}
