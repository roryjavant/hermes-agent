import type { ProfileInfo } from "./api";

export const TEAM_STATUSES = [
  "triage",
  "todo",
  "scheduled",
  "ready",
  "running",
  "blocked",
  "review",
  "done",
] as const;

export type TeamStatus = (typeof TEAM_STATUSES)[number];
export type TeamTone = "success" | "warning" | "destructive" | "secondary" | "outline";
export type TeamReadinessState = "live" | "queued" | "blocked" | "idle" | "needs-auth" | "offline";
export type TeamActivityIcon = "play" | "heartbeat" | "check" | "block" | "claim" | "status" | "info";

export const LIVE_HEARTBEAT_STALE_SECONDS = 15 * 60;
export const PREFERRED_TEAM_BOARD_SLUGS = ["hermes-team-ui", "juror-research", "agent-arena"] as const;

export const READINESS_ORDER: TeamReadinessState[] = [
  "blocked",
  "live",
  "queued",
  "needs-auth",
  "idle",
  "offline",
];

export interface KanbanTaskSummary {
  id: string;
  title: string;
  assignee: string | null;
  status: string;
  created_at?: number;
  started_at?: number | null;
  latest_summary?: string | null;
  skills?: string[] | null;
  current_run_id?: number | null;
  workspace_kind?: "scratch" | "dir" | "worktree" | string;
  workspace_path?: string | null;
  link_counts?: { parents?: number; children?: number };
}

export interface KanbanTaskLink {
  parent_id: string;
  child_id: string;
}

export interface KanbanColumnSummary {
  name: string;
  tasks: KanbanTaskSummary[];
}

export interface KanbanBoardSummary {
  columns: KanbanColumnSummary[];
  assignees?: string[];
  links?: KanbanTaskLink[];
  latest_event_id?: number;
  now?: number;
}

export interface KanbanActiveWorkerSummary {
  run_id: number;
  task_id: string;
  task_title: string;
  task_status: string;
  task_assignee: string | null;
  profile: string | null;
  worker_pid: number | null;
  started_at: number | null;
  last_heartbeat_at: number | null;
}

export interface KanbanEventSummary {
  id: number;
  task_id: string;
  run_id: number | null;
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: number;
}

export interface TeamActivityItem {
  id: number;
  taskId: string;
  runId: number | null;
  kind: string;
  createdAt: number;
  title: string;
  assignee: string | null;
  profile: string | null;
  status: string | null;
  tone: TeamTone;
  icon: TeamActivityIcon;
  summary: string;
}

export interface TeamReadiness {
  state: TeamReadinessState;
  tone: TeamTone;
  label: string;
  reasons: string[];
  lastHeartbeatAt: number | null;
}

export interface PipelineTimelineStage {
  key: string;
  label: string;
  profileName: string;
  state: TeamReadinessState;
  activeCount: number;
  queuedCount: number;
  blockedCount: number;
  doneCount: number;
  currentTask: KanbanTaskSummary | null;
}

export interface TeamLatestWorkItem {
  task: KanbanTaskSummary;
  roleLabel: string;
  profileName: string;
  summary: string;
  readinessLabel: string;
  needsReview: boolean;
  hasSummary: boolean;
}

export interface TeamOperationalCues {
  readyToDispatch: number;
  needsReview: number;
  hasLatestSummaries: number;
  blocked: number;
  liveWorkers: number;
  externalLiveWorkers: number;
  cue: string;
}

export type TeamTopologyKind = "relay" | "parallel" | "mixed" | "converging" | "idle" | "unknown";
export type TeamTopologyPhase = "active" | "ready" | "waiting" | "blocked" | "complete" | "idle";

export interface TeamExternalExecutor {
  name: string;
  taskId: string;
  taskTitle: string;
}

