import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
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
  FileText,
  Gauge,
  MessageSquare,
  Radio,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Terminal,
  Users,
  X,
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
import { Switch } from "@nous-research/ui/ui/components/switch";
import { usePageHeader } from "@/contexts/usePageHeader";
import { api } from "@/lib/api";
import type {
  CronJob,
  KanbanBoardResponse,
  KanbanBoardsResponse,
  KanbanTaskDetailResponse,
  KanbanTaskEvent,
  KanbanTaskRun,
  KanbanTaskSummary,
  KanbanTaskUpdate,
  MissionControlActivityResponse,
  MissionControlProfileTeam,
  MissionControlProfileTeamAgent,
  MissionControlTeamWorkflowStep,
  PaginatedSessions,
  ProfileInfo,
  SessionInfo,
  SkillInfo,
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
  kanbanBoards: KanbanBoardsResponse | null;
  kanbanByBoard: Record<string, KanbanBoardResponse>;
  activity: MissionControlActivityResponse | null;
  kanbanUnavailable: boolean;
};

type BadgeTone = "success" | "warning" | "destructive" | "secondary" | "outline";
type MissionView = "overview" | "work" | "ops";
type TeamFilter = "all" | string;
type MissionControlSoundSetting = MissionControlDing | "announce" | "terminalAnnounce";
type MissionControlSoundSettings = Record<MissionControlSoundSetting, boolean>;
type MissionTask = KanbanTaskSummary & {
  column: string;
  boardSlug: string;
  boardName: string;
};

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
  category: string;
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
  performanceRisk?: PerformanceRisk;
  popoverTitle?: string;
  popoverSubtitle?: string;
  profileName?: string;
  roleName?: string;
  roleGlyph?: string;
  teamName?: string;
  projectPath?: string;
  currentTask?: MissionTask;
  outputPlan?: string;
  workflow?: MissionControlTeamWorkflowStep[];
  workflowSummary?: string;
  isTeamLead?: boolean;
};

type PerformanceRisk = {
  level: "warning" | "critical";
  label: string;
  detail: string;
};

type LightAgentModalState = {
  item: OperationsItem;
  profile: ProfileInfo | null;
};

type LightAgentProfileDetails = {
  loading: boolean;
  soul: { content: string; exists: boolean } | null;
  skills: SkillInfo[];
  error: string | null;
};

const MISSION_CONTROL_ACTIVITY_REFRESH_MS = 1000;
const MISSION_CONTROL_FULL_REFRESH_MS = 15000;
const MISSION_CONTROL_ACTIVITY_TIMEOUT_MS = 5000;
const MISSION_CONTROL_FULL_SOURCE_TIMEOUT_MS = 6000;
const MISSION_CONTROL_TEAM_FILTER_KEY = "missionControl.teamFilter";
const MISSION_CONTROL_SOUND_SETTINGS_KEY = "missionControl.soundSettings";
const ALL_TEAMS_FILTER = "all";
const TEAM_FEED_RECENT_SESSION_SECONDS = 60 * 60;
const MISSION_QUEUE_ATTENTION_STATUSES = new Set(["blocked", "review", "running"]);

type AudioContextConstructor = new () => AudioContext;
let missionControlAudioContext: AudioContext | null = null;

type MissionControlDing = "approval" | "done";

const emptyState: LoadState = {
  status: null,
  sessions: null,
  cronJobs: [],
  profiles: [],
  kanban: null,
  kanbanBoards: null,
  kanbanByBoard: {},
  activity: null,
  kanbanUnavailable: false,
};

function readCachedTeamFilter(): TeamFilter {
  if (typeof window === "undefined") return ALL_TEAMS_FILTER;
  return window.localStorage.getItem(MISSION_CONTROL_TEAM_FILTER_KEY) || ALL_TEAMS_FILTER;
}

function cacheTeamFilter(value: TeamFilter): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MISSION_CONTROL_TEAM_FILTER_KEY, value);
}

function readCachedSoundSettings(): MissionControlSoundSettings {
  const defaults: MissionControlSoundSettings = { approval: true, done: true, announce: true, terminalAnnounce: false };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(MISSION_CONTROL_SOUND_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MissionControlSoundSettings>;
    return {
      approval: parsed.approval ?? defaults.approval,
      done: parsed.done ?? defaults.done,
      announce: parsed.announce ?? defaults.announce,
      terminalAnnounce: parsed.terminalAnnounce ?? defaults.terminalAnnounce,
    };
  } catch {
    return defaults;
  }
}

function cacheSoundSettings(value: MissionControlSoundSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MISSION_CONTROL_SOUND_SETTINGS_KEY, JSON.stringify(value));
}

function boardLabel(board: { slug: string; name?: string | null }): string {
  return board.name?.trim() || board.slug;
}

function teamFilterLabel(data: LoadState, teamFilter: TeamFilter): string {
  if (teamFilter === ALL_TEAMS_FILTER) return "All teams";
  const board = data.kanbanBoards?.boards.find((item) => item.slug === teamFilter);
  return board ? boardLabel(board) : teamFilter;
}

function matchesTeamFilter(text: string, data: LoadState, teamFilter: TeamFilter): boolean {
  if (teamFilter === ALL_TEAMS_FILTER) return true;
  const label = teamFilterLabel(data, teamFilter).toLowerCase();
  const slug = teamFilter.toLowerCase();
  const haystack = text.toLowerCase();
  return haystack.includes(label) || haystack.includes(slug);
}

function secondsTime(value: number | string | null | undefined): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time / 1000;
}

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

function cronSignalMeta(job: CronJob): string {
  if (job.last_error) return `last error ${formatTime(job.last_run_at)}`;
  if (job.next_run_at) {
    const nextRun = secondsTime(job.next_run_at);
    const prefix = nextRun && nextRun < Date.now() / 1000 ? "overdue" : "next";
    return `${prefix} ${formatTime(job.next_run_at)}`;
  }
  return getJobState(job);
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

function boardTasks(board: KanbanBoardResponse | null | undefined, boardSlug: string, boardName: string): MissionTask[] {
  return (
    board?.columns.flatMap((column) =>
      column.tasks.map((task) => ({ ...task, column: column.name, boardSlug, boardName })),
    ) ?? []
  );
}

function allTasks(data: LoadState, teamFilter: TeamFilter = ALL_TEAMS_FILTER): MissionTask[] {
  if (teamFilter !== ALL_TEAMS_FILTER) {
    const boardMeta = data.kanbanBoards?.boards.find((board) => board.slug === teamFilter);
    const board = data.kanbanByBoard[teamFilter] ?? (data.kanbanBoards?.current === teamFilter ? data.kanban : null);
    return boardTasks(board, teamFilter, boardMeta ? boardLabel(boardMeta) : teamFilter);
  }

  const boards = data.kanbanBoards?.boards ?? [];
  if (boards.length === 0) {
    const fallbackSlug = data.kanbanBoards?.current || "current";
    return boardTasks(data.kanban, fallbackSlug, fallbackSlug);
  }

  return boards.flatMap((boardMeta) =>
    boardTasks(
      data.kanbanByBoard[boardMeta.slug] ?? (data.kanbanBoards?.current === boardMeta.slug ? data.kanban : null),
      boardMeta.slug,
      boardLabel(boardMeta),
    ),
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-success, #60d394)";
  if (score >= 55) return "var(--color-warning, #f2c94c)";
  return "var(--color-destructive, #ff6b6b)";
}

function computeMissionScore(data: LoadState): number {
  const tasks = allTasks(data);
  const activeCronErrors = data.cronJobs.filter((job) => job.enabled && job.last_error).length;
  const missingTeamProfiles = (data.activity?.profile_teams ?? [])
    .flatMap((team) => team.agents)
    .filter((agent) => !agent.configured).length;
  let score = 100;
  if (!data.status?.gateway_running) score -= 18;
  if (data.status?.gateway_exit_reason) score -= 25;
  if (data.kanbanUnavailable) score -= 12;
  score -= Math.min(tasks.filter((task) => task.status === "blocked").length * 14, 28);
  score -= Math.min(activeCronErrors * 12, 24);
  score -= Math.min(missingTeamProfiles * 4, 16);
  return Math.max(0, Math.min(100, score));
}

function buildMetrics(data: LoadState): MissionMetric[] {
  const tasks = allTasks(data);
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const liveWorkers = tasks.filter((task) => task.status === "running").length;
  const terminalLights = buildOperationsItems(data).filter((item) => activitySegment(item) === "terminals").length;
  const trackedConversations = data.sessions?.total ?? data.sessions?.sessions.length ?? 0;
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
      accent: "from-cyan-400/18 via-sky-300/6 to-transparent",
    },
    {
      id: "sessions",
      label: "Active sessions",
      value: formatCount(terminalLights),
      detail: `${formatCount(trackedConversations)} total conversations tracked`,
      tone: terminalLights > 0 ? "success" : "secondary",
      icon: MessageSquare,
      href: "/sessions",
      accent: "from-indigo-500/18 via-indigo-300/6 to-transparent",
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
      accent: "from-violet-500/18 via-purple-300/6 to-transparent",
    },
    {
      id: "automation",
      label: "Next automation",
      value: nextCron ? formatTime(nextCron.next_run_at) : "None queued",
      detail: nextCron ? getJobTitle(nextCron) : `${formatCount(data.cronJobs.length)} cron jobs configured`,
      tone: nextCron ? jobTone(nextCron) : "secondary",
      icon: CalendarClock,
      href: "/cron",
      accent: "from-amber-400/18 via-orange-300/6 to-transparent",
    },
  ];
}

function teamFilterOptions(data: LoadState): Array<{ value: TeamFilter; label: string }> {
  const boardOptions = (data.kanbanBoards?.boards ?? []).map((board) => ({
    value: board.slug,
    label: boardLabel(board),
  }));
  return [{ value: ALL_TEAMS_FILTER, label: "All teams" }, ...boardOptions];
}

