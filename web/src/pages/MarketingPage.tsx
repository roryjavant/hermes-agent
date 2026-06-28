import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Image,
  Megaphone,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { api } from "@/lib/api";
import type { MissionControlProfileTeam, MissionControlProfileTeamAgent } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "amber" | "violet" | "emerald" | "rose";
type MarketingProjectId = "savant-ai-systems" | "hermes-marketing" | "automation-case-studies" | "home-hub-systems";
type PortalSectionId = "strategy" | "campaigns" | "content" | "assets" | "metrics";

interface StrategyPoint {
  label: string;
  value: string;
}

interface Campaign {
  name: string;
  goal: string;
  stage: string;
  channels: string[];
  nextAction: string;
}

interface PipelineItem {
  lane: string;
  title: string;
  owner: string;
  nextAction: string;
  tone: Tone;
}

interface AssetItem {
  title: string;
  type: string;
  status: string;
  location: string;
}

interface MetricRow {
  label: string;
  value: string;
  source: string;
  note: string;
}

interface MarketingProject {
  id: MarketingProjectId;
  title: string;
  kicker: string;
  description: string;
  openLabel: string;
  accent: string;
  icon: LucideIcon;
  stats: string[];
}

interface PortalSection {
  id: PortalSectionId;
  title: string;
  helper: string;
  icon: LucideIcon;
}

const STRATEGY_POINTS: StrategyPoint[] = [
  {
    label: "Audience",
    value: "Founder-led teams and operators who need secure AI agents, custom software, and automation without scattered tooling.",
  },
  {
    label: "Positioning",
    value: "Savant is the practical AI systems studio: agent architecture, internal tools, and reliable business automation.",
  },
  {
    label: "Current focus",
    value: "Prove the centralized Marketing workspace shape before connecting external calendars, analytics, CMS, or publishing APIs.",
  },
  {
    label: "Proof points",
    value: "Hermes Agent workflows, Home Hub systems, Mission Control dashboards, and repeatable local automation patterns.",
  },
];

const CAMPAIGNS: Campaign[] = [
  {
    name: "Founder systems narrative",
    goal: "Clarify the Savant point of view for secure agentic operations.",
    stage: "Strategy draft",
    channels: ["Website", "LinkedIn", "Sales deck"],
    nextAction: "Turn positioning notes into a one-page message map.",
  },
  {
    name: "Hermes Marketing workspace",
    goal: "Make campaign planning visible inside the Hermes dashboard.",
    stage: "Workspace validation",
    channels: ["Dashboard", "Internal docs"],
    nextAction: "Use this read-only tab to evaluate section density and flow.",
  },
  {
    name: "Automation case studies",
    goal: "Package real workflow wins into reusable examples.",
    stage: "Content queue",
    channels: ["Blog", "Newsletter", "Consulting follow-up"],
    nextAction: "Pick two safe examples that do not expose private data.",
  },
];

const PIPELINE: PipelineItem[] = [
  {
    lane: "Idea",
    title: "AI systems audit checklist",
    owner: "Manual placeholder",
    nextAction: "Outline risks, integration seams, and quick-win scoring.",
    tone: "cyan",
  },
  {
    lane: "Draft",
    title: "From scattered automations to Mission Control",
    owner: "Manual placeholder",
    nextAction: "Shape the story around operating rhythm, not tool novelty.",
    tone: "violet",
  },
  {
    lane: "Review",
    title: "Secure agent deployment talking points",
    owner: "Manual placeholder",
    nextAction: "Check claims against actual Hermes capabilities before publishing.",
    tone: "amber",
  },
  {
    lane: "Published",
    title: "Local-first workflow examples",
    owner: "Manual placeholder",
    nextAction: "Record destination links once publishing sources are connected.",
    tone: "emerald",
  },
];