export interface TeamTopology {
  kind: TeamTopologyKind;
  phase: TeamTopologyPhase;
  label: string;
  reason: string;
  currentLine: string | null;
  nextLine: string | null;
  waitingLine: string | null;
  activeTaskIds: string[];
  waitingTaskIds: string[];
  blockedTaskIds: string[];
  nextTaskIds: string[];
  externalExecutors: TeamExternalExecutor[];
  verifiedSharedWorkspace: { kind: "dir"; path: string } | null;
  evidenceComplete: boolean;
  announcement: string;
}

export interface TeamRoleDefinition {
  key: string;
  label: string;
  profileName: string;
  description: string;
}

export interface TeamBoardChoice {
  slug: string;
}

export interface TeamMemberOverview {
  role: TeamRoleDefinition;
  profile: ProfileInfo | null;
  tasks: KanbanTaskSummary[];
  activeWorkers: KanbanActiveWorkerSummary[];
  byStatus: Record<TeamStatus, number>;
  assignedTotal: number;
  blockedCount: number;
  attachedSkills: string[];
  latestTask: KanbanTaskSummary | null;
}

export const HERMES_TEAM_ROLES: TeamRoleDefinition[] = [
  {
    key: "planner",
    label: "Planner",
    profileName: "hermesplanner",
    description: "Maps requirements, seams, risks, and implementation routes before build work starts.",
  },
  {
    key: "builder",
    label: "Builder",
    profileName: "hermesbuilder",
    description: "Implements focused dashboard, backend, and workflow changes with tests.",
  },
  {
    key: "reviewer",
    label: "Reviewer",
    profileName: "hermesreviewer",
    description: "Reviews diffs for correctness, safety, regressions, and upstream fit.",
  },
  {
    key: "synth",
    label: "Synth",
    profileName: "hermessynth",
    description: "Synthesizes research and implementation handoffs into operator-ready outputs.",
  },
  {
    key: "curator",
    label: "Curator",
    profileName: "hermescurator",
    description: "Maintains skills, references, and reusable project knowledge after work lands.",
  },
];

export const JUROR_RESEARCH_TEAM_ROLES: TeamRoleDefinition[] = [
  {
    key: "planner",
    label: "Planner",
    profileName: "jrplanner",
    description: "Maps Juror Research architecture, product seams, risks, and implementation routes before build work starts.",
  },
  {
    key: "builder",
    label: "Builder",
    profileName: "jrbuilder",
    description: "Implements focused Juror Research UI, service, and workflow changes with tests.",
  },
  {
    key: "reviewer",
    label: "Reviewer",
    profileName: "jrreviewer",
    description: "Reviews Juror Research diffs for correctness, evidence guardrails, regressions, and product fit.",
  },
  {
    key: "synth",
    label: "Synth",
    profileName: "jrsynth",
    description: "Synthesizes Juror Research implementation and proof into operator-ready handoffs.",
  },
  {
    key: "curator",
    label: "Curator",
    profileName: "jrcurator",
    description: "Maintains durable Juror Research skills, references, and reusable workflow learnings.",
  },
];

export const DEFAULT_TEAM_ROLES = HERMES_TEAM_ROLES;

export function chooseTeamRoles(boardSlug: string | null | undefined): TeamRoleDefinition[] {
  if (boardSlug === "juror-research") return JUROR_RESEARCH_TEAM_ROLES;
  return DEFAULT_TEAM_ROLES;
}

export function chooseTeamBoardSlug(
  boards: TeamBoardChoice[],
  currentBoardSlug: string | null | undefined,
  selectedBoardSlug: string | null | undefined,
): string {
  const knownSlugs = new Set(boards.map((board) => board.slug));
  if (selectedBoardSlug && knownSlugs.has(selectedBoardSlug)) return selectedBoardSlug;

  const preferred = PREFERRED_TEAM_BOARD_SLUGS.find((slug) => knownSlugs.has(slug));
  if (preferred) return preferred;

  if (currentBoardSlug && knownSlugs.has(currentBoardSlug)) return currentBoardSlug;
  return boards[0]?.slug ?? "";
}

export function formatTeamBoardName(
  board: { name?: string | null; slug?: string | null } | null | undefined,
  fallback: string | null | undefined,
): string {
  if (board?.name) return board.name;
  if (board?.slug) return board.slug;
  return fallback || "current board";
}