function TeamFilterSelect({
  data,
  value,
  onChange,
  label = "Team",
}: {
  data: LoadState;
  value: TeamFilter;
  onChange: (value: TeamFilter) => void;
  label?: string;
}) {
  const options = teamFilterOptions(data);
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-[0.12em]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-border bg-background-base/70 px-2 py-1 text-xs text-foreground outline-none transition-colors hover:border-current/30 focus:border-midground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function buildTimeline(data: LoadState, teamFilter: TeamFilter = ALL_TEAMS_FILTER): TimelineItem[] {
  const taskItems: TimelineItem[] = allTasks(data, teamFilter)
    .filter((task) => ["blocked", "review", "running", "ready"].includes(task.status))
    .slice(0, 4)
    .map((task) => ({
      id: `task:${task.id}`,
      category: "Task",
      title: task.title || task.id,
      detail: task.latest_summary || task.body || `${task.boardName} · ${task.column}${task.assignee ? ` · ${task.assignee}` : ""}`,
      meta: task.status === "running" ? "active now" : task.status,
      tone: taskTone(task),
      icon: task.status === "blocked" ? AlertTriangle : CircleDot,
      href: "/team",
    }));

  const now = Date.now() / 1000;
  const sessionItems: TimelineItem[] = (data.sessions?.sessions ?? [])
    .filter((session: SessionInfo) => {
      const lastActive = secondsTime(session.last_active);
      const recent = Boolean(lastActive && now - lastActive <= TEAM_FEED_RECENT_SESSION_SECONDS);
      const title = `${session.title ?? ""} ${session.preview ?? ""}`;
      return (session.is_active || recent) && matchesTeamFilter(title, data, teamFilter);
    })
    .slice(0, 2)
    .map((session: SessionInfo) => ({
      id: `session:${session.id}`,
      category: "Session",
      title: session.title || session.preview || "Untitled session",
      detail: `${session.is_active ? "Active conversation" : "Recent conversation"} · ${session.message_count} messages · ${session.tool_call_count} tools`,
      meta: session.is_active ? "active now" : formatTime(session.last_active),
      tone: session.is_active ? "success" : "secondary" as BadgeTone,
      icon: MessageSquare,
      href: "/sessions",
    }));

  const jobItems: TimelineItem[] = data.cronJobs
    .filter((job) => job.last_error || !job.enabled || job.next_run_at)
    .filter((job) => matchesTeamFilter(`${getJobTitle(job)} ${job.prompt ?? ""} ${job.script ?? ""} ${job.schedule_display ?? ""} ${job.schedule?.display ?? ""}`, data, teamFilter))
    .slice(0, 3)
    .map((job) => ({
      id: `job:${job.profile ?? "default"}:${job.id}`,
      category: job.last_error ? "Automation error" : "Automation",
      title: getJobTitle(job),
      detail: job.last_error
        ? `${job.schedule_display || job.schedule?.display || "Scheduled automation"} · ${job.last_error}`
        : job.schedule_display || job.schedule?.display || "Scheduled automation",
      meta: cronSignalMeta(job),
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

async function playMissionControlApprovalDing(): Promise<void> {
  await playMissionControlDing("approval");
}

async function playMissionControlDoneDing(): Promise<void> {
  await playMissionControlDing("done");
}

async function playMissionControlAnnouncement(text: string, kind: MissionControlDing = "done"): Promise<void> {
  await api.playMissionControlAnnouncement(text, kind);
}

function terminalAnnouncementSubject(item: OperationsItem): string {
  const marker = `${item.title} ${item.detail} ${item.meta}`.toLowerCase();
  if (marker.includes("juror")) return "Juror Research task";
  if (marker.includes("hermes-team-ui") || marker.includes("hermes team ui") || marker.includes("mission control")) {
    return "Hermes Team UI task";
  }
  if (marker.includes("/users/roryavant/dev") || marker.includes(" dev · ")) return "Dev task";
  if (item.kind.toLowerCase().includes("claude")) return "Claude Code task";
  if (item.kind.toLowerCase().includes("hermes")) return "Hermes task";
  return "Terminal task";
}

function terminalResultAnnouncement(item: OperationsItem, tone: ReadinessTone): string {
  const subject = terminalAnnouncementSubject(item);
  if (tone === "review") return `${subject} needs your approval.`;
  return `${subject} completed.`;
}

async function playMissionControlDing(kind: MissionControlDing): Promise<void> {
  try {
    await api.playMissionControlDing(kind);
    return;
  } catch {
    // Fall back to browser audio when the dashboard backend is stale or unavailable.
  }

  try {
    await playMissionControlAudioElementDing(kind);
    return;
  } catch {
    // Fall back to Web Audio if media playback is unavailable for this browser.
  }

  const context = await ensureMissionControlAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(kind === "approval" ? 0.32 : 0.24, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "approval" ? 0.62 : 0.5));
  master.connect(context.destination);

  const playTone = (frequency: number, startOffset: number, stopOffset: number) => {
    const oscillator = context.createOscillator();
    const toneGain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now + startOffset);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, now + stopOffset);
    toneGain.gain.setValueAtTime(0.0001, now + startOffset);
    toneGain.gain.exponentialRampToValueAtTime(0.95, now + startOffset + 0.012);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + stopOffset);
    oscillator.connect(toneGain);
    toneGain.connect(master);
    oscillator.start(now + startOffset);
    oscillator.stop(now + stopOffset + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      toneGain.disconnect();
    };
  };

  if (kind === "approval") {
    playTone(880, 0, 0.22);
    playTone(1320, 0.18, 0.56);
  } else {
    playTone(660, 0, 0.16);
    playTone(990, 0.12, 0.38);
  }

  window.setTimeout(() => master.disconnect(), 750);
}

async function playMissionControlAudioElementDing(kind: MissionControlDing): Promise<void> {
  if (typeof window === "undefined") return;
  const audio = new Audio(missionControlDingDataUrl(kind));
  audio.volume = 1;
  await audio.play();
}

function missionControlDingDataUrl(kind: MissionControlDing): string {
  const sampleRate = 44100;
  const durationSeconds = kind === "approval" ? 1.05 : 0.72;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2;
  const headerBytes = 44;
  const dataBytes = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(headerBytes + dataBytes);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataBytes, true);

  const tones = kind === "approval"
    ? [{ start: 0, end: 0.34, frequency: 880 }, { start: 0.28, end: 0.92, frequency: 1320 }]
    : [{ start: 0, end: 0.24, frequency: 660 }, { start: 0.18, end: 0.62, frequency: 990 }];

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    let value = 0;
    for (const tone of tones) {
      if (t < tone.start || t > tone.end) continue;
      const local = (t - tone.start) / (tone.end - tone.start);
      const envelope = Math.sin(Math.PI * local);
      value += Math.sin(2 * Math.PI * tone.frequency * t) * envelope;
    }
    const clamped = Math.max(-1, Math.min(1, value * 0.42));
    view.setInt16(headerBytes + i * bytesPerSample, clamped * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${window.btoa(binary)}`;
}

async function ensureMissionControlAudioContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  const AudioContextCtor: AudioContextConstructor | undefined =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  const context = missionControlAudioContext ?? new AudioContextCtor();
  missionControlAudioContext = context;
  if (context.state === "suspended") {
    await context.resume();
  }
  return context;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function performanceRiskFromTelemetry(source: {
  context_percent?: number | null;
  context_tokens?: number | null;
  context_length?: number | null;
  compressions?: number | null;
}): PerformanceRisk | undefined {
  const contextPercent = numberOrNull(source.context_percent);
  const compressions = numberOrNull(source.compressions);
  const critical = (contextPercent !== null && contextPercent >= 95) || (compressions !== null && compressions >= 10);
  const warning = critical || (contextPercent !== null && contextPercent >= 80) || (compressions !== null && compressions >= 5);
  if (!warning) return undefined;

  const label = compressions !== null && compressions >= 5 ? `C${compressions}` : `${Math.round(contextPercent ?? 0)}%`;
  const parts = [
    contextPercent !== null ? `${Math.round(contextPercent)}% context window` : null,
    compressions !== null ? `${compressions} compression${compressions === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return {
    level: critical ? "critical" : "warning",
    label,
    detail: `Likely degraded by ${parts.join(" + ")}.`,
  };
}

function ActivityLightPopover({ item, rowLabel }: { item: OperationsItem; rowLabel: string }) {
  const title = item.popoverTitle || item.title;
  const subtitle = item.popoverSubtitle || item.kind;

  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2",
        "border border-current/20 bg-popover/95 p-3 text-left text-popover-foreground shadow-2xl backdrop-blur-md",
        "group-hover:block group-focus:block",
      )}
      role="tooltip"
    >
      <span className="block font-mondwest text-display text-xs uppercase tracking-[0.16em] text-foreground">
        {title}
      </span>
      <span className="mt-1 block truncate font-mono-ui text-xs text-midground">{subtitle}</span>
      <span className="mt-2 flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
        <span>{rowLabel.split(" · ")[0]}</span>
        <span>·</span>
        <span>{readinessLabel(item.tone)}</span>
      </span>
      <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
      {item.currentTask && (
        <span className="mt-2 block border-t border-current/10 pt-2 text-xs leading-relaxed text-foreground/90">
          Working: {item.currentTask.title || item.currentTask.id}
        </span>
      )}
      {item.outputPlan && (
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          Output: {item.outputPlan}
        </span>
      )}
      {item.performanceRisk && (
        <span className="mt-2 block text-xs leading-relaxed text-warning">
          {item.performanceRisk.detail}
        </span>
      )}
      <span className="mt-2 block truncate text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
        {item.meta}
      </span>
      <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-current/20 bg-popover/95" />
    </span>
  );
}

function profileChatPath(profileName: string | null | undefined): string {
  return profileName ? `/chat?profile=${encodeURIComponent(profileName)}` : "/chat";
}

