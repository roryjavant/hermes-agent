import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
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
  FileText,
  Gauge,
  MessageSquare,
  Radio,
  Rocket,
  ShieldCheck,
  Terminal,
  Trash2,
  Users,
  Volume2,
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
import { api, HERMES_BASE_PATH } from "@/lib/api";
import type {
  CronJob,
  KanbanBoardResponse,
  KanbanBoardsResponse,
  KanbanTaskDetailResponse,
  KanbanTaskEvent,
  KanbanTaskRun,
  KanbanTaskSummary,
  KanbanTaskUpdate,
  MissionControlActivity,
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
import ChatPage from "@/pages/ChatPage";
import { cn, timeAgo } from "@/lib/utils";

type MissionControlDingResponse = {
  ok: boolean;
  kind: string;
  method: string;
  sound?: string;
  duration_seconds?: number;
};

type MissionControlAnnouncementResponse = {
  ok: boolean;
  kind: string;
  method: string;
  file_path: string;
  provider?: string;
  duration_seconds?: number;
};

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
type TeamFilter = "all" | string;
type MissionControlSoundSetting = MissionControlDing | "announce" | "terminalAnnounce" | "launchClip";
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
type MissionSoundVisualState = {
  active: boolean;
  label: string;
};

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
const MISSION_CONTROL_SOUND_SETTINGS_KEY = "missionControl.soundSettings";
const MISSION_CONTROL_PROMPT_AWAY_CLIP_INDEX_KEY = "missionControl.promptAwayClipIndex";
const MISSION_CONTROL_FINAL_OUTPUT_SEEN_KEY = "missionControl.finalOutputSeen";
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

function readCachedSoundSettings(): MissionControlSoundSettings {
  const defaults: MissionControlSoundSettings = {
    approval: true,
    done: true,
    announce: true,
    terminalAnnounce: false,
    launchClip: false,
  };
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
      launchClip: parsed.launchClip ?? defaults.launchClip,
    };
  } catch {
    return defaults;
  }
}

function cacheSoundSettings(value: MissionControlSoundSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MISSION_CONTROL_SOUND_SETTINGS_KEY, JSON.stringify(value));
}

function nextMissionControlPromptAwayClipIndex(): number {
  if (typeof window === "undefined") return 0;
  const clipCount = MISSION_CONTROL_PROMPT_AWAY_CLIPS.length;
  if (clipCount === 0) return 0;
  const raw = window.localStorage.getItem(MISSION_CONTROL_PROMPT_AWAY_CLIP_INDEX_KEY);
  const current = Number.parseInt(raw ?? "0", 10);
  const clipIndex = Number.isFinite(current) && current >= 0 ? current % clipCount : 0;
  window.localStorage.setItem(MISSION_CONTROL_PROMPT_AWAY_CLIP_INDEX_KEY, String((clipIndex + 1) % clipCount));
  return clipIndex;
}

function readSeenFinalOutputs(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MISSION_CONTROL_FINAL_OUTPUT_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function markFinalOutputSeen(teamId: string, marker: string): void {
  if (typeof window === "undefined" || !marker) return;
  const seen = readSeenFinalOutputs();
  window.localStorage.setItem(MISSION_CONTROL_FINAL_OUTPUT_SEEN_KEY, JSON.stringify({ ...seen, [teamId]: marker }));
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
    },
    {
      id: "sessions",
      label: "Active sessions",
      value: formatCount(terminalLights),
      detail: `${formatCount(trackedConversations)} total conversations tracked`,
      tone: terminalLights > 0 ? "success" : "secondary",
      icon: MessageSquare,
      href: "/sessions",
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
    },
    {
      id: "automation",
      label: "Next automation",
      value: nextCron ? formatTime(nextCron.next_run_at) : "None queued",
      detail: nextCron ? getJobTitle(nextCron) : `${formatCount(data.cronJobs.length)} cron jobs configured`,
      tone: nextCron ? jobTone(nextCron) : "secondary",
      icon: CalendarClock,
      href: "/cron",
    },
  ];
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

async function playMissionControlAnnouncement(text: string, kind: MissionControlDing = "done"): Promise<MissionControlAnnouncementResponse> {
  return api.playMissionControlAnnouncement(text, kind);
}

const MISSION_CONTROL_PROMPT_AWAY_CLIPS = [
  "/audio/prompt-away/mission-control-prompt-away-1.mp3",
  "/audio/prompt-away/mission-control-prompt-away-2.mp3",
  "/audio/prompt-away/mission-control-prompt-away-3.mp3",
  "/audio/prompt-away/mission-control-prompt-away-4.mp3",
  "/audio/prompt-away/mission-control-prompt-away-5.mp3",
];