function emptyStatusCounts(): Record<TeamStatus, number> {
  return TEAM_STATUSES.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<TeamStatus, number>,
  );
}

function normalizeName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

function payloadString(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

const CURRENT_ASSIGNMENT_STATUS_RANK: Record<string, number> = {
  blocked: 0,
  running: 1,
  review: 2,
  ready: 3,
  scheduled: 4,
  todo: 5,
  triage: 6,
  done: 7,
};

function currentAssignmentSortKey(task: KanbanTaskSummary): [number, number] {
  const statusRank = CURRENT_ASSIGNMENT_STATUS_RANK[task.status] ?? 99;
  const activityAt = task.started_at ?? task.created_at ?? 0;
  return [statusRank, -activityAt];
}

function readinessTone(state: TeamReadinessState): TeamTone {
  if (state === "blocked") return "destructive";
  if (state === "live") return "success";
  if (state === "queued" || state === "needs-auth") return "warning";
  if (state === "idle") return "secondary";
  return "outline";
}

function readableActor(profile: string | null, assignee: string | null): string {
  return profile || assignee || "Team";
}

export function pickCurrentAssignment(tasks: KanbanTaskSummary[]): KanbanTaskSummary | null {
  if (tasks.length === 0) return null;
  return [...tasks].sort((a, b) => {
    const aKey = currentAssignmentSortKey(a);
    const bKey = currentAssignmentSortKey(b);
    return aKey[0] - bKey[0] || aKey[1] - bKey[1] || a.id.localeCompare(b.id);
  })[0];
}

export function findProfileForRole(
  profiles: ProfileInfo[],
  role: TeamRoleDefinition,
): ProfileInfo | null {
  const exact = profiles.find((profile) => normalizeName(profile.name) === normalizeName(role.profileName));
  if (exact) return exact;
  return profiles.find((profile) => normalizeName(profile.name).includes(role.key)) ?? null;
}

export function flattenBoardTasks(board: KanbanBoardSummary | null | undefined): KanbanTaskSummary[] {
  return (board?.columns ?? []).flatMap((column) =>
    (column.tasks ?? []).map((task) => ({ ...task, status: task.status || column.name })),
  );
}

const NONTERMINAL_TOPOLOGY_STATUSES = new Set(["triage", "todo", "scheduled", "ready", "running", "blocked", "review"]);

function topologyTaskName(task: KanbanTaskSummary, roles: TeamRoleDefinition[]): string {
  return roles.find((role) => normalizeName(role.profileName) === normalizeName(task.assignee))?.label ?? task.title;
}

function topologyResult(
  partial: Omit<TeamTopology, "announcement">,
): TeamTopology {
  return {
    ...partial,
    announcement: [partial.label, partial.reason, partial.currentLine, partial.nextLine, partial.waitingLine, partial.verifiedSharedWorkspace ? "Shared directory verified" : null]
      .filter(Boolean)
      .join(" · "),
  };
}

function topologyUnknown(
  reason: string,
  tasks: KanbanTaskSummary[],
  activeWorkers: KanbanActiveWorkerSummary[],
  roles: TeamRoleDefinition[],
): TeamTopology {
  const activeTaskIds = Array.from(new Set([...tasks.filter((task) => task.status === "running").map((task) => task.id), ...activeWorkers.map((worker) => worker.task_id)])).sort();
  const roster = new Set(roles.map((role) => normalizeName(role.profileName)));
  const externalExecutors = activeWorkers
    .filter((worker) => !roster.has(normalizeName(worker.profile ?? worker.task_assignee)))
    .map((worker) => ({ name: worker.profile ?? worker.task_assignee ?? "External executor", taskId: worker.task_id, taskTitle: worker.task_title }));
  const activeTitles = activeTaskIds.map((id) => tasks.find((task) => task.id === id)?.title ?? activeWorkers.find((worker) => worker.task_id === id)?.task_title).filter((title): title is string => Boolean(title));
  return topologyResult({
    kind: "unknown", phase: activeTaskIds.length > 0 ? "active" : "idle", label: "TOPOLOGY UNKNOWN", reason,
    currentLine: activeTitles.length > 0 ? `Current: ${activeTitles.join(", ")}` : null, nextLine: null, waitingLine: null,
    activeTaskIds, waitingTaskIds: [], blockedTaskIds: tasks.filter((task) => task.status === "blocked").map((task) => task.id), nextTaskIds: [],
    externalExecutors, verifiedSharedWorkspace: null, evidenceComplete: false,
  });
}

function hasDirectedCycle(ids: Set<string>, children: Map<string, string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const child of children.get(id) ?? []) if (visit(child)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...ids].some(visit);
}

