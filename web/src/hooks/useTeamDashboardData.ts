import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, buildWsUrl } from "@/lib/api";
import type {
  KanbanActiveWorker,
  KanbanBoardMeta,
  KanbanBoardResponse,
  KanbanEvent,
  KanbanEventsFrame,
  ProfileInfo,
} from "@/lib/api";
import {
  buildPipelineTimeline,
  buildTeamActivity,
  buildTeamLatestWork,
  buildTeamOperationalCues,
  buildTeamOverview,
  chooseTeamBoardSlug,
  chooseTeamRoles,
  computeMemberReadiness,
  formatTeamBoardName,
} from "@/lib/team";

const LIVE_EVENT_KINDS = new Set(["claimed", "heartbeat", "completed", "blocked", "status", "spawned", "gave_up", "promoted"]);
const TEAM_SELECTED_BOARD_STORAGE_KEY = "hermes.team.selectedBoard";

function readUrlSelectedBoard(): string {
  try {
    return new URLSearchParams(window.location.search).get("board") ?? "";
  } catch {
    return "";
  }
}

function readCachedSelectedBoard(): string {
  try {
    return readUrlSelectedBoard() || window.localStorage.getItem(TEAM_SELECTED_BOARD_STORAGE_KEY) || "";
  } catch {
    return readUrlSelectedBoard();
  }
}