const ASSETS: AssetItem[] = [
  {
    title: "Savant positioning one-sheet",
    type: "Messaging doc",
    status: "Manual placeholder",
    location: "Local path/link not connected yet",
  },
  {
    title: "Hermes dashboard screenshots",
    type: "Visual proof",
    status: "Needs curated capture",
    location: "Asset library not connected yet",
  },
  {
    title: "Automation architecture diagrams",
    type: "Diagram set",
    status: "Fixture inventory",
    location: "Design folder not connected yet",
  },
];

const METRICS: MetricRow[] = [
  {
    label: "Qualified conversations",
    value: "—",
    source: "Manual placeholder",
    note: "No CRM, email, or analytics integration connected in Milestone 1.",
  },
  {
    label: "Content shipped this month",
    value: "—",
    source: "Manual placeholder",
    note: "Publishing sources are intentionally not connected yet.",
  },
  {
    label: "Campaign momentum",
    value: "3 active",
    source: "Fixture data",
    note: "Static campaign rows above; not live performance data.",
  },
  {
    label: "Asset readiness",
    value: "1 / 3 ready",
    source: "Fixture data",
    note: "Represents this local seed only, not a DAM or drive sync.",
  },
];

const MARKETING_PROJECTS: MarketingProject[] = [
  {
    id: "savant-ai-systems",
    title: "Savant AI Systems",
    kicker: "Studio offer",
    description: "Founder-led AI systems architecture, secure agents, and business automation positioning.",
    openLabel: "Launch portal",
    accent: "from-cyan-300/24 via-sky-400/14 to-blue-500/8 text-cyan-100 border-cyan-200/25",
    icon: Target,
    stats: ["Core offer", "Message map", "Manual data"],
  },
  {
    id: "hermes-marketing",
    title: "Hermes Marketing",
    kicker: "Product story",
    description: "Campaigns, screenshots, launch copy, and internal proofs for Hermes Agent marketing.",
    openLabel: "Launch portal",
    accent: "from-fuchsia-300/22 via-purple-500/14 to-rose-500/8 text-fuchsia-100 border-fuchsia-200/25",
    icon: Megaphone,
    stats: ["3 campaigns", "Screenshots", "Read-only"],
  },
  {
    id: "automation-case-studies",
    title: "Automation Case Studies",
    kicker: "Proof library",
    description: "Safe, reusable examples that package workflow wins without exposing private data.",
    openLabel: "Launch portal",
    accent: "from-amber-300/22 via-orange-400/14 to-yellow-500/8 text-amber-100 border-amber-200/25",
    icon: FileText,
    stats: ["Content queue", "Examples", "Fixture"],
  },
  {
    id: "home-hub-systems",
    title: "Home Hub Systems",
    kicker: "Demo narrative",
    description: "Household dashboard and automation proof points for practical local-first systems.",
    openLabel: "Launch portal",
    accent: "from-emerald-300/20 via-teal-400/14 to-cyan-500/8 text-emerald-100 border-emerald-200/25",
    icon: Image,
    stats: ["Proof points", "Diagrams", "No sync"],
  },
];

const PORTAL_SECTIONS: PortalSection[] = [
  { id: "strategy", title: "Strategy", helper: "Audience, positioning, proof", icon: Target },
  { id: "campaigns", title: "Campaigns", helper: "Stages, channels, next actions", icon: Megaphone },
  { id: "content", title: "Content", helper: "Editorial lane view", icon: FileText },
  { id: "assets", title: "Assets", helper: "Creative inventory", icon: Image },
  { id: "metrics", title: "Metrics", helper: "KPI placeholders", icon: BarChart3 },
];

const TONE_CLASSES: Record<Tone, string> = {
  amber: "border-warning/30 bg-warning/10 text-warning",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  emerald: "border-success/30 bg-success/10 text-success",
  rose: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  violet: "border-violet-300/30 bg-violet-500/10 text-violet-100",
};

const MARKETING_PROFILE_TEAM_IDS = ["hermes-marketing", "hermes-marketing-dev"];
const MARKETING_TEAM_POLL_MS = 15_000;
const MARKETING_TEAM_TIMEOUT_MS = 8_000;