async function playMissionControlPromptAwayClip(clipIndex: number): Promise<void> {
  if (typeof window === "undefined") return;
  const clipPath = MISSION_CONTROL_PROMPT_AWAY_CLIPS[clipIndex % MISSION_CONTROL_PROMPT_AWAY_CLIPS.length]
    ?? "/audio/only-one-prompt-away.mp3";
  const audio = new Audio(`${HERMES_BASE_PATH}${clipPath}`);
  audio.volume = 1;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
    const handleEnded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Prompt-away clip failed to play."));
    };
    audio.addEventListener("ended", handleEnded, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
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

async function playMissionControlDing(kind: MissionControlDing): Promise<MissionControlDingResponse | void> {
  try {
    return await api.playMissionControlDing(kind);
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
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
    const handleEnded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Mission Control ding failed to play."));
    };
    audio.addEventListener("ended", handleEnded, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
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

// Procedural EKG trace: P wave, QRS complex, T wave per beat, with per-beat
// variation in spacing/amplitude plus baseline wander so it reads like a real
// hospital monitor instead of a uniform loop. Midline y=16 on a 32-tall grid.
// The x axis is normalized to a constant width so successive waveforms swap in
// without rescaling the strip.
function buildEcgGeometry(rng: () => number, beats: number): { d: string; width: number } {
  const mid = 16;
  let x = 0;
  const points: Array<[number, number]> = [[0, mid]];
  const lineTo = (nx: number, ny: number) => {
    x = nx;
    points.push([nx, ny]);
  };
  const wanderTo = (target: number) => {
    while (x < target - 7) {
      lineTo(x + 4 + rng() * 5, mid + (rng() - 0.5) * 1.8);
    }
    lineTo(target, mid);
  };

  for (let i = 0; i < beats; i += 1) {
    wanderTo(x + 14 + rng() * 22);
    const p = 2.5 + rng() * 2;
    lineTo(x + 4, mid - p);
    lineTo(x + 4, mid);
    wanderTo(x + 5 + rng() * 5);
    const r = 9.5 + rng() * 4;
    const s = 7.5 + rng() * 4.5;
    lineTo(x + 3, mid + 2 + rng() * 2);
    lineTo(x + 4, mid - r);
    lineTo(x + 4, mid + s);
    lineTo(x + 4, mid);
    wanderTo(x + 8 + rng() * 6);
    const t = 3.5 + rng() * 3;
    lineTo(x + 5, mid - t);
    lineTo(x + 5 + rng() * 3, mid);
  }
  wanderTo(x + 12 + rng() * 10);

  const width = beats * 55;
  const scale = width / x;
  const d = points
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${(px * scale).toFixed(1)} ${py.toFixed(1)}`)
    .join(" ");
  return { d, width };
}

const ECG_HEAD_WIDTH = 26;

function HeartbeatTrace({
  className,
  sweepSeconds = 1.2,
  beats = 4,
}: {
  className?: string;
  sweepSeconds?: number;
  beats?: number;
}) {
  // Fresh waveform on every pass, and a random rate/phase per monitor, so
  // multiple live agents never pulse in lockstep or repeat themselves.
  // The scan is a mask window translating at constant horizontal speed —
  // dash-offset sweeps stall on spikes where arc length piles up — with a
  // gradient beam head drawing the trace behind it. The waveform swaps at
  // the cycle wrap while both mask rects are off-screen.
  const maskId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [trace, setTrace] = useState(() => buildEcgGeometry(Math.random, beats));
  const timing = useMemo(
    () => ({
      duration: sweepSeconds * (0.85 + Math.random() * 0.3),
      delay: -Math.random() * sweepSeconds,
    }),
    [sweepSeconds],
  );
  const handleScanIteration = useCallback(
    (event: AnimationEvent<SVGRectElement>) => {
      if (event.animationName !== "agent-ecg-scan") return;
      setTrace(buildEcgGeometry(Math.random, beats));
    },
    [beats],
  );

  const travel = trace.width + ECG_HEAD_WIDTH;
  const scanStyle: CSSProperties = {
    animationDuration: `${timing.duration}s`,
    animationDelay: `${timing.delay}s`,
  };

  return (
    <svg
      className={cn("agent-ecg", className)}
      viewBox={`0 0 ${trace.width} 32`}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      style={{ "--agent-ecg-travel": `${travel}px` } as CSSProperties}
    >
      <defs>
        <linearGradient id={`ecg-${maskId}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <mask id={`ecg-${maskId}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width={trace.width} height="32">
          <rect className="agent-ecg__scan" x={-travel} y="0" width={travel} height="32" fill="#fff" style={scanStyle} />
        </mask>
        <mask id={`ecg-${maskId}-beam`} maskUnits="userSpaceOnUse" x="0" y="0" width={trace.width} height="32">
          <rect
            className="agent-ecg__scan"
            x={-ECG_HEAD_WIDTH}
            y="0"
            width={ECG_HEAD_WIDTH}
            height="32"
            fill={`url(#ecg-${maskId}-fade)`}
            style={scanStyle}
            onAnimationIteration={handleScanIteration}
          />
        </mask>
      </defs>
      <path
        className="agent-ecg__base"
        d={trace.d}
        mask={`url(#ecg-${maskId}-reveal)`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="agent-ecg__sweep"
        d={trace.d}
        mask={`url(#ecg-${maskId}-beam)`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background-base/80 p-3 backdrop-blur-md sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="light-agent-modal-title"
      onClick={onClose}
    >
      <div
        className="relative my-4 max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-hidden border border-midground/30 bg-card shadow-[0_0_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-[#ff3d00]/30" />
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

        <div className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto p-3 sm:p-4">
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

function toneFromCurrentTask(task: MissionTask | undefined, fallback: ReadinessTone): ReadinessTone {
  if (!task) return fallback;
  if (task.status === "running") return "working";
  if (task.status === "review" || task.status === "blocked") return "review";
  if (task.status === "ready") return "ready";
  return fallback;
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

function workVerbForTaskStatus(status: string): string {
  if (status === "running") return "working";
  if (status === "ready") return "queued";
  if (status === "review") return "reviewing";
  if (status === "blocked") return "blocked";
  if (status === "scheduled") return "scheduled";
  return "assigned";
}

function shouldPulseLight(item: OperationsItem): boolean {
  return item.tone === "working" || item.tone === "review" || item.currentTask?.status === "ready";
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

function currentTasksByTeam(data: LoadState): Map<string, MissionTask[]> {
  const byTeam = new Map<string, MissionTask[]>();
  const currentTasks = allTasks(data)
    .filter((task) => ["running", "review", "blocked", "ready", "scheduled", "todo"].includes(task.status))
    .sort((a, b) => {
      const aKey = taskSortKey(a);
      const bKey = taskSortKey(b);
      return aKey[0] - bKey[0] || aKey[1] - bKey[1] || a.id.localeCompare(b.id);
    });
  for (const task of currentTasks) {
    const teamTasks = byTeam.get(task.boardSlug) ?? [];
    if (teamTasks.length < 3) {
      teamTasks.push(task);
      byTeam.set(task.boardSlug, teamTasks);
    }
  }
  return byTeam;
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

function liveActivityByProfile(data: LoadState): Map<string, MissionControlActivity> {
  const statusRank: Record<MissionControlActivity["status"], number> = { review: 0, working: 1, ready: 2 };
  const liveActivities = (data.activity?.activities ?? [])
    .filter((record) => record.source !== "dashboard" && record.profile)
    .sort((a, b) => {
      const aRank = statusRank[a.status] ?? 99;
      const bRank = statusRank[b.status] ?? 99;
      return aRank - bRank || b.last_seen - a.last_seen;
    });
  const byProfile = new Map<string, MissionControlActivity>();
  for (const record of liveActivities) {
    const key = record.profile.trim().toLowerCase();
    if (key && !byProfile.has(key)) byProfile.set(key, record);
  }
  return byProfile;
}

function agentToOperationsItem(
  team: MissionControlProfileTeam,
  agent: MissionControlProfileTeamAgent,
  taskByProfile: Map<string, MissionTask>,
  liveProfiles: Map<string, MissionControlActivity>,
) {
  const currentTask = taskByProfile.get(agent.profile.toLowerCase());
  const liveActivity = liveProfiles.get(agent.profile.toLowerCase())
    ?? (agent.is_orchestrator ? liveProfiles.get(team.team_id.toLowerCase()) : undefined);
  const visibleStatus = liveActivity?.status ?? agent.status;
  const visualTone = toneFromCurrentTask(currentTask, toneFromProfileStatus(visibleStatus, agent.configured));
  const visibleActive = Boolean(liveActivity) || agent.active;
  const visiblePid = liveActivity?.pid ?? agent.pid;
  const visibleSource = liveActivity?.source ?? agent.source;
  return {
    id: `team-profile:${team.team_id}:${agent.profile}`,
    kind: "Team profile",
    title: `${agent.role} · ${agent.profile}`,
    detail: currentTask
      ? `${workVerbForTaskStatus(currentTask.status)} ${currentTask.id}: ${currentTask.title || currentTask.id}`
      : liveActivity?.detail || agent.detail || (visibleActive ? "live profile agent" : "profile standby"),
    meta: visibleActive
      ? [visibleSource, visiblePid ? `pid ${visiblePid}` : ""].filter(Boolean).join(" · ")
      : agent.configured ? "standby profile" : "missing profile",
    tone: visualTone,
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
    performanceRisk: performanceRiskFromTelemetry(liveActivity ?? agent),
  } as const;
}

function teamRowsFromProfileTeams(
  profileTeams: MissionControlProfileTeam[],
  taskByProfile: Map<string, MissionTask>,
  liveProfiles: Map<string, MissionControlActivity>,
) {
  return profileTeams.map((team) => {
    const orchestratorAgent = team.agents.find((a) => a.is_orchestrator) ?? null;
    const memberAgents = team.agents.filter((a) => !a.is_orchestrator);
    return {
      label: `${team.label} · ${team.project_path}`,
      orchestratorItem: orchestratorAgent ? agentToOperationsItem(team, orchestratorAgent, taskByProfile, liveProfiles) : null,
      items: memberAgents.map((agent) => agentToOperationsItem(team, agent, taskByProfile, liveProfiles)),
      workflow: team.workflow ?? [],
      workflowSummary: team.workflow_summary ?? "",
      teamId: team.team_id,
      finalOutput: team.final_output,
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

const MISSION_ORB_SECTION_LINKS: Array<{ href: string; label: string; icon: LucideIcon; className: string }> = [
  { href: "#mission-live-activity", label: "Lights", icon: Radio, className: "left-1/2 top-0 -translate-x-1/2" },
  { href: "#mission-queue", label: "Queue", icon: Gauge, className: "right-0 top-1/2 -translate-y-1/2" },
  { href: "#mission-team-signals", label: "Signals", icon: Activity, className: "bottom-0 left-1/2 -translate-x-1/2" },
  { href: "#mission-terminals", label: "Terms", icon: Terminal, className: "left-0 top-1/2 -translate-y-1/2" },
];

function MissionOrb({
  metrics,
  score,
  selectedMetric,
}: {
  metrics: MissionMetric[];
  score: number;
  selectedMetric: string;
}) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const active = metrics.find((metric) => metric.id === selectedMetric) ?? metrics[0];

  return (
    <div className="mission-orb relative ml-auto flex aspect-square w-full max-w-[16.5rem] 2xl:max-w-[18rem] items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 240 240" aria-hidden="true">
        <circle cx="120" cy="120" r="96" fill="none" stroke="#ff3d00" strokeOpacity="0.22" strokeWidth="1" />
        <circle cx="120" cy="120" r="84" fill="none" stroke="#22d3ee" strokeOpacity="0.32" strokeWidth="1" strokeDasharray="22 18" />
        <circle cx="120" cy="120" r={radius} fill="none" stroke="#ff3d00" strokeOpacity="0.22" strokeWidth="8" />
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="#ff3d00"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (score / 100) * circumference}
          className="mission-score-ring transition-[stroke-dashoffset] duration-700"
        />
        <line x1="120" y1="20" x2="120" y2="42" stroke="#22d3ee" strokeOpacity="0.72" strokeWidth="1" />
        <line x1="120" y1="198" x2="120" y2="220" stroke="#ff3d00" strokeOpacity="0.72" strokeWidth="1" />
      </svg>
      {MISSION_ORB_SECTION_LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <a
            key={link.href}
            href={link.href}
            className={cn(
              "mission-orb-section-link absolute z-20 flex h-9 items-center gap-1.5 border border-[#ff3d00]/45 bg-[#050505]/95 px-2.5 font-mono-ui text-[0.56rem] uppercase tracking-[0.13em] text-[#ff3d00]/82 shadow-[0_0_18px_rgba(255,61,0,0.12)] transition-colors hover:border-[#22d3ee]/60 hover:text-[#22d3ee] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#22d3ee]/70",
              link.className,
            )}
            aria-label={`Jump to ${link.label} section`}
          >
            <Icon className="h-3 w-3" />
            <span>{link.label}</span>
          </a>
        );
      })}
      <div className="relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-full border border-[#ff3d00]/40 bg-[#030303] text-center shadow-[0_0_26px_rgba(255, 61, 0,0.26)]">
        <span className="font-mono-ui text-[0.58rem] uppercase tracking-[0.22em] text-white/30">Mission score</span>
        <span className="mt-1 font-mono-ui text-4xl leading-none text-white">{score}</span>
        <span className="mt-1 max-w-24 truncate text-[0.62rem] uppercase tracking-[0.18em] text-[#22d3ee]/75">{active.label}</span>
      </div>
    </div>
  );
}

function MissionSoundBridge({ active, label }: MissionSoundVisualState) {
  const bars = [34, 58, 42, 76, 52, 92, 46, 68, 38, 84, 56, 72];
  if (!active) return null;
  return (
    <div
      className="mission-sound-bridge mission-sound-bridge--active pointer-events-none relative hidden min-h-[9rem] items-center xl:flex"
      aria-hidden="true"
    >
      <div className="mission-sound-bridge__rail" />
      <div className="mission-sound-bridge__capsule">
        <div className="mission-sound-bridge__label-row">
          <span className="mission-sound-bridge__dot" />
          <span>{label}</span>
        </div>
        <div className="mission-sound-bridge__wave" aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              className="mission-sound-bridge__bar"
              style={{
                "--bar-height": `${height}%`,
                "--bar-delay": `${index * 72}ms`,
              } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <div className="mission-sound-bridge__packet mission-sound-bridge__packet--one" />
      <div className="mission-sound-bridge__packet mission-sound-bridge__packet--two" />
    </div>
  );
}

function MissionSectionBreak({ label, eyebrow }: { label: string; eyebrow: string }) {
  return (
    <div className="mission-section-break" aria-hidden="true">
      <span className="mission-section-break__eyebrow">{eyebrow}</span>
      <span className="mission-section-break__rule" />
      <span className="mission-section-break__label">{label}</span>
    </div>
  );
}

const METRIC_ACCENTS: Record<string, { rail: string }> = {
  gateway:    { rail: "bg-[#ff3d00]" },
  sessions:   { rail: "bg-[#ff3d00]" },
  team:       { rail: "bg-[#ff3d00]" },
  automation: { rail: "bg-[#ff3d00]" },
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
        "mission-metric-card group relative overflow-hidden border text-left",
        "bg-[#030303] p-6",
        selected
          ? "border-[#ff3d00]/32"
          : "border-white/[0.08] hover:border-[#ff3d00]/26",
      )}
    >
      <div className={`absolute inset-y-0 left-0 w-[3px] ${accent.rail}`} />

      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start gap-2">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-white/30">
            {metric.label}
          </p>
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

function Timeline({
  items,
}: {
  items: TimelineItem[];
}) {
  const metaBadgeClass = (tone: BadgeTone) => cn(
    "shrink-0 border px-2 py-1 font-mondwest text-display text-[0.62rem] uppercase tracking-[0.14em]",
    tone === "destructive"
      ? "border-[#ff1200]/32 bg-[#ff1200]/[0.045] text-[#ff1200]/80"
      : "border-[#ff3d00]/26 bg-[#ff3d00]/[0.025] text-[#ff3d00]/72",
  );
  const categoryBadgeClass = "shrink-0 border border-white/18 bg-transparent px-2 py-1 font-mondwest text-display text-[0.62rem] uppercase tracking-[0.14em] text-white/52";

  return (
    <Card id="mission-team-signals" className="scroll-mt-24 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#ff3d00]/70" />
            <div>
              <CardTitle className="text-base">Team signals</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Active work, matching sessions, and automations for the selected team.
              </p>
            </div>
          </div>
          <span className={categoryBadgeClass}>{items.length} signals</span>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 border border-[#ff3d00]/18 bg-[#ff3d00]/[0.025] p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#ff3d00]/75" />
            Quiet team. No active tasks, recent matching sessions, or automation signals are surfacing for this filter.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-3 left-[1.05rem] top-3 w-px bg-[#ff3d00]/20" />
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className="group relative flex gap-3 border border-transparent p-2 transition-colors hover:border-[#ff3d00]/18 hover:bg-[#ff3d00]/[0.025]"
                  >
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/18 bg-background-base text-white/50 group-hover:border-[#ff3d00]/30 group-hover:text-[#ff3d00]/75">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={categoryBadgeClass}>{item.category}</span>
                          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                        </span>
                        <span className={metaBadgeClass(item.tone)}>{item.meta}</span>
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
}: {
  data: LoadState;
  onRefresh: () => Promise<void> | void;
  teamFilter: TeamFilter;
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
      <Card id="mission-queue" className="scroll-mt-24 overflow-hidden">
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
                <div className="absolute inset-x-0 top-0 h-px bg-current/20" />
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
    <label className="flex items-center gap-1.5 border border-[#ff3d00]/18 bg-transparent px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-[#ff3d00]/30 hover:text-foreground">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span className="font-mondwest text-display uppercase tracking-[0.12em]">{label}</span>
    </label>
  );
}

function ActiveOperationsBoard({
  items,
  profiles,
  profileTeams,
  liveProfiles,
  soundSettings,
  onSoundSettingChange,
  onSoundStarted,
  onSoundEnded,
  onRefresh,
  taskByProfile,
  tasksByTeam,
}: {
  items: OperationsItem[];
  profiles: ProfileInfo[];
  profileTeams: MissionControlProfileTeam[];
  liveProfiles: Map<string, MissionControlActivity>;
  soundSettings: MissionControlSoundSettings;
  onSoundSettingChange: (kind: MissionControlSoundSetting, enabled: boolean) => void;
  onSoundStarted: (label: string, durationMs?: number) => void;
  onSoundEnded: () => void;
  onRefresh: () => Promise<void> | void;
  taskByProfile: Map<string, MissionTask>;
  tasksByTeam: Map<string, MissionTask[]>;
}) {
  const [selectedLightAgent, setSelectedLightAgent] = useState<LightAgentModalState | null>(null);
  const [selectedLightAgentDetails, setSelectedLightAgentDetails] = useState<LightAgentProfileDetails>({
    loading: false,
    soul: null,
    skills: [],
    error: null,
  });
  const [expandedTeamRows, setExpandedTeamRows] = useState<Set<string>>(() => new Set());
  const [seenFinalOutputs, setSeenFinalOutputs] = useState<Record<string, string>>(() => readSeenFinalOutputs());
  const [testAnnounceState, setTestAnnounceState] = useState<"idle" | "playing" | "ok" | "error">("idle");
  const [promptAwayState, setPromptAwayState] = useState<"idle" | "playing" | "error">("idle");
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<MissionTask | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deleteTaskError, setDeleteTaskError] = useState<string | null>(null);

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
  const teamRows = teamRowsFromProfileTeams(profileTeams, taskByProfile, liveProfiles);
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
  const segments: Array<{ id: ActivitySegment; label: string }> = [
    { id: "terminals", label: "Terminals" },
    { id: "teams", label: "Teams" },
    { id: "agents", label: "Agents" },
    { id: "subagents", label: "Subagents" },
  ];

  const openLightAgent = (item: OperationsItem) => {
    const profileName = item.profileName;
    if (!profileName) return;
    const profile = profiles.find((candidate) => candidate.name === profileName) ?? null;
    setSelectedLightAgent({ item, profile });
  };

  const testAnnouncement = useCallback(() => {
    setTestAnnounceState("playing");
    onSoundStarted("Test announcement", 3400);
    void playMissionControlAnnouncement("Mission Control: test announcement complete.")
      .then(() => {
        setTestAnnounceState("ok");
        window.setTimeout(() => setTestAnnounceState("idle"), 2500);
      })
      .catch(() => {
        setTestAnnounceState("error");
        window.setTimeout(() => setTestAnnounceState("idle"), 4000);
      });
  }, [onSoundStarted]);

  const playPromptAwayClip = useCallback(() => {
    const clipIndex = nextMissionControlPromptAwayClipIndex();
    setPromptAwayState("playing");
    onSoundStarted("Prompt-away clip");
    void playMissionControlPromptAwayClip(clipIndex)
      .then(() => {
        onSoundEnded();
        window.setTimeout(() => setPromptAwayState("idle"), 2400);
      })
      .catch(() => {
        onSoundEnded();
        setPromptAwayState("error");
        window.setTimeout(() => setPromptAwayState("idle"), 3000);
      });
  }, [onSoundEnded, onSoundStarted]);

  const requestDeleteTeamTask = (task: MissionTask) => {
    setDeleteTaskTarget(task);
    setDeleteTaskError(null);
  };

  const confirmDeleteTeamTask = async () => {
    if (!deleteTaskTarget) return;
    setDeletingTaskId(deleteTaskTarget.id);
    setDeleteTaskError(null);
    try {
      await api.deleteKanbanTask(deleteTaskTarget.id, deleteTaskTarget.boardSlug);
      setDeleteTaskTarget(null);
      await onRefresh();
    } catch (err) {
      setDeleteTaskError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingTaskId(null);
    }
  };

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
    <Card id="mission-live-activity" className="mission-active-board scroll-mt-24 overflow-visible">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#ff3d00]" />
            <CardTitle className="text-base">Live activity lights</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="border border-[#22d3ee]/30 bg-transparent px-2 py-0.5 font-mono-ui text-[0.62rem] uppercase tracking-[0.12em] text-[#22d3ee]/80">{counts.ready} ready</span>
            <span className="border border-[#ff3d00]/35 bg-transparent px-2 py-0.5 font-mono-ui text-[0.62rem] uppercase tracking-[0.12em] text-[#ff3d00]/90">{counts.working} working</span>
            <span className="border border-[#ff1200]/55 bg-transparent px-2 py-0.5 font-mono-ui text-[0.62rem] uppercase tracking-[0.12em] text-[#ff1200] shadow-[0_0_12px_rgba(255,18,0,0.22)]">{counts.review} review</span>
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
            <SoundToggle
              label="Launch clip"
              checked={soundSettings.launchClip}
              onChange={(checked) => onSoundSettingChange("launchClip", checked)}
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
            <Button
              type="button"
              ghost
              size="sm"
              className="px-2"
              aria-label="Play it's only one prompt away clip"
              title={promptAwayState === "error" ? "Clip failed" : "Play: It's only one prompt away"}
              disabled={promptAwayState === "playing"}
              onClick={playPromptAwayClip}
            >
              {promptAwayState === "playing" ? <Spinner /> : <Volume2 className="h-3.5 w-3.5" />}
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
            <div className="mission-signal-board rounded border border-border bg-background-base/25 p-3">
              <div className="grid gap-4 xl:grid-cols-3">
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
                    <div key={segment.id} className="mission-signal-segment min-h-16 border border-border/80 bg-background-base/20 p-3 xl:col-span-3">
                      <div className="mb-3 flex items-center gap-3">
                        <p className="mission-signal-segment__title shrink-0 font-mondwest text-display text-xs uppercase">
                          {segment.label}
                        </p>
                        <span className="mission-signal-segment__rule" aria-hidden="true" />
                        <span className="mission-signal-segment__count px-2 py-0.5 font-mono-ui text-[0.58rem] uppercase tracking-[0.12em]">{segmentCount}</span>
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
                              ready:    { border: "border-[#22d3ee]/38", bg: "bg-[#22d3ee]/[0.025]", text: "text-[#22d3ee]/75", shadow: "shadow-none", wire: "text-[#22d3ee]/48", ping: "bg-[#22d3ee]" },
                              working:  { border: "border-[#ff3d00]/58", bg: "bg-[#ff3d00]/[0.045]", text: "text-[#ff3d00]/90", shadow: "shadow-none", wire: "text-[#ff3d00]/70", ping: "bg-[#ff3d00]" },
                              starting: { border: "border-[#ff3d00]/58", bg: "bg-[#ff3d00]/[0.045]", text: "text-[#ff3d00]/90", shadow: "shadow-none", wire: "text-[#ff3d00]/70", ping: "bg-[#ff3d00]" },
                              review:   { border: "border-[#ff1200]/80", bg: "bg-[#ff1200]/[0.075]", text: "text-[#ff1200]", shadow: "shadow-[0_0_14px_rgba(255,18,0,0.24)]", wire: "text-[#ff1200]/85", ping: "bg-[#ff1200]" },
                            } as const;

                            const buildLightElement = (item: OperationsItem, opts: { size: "sm" | "lg" | "xl"; rowLabel: string }) => {
                              const Icon = item.icon;
                              const immediateStartPulse = item.tone === "working" && /\bstarting\b/i.test(item.detail);
                              const visualTone = immediateStartPulse ? "starting" : item.tone;
                              const tc = toneColors[visualTone] ?? toneColors.ready;
                              const sizeClass = opts.size === "xl" ? "h-[6rem] w-[6rem]" : opts.size === "lg" ? "h-[5rem] w-[5rem]" : "h-12 w-12";
                              const riskTitle = item.performanceRisk ? ` · ${item.performanceRisk.detail}` : "";
                              const title = `${opts.rowLabel} · ${readinessLabel(item.tone)} · ${item.kind} · ${item.title} · ${item.meta}${riskTitle}`;
                              const ariaLabel = `${opts.rowLabel} ${readinessLabel(item.tone)} ${item.kind}: ${item.title}${riskTitle}`;
                              const shouldPulse = shouldPulseLight(item);
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
                                          ? "border-[#ff1200]/85 text-[#ff1200] shadow-[0_0_10px_rgba(255,18,0,0.22)]"
                                          : "border-[#ff3d00]/60 text-[#ff3d00]/85",
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
                              const teamIsRunning = allTeamItems.some((item) => item.tone === "working");
                              const workflowStages = workflowStagesForTeam(row.items, "workflow" in row ? row.workflow : undefined);
                              const showsFinalResearchOutput = rowTitle.toLowerCase() === "hermes research";
                              const rowTeamId = "teamId" in row ? row.teamId : row.label;
                              const finalOutput = "finalOutput" in row ? row.finalOutput : undefined;
                              const latestKb = finalOutput?.latest_base ?? null;
                              const finalOutputMarker = latestKb ? `${latestKb.slug}:${latestKb.updated_at}` : "";
                              const finalOutputSeen = finalOutputMarker ? seenFinalOutputs[rowTeamId] === finalOutputMarker : false;
                              const finalOutputIsNew = Boolean(latestKb && !finalOutputSeen);
                              const visibleTeamTasks = tasksByTeam.get(rowTeamId) ?? [];

                              const handleFinalResearchOutputClick = () => {
                                if (finalOutputMarker) {
                                  markFinalOutputSeen(rowTeamId, finalOutputMarker);
                                  setSeenFinalOutputs((current) => ({ ...current, [rowTeamId]: finalOutputMarker }));
                                }
                              };

                              const buildFinalResearchOutputElement = () => (
                                <span className="flex items-center">
                                  <span
                                    className={cn("relative flex w-20 shrink-0 self-stretch items-center justify-center", finalOutputIsNew ? "text-[#ff3d00]/80" : "text-[#ff3d00]/60")}
                                    aria-hidden="true"
                                  >
                                    <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-current/30" />
                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono-ui text-[0.7rem] text-current/80">›</span>
                                  </span>
                                  <Link
                                    to={latestKb ? `/knowledge-base?base=${encodeURIComponent(latestKb.slug)}` : "/knowledge-base"}
                                    onClick={handleFinalResearchOutputClick}
                                    className={cn(
                                      "relative flex h-[4.75rem] min-w-[8.5rem] flex-col items-center justify-center rounded-lg px-4 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-1",
                                      finalOutputIsNew
                                        ? "border border-[#ff3d00]/55 bg-[#ff3d00]/[0.05] text-[#ff3d00] shadow-none focus-visible:ring-[#ff3d00]/70"
                                        : "border border-[#ff3d00]/35 bg-[#ff3d00]/[0.03] text-[#ff3d00]/75 shadow-none focus-visible:ring-[#ff3d00]/60",
                                    )}
                                    title={latestKb ? `Knowledge Base added: ${latestKb.title}` : "Final research output · polished brief or saved knowledge-base artifact"}
                                    aria-label={latestKb ? `Final research output: Knowledge Base added ${latestKb.title}` : "Final research output: polished brief or saved knowledge-base artifact"}
                                  >
                                    <span className="absolute inset-1 rounded-md border border-current/10" />
                                    <span className="absolute inset-x-3 top-2 h-px bg-current/25" />
                                    <FileText className="relative z-10 h-4 w-4 text-current/85" />
                                    <span className="relative z-10 mt-1 font-mono-ui text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em] text-current/95">
                                      Final output
                                    </span>
                                    <span className="relative z-10 mt-1 font-mono-ui text-[0.46rem] uppercase tracking-[0.12em] text-current/60">
                                      {finalOutputIsNew ? "KB added" : latestKb ? "Knowledge Base" : "Research brief"}
                                    </span>
                                  </Link>
                                </span>
                              );

                              return (
                                <div key={row.label} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                                  <div className="grid w-full items-center gap-2 rounded border border-border/50 bg-background-base/25 px-2 py-1.5 transition-colors duration-200 md:grid-cols-[minmax(12rem,18rem)_1fr_auto]">
                                    <button
                                      type="button"
                                      aria-expanded={isExpanded}
                                      onClick={() => toggleTeamRow(rowKey)}
                                      className="group flex min-w-0 items-start gap-2 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff3d00]/70"
                                    >
                                      <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3d00]/70" />
                                      <span className="min-w-0">
                                        <span className="block truncate font-mono-ui text-xs font-semibold text-foreground">{rowTitle}</span>
                                        {rowMeta && <span className="mt-0.5 block truncate text-[0.68rem] text-muted-foreground">{rowMeta}</span>}
                                      </span>
                                      <span className="sr-only">{isExpanded ? "Collapse" : "Expand"} {rowTitle}</span>
                                    </button>
                                    <span className="hidden h-6 min-w-0 items-center px-3 text-[#ff3d00]/85 md:flex" aria-hidden="true">
                                      {teamIsRunning && <HeartbeatTrace />}
                                    </span>
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
                                              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-black/20 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff3d00]/70",
                                              itemTc.border,
                                              itemTc.bg,
                                              itemTc.text,
                                              itemTc.shadow,
                                            )}
                                            title={`${item.roleName || item.roleGlyph || item.kind}${item.currentTask ? ` · ${item.currentTask.title || item.currentTask.id}` : ""}`}
                                            aria-label={`Open ${item.roleName || item.roleGlyph || item.kind} details`}
                                          >
                                            {shouldPulseLight(item) && (
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
                                                    ? "border-[#ff1200]/85 text-[#ff1200] shadow-[0_0_10px_rgba(255,18,0,0.22)]"
                                                    : "border-[#ff3d00]/60 text-[#ff3d00]/85",
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

                                  {visibleTeamTasks.length > 0 && (
                                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                                      {visibleTeamTasks.map((task) => (
                                        <div
                                          key={`${task.boardSlug}:${task.id}`}
                                          className="group relative border border-border/50 bg-background-base/35 text-left transition-colors hover:border-[#ff3d00]/45 hover:bg-[#ff3d00]/[0.04]"
                                        >
                                          <Link
                                            to={`/kanban?task=${encodeURIComponent(task.id)}`}
                                            className="block px-2.5 py-2 pr-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff3d00]/60"
                                          >
                                            <span className="flex items-center justify-between gap-2">
                                              <span className="font-mono-ui text-[0.55rem] uppercase tracking-[0.16em] text-[#ff3d00]/75">Kanban</span>
                                              <Badge tone={taskTone(task)}>{task.status}</Badge>
                                            </span>
                                            <span className="mt-1 block line-clamp-1 text-xs font-medium text-foreground group-hover:text-white">
                                              {task.title || task.id}
                                            </span>
                                            <span className="mt-1 block truncate font-mono-ui text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground">
                                              {task.id} · {task.assignee || "unassigned"}
                                            </span>
                                          </Link>
                                          <button
                                            type="button"
                                            onClick={() => requestDeleteTeamTask(task)}
                                            disabled={deletingTaskId === task.id}
                                            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-border/60 bg-black/35 text-muted-foreground opacity-85 transition-colors hover:border-destructive/55 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/60 disabled:cursor-wait disabled:opacity-50"
                                            aria-label={`Cancel/remove Kanban task ${task.id}`}
                                            title={`Cancel/remove ${task.id}`}
                                          >
                                            {deletingTaskId === task.id ? <Spinner /> : <X className="h-3.5 w-3.5" />}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

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

                            const rowIsRunning = row.items.some((item) => item.tone === "working");
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
                                  {rowIsRunning && (
                                    <span className="hidden h-6 min-w-[5rem] flex-1 items-center pl-1 text-[#ff3d00]/85 sm:flex" aria-hidden="true">
                                      <HeartbeatTrace />
                                    </span>
                                  )}
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
      {deleteTaskTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-background-base/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mission-team-task-delete-title"
          onClick={(event) => event.target === event.currentTarget && setDeleteTaskTarget(null)}
        >
          <div className="w-full max-w-md border border-destructive/35 bg-card p-5 shadow-2xl shadow-black/45">
            <p className="font-mondwest text-display text-xs uppercase tracking-[0.18em] text-destructive/80">
              Cancel/remove Kanban
            </p>
            <h2 id="mission-team-task-delete-title" className="mt-2 text-lg font-semibold text-foreground">
              {deleteTaskTarget.title || deleteTaskTarget.id}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This removes the task from the Kanban board and Mission Control. Use this for stale, duplicate, or unwanted queued work.
            </p>
            <p className="mt-3 break-all border border-border/60 bg-background-base/45 px-3 py-2 font-mono-ui text-xs text-muted-foreground">
              {deleteTaskTarget.boardName} · {deleteTaskTarget.id} · {deleteTaskTarget.status}
            </p>
            {deleteTaskError && (
              <p className="mt-3 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteTaskError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => setDeleteTaskTarget(null)}
                disabled={Boolean(deletingTaskId)}
                className="border border-border/60 bg-background-base/70 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDeleteTeamTask}
                disabled={Boolean(deletingTaskId)}
                className="gap-2 border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25"
              >
                {deletingTaskId ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                {deletingTaskId ? "Removing…" : "Remove task"}
              </Button>
            </div>
          </div>
        </div>
      )}
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

function MissionControlTerminalDock({ workingProfiles }: { workingProfiles: Set<string> }) {
  const terminals = [
    { id: "personal", label: "Personal", profile: "rorypersonal", hero: "ONLY" },
    { id: "juror", label: "Juror", profile: "jurorcoordinator", hero: "ONE" },
    { id: "research", label: "Research", profile: "hresearchstrategist", hero: "PROMPT" },
    { id: "marketing", label: "Marketing", profile: "hmarketingplanner", hero: "AWAY" },
  ];

  return (
    <section id="mission-terminals" className="mission-terminal-dock scroll-mt-24 border border-border/70 bg-background-base/45 p-3 shadow-2xl shadow-black/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[#ff3d00]" />
          <div>
            <CardTitle className="text-base">Embedded terminals</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Four live Hermes panes for quick steering without leaving Mission Control.</p>
          </div>
        </div>
        <Badge tone="secondary">4 terminals</Badge>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {terminals.map((terminal) => (
          <div key={terminal.id} className="overflow-hidden border border-border/70 bg-black/40 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2 border-b border-border/60 bg-background-base/70 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff3d00]/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff3d00]/65" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff3d00]/40" />
              <span className="ml-2 truncate font-mono-ui text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
                {terminal.label} · {terminal.profile}
              </span>
              {workingProfiles.has(terminal.profile) && (
                <span className="ml-auto flex h-4 w-28 shrink-0 items-center text-[#ff3d00]/85" aria-hidden="true">
                  <HeartbeatTrace beats={2} />
                </span>
              )}
            </div>
            <div className="h-[28rem] min-h-0 bg-black">
              <ChatPage embedded isActive profileOverride={terminal.profile} embeddedHeroText={terminal.hero} />
            </div>
          </div>
        ))}
      </div>
    </section>
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
            className="group relative overflow-hidden border border-white/[0.07] bg-white/[0.03] p-6 transition-all hover:border-[#ff3d00]/24"
          >
            <div className="absolute inset-0 bg-black/10" />
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
    tone === "success" || tone === "warning"
      ? "border-[#ff3d00]/22 bg-[#ff3d00]/[0.025] text-[#ff3d00]/78"
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

export default function MissionControlPage() {
  const [data, setData] = useState<LoadState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState({ x: 72, y: 18 });
  const [selectedMetric, setSelectedMetric] = useState("gateway");
  const [soundSettings, setSoundSettings] = useState<MissionControlSoundSettings>(() => readCachedSoundSettings());
  const [soundVisual, setSoundVisual] = useState<MissionSoundVisualState>({ active: false, label: "Audio playing" });
  const soundVisualTimerRef = useRef<number | null>(null);
  const previousTerminalTonesRef = useRef<Map<string, ReadinessTone> | null>(null);
  const previousTaskStatusesRef = useRef<Map<string, string> | null>(null);
  const currentTerminalReviewIdsRef = useRef<Set<string>>(new Set());
  const launchClipPlayedRef = useRef(false);
  const pendingLaunchClipRef = useRef(false);
  const pendingApprovalDingRef = useRef(false);
  const pendingDoneDingRef = useRef(false);
  const lastKanbanActivityRefreshRef = useRef(0);

  const updateSoundSetting = useCallback((kind: MissionControlSoundSetting, enabled: boolean) => {
    setSoundSettings((current) => {
      const next = { ...current, [kind]: enabled };
      cacheSoundSettings(next);
      return next;
    });
  }, []);

  const beginSoundVisual = useCallback((label: string, durationMs?: number) => {
    if (soundVisualTimerRef.current !== null) {
      window.clearTimeout(soundVisualTimerRef.current);
      soundVisualTimerRef.current = null;
    }
    setSoundVisual({ active: true, label });
    if (typeof durationMs === "number") {
      soundVisualTimerRef.current = window.setTimeout(() => {
        setSoundVisual((current) => ({ ...current, active: false }));
        soundVisualTimerRef.current = null;
      }, durationMs);
    }
  }, []);

  const endSoundVisual = useCallback(() => {
    if (soundVisualTimerRef.current !== null) {
      window.clearTimeout(soundVisualTimerRef.current);
      soundVisualTimerRef.current = null;
    }
    setSoundVisual((current) => ({ ...current, active: false }));
  }, []);

  const playWithSoundVisual = useCallback(
    async (
      label: string,
      fallbackDurationMs: number,
      player: () => Promise<{ duration_seconds?: number } | void>,
    ) => {
      beginSoundVisual(label);
      const startedAt = Date.now();
      try {
        const result = await player();
        const durationMs = typeof result?.duration_seconds === "number"
          ? Math.max(350, result.duration_seconds * 1000)
          : fallbackDurationMs;
        const remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
        if (soundVisualTimerRef.current !== null) {
          window.clearTimeout(soundVisualTimerRef.current);
        }
        if (remainingMs === 0) {
          setSoundVisual((current) => ({ ...current, active: false }));
          soundVisualTimerRef.current = null;
        } else {
          soundVisualTimerRef.current = window.setTimeout(() => {
            setSoundVisual((current) => ({ ...current, active: false }));
            soundVisualTimerRef.current = null;
          }, remainingMs);
        }
      } catch (error) {
        if (soundVisualTimerRef.current !== null) {
          window.clearTimeout(soundVisualTimerRef.current);
          soundVisualTimerRef.current = null;
        }
        setSoundVisual((current) => ({ ...current, active: false }));
        throw error;
      }
    },
    [beginSoundVisual],
  );

  useEffect(() => () => {
    if (soundVisualTimerRef.current !== null) {
      window.clearTimeout(soundVisualTimerRef.current);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const activity = await api.getMissionControlActivity({ timeoutMs: MISSION_CONTROL_ACTIVITY_TIMEOUT_MS });
      const activeTeamIds = new Set(
        (activity.profile_teams ?? [])
          .filter((team) => team.agents.some((agent) => agent.active || agent.status === "working" || agent.status === "review"))
          .map((team) => team.team_id),
      );
      const shouldRefreshKanban = activeTeamIds.size > 0 && Date.now() - lastKanbanActivityRefreshRef.current > 4000;
      if (!shouldRefreshKanban) {
        setData((previous) => ({ ...previous, activity }));
      } else {
        lastKanbanActivityRefreshRef.current = Date.now();
        try {
          const kanbanBoards = await api.getKanbanBoards({ timeoutMs: MISSION_CONTROL_ACTIVITY_TIMEOUT_MS });
          const boardMetas = kanbanBoards.boards.filter((board) => activeTeamIds.has(board.slug));
          const boardResults = await Promise.allSettled(
            boardMetas.map((board) => api.getKanbanBoard(board.slug, { timeoutMs: MISSION_CONTROL_ACTIVITY_TIMEOUT_MS })),
          );
          const kanbanByBoard = boardResults.reduce<Record<string, KanbanBoardResponse>>((acc, result, index) => {
            if (result.status === "fulfilled") {
              acc[boardMetas[index].slug] = result.value;
            }
            return acc;
          }, {});
          setData((previous) => ({
            ...previous,
            activity,
            kanbanBoards,
            kanbanByBoard: { ...previous.kanbanByBoard, ...kanbanByBoard },
            kanban: previous.kanban ?? (kanbanBoards.current && kanbanByBoard[kanbanBoards.current] ? kanbanByBoard[kanbanBoards.current] : previous.kanban),
            kanbanUnavailable: false,
          }));
        } catch {
          setData((previous) => ({ ...previous, activity }));
        }
      }
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
      api.getSessions(30, 0, undefined, "created", timeout),
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

  useEffect(() => {
    void Promise.resolve().then(load);
    void Promise.resolve().then(loadActivity);
  }, [load, loadActivity]);

  useEffect(() => {
    if (launchClipPlayedRef.current || !soundSettings.launchClip) return;
    launchClipPlayedRef.current = true;
    void playWithSoundVisual(
      "Prompt-away clip",
      5200,
      () => playMissionControlPromptAwayClip(nextMissionControlPromptAwayClipIndex()),
    ).catch(() => {
      // Browsers can block page-load audio before user activation. Try once on the next gesture.
      pendingLaunchClipRef.current = true;
    });
  }, [playWithSoundVisual, soundSettings.launchClip]);

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

  const effectiveTeamFilter = ALL_TEAMS_FILTER;
  const metrics = useMemo(() => buildMetrics(data), [data]);
  const timeline = useMemo(() => buildTimeline(data, effectiveTeamFilter), [data, effectiveTeamFilter]);
  const operations = useMemo(() => buildOperationsItems(data), [data]);
  const liveProfiles = useMemo(() => liveActivityByProfile(data), [data]);
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
  const teamTasksById = useMemo(() => currentTasksByTeam(data), [data]);
  const workingProfiles = useMemo(() => {
    const profiles = new Set<string>();
    for (const record of data.activity?.activities ?? []) {
      if (record.status === "working" && record.profile) profiles.add(record.profile);
    }
    for (const item of operations) {
      if (item.tone === "working" && item.profileName) profiles.add(item.profileName);
    }
    return profiles;
  }, [data.activity, operations]);
  const score = useMemo(() => computeMissionScore(data), [data]);
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
      void playWithSoundVisual("Task voice update", 3400, () => playMissionControlAnnouncement(announcement)).catch(() => {
        if (soundSettings.done) {
          void playWithSoundVisual("Done tone", 1300, playMissionControlDoneDing).catch(() => undefined);
        }
      });
    }
  }, [data, playWithSoundVisual, soundSettings.announce, soundSettings.done]);

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
      void playWithSoundVisual("Approval tone", 1500, playMissionControlApprovalDing).catch(() => {
        // Browsers can block audio before user activation. Retry once the user next clicks/presses a key.
        pendingApprovalDingRef.current = true;
      });
    }
    if (hasNewReadyLight && soundSettings.done) {
      void playWithSoundVisual("Done tone", 1300, playMissionControlDoneDing).catch(() => {
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
        void playWithSoundVisual(
          tone === "review" ? "Terminal approval" : "Terminal complete",
          3400,
          () => playMissionControlAnnouncement(
            terminalResultAnnouncement(item, tone),
            tone === "review" ? "approval" : "done",
          ),
        ).catch(() => {
          if (tone === "review" && soundSettings.approval) {
            void playWithSoundVisual("Approval tone", 1500, playMissionControlApprovalDing).catch(() => undefined);
          } else if (tone === "ready" && soundSettings.done) {
            void playWithSoundVisual("Done tone", 1300, playMissionControlDoneDing).catch(() => undefined);
          }
        });
      }
    }
  }, [playWithSoundVisual, soundSettings.approval, soundSettings.done, soundSettings.terminalAnnounce, terminalItemsById, terminalReviewIds, terminalTones]);

  useEffect(() => {
    const playPendingDing = () => {
      void ensureMissionControlAudioContext().catch(() => {
        // Keep the listener passive if the browser still refuses to unlock audio.
      });
      if (pendingApprovalDingRef.current && soundSettings.approval && currentTerminalReviewIdsRef.current.size > 0) {
        pendingApprovalDingRef.current = false;
        void playWithSoundVisual("Approval tone", 1500, playMissionControlApprovalDing).catch(() => {
          pendingApprovalDingRef.current = true;
        });
      }
      if (pendingDoneDingRef.current && soundSettings.done) {
        pendingDoneDingRef.current = false;
        void playWithSoundVisual("Done tone", 1300, playMissionControlDoneDing).catch(() => {
          pendingDoneDingRef.current = true;
        });
      }
      if (pendingLaunchClipRef.current && soundSettings.launchClip) {
        pendingLaunchClipRef.current = false;
        void playWithSoundVisual(
          "Prompt-away clip",
          5200,
          () => playMissionControlPromptAwayClip(nextMissionControlPromptAwayClipIndex()),
        ).catch(() => {
          pendingLaunchClipRef.current = true;
        });
      }
    };
    window.addEventListener("pointerdown", playPendingDing);
    window.addEventListener("keydown", playPendingDing);
    return () => {
      window.removeEventListener("pointerdown", playPendingDing);
      window.removeEventListener("keydown", playPendingDing);
    };
  }, [playWithSoundVisual, soundSettings.approval, soundSettings.done, soundSettings.launchClip]);

  if (loading) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden border border-[#ff3d00]/20 bg-[#030303]">
        <div className="relative flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="text-3xl text-primary" />
          <p className="font-mondwest text-display text-xs uppercase tracking-[0.18em]">Booting mission control</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mission-control-surface relative isolate flex flex-col gap-5">
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
        {/* Warm black/orange terminal field with no decorative gradients. */}
        <div className="mission-hero__grid absolute inset-0" />
        <div className="mission-hero__glow absolute inset-0 transition-opacity" />
        <div className="mission-hero__scan absolute inset-x-0 top-0 h-40" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[#050505]" />

        <div className="relative flex flex-col px-6 pt-8 pb-6 sm:px-10 sm:pt-10 sm:pb-8">
          {/* HUD status line */}
          <div className="mb-5 flex items-center gap-3">
            <span className="mission-kicker">Orbital command online</span>
            <span className="h-px flex-1 bg-white/8" />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/25">
              {readiness.label} · Config v{data.status?.config_version ?? "—"}
            </span>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(21rem,0.8fr)_minmax(14rem,0.75fr)_minmax(15rem,18rem)] xl:items-center 2xl:grid-cols-[minmax(28rem,0.86fr)_minmax(18rem,1fr)_22rem]">
            <div>
              <h2
                className="mission-title font-light uppercase leading-[0.9] tracking-[0.18em] text-white"
                style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}
              >
                Mission Control
              </h2>
              <p className="mission-mantra mt-3" aria-label="Mission Control mantra">
                It’s only one prompt away
              </p>
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
            <div className="mission-sound-bridge-slot hidden min-h-[9rem] xl:flex xl:items-center xl:justify-center">
              <MissionSoundBridge active={soundVisual.active} label={soundVisual.label} />
            </div>
            <div className="flex justify-end">
              <MissionOrb
                metrics={metrics}
                score={score}
                selectedMetric={selectedMetric}
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-3 border border-[#ff1200]/35 bg-[#ff1200]/[0.05] px-4 py-3 text-sm text-[#ff1200]/90 shadow-[0_0_16px_rgba(255,18,0,0.16)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}


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

      <MissionSectionBreak eyebrow="Signal board" label="Active operations" />

      <ActiveOperationsBoard
        items={operations}
        profiles={data.profiles}
        profileTeams={data.activity?.profile_teams ?? []}
        liveProfiles={liveProfiles}
        soundSettings={soundSettings}
        onSoundSettingChange={updateSoundSetting}
        onSoundStarted={beginSoundVisual}
        onSoundEnded={endSoundVisual}
        onRefresh={load}
        taskByProfile={teamTaskByProfile}
        tasksByTeam={teamTasksById}
      />

      <MissionSectionBreak eyebrow="Workload" label="Mission queue + team signals" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <MissionQueue data={data} onRefresh={load} teamFilter={effectiveTeamFilter} />
        <Timeline items={timeline} />
      </div>

      <MissionSectionBreak eyebrow="Embedded panes" label="Terminal dock" />

      <MissionControlTerminalDock workingProfiles={workingProfiles} />
      <CommandDock />
      <PluginSlot name="mission-control:bottom" />
    </div>
  );
}
