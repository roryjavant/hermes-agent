import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { ChevronRight, Loader2, Music2, Play, Trash2, Volume2 } from "lucide-react";
import { api, authedFetch, HERMES_BASE_PATH } from "@/lib/api";
import type {
  AudioLibraryAsset,
  AudioLibraryEvent,
  AudioLibraryQuotaResponse,
  AudioLibraryResponse,
  AudioLibraryVoice,
  KanbanBoardMeta,
  MissionControlProfileTeam,
  MissionControlProfileTeamAgent,
} from "@/lib/api";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const MODEL_OPTIONS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2" },
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5" },
];
const PRESET_VOICES: AudioLibraryVoice[] = [
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", label: "Adam" },
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", label: "Rachel" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", label: "Sarah" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", label: "Antoni" },
  { voice_id: "29vD33N1CtxCmqQRPOHJ", name: "Drew", label: "Drew" },
  { voice_id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", label: "Clyde" },
  { voice_id: "CYw3kZ02Hs0563khs1Fj", name: "Dave", label: "Dave" },
  { voice_id: "D38z5RcWu1voky8WS1ja", name: "Fin", label: "Fin" },
];
const FIELD_CLASS = "rounded border border-border/80 bg-black/25 px-3 py-2 text-sm outline-none focus:border-[#ff3d00]";
const SELECT_CLASS = "w-full min-w-0 rounded border border-border/70 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-[#ff3d00]";
const CARD_CLASS = "overflow-hidden rounded-xl border border-[#ff3d00]/20 border-l-[#ff3d00]/60 bg-black/50";
const GROUP_HEADER_CLASS = "flex flex-wrap items-center justify-between gap-2 border-b border-[#ff3d00]/15 bg-[#ff3d00]/[0.045] px-3 py-2";
const GROUP_TITLE_CLASS = "font-mono-ui text-xs uppercase tracking-[0.18em] text-[#ff3d00]";
const EVENT_ROW_CLASS = "grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_2.75rem]";

type TabId = "events" | "generate" | "clips";

interface GenerateFormState {
  name: string;
  text: string;
  kind: "voice" | "music";
  category: string;
  tags: string;
  event_key: string;
  voice_id: string;
  model_id: string;
  music_length_ms: number;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
}

const EMPTY_FORM: GenerateFormState = {
  name: "",
  text: "",
  kind: "voice",
  category: "voice",
  tags: "mission-control",
  event_key: "",
  voice_id: DEFAULT_VOICE_ID,
  model_id: DEFAULT_MODEL_ID,
  music_length_ms: 30000,
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  speed: 1,
  use_speaker_boost: true,
};

function audioUrl(asset: AudioLibraryAsset): string {
  return `${HERMES_BASE_PATH}${asset.url}`;
}

function formatDuration(value?: number | null): string {
  if (!value) return "duration unknown";
  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function formatBytes(value?: number): string {
  if (!value) return "—";
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function quotaSummary(quota: AudioLibraryQuotaResponse | null): string {
  if (!quota) return "Quota not checked";
  const used = quota.subscription.character_count;
  const limit = quota.subscription.character_limit;
  if (typeof used === "number" && typeof limit === "number") {
    return `${used.toLocaleString()} / ${limit.toLocaleString()} chars used`;
  }
  return quota.subscription.tier ? `Tier: ${quota.subscription.tier}` : "Quota available";
}

function eventShortLabel(event?: AudioLibraryEvent): string {
  return event?.label.replace(" terminal complete", "").replace("Mission Control ", "MC ") ?? "Unknown event";
}

function boardLabel(board: KanbanBoardMeta): string {
  return board.name?.trim() || board.slug;
}

function teamTaskCompleteEventKey(boardSlug: string): string {
  return `team.${boardSlug}.task_complete`;
}

function teamMemberTaskCompleteEventKey(boardSlug: string, profile: string): string {
  return `team.${boardSlug}.member.${profile}.task_complete`;
}

function normalizeTeamToken(value?: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function teamMatchesBoard(team: MissionControlProfileTeam, board: KanbanBoardMeta): boolean {
  const boardSlug = normalizeTeamToken(board.slug);
  const boardName = normalizeTeamToken(boardLabel(board));
  const teamId = normalizeTeamToken(team.team_id);
  const teamLabel = normalizeTeamToken(team.label);
  const projectName = normalizeTeamToken(team.project_path.split("/").filter(Boolean).at(-1));
  return [teamId, teamLabel, projectName].some((token) => Boolean(token) && (token === boardSlug || token === boardName));
}

function teamForBoard(profileTeams: MissionControlProfileTeam[], board: KanbanBoardMeta): MissionControlProfileTeam | null {
  return profileTeams.find((team) => teamMatchesBoard(team, board)) ?? null;
}

function agentLabel(agent: MissionControlProfileTeamAgent): string {
  const role = agent.role?.trim();
  return role ? `${role} · ${agent.profile}` : agent.profile;
}

function boardTaskCompleteEvent(board: KanbanBoardMeta): AudioLibraryEvent {
  const label = boardLabel(board);
  return {
    key: teamTaskCompleteEventKey(board.slug),
    label: `${label} task complete`,
    description: `Played when a ${label} Kanban task moves to done.`,
  };
}

function clipSourceLabel(asset: AudioLibraryAsset): string {
  if (asset.source === "bundled") return "Built-in";
  if (asset.source === "elevenlabs_music") return "ElevenLabs Music";
  if (asset.source === "elevenlabs") return "ElevenLabs";
  return asset.source || "Custom";
}

function builtInSummary(clips: AudioLibraryAsset[]): string {
  if (clips.length === 0) return "No built-in set";
  if (clips.length === 1) return clips[0]?.name ?? "Built-in clip";
  return `${clips.length} rotating built-ins`;
}

function clipOptions(groups: { label: string; clips: AudioLibraryAsset[] }[]) {
  return groups.filter((group) => group.clips.length > 0).map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.clips.map((clip) => <option key={clip.id} value={clip.id}>{clip.name}</option>)}
    </optgroup>
  ));
}

export default function AudioLibraryPage() {
  const [library, setLibrary] = useState<AudioLibraryResponse | null>(null);
  const [quota, setQuota] = useState<AudioLibraryQuotaResponse | null>(null);
  const [teams, setTeams] = useState<KanbanBoardMeta[]>([]);
  const [profileTeams, setProfileTeams] = useState<MissionControlProfileTeam[]>([]);
  const [voices, setVoices] = useState<AudioLibraryVoice[]>([]);
  const [voicesAvailable, setVoicesAvailable] = useState(false);
  const [form, setForm] = useState<GenerateFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const [playingDefaultToneId, setPlayingDefaultToneId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("events");

  const assetsById = useMemo(() => {
    const map = new Map<string, AudioLibraryAsset>();
    for (const asset of library?.assets ?? []) map.set(asset.id, asset);
    return map;
  }, [library]);

  const teamEvents = useMemo(() => teams.map(boardTaskCompleteEvent), [teams]);
  const profileTeamByBoardSlug = useMemo(() => {
    const map = new Map<string, MissionControlProfileTeam>();
    for (const board of teams) {
      const match = teamForBoard(profileTeams, board);
      if (match) map.set(board.slug, match);
    }
    return map;
  }, [profileTeams, teams]);

  const eventsByKey = useMemo(() => {
    const map = new Map<string, AudioLibraryEvent>();
    for (const event of [...(library?.events ?? []), ...teamEvents]) map.set(event.key, event);
    for (const board of teams) {
      const team = profileTeamByBoardSlug.get(board.slug);
      for (const agent of team?.agents ?? []) {
        map.set(teamMemberTaskCompleteEventKey(board.slug, agent.profile), {
          key: teamMemberTaskCompleteEventKey(board.slug, agent.profile),
          label: `${boardLabel(board)} · ${agent.profile} task complete`,
          description: `Played when ${agent.profile} completes a ${boardLabel(board)} task.`,
        });
      }
    }
    return map;
  }, [library, profileTeamByBoardSlug, teamEvents, teams]);

  const bundledAssets = useMemo(() => (library?.assets ?? []).filter((asset) => asset.source === "bundled"), [library]);
  const customAssets = useMemo(() => (library?.assets ?? []).filter((asset) => asset.source !== "bundled"), [library]);
  const mappedCount = useMemo(() => Object.values(library?.mappings ?? {}).filter((mapping) => mapping?.asset_id && mapping.enabled !== false).length, [library]);
  const teamMemberEventCount = useMemo(
    () => [...profileTeamByBoardSlug.values()].reduce((total, team) => total + team.agents.length, 0),
    [profileTeamByBoardSlug],
  );
  const eventCount = (library?.events.length ?? 0) + teamEvents.length + teamMemberEventCount;
  const displayVoices = voices.length > 0 ? voices : PRESET_VOICES;
  const selectedVoiceInList = displayVoices.some((voice) => voice.voice_id === form.voice_id);

  const eventLabelsByAssetId = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!library) return map;
    for (const [eventKey, mapping] of Object.entries(library.mappings)) {
      if (!mapping?.asset_id || mapping.enabled === false) continue;
      const labels = map.get(mapping.asset_id) ?? [];
      labels.push(eventShortLabel(eventsByKey.get(eventKey)));
      map.set(mapping.asset_id, labels);
    }
    return map;
  }, [eventsByKey, library]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [libraryResult, boardsResult, activityResult] = await Promise.all([
        api.getAudioLibrary(),
        api.getKanbanBoards().catch(() => ({ boards: [], current: "" })),
        api.getMissionControlActivity().catch(() => ({ profile_teams: [] })),
      ]);
      setLibrary(libraryResult);
      setTeams(boardsResult.boards ?? []);
      setProfileTeams(activityResult.profile_teams ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const loadVoices = async () => {
    setVoicesLoading(true);
    try {
      const result = await api.getElevenLabsVoices();
      setVoices(result.voices ?? []);
      setVoicesAvailable(Boolean(result.available));
    } catch {
      setVoices([]);
      setVoicesAvailable(false);
    } finally {
      setVoicesLoading(false);
    }
  };

  useEffect(() => {
    void loadVoices();
  }, []);

  const checkQuota = async () => {
    setQuotaLoading(true);
    setError(null);
    try {
      setQuota(await api.getAudioLibraryQuota());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuotaLoading(false);
    }
  };

  const testVoice = async () => {
    setPreviewingVoice(true);
    setError(null);
    try {
      const result = await api.previewAudioLibraryVoice({
        text: form.text.trim() || "Testing this Mission Control voice.",
        voice_id: form.voice_id.trim() || DEFAULT_VOICE_ID,
        model_id: form.model_id || DEFAULT_MODEL_ID,
        stability: form.stability,
        similarity_boost: form.similarity_boost,
        style: form.style,
        speed: form.speed,
        use_speaker_boost: form.use_speaker_boost,
      });
      await new Audio(result.data_url).play();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewingVoice(false);
    }
  };

  const generate = async () => {
    if (!form.name.trim() || !form.text.trim()) {
      setError("Name and spoken text are required.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateAudioLibraryAsset({
        name: form.name.trim(),
        text: form.text.trim(),
        kind: form.kind,
        category: form.category.trim() || form.kind,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        event_key: form.event_key || undefined,
        voice_id: form.voice_id.trim() || DEFAULT_VOICE_ID,
        model_id: form.model_id || DEFAULT_MODEL_ID,
        music_length_ms: form.kind === "music" ? form.music_length_ms : undefined,
        stability: form.stability,
        similarity_boost: form.similarity_boost,
        style: form.style,
        speed: form.speed,
        use_speaker_boost: form.use_speaker_boost,
      });
      setLibrary(result.library);
      setForm({ ...EMPTY_FORM, event_key: form.event_key });
      setQuota(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const updateMapping = async (eventKey: string, assetId: string) => {
    setSavingEvent(eventKey);
    setError(null);
    try {
      const result = await api.updateAudioLibraryMapping({
        event_key: eventKey,
        asset_id: assetId || null,
        enabled: Boolean(assetId),
      });
      setLibrary(result.library);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEvent(null);
    }
  };

  const mappedAsset = (eventKey: string): AudioLibraryAsset | null => {
    const mapping = library?.mappings[eventKey];
    if (!mapping?.asset_id || mapping.enabled === false) return null;
    return assetsById.get(mapping.asset_id) ?? null;
  };

  const defaultCompletionAsset = (): AudioLibraryAsset | null => (
    mappedAsset("terminal.ready.default")
    ?? bundledAssets.find((clip) => clip.event_key === "terminal.ready.default")
    ?? null
  );

  const effectiveTeamMemberAsset = (boardSlug: string, profile: string): AudioLibraryAsset | null => (
    mappedAsset(teamMemberTaskCompleteEventKey(boardSlug, profile))
    ?? mappedAsset(teamTaskCompleteEventKey(boardSlug))
    ?? defaultCompletionAsset()
  );

  const stopActiveAudio = useCallback(() => {
    const audio = activeAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      activeAudioRef.current = null;
    }
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => stopActiveAudio(), [stopActiveAudio]);

  const play = async (asset: AudioLibraryAsset) => {
    stopActiveAudio();
    setPlayingAssetId(asset.id);
    setError(null);
    try {
      let src = audioUrl(asset);
      if (asset.source !== "bundled") {
        const response = await authedFetch(asset.url);
        if (!response.ok) throw new Error(`Could not load audio clip (${response.status})`);
        activeObjectUrlRef.current = URL.createObjectURL(await response.blob());
        src = activeObjectUrlRef.current;
      }
      const audio = new Audio(src);
      activeAudioRef.current = audio;
      audio.volume = 1;
      const cleanup = () => {
        if (activeAudioRef.current === audio) {
          stopActiveAudio();
          setPlayingAssetId((current) => current === asset.id ? null : current);
        }
      };
      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      await audio.play();
    } catch (err) {
      stopActiveAudio();
      setPlayingAssetId((current) => current === asset.id ? null : current);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const playDefaultCompletionTone = (toneId: string) => {
    setPlayingDefaultToneId(toneId);
    void api.playMissionControlDing("done")
      .catch(() => undefined)
      .finally(() => window.setTimeout(() => {
        setPlayingDefaultToneId((current) => current === toneId ? null : current);
      }, 500));
  };

  const deleteAsset = async (asset: AudioLibraryAsset) => {
    if (!window.confirm(`Delete audio clip “${asset.name}”?`)) return;
    setDeletingAssetId(asset.id);
    setError(null);
    try {
      const result = await api.deleteAudioLibraryAsset(asset.id);
      setLibrary(result.library);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingAssetId(null);
    }
  };

  const renderPlayButton = (asset: AudioLibraryAsset, label: string) => (
    <Button outlined size="sm" onClick={() => void play(asset)} aria-label={label}>
      {playingAssetId === asset.id ? <Volume2 className="h-3.5 w-3.5 text-[#ff3d00]" /> : <Play className="h-3.5 w-3.5" />}
    </Button>
  );

  const renderEffectivePlayButton = (asset: AudioLibraryAsset | null, toneId: string, label: string) => (
    asset ? renderPlayButton(asset, label) : (
      <Button outlined size="sm" onClick={() => playDefaultCompletionTone(toneId)} aria-label={`${label} default tone`}>
        {playingDefaultToneId === toneId ? <Volume2 className="h-3.5 w-3.5 text-[#ff3d00]" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
    )
  );

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "events", label: "Events", count: eventCount },
    { id: "generate", label: "Generate" },
    { id: "clips", label: "Clips", count: library?.assets.length ?? 0 },
  ];

  const statsSummary = [
    `${customAssets.length} custom`,
    `${bundledAssets.length} built-in`,
    `${mappedCount}/${eventCount} mapped`,
    ...(quota ? [quotaSummary(quota)] : []),
  ].join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-6">
      <header className="rounded-xl border border-[#ff3d00]/25 bg-black/70 shadow-[0_0_32px_rgba(255,61,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Audio Library</h1>
            <span className="font-mono-ui text-xs text-muted-foreground">{statsSummary}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button outlined size="sm" onClick={checkQuota} disabled={quotaLoading}>
              {quotaLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Check quota
            </Button>
            <Button outlined size="sm" onClick={refresh} disabled={loading}>Refresh</Button>
          </div>
        </div>
        <nav role="tablist" className="mt-1 flex items-center gap-1 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 font-mono-ui text-xs uppercase tracking-[0.18em] transition-colors ${
                activeTab === tab.id
                  ? "text-[#ff3d00] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#ff3d00]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" && <span className="ml-1.5 opacity-60">{tab.count}</span>}
            </button>
          ))}
        </nav>
        {error && (
          <div className="mx-4 mb-3 mt-1 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </header>

      {activeTab === "events" && (loading ? (
        <div className="flex items-center gap-2 p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading audio routes</div>
      ) : (
        <>
          <section className={CARD_CLASS}>
            <div className={GROUP_HEADER_CLASS}>
              <span className={GROUP_TITLE_CLASS}>System events · {library?.events.length ?? 0}</span>
              <Button outlined size="sm" onClick={() => setActiveTab("generate")}>Generate custom clip</Button>
            </div>
            <div className="divide-y divide-border/40">
              {library?.events.map((event) => {
                const mapping = library.mappings[event.key];
                const selected = mapping?.enabled === false ? "" : mapping?.asset_id ?? "";
                const selectedAsset = selected ? assetsById.get(selected) : null;
                const eventBuiltIns = bundledAssets.filter((clip) => clip.event_key === event.key);
                const otherBuiltIns = bundledAssets.filter((clip) => clip.event_key !== event.key);
                return (
                  <div key={event.key} className={`${EVENT_ROW_CLASS} px-3 py-2.5 transition-colors hover:bg-[#ff3d00]/[0.03]`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-medium">{event.label}</h3>
                        {selectedAsset && <Badge tone="secondary">Custom</Badge>}
                      </div>
                      <p className={`mt-0.5 truncate text-xs ${selectedAsset ? "text-[#ff3d00]/90" : "text-muted-foreground"}`}>{selectedAsset ? selectedAsset.name : builtInSummary(eventBuiltIns)}</p>
                    </div>
                    <select className={SELECT_CLASS} value={selected} onChange={(e) => updateMapping(event.key, e.target.value)}>
                      <option value="">Current built-in audio</option>
                      {clipOptions([
                        { label: "For this event", clips: eventBuiltIns },
                        { label: "Other built-ins", clips: otherBuiltIns },
                        { label: "Custom clips", clips: customAssets },
                      ])}
                    </select>
                    <div className="flex items-center justify-end">
                      {savingEvent === event.key
                        ? <Loader2 className="h-4 w-4 animate-spin text-[#ff3d00]" />
                        : selectedAsset ? renderPlayButton(selectedAsset, `Preview ${selectedAsset.name}`) : eventBuiltIns[0] ? renderPlayButton(eventBuiltIns[0], `Preview ${eventBuiltIns[0].name}`) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {teamEvents.length > 0 && (
            <section className={CARD_CLASS}>
              <div className={GROUP_HEADER_CLASS}>
                <span className={GROUP_TITLE_CLASS}>Team completion · {teamEvents.length}</span>
                <span className="text-xs text-muted-foreground">Unset events fall back to the default completion audio</span>
              </div>
              <div className="divide-y divide-border/40">
                {teamEvents.map((event) => {
                  const board = teams.find((candidate) => teamTaskCompleteEventKey(candidate.slug) === event.key);
                  const boardSlug = board?.slug ?? event.key.replace(/^team\./, "").replace(/\.task_complete$/, "");
                  const profileTeam = profileTeamByBoardSlug.get(boardSlug);
                  const mapping = library?.mappings[event.key];
                  const selected = mapping?.enabled === false ? "" : mapping?.asset_id ?? "";
                  const selectedAsset = selected ? assetsById.get(selected) : null;
                  const teamFallbackAsset = selectedAsset ?? defaultCompletionAsset();
                  return (
                    <div key={event.key} className="px-3 py-2.5">
                      <div className={EVENT_ROW_CLASS}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium">{event.label}</h3>
                            {selectedAsset && <Badge tone="secondary">Custom</Badge>}
                          </div>
                          <p className={`mt-0.5 truncate text-xs ${selectedAsset ? "text-[#ff3d00]/90" : "text-muted-foreground"}`}>{selectedAsset ? selectedAsset.name : "Default completion audio"}</p>
                        </div>
                        <select className={SELECT_CLASS} value={selected} onChange={(e) => updateMapping(event.key, e.target.value)}>
                          <option value="">Default completion audio</option>
                          {clipOptions([
                            { label: "Custom clips", clips: customAssets },
                            { label: "Built-in clips", clips: bundledAssets },
                          ])}
                        </select>
                        <div className="flex items-center justify-end">
                          {savingEvent === event.key
                            ? <Loader2 className="h-4 w-4 animate-spin text-[#ff3d00]" />
                            : renderEffectivePlayButton(teamFallbackAsset, event.key, `Preview ${event.label}`)}
                        </div>
                      </div>
                      {profileTeam && profileTeam.agents.length > 0 && (() => {
                        const overrideCount = profileTeam.agents.filter((agent) => {
                          const memberMapping = library?.mappings[teamMemberTaskCompleteEventKey(boardSlug, agent.profile)];
                          return Boolean(memberMapping?.asset_id) && memberMapping?.enabled !== false;
                        }).length;
                        return (
                        <details open={overrideCount > 0} className="group mt-2 overflow-hidden rounded-md border border-border/50 bg-black/20 transition-colors open:border-[#ff3d00]/35 open:bg-[#ff3d00]/[0.04]">
                          <summary className="flex cursor-pointer select-none items-center gap-2 px-2.5 py-1.5 font-mono-ui text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground group-open:text-[#ff3d00] list-none [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" />
                            Per-member overrides · {profileTeam.agents.length}
                            <span className="ml-auto normal-case tracking-normal">{overrideCount > 0 ? `${overrideCount} custom` : "all inherit"}</span>
                          </summary>
                          <div className="ml-4 border-l border-[#ff3d00]/25 pl-3 pr-2.5 pb-1 divide-y divide-[#ff3d00]/10 border-t border-t-[#ff3d00]/20">
                            {profileTeam.agents.map((agent) => {
                              const memberEventKey = teamMemberTaskCompleteEventKey(boardSlug, agent.profile);
                              const memberMapping = library?.mappings[memberEventKey];
                              const memberSelected = memberMapping?.enabled === false ? "" : memberMapping?.asset_id ?? "";
                              const memberSelectedAsset = memberSelected ? assetsById.get(memberSelected) : null;
                              const effectiveAsset = effectiveTeamMemberAsset(boardSlug, agent.profile);
                              return (
                                <div key={memberEventKey} className={`${EVENT_ROW_CLASS} py-2`}>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm">{agentLabel(agent)}</div>
                                    <div className={`mt-0.5 text-[0.68rem] ${memberSelectedAsset ? "text-[#ff3d00]/90" : "text-muted-foreground"}`}>
                                      {memberSelectedAsset ? `Override · ${memberSelectedAsset.name}` : selectedAsset ? "Uses team clip" : "Uses default clip"}
                                    </div>
                                  </div>
                                  <select className={SELECT_CLASS} value={memberSelected} onChange={(e) => updateMapping(memberEventKey, e.target.value)}>
                                    <option value="">Inherit team/default</option>
                                    {clipOptions([
                                      { label: "Custom clips", clips: customAssets },
                                      { label: "Built-in clips", clips: bundledAssets },
                                    ])}
                                  </select>
                                  <div className="flex items-center justify-end">
                                    {savingEvent === memberEventKey
                                      ? <Loader2 className="h-4 w-4 animate-spin text-[#ff3d00]" />
                                      : renderEffectivePlayButton(effectiveAsset, memberEventKey, `Test ${agent.profile} completion audio`)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      ))}

      {activeTab === "generate" && (
      <section className={CARD_CLASS}>
        <div className={GROUP_HEADER_CLASS}>
          <span className={GROUP_TITLE_CLASS}>Generate a clip</span>
          <span className="text-xs text-muted-foreground">ElevenLabs voice &amp; music</span>
        </div>
        <div className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Clip name
            <input className={FIELD_CLASS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mission complete" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Generate type
            <select className={FIELD_CLASS} value={form.kind} onChange={(e) => {
              const kind = e.target.value as "voice" | "music";
              setForm({
                ...form,
                kind,
                category: kind,
                tags: kind === "music" ? "music, mission-control" : "mission-control",
              });
            }}>
              <option value="voice">Voice / spoken clip</option>
              <option value="music">Music</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Auto-assign
            <select className={FIELD_CLASS} value={form.event_key} onChange={(e) => setForm({ ...form, event_key: e.target.value })}>
              <option value="">Do not auto-assign</option>
              {library?.events.map((event) => <option key={event.key} value={event.key}>{event.label}</option>)}
              {teamEvents.length > 0 && (
                <optgroup label="Team task completion">
                  {teamEvents.map((event) => <option key={event.key} value={event.key}>{event.label}</option>)}
                </optgroup>
              )}
              {teams.some((board) => (profileTeamByBoardSlug.get(board.slug)?.agents.length ?? 0) > 0) && (
                <optgroup label="Team member task completion">
                  {teams.flatMap((board) => (profileTeamByBoardSlug.get(board.slug)?.agents ?? []).map((agent) => (
                    <option key={teamMemberTaskCompleteEventKey(board.slug, agent.profile)} value={teamMemberTaskCompleteEventKey(board.slug, agent.profile)}>
                      {boardLabel(board)} · {agent.profile} task complete
                    </option>
                  )))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-3">
            {form.kind === "music" ? "Music prompt" : "Prompt"}
            <textarea className={`${FIELD_CLASS} min-h-24`} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder={form.kind === "music" ? "A short Mission Control synthwave sting: tense analog bass, warm orange cockpit ambience, clean heroic resolve, no vocals." : "Juror research complete. Democracy survives another spreadsheet."} />
          </label>
        </div>
        {form.kind === "music" ? (
        <details open className="mt-3 rounded border border-border/60 bg-black/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">Music settings</summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm lg:col-span-2">
              Length · {Math.round(form.music_length_ms / 1000)}s
              <input type="range" min="3" max="120" step="1" value={Math.round(form.music_length_ms / 1000)} onChange={(e) => setForm({ ...form, music_length_ms: Number(e.target.value) * 1000 })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Category
              <input className={FIELD_CLASS} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm lg:col-span-3">
              Tags
              <input className={FIELD_CLASS} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </label>
          </div>
        </details>
        ) : (
        <details open className="mt-3 rounded border border-border/60 bg-black/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">Voice settings</summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm lg:col-span-2">
              Voice
              <select className={FIELD_CLASS} value={selectedVoiceInList ? form.voice_id : "__custom"} onChange={(e) => {
                const value = e.target.value;
                if (value !== "__custom") setForm({ ...form, voice_id: value });
              }} disabled={voicesLoading}>
                <option value="__custom">Custom voice ID</option>
                {!voicesAvailable && <option value="__preset_note" disabled>Account list unavailable; showing presets</option>}
                {!selectedVoiceInList && form.voice_id && <option value={form.voice_id}>{form.voice_id}</option>}
                {displayVoices.map((voice) => <option key={voice.voice_id} value={voice.voice_id}>{voice.label || voice.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Voice ID
              <input className={`${FIELD_CLASS} font-mono-ui`} value={form.voice_id} onChange={(e) => setForm({ ...form, voice_id: e.target.value })} />
            </label>
            <div className="flex items-end">
              <Button type="button" outlined className="w-full" onClick={testVoice} disabled={previewingVoice || !form.voice_id.trim()}>
                {previewingVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Test voice
              </Button>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Model
              <select className={FIELD_CLASS} value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })}>
                {MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Speaker boost
              <select className={FIELD_CLASS} value={form.use_speaker_boost ? "on" : "off"} onChange={(e) => setForm({ ...form, use_speaker_boost: e.target.value === "on" })}>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Stability · {form.stability.toFixed(2)}
              <input type="range" min="0" max="1" step="0.05" value={form.stability} onChange={(e) => setForm({ ...form, stability: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Similarity · {form.similarity_boost.toFixed(2)}
              <input type="range" min="0" max="1" step="0.05" value={form.similarity_boost} onChange={(e) => setForm({ ...form, similarity_boost: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Style · {form.style.toFixed(2)}
              <input type="range" min="0" max="1" step="0.05" value={form.style} onChange={(e) => setForm({ ...form, style: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Speed · {form.speed.toFixed(2)}
              <input type="range" min="0.7" max="1.2" step="0.05" value={form.speed} onChange={(e) => setForm({ ...form, speed: Number(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Category
              <input className={FIELD_CLASS} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tags
              <input className={FIELD_CLASS} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </label>
          </div>
        </details>
        )}
        <Button className="mt-4" onClick={generate} disabled={generating || loading || !form.name.trim() || !form.text.trim()}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Music2 className="mr-2 h-4 w-4" />}
          Generate
        </Button>
        </div>
      </section>
      )}

      {activeTab === "clips" && (loading ? (
        <div className="flex items-center gap-2 p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading audio library</div>
      ) : (
        <>
          <section className={CARD_CLASS}>
            <div className={GROUP_HEADER_CLASS}>
              <span className={GROUP_TITLE_CLASS}>Custom clips · {customAssets.length}</span>
            </div>
            {customAssets.length > 0 ? (
              <div className="divide-y divide-border/40">
                {customAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#ff3d00]/[0.03]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="truncate text-sm font-medium">{asset.name}</h4>
                        {(eventLabelsByAssetId.get(asset.id) ?? []).map((label) => <Badge key={label} tone="secondary">→ {label}</Badge>)}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{clipSourceLabel(asset)} · {formatDuration(asset.duration_seconds)} · {formatBytes(asset.bytes)}</p>
                    </div>
                    {renderPlayButton(asset, `Play ${asset.name}`)}
                    <Button outlined size="sm" onClick={() => deleteAsset(asset)} disabled={deletingAssetId === asset.id} aria-label={`Delete ${asset.name}`}>
                      {deletingAssetId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No custom clips yet.{" "}
                <button type="button" className="text-[#ff3d00] underline-offset-2 hover:underline" onClick={() => setActiveTab("generate")}>
                  Generate one
                </button>{" "}
                and map it to a Mission Control event.
              </div>
            )}
          </section>

          <section className={CARD_CLASS}>
            <div className={GROUP_HEADER_CLASS}>
              <span className={GROUP_TITLE_CLASS}>Built-in clips · {bundledAssets.length}</span>
            </div>
            <div className="divide-y divide-border/40">
              {bundledAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium">{asset.name}</h4>
                    <p className="truncate text-xs text-muted-foreground">{asset.event_key ? eventShortLabel(eventsByKey.get(asset.event_key)) : "Built-in"}</p>
                  </div>
                  {renderPlayButton(asset, `Play ${asset.name}`)}
                </div>
              ))}
            </div>
          </section>
        </>
      ))}
    </div>
  );
}