function descendants(root: string, children: Map<string, string[]>): Set<string> {
  const found = new Set<string>();
  const queue = [...(children.get(root) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (found.has(id)) continue;
    found.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return found;
}

export function buildTeamTopology(
  board: KanbanBoardSummary | null | undefined,
  activeWorkers: KanbanActiveWorkerSummary[] = [],
  roles: TeamRoleDefinition[] = DEFAULT_TEAM_ROLES,
): TeamTopology {
  const tasks = flattenBoardTasks(board);
  if (tasks.length === 0) return topologyResult({
    kind: "idle", phase: "idle", label: "TEAM IDLE", reason: "No current board work", currentLine: null, nextLine: null, waitingLine: null,
    activeTaskIds: [], waitingTaskIds: [], blockedTaskIds: [], nextTaskIds: [], externalExecutors: [], verifiedSharedWorkspace: null, evidenceComplete: true,
  });
  if (!board?.links) return topologyUnknown("Dependency details unavailable", tasks, activeWorkers, roles);

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const ids = new Set(taskById.keys());
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const neighbors = new Map<string, Set<string>>();
  for (const id of ids) { parents.set(id, []); children.set(id, []); neighbors.set(id, new Set()); }
  for (const link of board.links) {
    if (!ids.has(link.parent_id) || !ids.has(link.child_id) || link.parent_id === link.child_id) return topologyUnknown("Dependency data is invalid", tasks, activeWorkers, roles);
    parents.get(link.child_id)!.push(link.parent_id);
    children.get(link.parent_id)!.push(link.child_id);
    neighbors.get(link.parent_id)!.add(link.child_id);
    neighbors.get(link.child_id)!.add(link.parent_id);
  }
  if (hasDirectedCycle(ids, children)) return topologyUnknown("Dependency data is invalid", tasks, activeWorkers, roles);
  for (const task of tasks) {
    const counts = task.link_counts;
    if (counts && ((counts.parents ?? 0) !== parents.get(task.id)!.length || (counts.children ?? 0) !== children.get(task.id)!.length)) return topologyUnknown("Dependency details unavailable", tasks, activeWorkers, roles);
  }

  const components: Set<string>[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const component = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current); component.add(current); queue.push(...(neighbors.get(current) ?? []));
    }
    components.push(component);
  }
  const current = components.filter((component) => [...component].some((id) => NONTERMINAL_TOPOLOGY_STATUSES.has(taskById.get(id)!.status)));
  if (current.length > 1) return topologyUnknown("Multiple independent work graphs", tasks, activeWorkers, roles);
  const component = current[0] ?? (components.length === 1 ? components[0] : null);
  if (!component || component.size < 2) return topologyUnknown("Dependency details unavailable", tasks, activeWorkers, roles);
  const componentTasks = [...component].map((id) => taskById.get(id)!);
  const forks = componentTasks.filter((task) => (children.get(task.id) ?? []).length > 1);
  const joins = componentTasks.filter((task) => (parents.get(task.id) ?? []).length > 1);
  const activeTaskIds = Array.from(new Set([
    ...componentTasks.filter((task) => task.status === "running").map((task) => task.id),
    ...activeWorkers.filter((worker) => component.has(worker.task_id)).map((worker) => worker.task_id),
  ])).sort();
  const blocked = componentTasks.filter((task) => task.status === "blocked");
  const waiting = componentTasks.filter((task) => (task.status === "todo" || task.status === "scheduled") && (parents.get(task.id) ?? []).some((id) => taskById.get(id)?.status !== "done"));
  const frontier = componentTasks.filter((task) => ["ready", "running", "review"].includes(task.status) && (parents.get(task.id) ?? []).every((id) => taskById.get(id)?.status === "done")).map((task) => task.id);
  const parallelBranchesReady = forks.flatMap((fork) => (children.get(fork.id) ?? []).filter((root) => {
    const branch = new Set([root, ...descendants(root, children)]);
    return frontier.some((id) => branch.has(id));
  }));
  const parallelFrontier = parallelBranchesReady.length >= 2;
  const isChain = forks.length === 0 && joins.length === 0;
  const kind: TeamTopologyKind = isChain ? "relay" : forks.length === 0 ? "converging" : parallelFrontier && joins.length === 0 ? "parallel" : "mixed";
  const phase: TeamTopologyPhase = activeTaskIds.length > 0 ? "active" : blocked.length > 0 ? "blocked" : frontier.length > 0 ? "ready" : waiting.length > 0 ? "waiting" : componentTasks.every((task) => task.status === "done") ? "complete" : "idle";
  const activeTask = activeTaskIds.map((id) => taskById.get(id)).find(Boolean) ?? null;
  const activeJoin = activeTaskIds.some((id) => (parents.get(id) ?? []).length > 1);
  const nextTaskIds = Array.from(new Set(activeTaskIds.flatMap((id) => children.get(id) ?? []))).sort();
  const nextTasks = nextTaskIds.map((id) => taskById.get(id)!).filter(Boolean);
  const blockedName = blocked[0] ? topologyTaskName(blocked[0], roles) : null;
  const swarmNow = parallelFrontier && activeTaskIds.length >= 2;
  const label = phase === "blocked" ? `${kind === "parallel" ? "PARALLEL SWARM" : kind.toUpperCase()} · BLOCKED`
    : phase === "complete" ? `${kind === "parallel" ? "PARALLEL SWARM" : kind.toUpperCase()} COMPLETE · ${componentTasks.length} STAGES`
    : kind === "relay" ? phase === "ready" ? "RELAY · READY TO DISPATCH" : "RELAY · 1 ACTIVE AT A TIME"
    : kind === "converging" ? "CONVERGING GATES · NO FAN-OUT VERIFIED"
    : kind === "parallel" ? phase === "active" ? `PARALLEL SWARM · ${Math.max(2, parallelBranchesReady.length)} BRANCHES ACTIVE` : `PARALLEL FAN-OUT · ${Math.max(2, parallelBranchesReady.length)} BRANCHES READY`
    : activeJoin ? "MIXED · JOIN NOW" : swarmNow ? "MIXED · SWARM NOW, JOIN NEXT" : phase === "active" ? "MIXED · RELAY NOW, SWARM NEXT" : "MIXED · FAN-OUT VERIFIED, IDLE";
  const reason = phase === "blocked" ? "Dependency handoff is paused by a block" : blocked.length > 0 ? "Active work continues; a separate handoff is paused" : phase === "complete" ? "Verified dependency component complete"
    : kind === "relay" ? "Sequential by dependency" : kind === "converging" ? "Dependencies converge, but no fan-out is verified"
    : kind === "parallel" ? `Fan-out verified from ${topologyTaskName(forks[0], roles)}`
    : activeJoin ? "Verified branches converge at the current dependency join" : swarmNow ? "Verified branches converge at a dependency join" : "Verified fan-out follows the current relay";
  const roster = new Set(roles.map((role) => normalizeName(role.profileName)));
  const external = new Map<string, TeamExternalExecutor>();
  for (const worker of activeWorkers.filter((worker) => component.has(worker.task_id))) {
    const name = worker.profile ?? worker.task_assignee;
    if (name && !roster.has(normalizeName(name))) external.set(worker.task_id, { name, taskId: worker.task_id, taskTitle: worker.task_title });
  }
  for (const task of componentTasks.filter((task) => task.status === "running" && task.assignee && !roster.has(normalizeName(task.assignee)))) {
    external.set(task.id, { name: task.assignee!, taskId: task.id, taskTitle: task.title });
  }
  const unfinished = componentTasks.filter((task) => task.status !== "done");
  const path = unfinished[0]?.workspace_path?.trim() ?? "";
  const verifiedSharedWorkspace = unfinished.length > 0 && path && unfinished.every((task) => task.workspace_kind === "dir" && task.workspace_path?.trim() === path) ? { kind: "dir" as const, path } : null;
  return topologyResult({
    kind, phase, label, reason, currentLine: activeTask ? `Current: ${topologyTaskName(activeTask, roles)}` : null,
    nextLine: blockedName ? "Next handoff paused until the block is resolved" : nextTasks.length > 0 && activeTask ? `Next: ${nextTasks.map((task) => topologyTaskName(task, roles)).join(", ")} after ${topologyTaskName(activeTask, roles)}` : null,
    waitingLine: blocked.length === 0 && waiting.length > 0 ? `${waiting.length} stage${waiting.length === 1 ? "" : "s"} waiting — not blocked` : null,
    activeTaskIds, waitingTaskIds: waiting.map((task) => task.id), blockedTaskIds: blocked.map((task) => task.id), nextTaskIds,
    externalExecutors: [...external.values()], verifiedSharedWorkspace, evidenceComplete: true,
  });
}