function marketingAgentStatusLabel(agent: MissionControlProfileTeamAgent): string {
  if (!agent.configured) return "missing profile";
  if (!agent.active && agent.status === "ready") return "standby";
  return agent.status || "ready";
}

function marketingAgentStatusClass(agent: MissionControlProfileTeamAgent): string {
  if (!agent.configured || agent.status === "missing") return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  if (agent.status === "working") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  if (agent.status === "review") return "border-violet-300/25 bg-violet-500/10 text-violet-100";
  if (agent.active) return "border-success/25 bg-success/10 text-success";
  return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
}

function formatMarketingTeamCheckedAt(checkedAt: number | null): string {
  if (!checkedAt) return "Not loaded yet";
  return new Date(checkedAt * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function filterMarketingProfileTeams(teams: MissionControlProfileTeam[] | undefined): MissionControlProfileTeam[] {
  return (teams ?? []).filter((team) => MARKETING_PROFILE_TEAM_IDS.includes(team.team_id));
}

function SectionHeader({ icon: Icon, kicker, title, description }: { icon: LucideIcon; kicker: string; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-midground/25 bg-midground/10 text-midground shadow-[0_0_28px_rgba(241,226,177,0.12)]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-text-tertiary">{kicker}</div>
        <h2 className="font-expanded text-lg font-black uppercase tracking-[0.08em] text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
      </div>
    </div>
  );
}

function MarketingCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/72 shadow-2xl shadow-black/15", className)}>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function MarketingAgentRow({ agent }: { agent: MissionControlProfileTeamAgent }) {
  const statusLabel = marketingAgentStatusLabel(agent);
  const canLaunch = agent.configured && agent.profile.trim().length > 0;

  return (
    <article className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-tertiary">Role</div>
          <h4 className="mt-1 font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{agent.role}</h4>
          <div className="mt-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-tertiary">Profile</div>
          <code className="mt-1 block truncate rounded-xl border border-current/10 bg-black/18 px-2.5 py-1.5 font-mono-ui text-xs text-midground">
            {agent.profile}
          </code>
        </div>
        <Badge className={cn("border text-[0.68rem] uppercase tracking-[0.12em]", marketingAgentStatusClass(agent))}>
          Status: {statusLabel}
        </Badge>
      </div>

      <div className="mt-3 rounded-xl border border-current/10 bg-black/12 px-3 py-2 text-xs leading-5 text-text-secondary">
        {agent.detail || (agent.configured ? "Profile configured and standing by." : "Profile missing from local Hermes profiles.")}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
        <div className="flex flex-wrap gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-text-tertiary">
          <span>{agent.active ? "Active runtime" : "No active runtime"}</span>
          {agent.pid ? <span>PID {agent.pid}</span> : null}
          {agent.source ? <span>{agent.source}</span> : null}
        </div>
        {canLaunch ? (
          <Link
            to={`/chat?profile=${encodeURIComponent(agent.profile)}`}
            className="inline-flex items-center gap-1 rounded-full border border-midground/30 bg-midground/10 px-3 py-1.5 text-xs font-bold text-midground transition-colors hover:border-midground/60 hover:bg-midground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/70"
          >
            Launch chat
            <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-100" aria-disabled="true">
            Configure profile before launch
          </span>
        )}
      </div>
    </article>
  );
}

function MarketingAgentTeamPanel() {
  const [teams, setTeams] = useState<MissionControlProfileTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const loadMarketingTeams = useCallback(async () => {
    try {
      const response = await api.getMissionControlActivity({ timeoutMs: MARKETING_TEAM_TIMEOUT_MS });
      setTeams(filterMarketingProfileTeams(response.profile_teams));
      setCheckedAt(response.checked_at);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadMarketingTeams();
    }, 0);
    const poll = window.setInterval(() => {
      void loadMarketingTeams();
    }, MARKETING_TEAM_POLL_MS);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(poll);
    };
  }, [loadMarketingTeams]);

  const summary = useMemo(() => {
    const agents = teams.flatMap((team) => team.agents);
    return {
      active: agents.filter((agent) => agent.active).length,
      configured: agents.filter((agent) => agent.configured).length,
      total: agents.length,
    };
  }, [teams]);

  return (
    <MarketingCard className="border-fuchsia-200/18 bg-card/78">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          icon={Users}
          kicker="Marketing agent team"
          title="Live Hermes Marketing roster"
          description="Read-only Mission Control view of the profile-backed Marketing agents. Use Launch chat to open a configured profile in the Hermes chat surface."
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge className="border-cyan-300/25 bg-cyan-400/10 text-cyan-100">15s auto-refresh</Badge>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void loadMarketingTeams();
            }}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-midground/30 bg-midground/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-midground transition-colors hover:border-midground/60 hover:bg-midground/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge className="border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100">{teams.length} teams</Badge>
        <Badge className="border-success/25 bg-success/10 text-success">{summary.configured} / {summary.total} configured</Badge>
        <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">{summary.active} active</Badge>
        <Badge className="border-border/70 bg-background-base/55 text-text-secondary">Updated {formatMarketingTeamCheckedAt(checkedAt)}</Badge>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
          Could not load Marketing profile teams from Mission Control: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-background-base/45 p-4 text-sm text-text-secondary">
          Loading Marketing profile teams…
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-background-base/45 p-4 text-sm leading-6 text-text-secondary">
          Mission Control did not return the hermes-marketing or hermes-marketing-dev profile teams yet. Refresh after the dashboard server has the current backend definitions loaded.
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const configuredCount = team.agents.filter((agent) => agent.configured).length;
            const activeCount = team.agents.filter((agent) => agent.active).length;
            return (
              <article key={team.team_id} className="rounded-2xl border border-border/60 bg-background-base/35 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-tertiary">{team.team_id}</div>
                    <h3 className="mt-1 font-expanded text-lg font-black uppercase tracking-[0.08em] text-foreground">{team.label}</h3>
                    <p className="mt-2 truncate text-xs text-text-tertiary">
                      <span className="font-bold text-midground">Project path:</span> {team.project_path}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className="border-success/25 bg-success/10 text-success">Configured {configuredCount} / {team.agents.length}</Badge>
                    <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">Active {activeCount}</Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {team.agents.map((agent) => (
                    <MarketingAgentRow key={`${team.team_id}-${agent.profile}`} agent={agent} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </MarketingCard>
  );
}