function LightAgentModal({
  details,
  modal,
  onClose,
}: {
  details: LightAgentProfileDetails;
  modal: LightAgentModalState;
  onClose: () => void;
}) {
  const { item, profile } = modal;
  const enabledSkills = details.skills.filter((skill) => skill.enabled);
  const disabledSkills = details.skills.filter((skill) => !skill.enabled);
  const soulText = details.soul?.content.trim();
  const launchHref = profileChatPath(item.profileName || profile?.name);
  const targetProfile = item.profileName || profile?.name || "";
  const currentTask = item.currentTask;
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!targetProfile || !trimmed || sending) return;
    setSending(true);
    setSendStatus(null);
    setSendError(null);
    try {
      const result = await api.sendMissionControlProfileMessage(targetProfile, { message: trimmed });
      setMessage("");
      setSendStatus(result.message || `Message sent to ${targetProfile}.`);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background-base/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="light-agent-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[86vh] w-full max-w-4xl overflow-hidden border border-midground/30 bg-card shadow-[0_0_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-midground/70 to-transparent" />
        <div className="flex items-start justify-between gap-4 border-b border-border bg-background-base/35 p-4">
          <div className="min-w-0">
            <p className="font-mondwest text-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Light agent dossier
            </p>
            <h2 id="light-agent-modal-title" className="mt-1 truncate text-2xl font-semibold text-foreground">
              {item.roleName || item.popoverTitle || item.title}
            </h2>
            <p className="mt-1 truncate font-mono-ui text-sm text-midground">
              {item.profileName || profile?.name || item.popoverSubtitle || item.kind}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={launchHref}
              onClick={onClose}
              className="inline-flex h-9 items-center gap-2 border border-border bg-background-base/50 px-3 font-mondwest text-display text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-success/50 hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open full chat
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background-base/60 text-muted-foreground transition-colors hover:border-current/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close agent details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(86vh-5rem)] overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="border border-border bg-background-base/35 p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Team</p>
              <p className="mt-1 truncate text-sm text-foreground">{item.teamName || "Profile team"}</p>
            </div>
            <div className="border border-border bg-background-base/35 p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Status</p>
              <p className="mt-1 text-sm text-foreground">{readinessLabel(item.tone)} · {item.meta}</p>
            </div>
            <div className="border border-border bg-background-base/35 p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Model</p>
              <p className="mt-1 truncate text-sm text-foreground">
                {[profile?.provider, profile?.model].filter(Boolean).join(" · ") || "default model"}
              </p>
            </div>
            <div className="border border-border bg-background-base/35 p-3">
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Skills</p>
              <p className="mt-1 text-sm text-foreground">
                {details.loading ? "Loading…" : `${enabledSkills.length}/${details.skills.length || profile?.skill_count || 0} enabled`}
              </p>
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="mt-4 border border-success/25 bg-success/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-mondwest text-display text-sm uppercase tracking-[0.16em] text-foreground">Send a quick message</h3>
                <p className="mt-1 text-xs text-muted-foreground">Runs in the background and keeps you on Mission Control.</p>
              </div>
              {targetProfile ? <Badge tone="success">{targetProfile}</Badge> : <Badge tone="outline">no profile</Badge>}
            </div>
            {item.isTeamLead && item.workflow && item.workflow.length > 0 && (
              <div className="mb-3 border border-warning/25 bg-warning/5 p-3 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-mondwest text-display uppercase tracking-[0.16em] text-warning">Team workflow template</p>
                  <Badge tone="warning">lead-first</Badge>
                </div>
                <ol className="space-y-1.5 text-muted-foreground">
                  {item.workflow.map((step, index) => (
                    <li key={`${step.label}-${index}`} className="flex gap-2">
                      <span className="font-mono-ui text-warning">{index + 1}.</span>
                      <span>
                        <span className="text-foreground">{step.label}</span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="uppercase tracking-[0.12em]">{step.mode === "parallel" ? "parallel" : "sequence"}</span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="font-mono-ui">{step.profiles.join(" → ")}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 leading-5 text-muted-foreground">
                  Sending this lead queues the whole template, but only the first ready phase dispatches immediately; downstream cards wait on linked parent tasks.
                </p>
              </div>
            )}
            <textarea
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setSendStatus(null);
                setSendError(null);
              }}
              rows={3}
              disabled={sending || !targetProfile}
              placeholder={targetProfile ? `Message ${targetProfile}…` : "This light is not tied to an installed profile."}
              className="min-h-24 w-full resize-y border border-border bg-background-base/70 p-3 font-mono-ui text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-success/60 focus:ring-1 focus:ring-success/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5 text-xs">
                {sendStatus ? <span className="text-success">{sendStatus}</span> : null}
                {sendError ? <span className="text-destructive">{sendError}</span> : null}
              </div>
              <button
                type="submit"
                disabled={sending || !targetProfile || !message.trim()}
                className="inline-flex h-9 items-center gap-2 border border-success/45 bg-success/10 px-3 font-mondwest text-display text-xs uppercase tracking-[0.14em] text-success transition-colors hover:border-success/70 hover:bg-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Spinner /> : <MessageSquare className="h-3.5 w-3.5" />}
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <section className="space-y-4">
              <div className="border border-border bg-background-base/25 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-mondwest text-display text-sm uppercase tracking-[0.16em] text-foreground">Current work</h3>
                  {currentTask ? <Badge tone={taskTone(currentTask)}>{currentTask.status}</Badge> : <Badge tone="outline">idle</Badge>}
                </div>
                {currentTask ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Item</p>
                      <p className="mt-1 font-medium text-foreground">{currentTask.title || currentTask.id}</p>
                      <p className="mt-1 font-mono-ui text-xs text-midground">{currentTask.id} · {currentTask.boardName} · {currentTask.assignee || "unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Planned output use</p>
                      <p className="mt-1 leading-6 text-foreground/90">{item.outputPlan || outputPlanForTask(currentTask)}</p>
                    </div>
                    {(currentTask.latest_summary || currentTask.body) && (
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Work brief / latest note</p>
                        <p className="mt-1 line-clamp-6 whitespace-pre-wrap leading-6 text-muted-foreground">{currentTask.latest_summary || currentTask.body}</p>
                      </div>
                    )}
                    <Link
                      to={`/kanban?task=${encodeURIComponent(currentTask.id)}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
                    >
                      Open task <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No running Kanban item is assigned to this profile right now.</p>
                )}
              </div>

              <div className="border border-border bg-background-base/25 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-mondwest text-display text-sm uppercase tracking-[0.16em] text-foreground">SOUL.md</h3>
                  {details.soul?.exists ? <Badge tone="success">loaded</Badge> : <Badge tone="outline">missing</Badge>}
                </div>
                {details.loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading profile identity…</div>
                ) : details.error ? (
                  <p className="text-sm text-destructive">{details.error}</p>
                ) : soulText ? (
                  <pre className="max-h-[22rem] overflow-auto whitespace-pre-wrap break-words rounded border border-border/70 bg-background-base/70 p-3 font-mono text-xs leading-5 text-foreground/90">
                    {soulText}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No SOUL.md is set for this profile yet.</p>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <section className="border border-border bg-background-base/25 p-4">
                <h3 className="font-mondwest text-display text-sm uppercase tracking-[0.16em] text-foreground">Profile details</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Path</dt><dd className="mt-0.5 break-words font-mono-ui text-xs text-foreground">{profile?.path || item.projectPath || "Profile not installed"}</dd></div>
                  <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Role</dt><dd className="mt-0.5 text-foreground">{item.roleName || item.title}</dd></div>
                  <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current signal</dt><dd className="mt-0.5 text-foreground">{item.detail}</dd></div>
                  {profile?.description && <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Description</dt><dd className="mt-0.5 text-muted-foreground">{profile.description}</dd></div>}
                </dl>
              </section>

              <section className="border border-border bg-background-base/25 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-mondwest text-display text-sm uppercase tracking-[0.16em] text-foreground">Skills</h3>
                  <Badge tone="outline">{details.skills.length || profile?.skill_count || 0}</Badge>
                </div>
                {details.loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading skills…</div>
                ) : details.skills.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                      {enabledSkills.map((skill) => <Badge key={skill.name} tone="success">{skill.name}</Badge>)}
                    </div>
                    {disabledSkills.length > 0 && (
                      <div>
                        <p className="mb-2 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Disabled</p>
                        <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
                          {disabledSkills.map((skill) => <Badge key={skill.name} tone="outline">{skill.name}</Badge>)}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No skill list was available for this profile.</p>
                )}
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function runtimeSourceLabel(source: string): string {
  if (source === "cli") return "Local Hermes CLI";
  if (source === "tui") return "Local Hermes TUI";
  if (source === "claude") return "Claude Code";
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
  return { review: 0, working: 1, ready: 2 }[tone];
}

function groupedActivityRows(segment: ActivitySegment, items: OperationsItem[]) {
  const rows = new Map<string, OperationsItem[]>();
  for (const item of items) {
    const label = activityGroupLabel(segment, item);
    rows.set(label, [...(rows.get(label) ?? []), item]);
  }
  const sortedRows = [...rows.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (segment === "terminals") {
    return sortedRows.map(([label, rowItems]) => ({
      label,
      items: [...rowItems].sort((a, b) => a.id.localeCompare(b.id) || a.title.localeCompare(b.title)),
    }));
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

function glyphForTeamRole(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized.includes("strategist")) return "strategy";
  if (normalized.includes("scout")) return "scout";
  if (normalized.includes("analyst")) return "analyst";
  if (normalized.includes("fact")) return "fact check";
  if (normalized.includes("copywriter")) return "copy";
  if (normalized.includes("calendar")) return "calendar";
  if (normalized.includes("analytics")) return "analytics";
  if (normalized.includes("growth")) return "growth";
  if (normalized.includes("brand")) return "brand";
  if (normalized.includes("assets")) return "assets";
  if (normalized.includes("ideation")) return "ideation";
  if (normalized.includes("planner")) return "planner";
  if (normalized.includes("implementor")) return "implementor";
  if (normalized.includes("builder")) return "builder";
  if (normalized.includes("designer")) return "designer";
  if (normalized.includes("vision") || normalized.includes("qa")) return "vision qa";
  if (normalized.includes("reviewer")) return "reviewer";
  if (normalized.includes("synth")) return "synth";
  if (normalized.includes("curator")) return "curator";
  return "agent";
}

function linkedChildCount(task: MissionTask): number {
  const maybeCounts = task as MissionTask & { link_counts?: { children?: number } };
  return Math.max(0, Number(maybeCounts.link_counts?.children ?? 0) || 0);
}

function outputPlanForTask(task: MissionTask): string {
  const childCount = linkedChildCount(task);
  const downstream = childCount > 0
    ? ` That handoff feeds forward to ${childCount} downstream linked task${childCount === 1 ? "" : "s"} for the next teammate to use.`
    : " If no linked next task is recorded yet, the handoff still feeds forward through the team activity/history for the next teammate to pick up.";
  if (task.status === "running") {
    return `The worker should write a handoff summary/result back to this Kanban item, then move it to review or done.${downstream}`;
  }
  if (task.status === "review") {
    return `The handoff is waiting for review; accepting it lets the team feed the summary/result into the next dependent work.${downstream}`;
  }
  if (task.status === "ready") {
    return `This item is queued for a worker; its future handoff becomes the team handoff summary/result.${downstream}`;
  }
  return `The task output is tracked on the Kanban item as summary/result so it can feed forward to the team.${downstream}`;
}

function taskSortKey(task: MissionTask): [number, number] {
  const statusRank: Record<string, number> = { running: 0, review: 1, blocked: 2, ready: 3, scheduled: 4, todo: 5 };
  return [statusRank[task.status] ?? 99, -(task.started_at ?? task.created_at ?? 0)];
}

function currentTaskByProfile(data: LoadState): Map<string, MissionTask> {
  const tasks = allTasks(data).filter((task) => task.assignee && ["running", "review", "blocked", "ready", "scheduled", "todo"].includes(task.status));
  const byProfile = new Map<string, MissionTask>();
  for (const task of [...tasks].sort((a, b) => {
    const aKey = taskSortKey(a);
    const bKey = taskSortKey(b);
    return aKey[0] - bKey[0] || aKey[1] - bKey[1] || a.id.localeCompare(b.id);
  })) {
    const assignee = task.assignee?.trim().toLowerCase();
    if (assignee && !byProfile.has(assignee)) byProfile.set(assignee, task);
  }
  return byProfile;
}

function missionTaskStatusSnapshot(data: LoadState): Map<string, string> {
  return new Map(allTasks(data).map((task) => [`${task.boardSlug}:${task.id}`, task.status]));
}

function missionTaskDoneAnnouncements(data: LoadState, previousStatuses: Map<string, string> | null): string[] {
  if (!previousStatuses) return [];
  return allTasks(data)
    .filter((task) => {
      const previous = previousStatuses.get(`${task.boardSlug}:${task.id}`);
      return task.status === "done" && previous !== undefined && previous !== "done";
    })
    .slice(0, 2)
    .map((task) => {
      const owner = task.assignee?.trim() || task.boardName;
      const title = task.title || task.id;
      return `Mission Control: ${owner} finished ${title}.`;
    });
}

function agentToOperationsItem(team: MissionControlProfileTeam, agent: MissionControlProfileTeamAgent, taskByProfile: Map<string, MissionTask>) {
  const currentTask = taskByProfile.get(agent.profile.toLowerCase());
  return {
    id: `team-profile:${team.team_id}:${agent.profile}`,
    kind: "Team profile",
    title: `${agent.role} · ${agent.profile}`,
    detail: currentTask
      ? `working ${currentTask.id}: ${currentTask.title || currentTask.id}`
      : agent.detail || (agent.active ? "live profile agent" : "profile standby"),
    meta: agent.active
      ? [agent.source, agent.pid ? `pid ${agent.pid}` : ""].filter(Boolean).join(" · ")
      : agent.configured ? "standby profile" : "missing profile",
    tone: toneFromProfileStatus(agent.status, agent.configured),
    href: "/profiles",
    icon: Users,
    popoverTitle: agent.role,
    popoverSubtitle: agent.profile,
    profileName: agent.profile,
    roleName: agent.role,
    roleGlyph: glyphForTeamRole(agent.role),
    teamName: team.label,
    projectPath: team.project_path,
    currentTask,
    outputPlan: currentTask ? outputPlanForTask(currentTask) : undefined,
    workflow: agent.is_orchestrator ? team.workflow : undefined,
    workflowSummary: agent.is_orchestrator ? team.workflow_summary : undefined,
    isTeamLead: Boolean(agent.is_orchestrator),
    performanceRisk: performanceRiskFromTelemetry(agent),
  } as const;
}

function teamRowsFromProfileTeams(profileTeams: MissionControlProfileTeam[], taskByProfile: Map<string, MissionTask>) {
  return profileTeams.map((team) => {
    const orchestratorAgent = team.agents.find((a) => a.is_orchestrator) ?? null;
    const memberAgents = team.agents.filter((a) => !a.is_orchestrator);
    return {
      label: `${team.label} · ${team.project_path}`,
      orchestratorItem: orchestratorAgent ? agentToOperationsItem(team, orchestratorAgent, taskByProfile) : null,
      items: memberAgents.map((agent) => agentToOperationsItem(team, agent, taskByProfile)),
      workflow: team.workflow ?? [],
      workflowSummary: team.workflow_summary ?? "",
    };
  });
}

function workflowStagesForTeam(items: OperationsItem[], workflow: MissionControlTeamWorkflowStep[] | undefined) {
  const byProfile = new Map(items.map((item) => [item.profileName?.toLowerCase(), item]).filter(([profile]) => Boolean(profile)) as Array<[string, OperationsItem]>);
  const used = new Set<string>();
  const stages = (workflow ?? [])
    .map((step) => {
      const stageItems = step.profiles
        .map((profile) => byProfile.get(profile.toLowerCase()))
        .filter((item): item is OperationsItem => Boolean(item));
      stageItems.forEach((item) => {
        if (item.profileName) used.add(item.profileName.toLowerCase());
      });
      return {
        label: step.label,
        mode: step.mode === "parallel" ? "parallel" : "sequence",
        items: stageItems,
      };
    })
    .filter((stage) => stage.items.length > 0);

  const unmatched = items.filter((item) => !item.profileName || !used.has(item.profileName.toLowerCase()));
  return [
    ...stages,
    ...unmatched.map((item) => ({
      label: item.roleName || item.roleGlyph || item.kind,
      mode: "sequence",
      items: [item],
    })),
  ];
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
      kind: profileTeamProfiles.has(record.profile) ? "Profile agent" : record.source === "claude" ? "Claude Code terminal" : runtimeSourceLabel(record.source) === "Local Hermes CLI" || runtimeSourceLabel(record.source) === "Local Hermes TUI" ? "Hermes terminal" : runtimeSourceLabel(record.source),
      title: record.detail || record.session_id || `${record.source} activity`,
      detail: [record.profile, record.cwd].filter(Boolean).join(" · ") || "Local Hermes runtime heartbeat",
      meta: record.pid ? `pid ${record.pid} · ${formatTime(record.last_seen)}` : formatTime(record.last_seen),
      tone: record.status === "ready" ? "ready" : record.status === "working" ? "working" : "review",
      href: record.source === "kanban" ? "/team" : "/sessions",
      icon: record.source === "kanban" || record.source === "delegate" ? Users : record.source === "claude" ? Terminal : Activity,
      performanceRisk: performanceRiskFromTelemetry(record),
    }));

  // PTY sessions are already projected into activity rows by the backend so
  // they can be deduped with runtime heartbeats and local process scans. Keep
  // those `pty:*` activity rows in runtimeItems so approval/review prompts turn
  // into visible red terminal lights. Do not also render raw `terminals` here;
  // that creates a second light for the same dashboard terminal.
  const terminalItems: OperationsItem[] = [];

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
    <div className="mission-orb relative mx-auto flex aspect-square w-full max-w-[18.5rem] items-center justify-center">
      <div className="mission-orb__halo absolute inset-0 rounded-full" />
      <div className="mission-orb__sweep absolute inset-5 rounded-full" />
      <div className="absolute inset-3 rounded-full border border-current/10 bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-success)_20%,transparent),transparent_58%)]" />
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
      <div className="relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-full border border-success/30 bg-background-base/85 text-center shadow-[0_0_55px_color-mix(in_srgb,var(--color-success)_24%,transparent)] backdrop-blur-md">
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
                ? "scale-110 border-success/70 bg-success/15 text-success shadow-[0_0_28px_color-mix(in_srgb,var(--color-success)_42%,transparent)]"
                : "border-current/20 bg-background-base/75 text-muted-foreground hover:scale-105 hover:border-success/40 hover:text-foreground",
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

const METRIC_ACCENTS: Record<string, { left: string; glow: string; orb: string; color: string }> = {
  gateway:    { left: "from-cyan-400 to-cyan-600",    glow: "hover:shadow-[0_0_80px_rgba(34,211,238,0.22),inset_0_0_40px_rgba(34,211,238,0.04)]",    orb: "bg-cyan-400",    color: "rgba(34,211,238," },
  sessions:   { left: "from-indigo-400 to-indigo-600", glow: "hover:shadow-[0_0_80px_rgba(99,102,241,0.22),inset_0_0_40px_rgba(99,102,241,0.04)]",    orb: "bg-indigo-400",  color: "rgba(99,102,241," },
  team:       { left: "from-violet-400 to-violet-600", glow: "hover:shadow-[0_0_80px_rgba(167,139,250,0.22),inset_0_0_40px_rgba(167,139,250,0.04)]",  orb: "bg-violet-400",  color: "rgba(167,139,250," },
  automation: { left: "from-amber-400 to-amber-600",  glow: "hover:shadow-[0_0_80px_rgba(251,191,36,0.22),inset_0_0_40px_rgba(251,191,36,0.04)]",    orb: "bg-amber-400",   color: "rgba(251,191,36," },
};

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
  const accent = METRIC_ACCENTS[metric.id] ?? METRIC_ACCENTS.gateway;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "mission-metric-card group relative overflow-hidden border text-left transition-all duration-300",
        "bg-white/[0.025] backdrop-blur-2xl p-6",
        accent.glow,
        selected
          ? "border-white/20"
          : "border-white/[0.06] hover:border-white/12 hover:-translate-y-0.5",
      )}
    >
      {/* ambient fill */}
      <div className={`absolute inset-0 bg-gradient-to-br ${metric.accent} opacity-100`} />
      {/* vivid left border */}
      <div className={`absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${accent.left}`} />
      {/* corner orb */}
      <div className={`absolute -right-10 -top-10 h-48 w-48 rounded-full ${accent.orb} opacity-[0.07] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.13]`} />
      {/* glass sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-white/30">
            {metric.label}
          </p>
          <Badge tone={metric.tone}>{metric.tone === "success" ? "live" : metric.tone}</Badge>
        </div>
        <div>
          <p className="font-mono-ui text-[3.2rem] leading-none text-white">{metric.value}</p>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/8 bg-white/5">
              <Icon className="h-3 w-3 text-white/35" />
            </div>
            <p className="line-clamp-1 text-[0.7rem] text-white/30">{metric.detail}</p>
          </div>
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
    <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-1 backdrop-blur-xl">
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-all duration-200",
              active
                ? "bg-white/10 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-white/30 hover:text-white/60",
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

function Timeline({
  items,
  data,
  teamFilter,
  onTeamFilterChange,
}: {
  items: TimelineItem[];
  data: LoadState;
  teamFilter: TeamFilter;
  onTeamFilterChange: (value: TeamFilter) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Team signals</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Active work, matching sessions, and automations for the selected team.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TeamFilterSelect data={data} value={teamFilter} onChange={onTeamFilterChange} />
            <Badge tone="outline">{items.length} signals</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            Quiet team. No active tasks, recent matching sessions, or automation signals are surfacing for this filter.
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
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge tone="outline">{item.category}</Badge>
                          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                        </span>
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

const EDITABLE_KANBAN_STATUSES = ["triage", "todo", "scheduled", "ready", "blocked", "review", "done"] as const;

function payloadPreview(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  try {
    return JSON.stringify(payload).slice(0, 180);
  } catch {
    return "";
  }
}

function TaskDetailModal({
  assignees,
  detail,
  error,
  loading,
  onClose,
  onRefresh,
  task,
}: {
  assignees: string[];
  detail: KanbanTaskDetailResponse | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
  task: MissionTask;
}) {
  const detailTask = detail?.task ?? task;
  const [draftTitle, setDraftTitle] = useState(detailTask.title || "");
  const [draftBody, setDraftBody] = useState(detailTask.body || "");
  const [draftAssignee, setDraftAssignee] = useState(detailTask.assignee || "");
  const [draftStatus, setDraftStatus] = useState(detailTask.status || "todo");
  const [draftPriority, setDraftPriority] = useState(String(detailTask.priority ?? 0));
  const [draftReason, setDraftReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setDraftTitle(detailTask.title || "");
    setDraftBody(detailTask.body || "");
    setDraftAssignee(detailTask.assignee || "");
    setDraftStatus(detailTask.status || "todo");
    setDraftPriority(String(detailTask.priority ?? 0));
    setDraftReason("");
    setActionError(null);
    setConfirmRemove(false);
  }, [detailTask.id, detailTask.title, detailTask.body, detailTask.assignee, detailTask.status, detailTask.priority]);

  const save = async (updates: KanbanTaskUpdate) => {
    setSaving(true);
    setActionError(null);
    try {
      await api.updateKanbanTask(task.id, updates, task.boardSlug);
      await onRefresh();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      setActionError(null);
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await api.deleteKanbanTask(task.id, task.boardSlug);
      onClose();
      void Promise.resolve(onRefresh()).catch(() => undefined);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const saveEdits = () => save({
    title: draftTitle,
    body: draftBody,
    assignee: draftAssignee.trim() || null,
    priority: Number.parseInt(draftPriority, 10) || 0,
    status: draftStatus,
    block_reason: draftStatus === "blocked" || draftStatus === "scheduled" ? draftReason || undefined : undefined,
  });

  const latestRuns = (detail?.runs ?? []).slice(0, 4);
  const latestEvents = (detail?.events ?? []).slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background-base/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-task-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full max-w-5xl overflow-hidden border border-midground/30 bg-card shadow-[0_0_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border bg-background-base/35 p-4">
          <div className="min-w-0">
            <p className="font-mondwest text-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Mission queue task · {task.boardName}
            </p>
            <h2 id="mission-task-modal-title" className="mt-1 truncate text-2xl font-semibold text-foreground">
              {detailTask.title || task.id}
            </h2>
            <p className="mt-1 font-mono-ui text-xs text-midground">
              {task.id} · {detailTask.status} · {detailTask.assignee || "unassigned"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background-base/60 text-muted-foreground transition-colors hover:border-current/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close task details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-5rem)] overflow-y-auto p-4">
          {loading && <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading task details…</div>}
          {(error || actionError) && <div className="mb-3 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error || actionError}</div>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
            <section className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground sm:col-span-2">
                  Title
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="border border-border bg-background-base/50 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-midground"
                  />
                </label>
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                  <select
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value)}
                    className="border border-border bg-background-base/50 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-midground"
                  >
                    {EDITABLE_KANBAN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Assignee
                  <input
                    list="mission-task-assignees"
                    value={draftAssignee}
                    onChange={(event) => setDraftAssignee(event.target.value)}
                    className="border border-border bg-background-base/50 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-midground"
                    placeholder="unassigned"
                  />
                  <datalist id="mission-task-assignees">
                    {assignees.map((assignee) => <option key={assignee} value={assignee} />)}
                  </datalist>
                </label>
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Priority
                  <input
                    type="number"
                    value={draftPriority}
                    onChange={(event) => setDraftPriority(event.target.value)}
                    className="border border-border bg-background-base/50 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-midground"
                  />
                </label>
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Block / schedule reason
                  <input
                    value={draftReason}
                    onChange={(event) => setDraftReason(event.target.value)}
                    className="border border-border bg-background-base/50 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-midground"
                    placeholder="optional"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Body
                <textarea
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  className="min-h-48 border border-border bg-background-base/50 px-3 py-2 text-sm normal-case leading-6 tracking-normal text-foreground outline-none focus:border-midground"
                />
              </label>

              {detailTask.latest_summary && (
                <div className="border border-border bg-background-base/25 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Latest worker summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{detailTask.latest_summary}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={saveEdits} disabled={saving || !draftTitle.trim()} prefix={saving ? <Spinner /> : undefined}>Save changes</Button>
                  {detailTask.status === "blocked" || detailTask.status === "scheduled" ? (
                    <Button size="sm" ghost onClick={() => save({ status: "ready" })} disabled={saving}>Resolve to ready</Button>
                  ) : null}
                  {detailTask.status === "review" ? (
                    <Button size="sm" ghost onClick={() => save({ status: "done", summary: "Accepted from Mission Control." })} disabled={saving}>Accept review</Button>
                  ) : null}
                  {detailTask.status !== "blocked" && (
                    <Button size="sm" ghost onClick={() => save({ status: "blocked", block_reason: draftReason || "Blocked from Mission Control." })} disabled={saving}>Block</Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeTask()}
                  disabled={saving}
                  className={cn(
                    "border px-3 py-2 font-mondwest text-display text-xs uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    confirmRemove
                      ? "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20",
                  )}
                >
                  {confirmRemove ? "Confirm remove" : "Remove altogether"}
                </button>
                {confirmRemove ? (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    disabled={saving}
                    className="border border-border bg-background-base/40 px-3 py-2 font-mondwest text-display text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-current/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="border border-border bg-background-base/25 p-3"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Created</p><p className="mt-1 text-foreground">{formatTime(detailTask.created_at)}</p></div>
                <div className="border border-border bg-background-base/25 p-3"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Started</p><p className="mt-1 text-foreground">{formatTime(detailTask.started_at)}</p></div>
                <div className="border border-border bg-background-base/25 p-3"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tenant</p><p className="mt-1 text-foreground">{detailTask.tenant || "—"}</p></div>
                <div className="border border-border bg-background-base/25 p-3"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Column</p><p className="mt-1 text-foreground">{task.column}</p></div>
              </div>

              {detailTask.skills && detailTask.skills.length > 0 && (
                <section className="border border-border bg-background-base/25 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Skills</p>
                  <div className="mt-2 flex flex-wrap gap-2">{detailTask.skills.map((skill) => <Badge key={skill} tone="outline">{skill}</Badge>)}</div>
                </section>
              )}

              <section className="border border-border bg-background-base/25 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Recent runs</p>
                <div className="mt-2 space-y-2">
                  {latestRuns.length > 0 ? latestRuns.map((run: KanbanTaskRun) => (
                    <div key={run.id} className="border border-border/60 bg-card/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="font-mono-ui text-foreground">#{run.id} {run.profile || "worker"}</span><Badge tone={run.error ? "destructive" : run.outcome === "success" ? "success" : "outline"}>{run.outcome || run.status || "run"}</Badge></div>
                      {(run.summary || run.error) && <p className="mt-1 line-clamp-3 text-muted-foreground">{run.error || run.summary}</p>}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No runs recorded yet.</p>}
                </div>
              </section>

              <section className="border border-border bg-background-base/25 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Recent events</p>
                <div className="mt-2 space-y-2">
                  {latestEvents.length > 0 ? latestEvents.map((event: KanbanTaskEvent) => (
                    <div key={event.id} className="border border-border/60 bg-card/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="font-mono-ui text-foreground">{event.kind}</span><span className="text-muted-foreground">{formatTime(event.created_at)}</span></div>
                      {event.payload && <p className="mt-1 line-clamp-2 text-muted-foreground">{payloadPreview(event.payload)}</p>}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No events recorded yet.</p>}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionQueue({
  data,
  onRefresh,
  teamFilter,
  onTeamFilterChange,
}: {
  data: LoadState;
  onRefresh: () => Promise<void> | void;
  teamFilter: TeamFilter;
  onTeamFilterChange: (value: TeamFilter) => void;
}) {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [selectedTask, setSelectedTask] = useState<MissionTask | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<KanbanTaskDetailResponse | null>(null);
  const [selectedTaskLoading, setSelectedTaskLoading] = useState(false);
  const [selectedTaskError, setSelectedTaskError] = useState<string | null>(null);
  const tasks = allTasks(data, teamFilter);
  const visibleTasks = (filter === "attention"
    ? tasks.filter((task) => MISSION_QUEUE_ATTENTION_STATUSES.has(task.status))
    : tasks
  ).slice(0, 8);

  useEffect(() => {
    if (!selectedTask) return undefined;
    let cancelled = false;
    setSelectedTaskLoading(true);
    setSelectedTaskError(null);
    setSelectedTaskDetail(null);
    void api.getKanbanTask(selectedTask.id, selectedTask.boardSlug)
      .then((result) => {
        if (cancelled) return;
        setSelectedTaskDetail(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setSelectedTaskError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setSelectedTaskLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedTask) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTask(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTask]);

  return (
    <>
      <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Mission queue</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <TeamFilterSelect data={data} value={teamFilter} onChange={onTeamFilterChange} />
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
            body="No running, blocked, or review task needs attention right now. Ready work is available under All."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTask(task)}
                className="group relative overflow-hidden border border-border bg-background-base/30 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-current/25 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open ${task.id} details`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current/20 to-transparent" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{task.title || task.id}</p>
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {task.boardName} · {task.column}{task.assignee ? ` · ${task.assignee}` : ""}
                    </p>
                  </div>
                  <Badge tone={taskTone(task)}>{task.status}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {task.latest_summary || task.body || "No worker summary captured yet."}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                  Open details <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    {selectedTask ? (
      <TaskDetailModal
        assignees={data.kanbanByBoard[selectedTask.boardSlug]?.assignees ?? data.kanban?.assignees ?? []}
        detail={selectedTaskDetail}
        error={selectedTaskError}
        loading={selectedTaskLoading}
        onClose={() => setSelectedTask(null)}
        onRefresh={onRefresh}
        task={selectedTask}
      />
    ) : null}
    </>
  );
}

function SoundToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded border border-border/60 bg-background-base/30 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span className="font-mondwest text-display uppercase tracking-[0.12em]">{label}</span>
    </label>
  );
}