export function buildTeamOverview(
  profiles: ProfileInfo[],
  board: KanbanBoardSummary | null | undefined,
  activeWorkers: KanbanActiveWorkerSummary[] = [],
  roles: TeamRoleDefinition[] = DEFAULT_TEAM_ROLES,
): TeamMemberOverview[] {
  const tasks = flattenBoardTasks(board);

  return roles.map((role) => {
    const profile = findProfileForRole(profiles, role);
    const profileName = normalizeName(profile?.name ?? role.profileName);
    const roleTasks = tasks.filter((task) => normalizeName(task.assignee) === profileName);
    const roleWorkers = activeWorkers.filter((worker) => {
      const workerProfile = normalizeName(worker.profile);
      const workerAssignee = normalizeName(worker.task_assignee);
      return workerProfile === profileName || workerAssignee === profileName;
    });
    const byStatus = emptyStatusCounts();
    for (const task of roleTasks) {
      if (TEAM_STATUSES.includes(task.status as TeamStatus)) {
        byStatus[task.status as TeamStatus] += 1;
      }
    }
    const attachedSkills = Array.from(
      new Set(roleTasks.flatMap((task) => task.skills ?? []).filter((skill): skill is string => Boolean(skill))),
    ).sort((a, b) => a.localeCompare(b));

    return {
      role,
      profile,
      tasks: roleTasks,
      activeWorkers: roleWorkers,
      byStatus,
      assignedTotal: roleTasks.length,
      blockedCount: byStatus.blocked,
      attachedSkills,
      latestTask: pickCurrentAssignment(roleTasks),
    };
  });
}