function writeCachedSelectedBoard(slug: string): void {
  try {
    if (slug) window.localStorage.setItem(TEAM_SELECTED_BOARD_STORAGE_KEY, slug);
    else window.localStorage.removeItem(TEAM_SELECTED_BOARD_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private windows or locked-down embeds.
  }
}

export interface TeamDashboardDataOptions {
  onLoadError?: (error: unknown) => void;
}

export function useTeamDashboardData(options: TeamDashboardDataOptions = {}) {
  const { onLoadError } = options;
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [boards, setBoards] = useState<KanbanBoardMeta[]>([]);
  const [selectedBoard, setSelectedBoard] = useState(readCachedSelectedBoard);
  const [currentBoard, setCurrentBoard] = useState<string | null>(null);
  const [board, setBoard] = useState<KanbanBoardResponse | null>(null);
  const [activeWorkers, setActiveWorkers] = useState<KanbanActiveWorker[]>([]);
  const [events, setEvents] = useState<KanbanEvent[]>([]);
  const [eventCursor, setEventCursor] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [currentNow, setCurrentNow] = useState(() => Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kanbanError, setKanbanError] = useState<string | null>(null);
  const eventCursorRef = useRef(0);
  const liveRefreshTimerRef = useRef<number | null>(null);

  const updateEventCursor = useCallback((cursor: number) => {
    eventCursorRef.current = cursor;
    setEventCursor(cursor);
  }, []);

  const loadLiveSummary = useCallback(async (boardSlug: string) => {
    const [boardRes, workersRes] = await Promise.all([
      api.getKanbanBoard(boardSlug),
      api.getKanbanActiveWorkers(boardSlug).catch(() => ({ workers: [] })),
    ]);
    setBoard(boardRes);
    setActiveWorkers(workersRes.workers ?? []);
    setCurrentNow(boardRes.now ?? Math.floor(Date.now() / 1000));
    return boardRes;
  }, []);

  const scheduleLiveSummaryRefresh = useCallback(() => {
    if (!selectedBoard || liveRefreshTimerRef.current !== null) return;
    liveRefreshTimerRef.current = window.setTimeout(() => {
      liveRefreshTimerRef.current = null;
      void loadLiveSummary(selectedBoard).catch(() => {
        setLiveError("Live summary refresh failed");
      });
    }, 350);
  }, [loadLiveSummary, selectedBoard]);

  const load = useCallback(async () => {
    setRefreshing(true);
    setKanbanError(null);
    try {
      const profilesRes = await api.getProfiles();
      setProfiles(profilesRes.profiles);

      try {
        const boardsRes = await api.getKanbanBoards();
        const preferredBoard = chooseTeamBoardSlug(boardsRes.boards, boardsRes.current, selectedBoard || readCachedSelectedBoard());
        setBoards(boardsRes.boards);
        setCurrentBoard(boardsRes.current || null);
        setSelectedBoard(preferredBoard);
        writeCachedSelectedBoard(preferredBoard);

        if (preferredBoard) {
          const boardRes = await loadLiveSummary(preferredBoard);
          const since = Math.max(0, (boardRes.latest_event_id ?? 0) - 50);
          const eventRes = await api.getKanbanEvents(preferredBoard, since, 50).catch(() => ({ events: [], cursor: boardRes.latest_event_id ?? 0 }));
          setEvents(eventRes.events ?? []);
          updateEventCursor(eventRes.cursor ?? boardRes.latest_event_id ?? 0);
        } else {
          setBoard(null);
          setActiveWorkers([]);
          setEvents([]);
          updateEventCursor(0);
        }
      } catch (error) {
        setBoard(null);
        setActiveWorkers([]);
        setEvents([]);
        updateEventCursor(0);
        setKanbanError(error instanceof Error ? error.message : String(error));
      }
    } catch (error) {
      onLoadError?.(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadLiveSummary, onLoadError, selectedBoard, updateEventCursor]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!selectedBoard) return undefined;

    let closed = false;
    let socket: WebSocket | null = null;

    void buildWsUrl("/api/plugins/kanban/events", {
      board: selectedBoard,
      since: String(eventCursorRef.current),
    })
      .then((url) => {
        if (closed) return;
        socket = new WebSocket(url);
        socket.onopen = () => {
          setLiveConnected(true);
          setLiveError(null);
        };
        socket.onclose = () => {
          setLiveConnected(false);
          if (!closed) setLiveError("Live event stream disconnected");
        };
        socket.onerror = () => {
          setLiveConnected(false);
          setLiveError("Live event stream unavailable");
        };
        socket.onmessage = (message) => {
          try {
            const frame = JSON.parse(message.data) as KanbanEventsFrame;
            if (frame.cursor !== undefined) updateEventCursor(frame.cursor);
            if (!Array.isArray(frame.events) || frame.events.length === 0) return;
            setEvents((prev) => {
              const byId = new Map<number, KanbanEvent>();
              [...prev, ...frame.events].forEach((event) => byId.set(event.id, event));
              return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, 100);
            });
            if (frame.events.some((event) => LIVE_EVENT_KINDS.has(event.kind))) {
              scheduleLiveSummaryRefresh();
            }
          } catch {
            setLiveError("Live event frame could not be read");
          }
        };
      })
      .catch(() => {
        setLiveConnected(false);
        setLiveError("Live event stream unavailable");
      });

    return () => {
      closed = true;
      socket?.close();
    };
  }, [scheduleLiveSummaryRefresh, selectedBoard, updateEventCursor]);

  useEffect(() => {
    return () => {
      if (liveRefreshTimerRef.current !== null) window.clearTimeout(liveRefreshTimerRef.current);
    };
  }, []);

  const teamRoles = useMemo(() => chooseTeamRoles(selectedBoard), [selectedBoard]);
  const team = useMemo(
    () => buildTeamOverview(profiles, board, activeWorkers, teamRoles),
    [activeWorkers, board, profiles, teamRoles],
  );
  const now = board?.now ?? currentNow;
  const readinessByRole = useMemo(
    () => new Map(team.map((member) => [member.role.key, computeMemberReadiness(member, now)])),
    [now, team],
  );
  const pipeline = useMemo(() => buildPipelineTimeline(team, now), [now, team]);
  const activity = useMemo(() => buildTeamActivity(events, board, activeWorkers, 20), [activeWorkers, board, events]);
  const latestWork = useMemo(() => buildTeamLatestWork(team, now, 6), [now, team]);
  const operationalCues = useMemo(() => buildTeamOperationalCues(team), [team]);
  const selectedBoardMeta = useMemo(
    () => boards.find((candidate) => candidate.slug === selectedBoard) ?? null,
    [boards, selectedBoard],
  );
  const currentBoardMeta = useMemo(
    () => boards.find((candidate) => candidate.slug === currentBoard) ?? null,
    [boards, currentBoard],
  );
  const selectedBoardLabel = formatTeamBoardName(selectedBoardMeta, selectedBoard || null);
  const currentBoardLabel = formatTeamBoardName(currentBoardMeta, currentBoard);
  const totals = useMemo(() => {
    const assigned = team.reduce((sum, member) => sum + member.assignedTotal, 0);
    const running = team.reduce((sum, member) => sum + member.byStatus.running, 0);
    const blocked = team.reduce((sum, member) => sum + member.byStatus.blocked, 0);
    const profilesReady = team.filter((member) => member.profile).length;
    const authReady = team.filter((member) => {
      const readiness = readinessByRole.get(member.role.key);
      return member.profile && readiness?.state !== "needs-auth";
    }).length;
    const staleHeartbeat = team.filter((member) => readinessByRole.get(member.role.key)?.label === "stale heartbeat").length;
    return { assigned, running, blocked, profiles: profilesReady, authReady, staleHeartbeat };
  }, [readinessByRole, team]);

  const handleBoardChange = useCallback((slug: string) => {
    setEvents([]);
    updateEventCursor(0);
    setLiveConnected(false);
    setLiveError(null);
    setSelectedBoard(slug);
    writeCachedSelectedBoard(slug);
  }, [updateEventCursor]);

  return {
    profiles,
    boards,
    selectedBoard,
    currentBoard,
    board,
    activeWorkers,
    events,
    eventCursor,
    liveConnected,
    liveError,
    now,
    loading,
    refreshing,
    kanbanError,
    load,
    loadLiveSummary,
    setLiveError,
    handleBoardChange,
    team,
    readinessByRole,
    pipeline,
    activity,
    latestWork,
    operationalCues,
    selectedBoardMeta,
    currentBoardMeta,
    selectedBoardLabel,
    currentBoardLabel,
    totals,
  };
}