function ProjectSquare({ project, active, onOpen }: { project: MarketingProject; active: boolean; onOpen: (id: MarketingProjectId) => void }) {
  const Icon = project.icon;
  return (
    <Card className={cn(
      "group relative min-h-[18rem] overflow-hidden border-current/15 bg-background-base/70 shadow-2xl shadow-black/20 transition-transform duration-150 hover:-translate-y-0.5 hover:border-current/25",
      active && "ring-2 ring-midground/60",
    )}>
      <CardContent className="relative flex h-full flex-col p-0">
        <button
          type="button"
          onClick={() => onOpen(project.id)}
          aria-pressed={active}
          className="flex h-full min-h-[18rem] w-full flex-col items-stretch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/70"
          aria-label={`${project.openLabel}: ${project.title}`}
        >
          <div className={cn("relative overflow-hidden border-b bg-gradient-to-br p-4", project.accent)}>
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-current/15 blur-2xl transition-transform duration-300 group-hover:scale-125" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge className="mb-3 max-w-full truncate bg-black/24 text-current">{project.kicker}</Badge>
                <h2 className="font-expanded text-xl font-black uppercase tracking-[0.08em] text-current">
                  {project.title}
                </h2>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-current/25 bg-black/24 shadow-[0_0_28px_currentColor]">
                <Icon className="size-6" />
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <p className="min-h-[3.75rem] text-sm leading-6 text-text-secondary">{project.description}</p>
            <div className="flex flex-wrap gap-2">
              {project.stats.map((stat) => (
                <span key={stat} className="rounded-full border border-current/15 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-text-tertiary">
                  {stat}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-current/10 pt-3 text-sm font-bold text-midground">
              <span>{active ? "Open in portal" : project.openLabel}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function StrategyWorkspace() {
  return (
    <MarketingCard>
      <SectionHeader
        icon={Target}
        kicker="Strategy"
        title="Positioning spine"
        description="Local notes that make the workspace feel like one source of truth without claiming live source coverage."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {STRATEGY_POINTS.map((point) => (
          <div key={point.label} className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
            <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-midground">{point.label}</div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{point.value}</p>
          </div>
        ))}
      </div>
    </MarketingCard>
  );
}

function CampaignsWorkspace() {
  return (
    <MarketingCard>
      <SectionHeader
        icon={Megaphone}
        kicker="Campaigns"
        title="Active campaign board"
        description="Compact read-only campaign rows with explicit next actions and manual channel labels."
      />
      <div className="space-y-3">
        {CAMPAIGNS.map((campaign) => (
          <article key={campaign.name} className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{campaign.name}</h3>
                <p className="mt-1 text-sm text-text-secondary">{campaign.goal}</p>
              </div>
              <Badge className="border-cyan-300/25 bg-cyan-400/10 text-cyan-100">{campaign.stage}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {campaign.channels.map((channel) => (
                <span key={channel} className="rounded-full border border-current/15 bg-black/20 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.13em] text-text-tertiary">{channel}</span>
              ))}
            </div>
            <p className="mt-3 border-t border-border/50 pt-3 text-sm text-text-secondary">
              <span className="font-bold text-midground">Next action:</span> {campaign.nextAction}
            </p>
          </article>
        ))}
      </div>
    </MarketingCard>
  );
}

function ContentWorkspace() {
  return (
    <MarketingCard>
      <SectionHeader
        icon={FileText}
        kicker="Content Pipeline"
        title="Idea to published lanes"
        description="Static lane cards show how content can move through the workspace before any editing workflow exists."
      />
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {PIPELINE.map((item) => (
          <article key={`${item.lane}-${item.title}`} className={cn("rounded-2xl border p-4", TONE_CLASSES[item.tone])}>
            <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] opacity-80">{item.lane}</div>
            <h3 className="mt-3 min-h-[3.25rem] break-words font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{item.title}</h3>
            <div className="mt-3 rounded-xl border border-current/15 bg-black/18 px-3 py-2 text-xs text-current">{item.owner}</div>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{item.nextAction}</p>
          </article>
        ))}
      </div>
    </MarketingCard>
  );
}

function AssetsWorkspace() {
  return (
    <MarketingCard>
      <SectionHeader
        icon={Image}
        kicker="Assets"
        title="Fixture asset register"
        description="A read-only inventory shape for future local paths or asset library links, currently not connected."
      />
      <div className="overflow-hidden rounded-2xl border border-border/60">
        {ASSETS.map((asset) => (
          <div key={asset.title} className="grid gap-2 border-b border-border/50 bg-background-base/45 p-4 last:border-b-0 sm:grid-cols-[1fr_8rem]">
            <div className="min-w-0">
              <h3 className="font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{asset.title}</h3>
              <p className="mt-1 text-sm text-text-secondary">{asset.type}</p>
              <p className="mt-2 text-xs text-text-tertiary">{asset.location}</p>
            </div>
            <Badge className="h-fit border-amber-300/25 bg-amber-300/10 text-amber-100">{asset.status}</Badge>
          </div>
        ))}
      </div>
    </MarketingCard>
  );
}

function MetricsWorkspace() {
  return (
    <MarketingCard>
      <SectionHeader
        icon={BarChart3}
        kicker="Metrics"
        title="Manual KPI placeholders"
        description="Metric rows are labeled honestly so this dashboard does not imply live analytics, CRM, or publishing data."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
            <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-tertiary">{metric.label}</div>
            <div className="mt-2 font-mono-ui text-3xl text-foreground">{metric.value}</div>
            <Badge className="mt-3 border-rose-300/25 bg-rose-500/10 text-rose-100">{metric.source}</Badge>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{metric.note}</p>
          </article>
        ))}
      </div>
    </MarketingCard>
  );
}

function PortalPanel({ sectionId }: { sectionId: PortalSectionId }) {
  if (sectionId === "strategy") return <StrategyWorkspace />;
  if (sectionId === "campaigns") return <CampaignsWorkspace />;
  if (sectionId === "content") return <ContentWorkspace />;
  if (sectionId === "assets") return <AssetsWorkspace />;
  return <MetricsWorkspace />;
}

function MarketingPortal({ project }: { project: MarketingProject }) {
  const [activeSection, setActiveSection] = useState<PortalSectionId>("strategy");
  const activePortalSection = PORTAL_SECTIONS.find((section) => section.id === activeSection) ?? PORTAL_SECTIONS[0];

  return (
    <section className="space-y-5 rounded-[2rem] border border-midground/20 bg-card/55 p-4 shadow-2xl shadow-black/20 sm:p-5" aria-label={`${project.title} marketing portal`}>
      <div className={cn("overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-5", project.accent)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-3 border-current/20 bg-black/24 text-current">Marketing portal</Badge>
            <h2 className="font-expanded text-2xl font-black uppercase tracking-[0.08em] text-current">{project.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-current/82">{project.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.stats.map((stat) => (
              <span key={stat} className="rounded-full border border-current/15 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-current/80">
                {stat}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[17rem_1fr]">
        <aside className="rounded-2xl border border-border/60 bg-background-base/45 p-3" aria-label="Portal section picker">
          <div className="mb-3 px-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-tertiary">Portal sections</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {PORTAL_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/70",
                    active
                      ? "border-midground/55 bg-midground/12 text-foreground shadow-[0_0_28px_rgba(241,226,177,0.1)]"
                      : "border-border/55 bg-black/12 text-text-secondary hover:border-midground/30 hover:bg-midground/8 hover:text-foreground",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-current/20 bg-black/20 text-current">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-expanded text-xs font-black uppercase tracking-[0.08em]">{section.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-text-tertiary">{section.helper}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
            <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-tertiary">Active section</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-expanded text-xl font-black uppercase tracking-[0.08em] text-foreground">{activePortalSection.title}</h3>
              <Badge className="border-midground/25 bg-midground/10 text-midground">Interactive portal view</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{activePortalSection.helper}. Use the left rail to move through this project's portal without leaving the Marketing tab.</p>
          </div>
          <PortalPanel sectionId={activeSection} />
        </div>
      </div>
    </section>
  );
}

export default function MarketingPage() {
  const [selectedProject, setSelectedProject] = useState<MarketingProjectId>("savant-ai-systems");
  const selected = MARKETING_PROJECTS.find((project) => project.id === selectedProject) ?? MARKETING_PROJECTS[0];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-96 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-72 rounded-full bg-cyan-300/8 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-3 border-amber-200/30 bg-amber-300/10 text-amber-100">Read-only Milestone 1</Badge>
              <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">Marketing project launchpad</h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Square cards represent separate marketing projects. Pick one and its full marketing portal opens right here with strategy, campaigns, content, assets, and metrics. This slice uses local fixture/manual data only.
              </p>
            </div>
            <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
              <div className="font-black uppercase tracking-[0.14em]">No integrations connected</div>
              <div className="mt-1 text-xs text-success/80">No publish, sync, CRM, CMS, analytics, or social API actions.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5" aria-label="Marketing project launchpad">
        {MARKETING_PROJECTS.map((project) => (
          <ProjectSquare
            key={project.id}
            project={project}
            active={selectedProject === project.id}
            onOpen={setSelectedProject}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-current/10 bg-background-base/55 p-4 text-sm text-text-secondary">
        <div className="mb-2 flex items-center gap-2 font-bold text-midground">
          <Sparkles className="size-4" />
          Marketing portal: {selected.title}
        </div>
        Select a project square above to launch that project's marketing portal in-place below. These are read-only local cards, not live publishing or analytics integrations.
      </section>

      <MarketingAgentTeamPanel />

      <MarketingPortal key={selected.id} project={selected} />
    </main>
  );
}