export function countPipelineActiveStatuses(member: TeamMemberOverview): number {
  return member.byStatus.ready + member.byStatus.running + member.byStatus.blocked + member.byStatus.review;
}

export function normalizeKanbanEvent(
  event: KanbanEventSummary,
  tasksById: Map<string, KanbanTaskSummary>,
  activeWorkers: KanbanActiveWorkerSummary[] = [],
): TeamActivityItem {
  const task = tasksById.get(event.task_id) ?? null;
  const worker = activeWorkers.find((row) => row.run_id === event.run_id || row.task_id === event.task_id) ?? null;
  const title = task?.title || worker?.task_title || event.task_id;
  const assignee = task?.assignee ?? worker?.task_assignee ?? payloadString(event.payload, "assignee");
  const profile = worker?.profile ?? payloadString(event.payload, "profile");
  const status = payloadString(event.payload, "status") ?? task?.status ?? worker?.task_status ?? null;
  const actor = readableActor(profile, assignee);

  switch (event.kind) {
    case "claimed":
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status,
        tone: "warning",
        icon: "claim",
        summary: `${actor} picked up ${title}`,
      };
    case "spawned":
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status,
        tone: "success",
        icon: "play",
        summary: `${actor} started ${title}`,
      };
    case "heartbeat":
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status,
        tone: "success",
        icon: "heartbeat",
        summary: `${actor} checked in`,
      };
    case "completed":
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status: status ?? "done",
        tone: "success",
        icon: "check",
        summary: `${actor} completed ${title}`,
      };
    case "blocked":
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status: status ?? "blocked",
        tone: "destructive",
        icon: "block",
        summary: `${title} needs input`,
      };
    case "status":
    case "promoted":
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status,
        tone: status === "blocked" ? "destructive" : status === "done" ? "success" : "secondary",
        icon: "status",
        summary: status ? `${title} moved to ${status}` : `Status changed for ${title}`,
      };
    default:
      return {
        id: event.id,
        taskId: event.task_id,
        runId: event.run_id,
        kind: event.kind,
        createdAt: event.created_at,
        title,
        assignee,
        profile,
        status,
        tone: "outline",
        icon: "info",
        summary: `Kanban event: ${event.kind}`,
      };
  }
}