function ActiveOperationsBoard({
  items,
  profiles,
  profileTeams,
  soundSettings,
  onSoundSettingChange,
  taskByProfile,
}: {
  items: OperationsItem[];
  profiles: ProfileInfo[];
  profileTeams: MissionControlProfileTeam[];
  soundSettings: MissionControlSoundSettings;
  onSoundSettingChange: (kind: MissionControlSoundSetting, enabled: boolean) => void;
  taskByProfile: Map<string, MissionTask>;
}) {
  const [selectedLightAgent, setSelectedLightAgent] = useState<LightAgentModalState | null>(null);
  const [selectedLightAgentDetails, setSelectedLightAgentDetails] = useState<LightAgentProfileDetails>({
    loading: false,
    soul: null,
    skills: [],
    error: null,
  });
  const [expandedTeamRows, setExpandedTeamRows] = useState<Set<string>>(() => new Set());
  const [testAnnounceState, setTestAnnounceState] = useState<"idle" | "playing" | "ok" | "error">("idle");

  const toggleTeamRow = useCallback((rowKey: string) => {
    setExpandedTeamRows((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const sortedItems = [...items].sort((a, b) => {
    const order: Record<ReadinessTone, number> = { review: 0, working: 1, ready: 2 };
    return order[a.tone] - order[b.tone] || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
  });
  const agentItems = sortedItems.filter((item) => activitySegment(item) === "agents");
  const agentRows = groupedActivityRows("agents", agentItems);
  const teamRows = teamRowsFromProfileTeams(profileTeams, taskByProfile);
  const subagentItems = sortedItems.filter((item) => activitySegment(item) === "subagents");
  const subagentRows = groupedActivityRows("subagents", subagentItems);
  const terminalSignalItems = sortedItems.filter((item) => activitySegment(item) === "terminals");
  const signalItems = [
    ...terminalSignalItems,
    ...teamRows.flatMap((row) => row.orchestratorItem ? [row.orchestratorItem, ...row.items] : row.items),
    ...agentItems,
    ...subagentItems,
  ];
  const counts = {
    ready: signalItems.filter((item) => item.tone === "ready").length,
    working: signalItems.filter((item) => item.tone === "working").length,
    review: signalItems.filter((item) => item.tone === "review").length,
  };
  const segments: Array<{ id: ActivitySegment; label: string; helper: string }> = [
    { id: "terminals", label: "Terminals", helper: "Local Hermes/PTY shells and dashboard surfaces" },
    { id: "teams", label: "Teams", helper: "Profile-backed role agents per project team" },
    { id: "agents", label: "Agents", helper: "Live profile-backed Hermes agents" },
    { id: "subagents", label: "Subagents", helper: "Ephemeral delegate children spawned by an agent" },
  ];

  const openLightAgent = (item: OperationsItem) => {
    const profileName = item.profileName;
    if (!profileName) return;
    const profile = profiles.find((candidate) => candidate.name === profileName) ?? null;
    setSelectedLightAgent({ item, profile });
  };

  const testAnnouncement = useCallback(() => {
    setTestAnnounceState("playing");
    void playMissionControlAnnouncement("Mission Control: test announcement complete.")
      .then(() => {
        setTestAnnounceState("ok");
        window.setTimeout(() => setTestAnnounceState("idle"), 2500);
      })
      .catch(() => {
        setTestAnnounceState("error");
        window.setTimeout(() => setTestAnnounceState("idle"), 4000);
      });
  }, []);

  useEffect(() => {
    const profileName = selectedLightAgent?.item.profileName;
    if (!profileName) return undefined;

    let cancelled = false;
    setSelectedLightAgentDetails({ loading: true, soul: null, skills: [], error: null });
    void Promise.all([
      api.getProfileSoul(profileName),
      api.getSkills(profileName),
    ])
      .then(([soul, skills]) => {
        if (cancelled) return;
        setSelectedLightAgentDetails({ loading: false, soul, skills, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setSelectedLightAgentDetails({
          loading: false,
          soul: null,
          skills: [],
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLightAgent?.item.profileName]);

  useEffect(() => {
    if (!selectedLightAgent) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedLightAgent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLightAgent]);

  return (
    <Card className="mission-active-board overflow-hidden">
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
            <SoundToggle
              label="Approval ding"
              checked={soundSettings.approval}
              onChange={(checked) => onSoundSettingChange("approval", checked)}
            />
            <SoundToggle
              label="Done ding"
              checked={soundSettings.done}
              onChange={(checked) => onSoundSettingChange("done", checked)}
            />
            <SoundToggle
              label="Voice task updates"
              checked={soundSettings.announce}
              onChange={(checked) => onSoundSettingChange("announce", checked)}
            />
            <SoundToggle
              label="Announce terminal results"
              checked={soundSettings.terminalAnnounce}
              onChange={(checked) => onSoundSettingChange("terminalAnnounce", checked)}
            />
            <Button
              type="button"
              ghost
              size="sm"
              disabled={testAnnounceState === "playing"}
              onClick={testAnnouncement}
            >
              {testAnnounceState === "playing" ? <Spinner /> : null}
              {testAnnounceState === "ok"
                ? "Announce sent"
                : testAnnounceState === "error"
                  ? "Announce failed"
                  : "Test announce"}
            </Button>
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
          <div className="space-y-3">
            <div className="mission-signal-board rounded border border-border bg-background-base/25 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
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
                    <div key={segment.id} className="mission-signal-segment min-h-16 border border-border/80 bg-background-base/20 p-2.5 xl:col-span-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
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
                        <div className="space-y-2">
                          {groupedRows.map((row) => {
                            const isTeamFlow = segment.id === "teams";
                            // orchestratorItem only exists on teamRows entries; access safely.
                            const orchestratorItem: OperationsItem | null =
                              isTeamFlow && "orchestratorItem" in row
                                ? (row as { orchestratorItem: OperationsItem | null }).orchestratorItem
                                : null;

                            const toneColors = {
                              ready:   { border: "border-cyan-400/45",    bg: "bg-cyan-500/6",     text: "text-cyan-300/80", shadow: "shadow-[0_0_22px_rgba(34,211,238,0.24),inset_0_0_20px_rgba(34,211,238,0.07)]",  wire: "text-cyan-400/70", ping: "bg-cyan-400" },
                              working: { border: "border-amber-400/60",   bg: "bg-amber-500/10",   text: "text-amber-200",   shadow: "shadow-[0_0_30px_rgba(251,191,36,0.5),inset_0_0_24px_rgba(251,191,36,0.12)]",   wire: "text-amber-400",  ping: "bg-amber-400" },
                              starting: { border: "border-sky-300/70",    bg: "bg-sky-400/12",     text: "text-sky-200",     shadow: "shadow-[0_0_34px_rgba(56,189,248,0.62),inset_0_0_28px_rgba(56,189,248,0.14)]",  wire: "text-sky-300",    ping: "bg-sky-300" },
                              review:  { border: "border-rose-400/55",    bg: "bg-rose-500/8",     text: "text-rose-300",    shadow: "shadow-[0_0_28px_rgba(244,63,94,0.45),inset_0_0_24px_rgba(244,63,94,0.10)]",    wire: "text-rose-400",   ping: "bg-rose-400" },
                            } as const;

                            const buildLightElement = (item: OperationsItem, opts: { size: "sm" | "lg" | "xl"; rowLabel: string }) => {
                              const Icon = item.icon;
                              const immediateBluePulse = item.tone === "working" && /\bstarting\b/i.test(item.detail);
                              const visualTone = immediateBluePulse ? "starting" : item.tone;
                              const tc = toneColors[visualTone] ?? toneColors.ready;
                              const sizeClass = opts.size === "xl" ? "h-[6rem] w-[6rem]" : opts.size === "lg" ? "h-[5rem] w-[5rem]" : "h-12 w-12";
                              const riskTitle = item.performanceRisk ? ` · ${item.performanceRisk.detail}` : "";
                              const title = `${opts.rowLabel} · ${readinessLabel(item.tone)} · ${item.kind} · ${item.title} · ${item.meta}${riskTitle}`;
                              const ariaLabel = `${opts.rowLabel} ${readinessLabel(item.tone)} ${item.kind}: ${item.title}${riskTitle}`;
                              const shouldPulse = item.tone === "working" || item.tone === "review";
                              const className = cn(
                                "agent-light group relative flex items-center justify-center rounded-full transition-all duration-300",
                                sizeClass, "border-2",
                                tc.border, tc.bg, tc.text, tc.shadow,
                                "hover:-translate-y-1 hover:scale-110 focus-visible:outline-none",
                              );
                              const contents = (
                                <>
                                  <ActivityLightPopover item={item} rowLabel={opts.rowLabel} />
                                  {shouldPulse && (
                                    <span className={cn("agent-light__ping absolute inset-0 rounded-full border-2", tc.border)} />
                                  )}
                                  <span className="absolute inset-[5px] rounded-full border border-current/20" />
                                  {opts.size !== "sm" && <span className="absolute inset-[14px] rounded-full border border-current/12" />}
                                  {opts.size === "xl" && <span className="absolute inset-[22px] rounded-full border border-current/8" />}
                                  {item.roleGlyph ? (
                                    <span className={cn(
                                      "relative z-10 text-center font-mono-ui font-bold uppercase leading-tight",
                                      opts.size !== "sm"
                                        ? "text-[0.58rem] tracking-[0.1em] text-white/80"
                                        : "text-[0.5rem] tracking-[0.06em] text-white/70",
                                    )}>
                                      {item.roleGlyph}
                                    </span>
                                  ) : (
                                    <Icon className="relative z-10 h-4 w-4 text-white/70" />
                                  )}
                                  {item.performanceRisk && (
                                    <span
                                      className={cn(
                                        "absolute -right-1 -top-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full border px-1 font-mono-ui text-[0.5rem] leading-none",
                                        "bg-[rgb(3,5,18)]",
                                        item.performanceRisk.level === "critical"
                                          ? "border-rose-400/70 text-rose-400"
                                          : "border-amber-400/70 text-amber-400",
                                      )}
                                      aria-label={item.performanceRisk.detail}
                                    >
                                      {item.performanceRisk.label}
                                    </span>
                                  )}
                                </>
                              );
                              return item.profileName ? (
                                <button type="button" onClick={() => openLightAgent(item)} title={title} aria-label={ariaLabel} className={className}>
                                  {contents}
                                </button>
                              ) : (
                                <Link to={item.href} title={title} aria-label={ariaLabel} className={className}>
                                  {contents}
                                </Link>
                              );
                            };

                            const [rowTitle, ...rowMetaParts] = row.label.split(" · ");
                            const rowMeta = rowMetaParts.join(" · ");

                            if (isTeamFlow) {
                              const rowKey = row.label;
                              const isExpanded = expandedTeamRows.has(rowKey);
                              const allTeamItems = orchestratorItem ? [orchestratorItem, ...row.items] : row.items;
                              const rowTone: ReadinessTone = allTeamItems.some((item) => item.tone === "review")
                                ? "review"
                                : allTeamItems.some((item) => item.tone === "working")
                                  ? "working"
                                  : "ready";
                              const rowTc = toneColors[rowTone] ?? toneColors.ready;
                              const workflowStages = workflowStagesForTeam(row.items, "workflow" in row ? row.workflow : undefined);
                              const showsFinalResearchOutput = rowTitle.toLowerCase() === "hermes research";

                              const buildFinalResearchOutputElement = () => (
                                <span className="flex items-center">
                                  <span
                                    className="relative flex w-20 shrink-0 self-stretch items-center justify-center text-amber-200/70"
                                    aria-hidden="true"
                                  >
                                    <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-current/30" />
                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono-ui text-[0.7rem] text-current/80">›</span>
                                  </span>
                                  <span
                                    className="relative flex h-[4.75rem] min-w-[8.5rem] flex-col items-center justify-center rounded-lg border border-amber-200/50 bg-amber-300/[0.07] px-4 text-center text-amber-100 shadow-[0_0_26px_rgba(251,191,36,0.18),inset_0_0_22px_rgba(251,191,36,0.05)]"
                                    title="Final research output · polished brief or saved knowledge-base artifact"
                                    aria-label="Final research output: polished brief or saved knowledge-base artifact"
                                  >
                                    <span className="absolute inset-1 rounded-md border border-amber-100/10" />
                                    <span className="absolute inset-x-3 top-2 h-px bg-gradient-to-r from-transparent via-amber-100/35 to-transparent" />
                                    <FileText className="relative z-10 h-4 w-4 text-amber-100/85" />
                                    <span className="relative z-10 mt-1 font-mono-ui text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em] text-amber-50/90">
                                      Final output
                                    </span>
                                    <span className="relative z-10 mt-1 font-mono-ui text-[0.46rem] uppercase tracking-[0.12em] text-amber-100/55">
                                      Research brief
                                    </span>
                                  </span>
                                </span>
                              );

                              return (
                                <div key={row.label} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                                  <div className="grid w-full items-center gap-2 rounded border border-border/50 bg-background-base/25 px-2 py-1.5 transition-colors duration-200 md:grid-cols-[minmax(12rem,18rem)_1fr_auto]">
                                    <button
                                      type="button"
                                      aria-expanded={isExpanded}
                                      onClick={() => toggleTeamRow(rowKey)}
                                      className="group flex min-w-0 items-start gap-2 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/70"
                                    >
                                      <ChevronRight className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/75 transition-transform", isExpanded && "rotate-90")} />
                                      <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      <span className="min-w-0">
                                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                          <span className="truncate font-mono-ui text-xs font-semibold text-foreground">{rowTitle}</span>
                                          <span className={cn("rounded border px-1.5 py-0.5 font-mono-ui text-[0.58rem] uppercase tracking-[0.14em]", rowTc.border, rowTc.bg, rowTc.text)}>
                                            {readinessLabel(rowTone)}
                                          </span>
                                          <span className="font-mono-ui text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                                            {allTeamItems.length} agents
                                          </span>
                                        </span>
                                        {rowMeta && <span className="mt-0.5 block truncate text-[0.68rem] text-muted-foreground">{rowMeta}</span>}
                                      </span>
                                      <span className="sr-only">{isExpanded ? "Collapse" : "Expand"} {rowTitle}</span>
                                    </button>
                                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                                      {allTeamItems.map((item) => {
                                        const itemTc = toneColors[item.tone] ?? toneColors.ready;
                                        const MiniIcon = item.icon;
                                        return (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => openLightAgent(item)}
                                            className={cn(
                                              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-black/20 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/70",
                                              itemTc.border,
                                              itemTc.bg,
                                              itemTc.text,
                                              itemTc.shadow,
                                            )}
                                            title={`${item.roleName || item.roleGlyph || item.kind}${item.currentTask ? ` · ${item.currentTask.title || item.currentTask.id}` : ""}`}
                                            aria-label={`Open ${item.roleName || item.roleGlyph || item.kind} details`}
                                          >
                                            {(item.tone === "working" || item.tone === "review") && (
                                              <span className={cn("agent-light__ping absolute inset-0 rounded-full border-2", itemTc.border)} />
                                            )}
                                            <span className="absolute inset-[3px] rounded-full border border-current/20" />
                                            <span className="absolute inset-[9px] rounded-full border border-current/10" />
                                            {item.roleGlyph ? (
                                              <span className="relative z-10 max-w-[1.55rem] truncate text-center font-mono-ui text-[0.38rem] font-bold uppercase leading-none tracking-[0.03em] text-white/75">
                                                {item.roleGlyph}
                                              </span>
                                            ) : (
                                              <MiniIcon className="relative z-10 h-3 w-3 text-white/70" />
                                            )}
                                            {item.performanceRisk && (
                                              <span
                                                className={cn(
                                                  "absolute -right-1 -top-1 z-20 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border px-0.5 font-mono-ui text-[0.45rem] leading-none bg-[rgb(3,5,18)]",
                                                  item.performanceRisk.level === "critical"
                                                    ? "border-rose-400/70 text-rose-400"
                                                    : "border-amber-400/70 text-amber-400",
                                                )}
                                              >
                                                {item.performanceRisk.label}
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </span>
                                  </div>

                                  {isExpanded && (
                                    <div className="flex flex-col items-center gap-4 px-3 py-4">
                                      <div className="flex flex-wrap items-center justify-center gap-y-2">
                                        {orchestratorItem && (() => {
                                          const orch = orchestratorItem;
                                          const orchTc = toneColors[orch.tone] ?? toneColors.ready;
                                          return (
                                            <span className="flex items-center">
                                              <span className="flex flex-col items-center">
                                                {buildLightElement(orch, { size: "xl", rowLabel: row.label })}
                                                <span className="mt-1 font-mono-ui text-[0.48rem] uppercase tracking-[0.12em] text-muted-foreground">lead</span>
                                              </span>
                                              <span
                                                className={cn("relative flex w-24 shrink-0 self-stretch items-center justify-center", orchTc.wire)}
                                                aria-hidden="true"
                                              >
                                                <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-current/25" />
                                                <span className="agent-wire__dot absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current/70 shadow-[0_0_6px_currentColor]" />
                                                <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono-ui text-[0.7rem] text-current/80">›</span>
                                              </span>
                                            </span>
                                          );
                                        })()}

                                        <div className="flex flex-wrap items-center justify-center gap-y-3">
                                          {workflowStages.map((stage, index, stages) => {
                                            const isLastStage = index === stages.length - 1;
                                            const shouldShowStageWire = !isLastStage || showsFinalResearchOutput;
                                            const stageTone: ReadinessTone = stage.items.some((item) => item.tone === "review")
                                              ? "review"
                                              : stage.items.some((item) => item.tone === "working")
                                                ? "working"
                                                : "ready";
                                            const tc = toneColors[stageTone] ?? toneColors.ready;
                                            const isParallel = stage.mode === "parallel" || stage.items.length > 1;
                                            return (
                                              <span key={`${row.label}:${stage.label}:${index}`} className="flex items-center">
                                                <span
                                                  className={cn("relative flex flex-col items-center py-1", isParallel ? "" : "px-1 gap-2")}
                                                  title={`${stage.label} · ${isParallel ? "parallel" : "sequential"}`}
                                                >
                                                  {isParallel ? (() => {
                                                    const n = stage.items.length;
                                                    const nodeH = 80; // h-[5rem] at 16px base
                                                    const gapH = 12;  // gap-3 at 16px base
                                                    const totalH = n * nodeH + (n - 1) * gapH;
                                                    // Label is absolutely positioned so stage span height = py-1 + totalH + py-1.
                                                    // Connector wire is at top-1/2 of that = (totalH+8)/2 = totalH/2+4.
                                                    // Fan SVG starts at py-1=4px, so midY (SVG coords) = (totalH/2+4) - 4 = totalH/2. ✓
                                                    const midY = totalH / 2;
                                                    const centers = Array.from({ length: n }, (_, i) => i * (nodeH + gapH) + nodeH / 2);
                                                    const fanW = 64;
                                                    // Color each fan branch by the node it serves so a single active parallel worker
                                                    // lights only its own diagonals instead of tinting every branch.
                                                    const animBranchIndexes = n <= 2 ? centers.map((_, i) => i) : [0, n - 1];
                                                    const dotStagger = 0;
                                                    const glowL = `fan-glow-l-${index}`;
                                                    const glowR = `fan-glow-r-${index}`;
                                                    return (
                                                      <span className={cn("flex items-center", tc.wire)}>
                                                        <svg aria-hidden="true" className="pointer-events-none shrink-0" style={{ display: "block" }} width={fanW} height={totalH} viewBox={`0 0 ${fanW} ${totalH}`}>
                                                          <defs>
                                                            <filter id={glowL} x="-80%" y="-80%" width="260%" height="260%">
                                                              <feGaussianBlur stdDeviation="2" result="blur"/>
                                                              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                                            </filter>
                                                          </defs>
                                                          {centers.map((ny, i) => {
                                                            const branchTc = toneColors[stage.items[i]?.tone ?? "ready"] ?? toneColors.ready;
                                                            return (
                                                              <g key={i} className={branchTc.wire}>
                                                                <line x1={0} y1={midY} x2={fanW} y2={ny} stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="4 3" />
                                                              </g>
                                                            );
                                                          })}
                                                          {animBranchIndexes.map((branchIndex, i) => {
                                                            const ny = centers[branchIndex];
                                                            const branchTc = toneColors[stage.items[branchIndex]?.tone ?? "ready"] ?? toneColors.ready;
                                                            return (
                                                              <circle key={branchIndex} className={branchTc.wire} r="2" fill="currentColor" fillOpacity="0.7" filter={`url(#${glowL})`}>
                                                                <animateMotion dur="3s" begin={`${(i * dotStagger).toFixed(1)}s`} repeatCount="indefinite" path={`M 0 ${midY} L ${fanW} ${ny}`} />
                                                              </circle>
                                                            );
                                                          })}
                                                          <circle cx={0} cy={midY} r={3} fill="currentColor" fillOpacity="0.7" />
                                                        </svg>
                                                        <span className="flex flex-col gap-3">
                                                          {stage.items.map((item) => (
                                                            <span key={item.id} className="relative z-10 block">
                                                              {buildLightElement(item, { size: "lg", rowLabel: row.label })}
                                                            </span>
                                                          ))}
                                                        </span>
                                                        {shouldShowStageWire && (
                                                          <svg aria-hidden="true" className="pointer-events-none shrink-0" style={{ display: "block" }} width={fanW} height={totalH} viewBox={`0 0 ${fanW} ${totalH}`}>
                                                            <defs>
                                                              <filter id={glowR} x="-80%" y="-80%" width="260%" height="260%">
                                                                <feGaussianBlur stdDeviation="2" result="blur"/>
                                                                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                                              </filter>
                                                            </defs>
                                                            {centers.map((ny, i) => {
                                                              const branchTc = toneColors[stage.items[i]?.tone ?? "ready"] ?? toneColors.ready;
                                                              return (
                                                                <g key={i} className={branchTc.wire}>
                                                                  <line x1={0} y1={ny} x2={fanW} y2={midY} stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="4 3" />
                                                                </g>
                                                              );
                                                            })}
                                                            {animBranchIndexes.map((branchIndex, i) => {
                                                              const ny = centers[branchIndex];
                                                              const branchTc = toneColors[stage.items[branchIndex]?.tone ?? "ready"] ?? toneColors.ready;
                                                              return (
                                                                <circle key={branchIndex} className={branchTc.wire} r="2" fill="currentColor" fillOpacity="0.7" filter={`url(#${glowR})`}>
                                                                  <animateMotion dur="3s" begin={`${(i * dotStagger).toFixed(1)}s`} repeatCount="indefinite" path={`M 0 ${ny} L ${fanW} ${midY}`} />
                                                                </circle>
                                                              );
                                                            })}
                                                            <circle cx={fanW} cy={midY} r={3} fill="currentColor" fillOpacity="0.7" />
                                                          </svg>
                                                        )}
                                                      </span>
                                                    );
                                                  })() : (
                                                    stage.items.map((item) => (
                                                      <span key={item.id} className="flex justify-center">
                                                        {buildLightElement(item, { size: "lg", rowLabel: row.label })}
                                                      </span>
                                                    ))
                                                  )}
                                                </span>
                                                {shouldShowStageWire && (
                                                  <span
                                                    className={cn("relative flex w-24 shrink-0 self-stretch items-center justify-center", tc.wire)}
                                                    aria-hidden="true"
                                                  >
                                                    <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-current/25" />
                                                    <span className="agent-wire__dot absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current/70 shadow-[0_0_6px_currentColor]" />
                                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono-ui text-[0.7rem] text-current/80">›</span>
                                                  </span>
                                                )}
                                              </span>
                                            );
                                          })}
                                          {showsFinalResearchOutput && buildFinalResearchOutputElement()}
                                        </div>
                                      </div>

                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div key={row.label} className="grid gap-2 border-t border-border/60 pt-2 first:border-t-0 first:pt-0 md:grid-cols-[minmax(12rem,18rem)_1fr]">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-foreground">{rowTitle}</p>
                                  {rowMeta && <p className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">{rowMeta}</p>}
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                  {row.items.map((item) => (
                                    <span key={item.id} className="flex items-center">
                                      {buildLightElement(item, { size: "sm", rowLabel: row.label })}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
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
      {selectedLightAgent && (
        <LightAgentModal
          details={selectedLightAgentDetails}
          modal={selectedLightAgent}
          onClose={() => setSelectedLightAgent(null)}
        />
      )}
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
    { label: "Launch chat", detail: "Start hands-on agent work", href: "/chat", icon: Rocket, glow: "hover:shadow-[0_0_60px_rgba(34,211,238,0.12)]", topLine: "from-cyan-400 to-sky-400", orb: "bg-cyan-400" },
    { label: "System doctor", detail: "Health, credentials, hooks", href: "/system", icon: ShieldCheck, glow: "hover:shadow-[0_0_60px_rgba(99,102,241,0.12)]", topLine: "from-indigo-400 to-blue-400", orb: "bg-indigo-400" },
    { label: "Channels", detail: "Gateway and platforms", href: "/channels", icon: Radio, glow: "hover:shadow-[0_0_60px_rgba(167,139,250,0.12)]", topLine: "from-violet-400 to-purple-400", orb: "bg-violet-400" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {commands.map((command) => {
        const Icon = command.icon;
        return (
          <Link
            key={command.href}
            to={command.href}
            className={cn(
              "group relative overflow-hidden border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:border-white/14",
              command.glow,
            )}
          >
            <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${command.topLine} opacity-0 transition-opacity group-hover:opacity-80`} />
            <div className={`absolute -right-8 -top-8 h-36 w-36 rounded-full ${command.orb} opacity-0 blur-3xl transition-opacity group-hover:opacity-[0.08]`} />
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-white/40 transition-colors group-hover:text-white/70" />
                </div>
                <p className="font-medium text-white/70 transition-colors group-hover:text-white/90">{command.label}</p>
                <p className="mt-1 text-xs text-white/30">{command.detail}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/20 transition-all group-hover:translate-x-1 group-hover:text-white/50" />
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
      className="inline-flex items-center gap-1.5 border border-border bg-background-base/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-current/30 hover:bg-card/60 hover:text-foreground"
      to={to}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
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
      ? "border-success/25 bg-success/5 text-success"
      : tone === "warning"
        ? "border-warning/25 bg-warning/5 text-warning"
        : "border-border bg-muted/15 text-muted-foreground";
  return (
    <div className={cn("relative flex items-center gap-4 border p-5 text-sm", toneClass)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/25 bg-background-base/50">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="relative overflow-hidden border border-white/[0.08] bg-white/[0.04] p-3 backdrop-blur-xl">
      <p className="text-[0.58rem] font-medium uppercase tracking-[0.22em] text-white/30">
        {label}
      </p>
      <p className="mt-1.5 truncate font-mono-ui text-2xl leading-none text-white/80">{value}</p>
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
  const [teamFilter, setTeamFilter] = useState<TeamFilter>(() => readCachedTeamFilter());
  const [soundSettings, setSoundSettings] = useState<MissionControlSoundSettings>(() => readCachedSoundSettings());
  const previousTerminalTonesRef = useRef<Map<string, ReadinessTone> | null>(null);
  const previousTaskStatusesRef = useRef<Map<string, string> | null>(null);
  const currentTerminalReviewIdsRef = useRef<Set<string>>(new Set());
  const pendingApprovalDingRef = useRef(false);
  const pendingDoneDingRef = useRef(false);
  const { setEnd } = usePageHeader();

  const updateTeamFilter = useCallback((value: TeamFilter) => {
    setTeamFilter(value);
    cacheTeamFilter(value);
  }, []);

  const updateSoundSetting = useCallback((kind: MissionControlSoundSetting, enabled: boolean) => {
    setSoundSettings((current) => {
      const next = { ...current, [kind]: enabled };
      cacheSoundSettings(next);
      return next;
    });
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const activity = await api.getMissionControlActivity({ timeoutMs: MISSION_CONTROL_ACTIVITY_TIMEOUT_MS });
      setData((previous) => ({ ...previous, activity }));
      setError(null);
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

    const boardMetas = kanbanBoards.status === "fulfilled" ? kanbanBoards.value.boards : [];
    const boardResults = await Promise.allSettled(
      boardMetas.map((board) => api.getKanbanBoard(board.slug, timeout)),
    );
    const kanbanByBoard = boardResults.reduce<Record<string, KanbanBoardResponse>>((acc, result, index) => {
      if (result.status === "fulfilled") {
        acc[boardMetas[index].slug] = result.value;
      }
      return acc;
    }, {});
    const selectedBoard = kanbanBoards.status === "fulfilled"
      ? kanbanBoards.value.current || kanbanBoards.value.boards[0]?.slug
      : undefined;
    const kanban = selectedBoard && kanbanByBoard[selectedBoard]
      ? ({ status: "fulfilled" as const, value: kanbanByBoard[selectedBoard] })
      : ({ status: "rejected" as const });

    setData((previous) => ({
      status: status.status === "fulfilled" ? status.value : previous.status,
      sessions: sessions.status === "fulfilled" ? sessions.value : previous.sessions,
      cronJobs: cronJobs.status === "fulfilled" ? cronJobs.value : previous.cronJobs,
      profiles: profiles.status === "fulfilled" ? profiles.value.profiles : previous.profiles,
      kanban: kanban.status === "fulfilled" && "columns" in kanban.value ? kanban.value : previous.kanban,
      kanbanBoards: kanbanBoards.status === "fulfilled" ? kanbanBoards.value : previous.kanbanBoards,
      kanbanByBoard: { ...previous.kanbanByBoard, ...kanbanByBoard },
      activity: previous.activity,
      kanbanUnavailable: kanbanBoards.status === "rejected" || (boardMetas.length > 0 && Object.keys(kanbanByBoard).length === 0),
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
    const refreshVisible = () => {
      if (!document.hidden) {
        void loadActivity();
      }
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadActivity]);

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

  const effectiveTeamFilter = useMemo(() => {
    if (!data.kanbanBoards) return teamFilter;
    return teamFilterOptions(data).some((option) => option.value === teamFilter) ? teamFilter : ALL_TEAMS_FILTER;
  }, [data, teamFilter]);
  const metrics = useMemo(() => buildMetrics(data), [data]);
  const timeline = useMemo(() => buildTimeline(data, effectiveTeamFilter), [data, effectiveTeamFilter]);
  const operations = useMemo(() => buildOperationsItems(data), [data]);
  const terminalReviewIds = useMemo(
    () => new Set(
      operations
        .filter((item) => activitySegment(item) === "terminals" && item.tone === "review")
        .map((item) => item.id),
    ),
    [operations],
  );
  const terminalTones = useMemo(
    () => new Map(
      operations
        .filter((item) => activitySegment(item) === "terminals")
        .map((item) => [item.id, item.tone] as const),
    ),
    [operations],
  );
  const terminalItemsById = useMemo(
    () => new Map(
      operations
        .filter((item) => activitySegment(item) === "terminals")
        .map((item) => [item.id, item] as const),
    ),
    [operations],
  );
  const teamTaskByProfile = useMemo(() => currentTaskByProfile(data), [data]);
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

  useEffect(() => {
    const previousStatuses = previousTaskStatusesRef.current;
    const announcements = missionTaskDoneAnnouncements(data, previousStatuses);
    previousTaskStatusesRef.current = missionTaskStatusSnapshot(data);
    if (!soundSettings.announce || announcements.length === 0) return;

    for (const announcement of announcements) {
      void playMissionControlAnnouncement(announcement).catch(() => {
        if (soundSettings.done) {
          void playMissionControlDoneDing().catch(() => undefined);
        }
      });
    }
  }, [data, soundSettings.announce, soundSettings.done]);

  useEffect(() => {
    const previousTones = previousTerminalTonesRef.current;
    currentTerminalReviewIdsRef.current = terminalReviewIds;
    previousTerminalTonesRef.current = terminalTones;
    if (!previousTones && terminalTones.size === 0) return;

    const hasNewReviewLight = [...terminalTones].some(
      ([id, tone]) => tone === "review" && previousTones?.get(id) !== "review",
    );
    const hasNewReadyLight = [...terminalTones].some(([id, tone]) => {
      const previousTone = previousTones?.get(id);
      return tone === "ready" && (previousTone === "working" || previousTone === "review");
    });

    if (hasNewReviewLight && soundSettings.approval) {
      void playMissionControlApprovalDing().catch(() => {
        // Browsers can block audio before user activation. Retry once the user next clicks/presses a key.
        pendingApprovalDingRef.current = true;
      });
    }
    if (hasNewReadyLight && soundSettings.done) {
      void playMissionControlDoneDing().catch(() => {
        pendingDoneDingRef.current = true;
      });
    }
    if (soundSettings.terminalAnnounce && previousTones) {
      const announcements = [...terminalTones]
        .filter(([, tone]) => tone === "ready" || tone === "review")
        .filter(([id, tone]) => {
          const previousTone = previousTones?.get(id);
          return tone === "review"
            ? previousTone !== "review"
            : previousTone === "working" || previousTone === "review";
        })
        .map(([id, tone]) => {
          const item = terminalItemsById.get(id);
          return item ? { item, tone } : null;
        })
        .filter((entry): entry is { item: OperationsItem; tone: ReadinessTone } => Boolean(entry))
        .slice(0, 2);

      for (const { item, tone } of announcements) {
        void playMissionControlAnnouncement(
          terminalResultAnnouncement(item, tone),
          tone === "review" ? "approval" : "done",
        ).catch(() => {
          if (tone === "review" && soundSettings.approval) {
            void playMissionControlApprovalDing().catch(() => undefined);
          } else if (tone === "ready" && soundSettings.done) {
            void playMissionControlDoneDing().catch(() => undefined);
          }
        });
      }
    }
  }, [soundSettings.approval, soundSettings.done, soundSettings.terminalAnnounce, terminalItemsById, terminalReviewIds, terminalTones]);

  useEffect(() => {
    const playPendingDing = () => {
      void ensureMissionControlAudioContext().catch(() => {
        // Keep the listener passive if the browser still refuses to unlock audio.
      });
      if (pendingApprovalDingRef.current && soundSettings.approval && currentTerminalReviewIdsRef.current.size > 0) {
        pendingApprovalDingRef.current = false;
        void playMissionControlApprovalDing().catch(() => {
          pendingApprovalDingRef.current = true;
        });
      }
      if (pendingDoneDingRef.current && soundSettings.done) {
        pendingDoneDingRef.current = false;
        void playMissionControlDoneDing().catch(() => {
          pendingDoneDingRef.current = true;
        });
      }
    };
    window.addEventListener("pointerdown", playPendingDing);
    window.addEventListener("keydown", playPendingDing);
    return () => {
      window.removeEventListener("pointerdown", playPendingDing);
      window.removeEventListener("keydown", playPendingDing);
    };
  }, [soundSettings.approval, soundSettings.done]);

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
    <div className="mission-control-surface relative isolate flex flex-col gap-3">
      <PluginSlot name="mission-control:top" />

      {/* ── Hero ──────────────────────────────────── */}
      <section
        className="mission-hero group relative overflow-hidden"
        style={heroStyle}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setSpotlight({
            x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
            y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
          });
        }}
      >
        {/* Vivid ambient blobs */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-cyan-400/15 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 top-0 h-[36rem] w-[36rem] rounded-full bg-violet-600/18 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[72px]" />
        <div className="mission-hero__grid absolute inset-0" />
        <div className="mission-hero__glow absolute inset-0 transition-opacity" />
        <div className="mission-hero__scan absolute inset-x-0 top-0 h-40" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgb(3,5,18)] to-transparent" />

        <div className="relative flex flex-col px-6 pt-8 pb-6 sm:px-10 sm:pt-10 sm:pb-8">
          {/* HUD status line */}
          <div className="mb-5 flex items-center gap-3">
            <span className="mission-kicker">Orbital command online</span>
            <span className="h-px flex-1 bg-white/8" />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/25">
              {readiness.label} · Config v{data.status?.config_version ?? "—"}
            </span>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_22rem] xl:items-center">
            <div>
              <h2
                className="mission-title font-light uppercase leading-[0.9] tracking-[0.18em] text-white"
                style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}
              >
                Mission Control
              </h2>
              {/* Inline HUD metrics */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                {[
                  { label: "Platforms", value: Object.keys(data.status?.gateway_platforms ?? {}).length },
                  { label: "Profiles", value: data.profiles.length },
                  { label: "Cron jobs", value: data.cronJobs.length },
                  { label: "Signals", value: timeline.length },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-baseline gap-2">
                    <span className="font-mono-ui text-xl leading-none text-white/70">{stat.value}</span>
                    <span className="text-[0.58rem] uppercase tracking-[0.2em] text-white/25">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <MissionOrb
              metrics={metrics}
              score={score}
              selectedMetric={selectedMetric}
              onSelectMetric={setSelectedMetric}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-3 border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400/80 backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── OS nav strip ──────────────────────────── */}
      <div className="mission-control-strip flex flex-col gap-2 border-y border-white/[0.06] bg-white/[0.02] px-4 py-2.5 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <ViewSwitch view={view} onChange={setView} />
          <div className="hidden h-3 w-px bg-white/10 sm:block" />
          <TeamFilterSelect data={data} value={effectiveTeamFilter} onChange={updateTeamFilter} label="Queue team" />
          {selectedMetricData && (
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-white/30">
              ↳ {selectedMetricData.label} · {selectedMetricData.value}
            </span>
          )}
        </div>
        {selectedMetricData && (
          <Link
            to={selectedMetricData.href}
            className="inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.14em] text-white/25 transition-colors hover:text-white/55"
          >
            Open {selectedMetricData.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* ── Bento metric grid ─────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            selected={selectedMetric === metric.id}
            onSelect={() => setSelectedMetric(metric.id)}
          />
        ))}
      </div>

      <ActiveOperationsBoard
        items={operations}
        profiles={data.profiles}
        profileTeams={data.activity?.profile_teams ?? []}
        soundSettings={soundSettings}
        onSoundSettingChange={updateSoundSetting}
        taskByProfile={teamTaskByProfile}
      />

      {view === "overview" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <MissionQueue data={data} onRefresh={load} teamFilter={effectiveTeamFilter} onTeamFilterChange={updateTeamFilter} />
          <Timeline items={timeline} data={data} teamFilter={effectiveTeamFilter} onTeamFilterChange={updateTeamFilter} />
        </div>
      )}

      {view === "work" && <MissionQueue data={data} onRefresh={load} teamFilter={effectiveTeamFilter} onTeamFilterChange={updateTeamFilter} />}

      {view === "ops" && <OpsDeck data={data} />}

      <CommandDock />
      <PluginSlot name="mission-control:bottom" />
    </div>
  );
}