export function buildTeamActivity(
  events: KanbanEventSummary[],
  board: KanbanBoardSummary | null | undefined,
  activeWorkers: KanbanActiveWorkerSummary[] = [],
  limit = 20,
): TeamActivityItem[] {
  const tasksById = new Map(flattenBoardTasks(board).map((task) => [task.id, task]));
  const byId = new Map<number, KanbanEventSummary>();
  for (const event of events) byId.set(event.id, event);
  return [...byId.values()]
    .sort((a, b) => b.id - a.id)
    .slice(0, limit)
    .map((event) => normalizeKanbanEvent(event, tasksById, activeWorkers));
}

export function computeMemberReadiness(member: TeamMemberOverview, now: number): TeamReadiness {
  const heartbeatTimes = member.activeWorkers
    .map((worker) => worker.last_heartbeat_at)
    .filter((value): value is number => typeof value === "number");
  const lastHeartbeatAt = heartbeatTimes.length > 0 ? Math.max(...heartbeatTimes) : null;
  const hasLiveWorker = member.activeWorkers.some(
    (worker) => typeof worker.last_heartbeat_at === "number" && now - worker.last_heartbeat_at < LIVE_HEARTBEAT_STALE_SECONDS,
  );
  const hasStaleWorker = member.activeWorkers.length > 0 && !hasLiveWorker;
  const reasons: string[] = [];

  let state: TeamReadinessState;
  let label: string;

  if (member.blockedCount > 0) {
    state = "blocked";
    label = `${member.blockedCount} blocked`;
    reasons.push("Blocked task needs input");
  } else if (hasStaleWorker) {
    state = "queued";
    label = "stale heartbeat";
    reasons.push("Worker heartbeat is stale or missing");
  } else if (hasLiveWorker) {
    state = "live";
    label = "live worker";
    reasons.push("Recent worker heartbeat");
  } else if (member.byStatus.ready > 0 || member.byStatus.running > 0 || member.byStatus.review > 0) {
    state = "queued";
    label = `${member.byStatus.ready + member.byStatus.running + member.byStatus.review} active`;
    reasons.push("Assigned work is ready, running, or in review");
  } else if (!member.profile) {
    state = "offline";
    label = "profile missing";
    reasons.push("Using fallback roster entry");
  } else if (!member.profile.has_env || (!member.profile.model && !member.profile.provider)) {
    state = "needs-auth";
    label = !member.profile.has_env ? "profile env missing" : "inherits default";
    reasons.push(!member.profile.has_env ? "Profile env file is not present" : "No profile-specific model/provider configured");
  } else {
    state = "idle";
    label = "ready idle";
    reasons.push(member.profile.gateway_running ? "Gateway running" : "Profile installed");
  }

  return {
    state,
    tone: readinessTone(state),
    label,
    reasons,
    lastHeartbeatAt,
  };
}

export function buildPipelineTimeline(
  team: TeamMemberOverview[],
  now = Math.floor(Date.now() / 1000),
): PipelineTimelineStage[] {
  return team.map((member) => {
    const readiness = computeMemberReadiness(member, now);
    return {
      key: member.role.key,
      label: member.role.label,
      profileName: member.profile?.name ?? member.role.profileName,
      state: readiness.state,
      activeCount: member.byStatus.running + member.activeWorkers.length,
      queuedCount: member.byStatus.ready + member.byStatus.review + member.byStatus.scheduled + member.byStatus.todo,
      blockedCount: member.byStatus.blocked,
      doneCount: member.byStatus.done,
      currentTask: member.latestTask,
    };
  });
}

function latestWorkSortValue(task: KanbanTaskSummary): number {
  return task.started_at ?? task.created_at ?? 0;
}

export function buildTeamLatestWork(
  team: TeamMemberOverview[],
  now = Math.floor(Date.now() / 1000),
  limit = 6,
): TeamLatestWorkItem[] {
  return team
    .flatMap((member) => {
      const readiness = computeMemberReadiness(member, now);
      return member.tasks.map((task) => ({
        task,
        roleLabel: member.role.label,
        profileName: member.profile?.name ?? member.role.profileName,
        summary: task.latest_summary?.trim() || "No worker summary captured yet.",
        readinessLabel: readiness.label,
        needsReview: task.status === "review" || Boolean(task.latest_summary?.includes("review-required")),
        hasSummary: Boolean(task.latest_summary?.trim()),
      }));
    })
    .sort((a, b) => latestWorkSortValue(b.task) - latestWorkSortValue(a.task) || a.task.id.localeCompare(b.task.id))
    .slice(0, limit);
}

export function buildTeamOperationalCues(
  team: TeamMemberOverview[],
  activeWorkers: KanbanActiveWorkerSummary[] = [],
  roles: TeamRoleDefinition[] = DEFAULT_TEAM_ROLES,
): TeamOperationalCues {
  const tasks = team.flatMap((member) => member.tasks);
  const readyToDispatch = tasks.filter((task) => task.status === "ready" && Boolean(task.assignee)).length;
  const needsReview = tasks.filter(
    (task) => task.status === "review" || Boolean(task.latest_summary?.includes("review-required")),
  ).length;
  const hasLatestSummaries = tasks.filter((task) => Boolean(task.latest_summary?.trim())).length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const roster = new Set(roles.map((role) => normalizeName(role.profileName)));
  const externalLiveWorkers = activeWorkers.filter((worker) => !roster.has(normalizeName(worker.profile ?? worker.task_assignee))).length;
  const liveWorkers = team.reduce((sum, member) => sum + member.activeWorkers.length, 0) + externalLiveWorkers;

  let cue = "No dispatchable or review-ready team work on this board.";
  if (blocked > 0) cue = `${blocked} task${blocked === 1 ? "" : "s"} blocked before more dispatch.`;
  else if (needsReview > 0) cue = `${needsReview} task${needsReview === 1 ? "" : "s"} waiting on review/readiness.`;
  else if (readyToDispatch > 0) cue = `${readyToDispatch} assigned ready task${readyToDispatch === 1 ? "" : "s"} can be dispatched safely.`;
  else if (externalLiveWorkers > 0) cue = `${externalLiveWorkers} external live worker${externalLiveWorkers === 1 ? "" : "s"} active now.`;
  else if (liveWorkers > 0) cue = `${liveWorkers} live worker${liveWorkers === 1 ? "" : "s"} active now.`;

  return { readyToDispatch, needsReview, hasLatestSummaries, blocked, liveWorkers, externalLiveWorkers, cue };
}
