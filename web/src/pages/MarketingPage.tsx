import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ExternalLink,
  FileText,
  Image,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { api } from "@/lib/api";
import type { MissionControlProfileTeam, MissionControlProfileTeamAgent } from "@/lib/api";
import { cn } from "@/lib/utils";

type MarketingProjectId = "savant-ai-systems" | "hermes-marketing" | "automation-case-studies" | "home-hub-systems";
type SectionId = "pipeline" | "campaigns" | "strategy" | "assets" | "metrics";
type LaneId = "idea" | "draft" | "review" | "published";

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

interface MarketingProject {
  id: MarketingProjectId;
  title: string;
  kicker: string;
  focus: string;
  icon: LucideIcon;
  accent: string;
  strategy: StrategyPoint[];
  campaigns: Campaign[];
}

interface PipelineCard {
  id: string;
  title: string;
  lane: LaneId;
  createdAt: number;
}

interface AssetLink {
  id: string;
  title: string;
  href: string;
}

interface Workspace {
  notes: string;
  notesUpdatedAt: number | null;
  pipeline: PipelineCard[];
  assets: AssetLink[];
  doneActions: string[];
}

const STORAGE_KEY = "hermes.marketing.workspace.v1";

const LANES: { id: LaneId; title: string; dot: string }[] = [
  { id: "idea", title: "Ideas", dot: "bg-cyan-400" },
  { id: "draft", title: "Drafting", dot: "bg-violet-400" },
  { id: "review", title: "Review", dot: "bg-amber-400" },
  { id: "published", title: "Published", dot: "bg-emerald-400" },
];

const LANE_ORDER: LaneId[] = ["idea", "draft", "review", "published"];

const MARKETING_PROJECTS: MarketingProject[] = [
  {
    id: "savant-ai-systems",
    title: "Savant AI Systems",
    kicker: "Studio offer",
    focus: "Sharpen the studio narrative: secure agents, internal tools, and reliable automation for founder-led teams.",
    icon: Target,
    accent: "from-cyan-300/18 via-sky-400/8 to-transparent text-cyan-100 border-cyan-200/20",
    strategy: [
      {
        label: "Audience",
        value: "Founder-led teams and operators who need secure AI agents, custom software, and automation without scattered tooling.",
      },
      {
        label: "Positioning",
        value: "Savant is the practical AI systems studio: agent architecture, internal tools, and reliable business automation.",
      },
      {
        label: "Proof points",
        value: "Hermes Agent workflows, Home Hub systems, Mission Control dashboards, and repeatable local automation patterns.",
      },
    ],
    campaigns: [
      {
        name: "Founder systems narrative",
        goal: "Clarify the Savant point of view for secure agentic operations.",
        stage: "Strategy draft",
        channels: ["Website", "LinkedIn", "Sales deck"],
        nextAction: "Turn positioning notes into a one-page message map.",
      },
      {
        name: "AI systems audit offer",
        goal: "Package the audit as a low-friction entry point for consulting.",
        stage: "Idea",
        channels: ["Consulting", "LinkedIn"],
        nextAction: "Outline risks, integration seams, and quick-win scoring.",
      },
    ],
  },
  {
    id: "hermes-marketing",
    title: "Hermes Marketing",
    kicker: "Product story",
    focus: "Tell the Hermes Agent story with real screenshots and launch copy pulled from the working dashboard.",
    icon: Megaphone,
    accent: "from-fuchsia-300/16 via-purple-500/8 to-transparent text-fuchsia-100 border-fuchsia-200/20",
    strategy: [
      {
        label: "Audience",
        value: "Builders and operators who want a mission-control view over their agents instead of scattered terminal sessions.",
      },
      {
        label: "Positioning",
        value: "Hermes is the cockpit: chat, sessions, files, and agent teams in one local-first dashboard.",
      },
      {
        label: "Proof points",
        value: "Live Mission Control screenshots, profile-backed agent teams, and the marketing workspace itself.",
      },
    ],
    campaigns: [
      {
        name: "Hermes launch story",
        goal: "Show the dashboard doing real work, not mockups.",
        stage: "Content queue",
        channels: ["Blog", "X"],
        nextAction: "Capture a curated screenshot set from the live dashboard.",
      },
      {
        name: "Marketing workspace dogfood",
        goal: "Plan Hermes marketing inside Hermes itself and write that up.",
        stage: "In progress",
        channels: ["Dashboard", "Internal docs"],
        nextAction: "Run one full campaign through this workspace end to end.",
      },
    ],
  },
  {
    id: "automation-case-studies",
    title: "Automation Case Studies",
    kicker: "Proof library",
    focus: "Package real workflow wins into safe, reusable examples that never expose private data.",
    icon: FileText,
    accent: "from-amber-300/16 via-orange-400/8 to-transparent text-amber-100 border-amber-200/20",
    strategy: [
      {
        label: "Audience",
        value: "Prospects who need evidence that agent automation holds up in day-to-day operations.",
      },
      {
        label: "Positioning",
        value: "Concrete before/after stories: hours saved, failure modes handled, and what stayed boring on purpose.",
      },
      {
        label: "Proof points",
        value: "Anonymized workflow diagrams, operating-rhythm writeups, and reproducible local-first patterns.",
      },
    ],
    campaigns: [
      {
        name: "Case study batch one",
        goal: "Publish two safe examples that package workflow wins.",
        stage: "Content queue",
        channels: ["Blog", "Newsletter", "Consulting follow-up"],
        nextAction: "Pick two examples that do not expose private data.",
      },
    ],
  },
  {
    id: "home-hub-systems",
    title: "Home Hub Systems",
    kicker: "Demo narrative",
    focus: "Use the household dashboard as an approachable demo of practical local-first automation.",
    icon: Image,
    accent: "from-emerald-300/15 via-teal-400/8 to-transparent text-emerald-100 border-emerald-200/20",
    strategy: [
      {
        label: "Audience",
        value: "People who get the value of automation faster through a home demo than an enterprise pitch.",
      },
      {
        label: "Positioning",
        value: "The same architecture that runs the studio runs the house — small, legible, and private.",
      },
      {
        label: "Proof points",
        value: "Household dashboard walkthroughs, automation diagrams, and no-cloud-required talking points.",
      },
    ],
    campaigns: [
      {
        name: "Home Hub walkthrough",
        goal: "A friendly tour that doubles as a systems-thinking demo.",
        stage: "Idea",
        channels: ["Blog", "YouTube"],
        nextAction: "Script the walkthrough around one real morning routine.",
      },
    ],
  },
];

const SECTIONS: { id: SectionId; title: string; icon: LucideIcon }[] = [
  { id: "pipeline", title: "Pipeline", icon: FileText },
  { id: "campaigns", title: "Campaigns", icon: Megaphone },
  { id: "strategy", title: "Strategy", icon: Target },
  { id: "assets", title: "Assets", icon: Image },
  { id: "metrics", title: "Metrics", icon: BarChart3 },
];

const MARKETING_PROFILE_TEAM_IDS = ["hermes-marketing", "hermes-marketing-dev"];
const MARKETING_TEAM_POLL_MS = 15_000;
const MARKETING_TEAM_TIMEOUT_MS = 8_000;

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function seedCard(title: string, lane: LaneId): PipelineCard {
  return { id: uid(), title, lane, createdAt: Date.now() };
}

function emptyWorkspace(): Workspace {
  return { notes: "", notesUpdatedAt: null, pipeline: [], assets: [], doneActions: [] };
}

function seedWorkspaces(): Record<MarketingProjectId, Workspace> {
  return {
    "savant-ai-systems": {
      ...emptyWorkspace(),
      pipeline: [
        seedCard("AI systems audit checklist", "idea"),
        seedCard("From scattered automations to Mission Control", "draft"),
        seedCard("Secure agent deployment talking points", "review"),
        seedCard("Local-first workflow examples", "published"),
      ],
      assets: [{ id: uid(), title: "Savant positioning one-sheet", href: "" }],
    },
    "hermes-marketing": {
      ...emptyWorkspace(),
      pipeline: [
        seedCard("Launch story: chat + Mission Control tour", "idea"),
        seedCard("Dashboard screenshot set", "draft"),
      ],
    },
    "automation-case-studies": {
      ...emptyWorkspace(),
      pipeline: [seedCard("Shortlist two safe workflow wins", "idea")],
    },
    "home-hub-systems": {
      ...emptyWorkspace(),
      pipeline: [seedCard("Household dashboard walkthrough script", "idea")],
    },
  };
}

function loadWorkspaces(): Record<MarketingProjectId, Workspace> {
  const seeds = seedWorkspaces();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seeds;
    const parsed = JSON.parse(raw) as Partial<Record<MarketingProjectId, Partial<Workspace>>>;
    const merged = { ...seeds };
    for (const project of MARKETING_PROJECTS) {
      const stored = parsed[project.id];
      if (stored) merged[project.id] = { ...emptyWorkspace(), ...stored };
    }
    return merged;
  } catch {
    return seeds;
  }
}

function formatClockTime(timestampMs: number | null): string {
  if (!timestampMs) return "";
  return new Date(timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function marketingAgentStatusLabel(agent: MissionControlProfileTeamAgent): string {
  if (!agent.configured) return "missing profile";
  if (!agent.active && agent.status === "ready") return "standby";
  return agent.status || "ready";
}

function formatMarketingTeamCheckedAt(checkedAt: number | null): string {
  if (!checkedAt) return "not loaded yet";
  return new Date(checkedAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function filterMarketingProfileTeams(teams: MissionControlProfileTeam[] | undefined): MissionControlProfileTeam[] {
  return (teams ?? []).filter((team) => MARKETING_PROFILE_TEAM_IDS.includes(team.team_id));
}

function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/60 shadow-lg shadow-black/10", className)}>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function RailHeader({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
      <Icon className="size-4 text-midground" />
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

function GhostIconButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-6 place-items-center rounded-md text-text-tertiary transition-colors",
        "hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/60",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-tertiary",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ProjectSwitcher({
  selectedProject,
  onSelect,
}: {
  selectedProject: MarketingProjectId;
  onSelect: (id: MarketingProjectId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Marketing projects">
      {MARKETING_PROJECTS.map((project) => {
        const Icon = project.icon;
        const active = project.id === selectedProject;
        return (
          <button
            key={project.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(project.id)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midground/60",
              active
                ? "bg-midground/14 text-foreground shadow-[inset_0_0_0_1px_rgba(241,226,177,0.35)]"
                : "text-text-secondary hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3.5", active ? "text-midground" : "text-text-tertiary")} />
            {project.title}
          </button>
        );
      })}
    </div>
  );
}

function SectionTabs({
  activeSection,
  onSelect,
  counts,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  counts: Partial<Record<SectionId, number>>;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-2" role="tablist" aria-label="Workspace sections">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = section.id === activeSection;
        const count = counts[section.id];
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(section.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-xs font-semibold transition-colors focus-visible:outline-none",
              active ? "text-foreground" : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            <Icon className={cn("size-3.5", active ? "text-midground" : "")} />
            {section.title}
            {typeof count === "number" ? (
              <span className={cn("font-mono-ui text-[0.65rem]", active ? "text-midground" : "text-text-tertiary/70")}>{count}</span>
            ) : null}
            {active ? <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-midground" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function AddInlineForm({ placeholder, onAdd, label }: { placeholder: string; onAdd: (value: string) => void; label: string }) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  };

  return (
    <form onSubmit={submit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-xs text-foreground placeholder:text-text-tertiary/70 transition-colors hover:bg-white/[0.03] focus:border-midground/30 focus:bg-black/25 focus:outline-none"
      />
    </form>
  );
}

function PipelineSection({
  pipeline,
  onAdd,
  onMove,
  onMoveToLane,
  onDelete,
}: {
  pipeline: PipelineCard[];
  onAdd: (lane: LaneId, title: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onMoveToLane: (id: string, lane: LaneId) => void;
  onDelete: (id: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<LaneId | null>(null);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {LANES.map((lane) => {
        const laneIndex = LANE_ORDER.indexOf(lane.id);
        const cards = pipeline.filter((card) => card.lane === lane.id);
        const isDropTarget = dragOverLane === lane.id && draggingId !== null;
        return (
          <section
            key={lane.id}
            aria-label={`${lane.title} lane`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverLane(lane.id);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverLane(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain") || draggingId;
              if (id) onMoveToLane(id, lane.id);
              setDragOverLane(null);
              setDraggingId(null);
            }}
            className={cn(
              "flex min-h-[16rem] flex-col rounded-xl bg-black/20 p-2 transition-colors",
              isDropTarget && "bg-midground/8 shadow-[inset_0_0_0_1px_rgba(241,226,177,0.3)]",
            )}
          >
            <header className="flex items-center gap-2 px-2 pb-2 pt-1.5">
              <span className={cn("size-1.5 rounded-full", lane.dot)} aria-hidden="true" />
              <h3 className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-text-secondary">{lane.title}</h3>
              <span className="ml-auto font-mono-ui text-[0.65rem] text-text-tertiary">{cards.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-1.5">
              {cards.map((card) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", card.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingId(card.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverLane(null);
                  }}
                  className={cn(
                    "group flex cursor-grab items-start gap-1.5 rounded-lg border border-border/40 bg-card/80 py-2.5 pl-3 pr-2 transition-colors hover:border-midground/25 active:cursor-grabbing",
                    draggingId === card.id && "opacity-40",
                  )}
                >
                  <p className="min-w-0 flex-1 break-words text-xs leading-5 text-foreground">{card.title}</p>
                  <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <GhostIconButton label={`Move "${card.title}" back a lane`} onClick={() => onMove(card.id, -1)} disabled={laneIndex === 0}>
                      <ArrowLeft className="size-3" />
                    </GhostIconButton>
                    <GhostIconButton
                      label={`Advance "${card.title}" to the next lane`}
                      onClick={() => onMove(card.id, 1)}
                      disabled={laneIndex === LANE_ORDER.length - 1}
                    >
                      <ArrowRight className="size-3" />
                    </GhostIconButton>
                    <GhostIconButton label={`Delete "${card.title}"`} onClick={() => onDelete(card.id)} className="hover:text-rose-300">
                      <Trash2 className="size-3" />
                    </GhostIconButton>
                  </span>
                </article>
              ))}
            </div>
            <div className="mt-1.5">
              <AddInlineForm placeholder="+ Add" label={`${lane.title} card`} onAdd={(title) => onAdd(lane.id, title)} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CampaignsSection({
  campaigns,
  doneActions,
  onToggleAction,
}: {
  campaigns: Campaign[];
  doneActions: string[];
  onToggleAction: (campaignName: string) => void;
}) {
  return (
    <div className="divide-y divide-border/40">
      {campaigns.map((campaign) => {
        const done = doneActions.includes(campaign.name);
        return (
          <article key={campaign.name} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-bold text-foreground">{campaign.name}</h3>
              <Badge className="border-0 bg-cyan-400/12 text-[0.65rem] text-cyan-200">{campaign.stage}</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{campaign.goal}</p>
            <p className="mt-1.5 font-mono-ui text-[0.65rem] uppercase tracking-[0.08em] text-text-tertiary">{campaign.channels.join(" · ")}</p>
            <button
              type="button"
              onClick={() => onToggleAction(campaign.name)}
              aria-pressed={done}
              className="-mx-2 mt-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/60"
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                  done ? "border-success/60 bg-success/20 text-success" : "border-border text-transparent",
                )}
              >
                <Check className="size-3" />
              </span>
              <span className={cn("text-xs leading-5", done ? "text-text-tertiary line-through" : "text-text-secondary")}>{campaign.nextAction}</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}

function StrategySection({ strategy }: { strategy: StrategyPoint[] }) {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {strategy.map((point) => (
        <div key={point.label} className="border-l-2 border-midground/30 pl-4">
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-midground">{point.label}</div>
          <p className="mt-1.5 text-xs leading-5 text-text-secondary">{point.value}</p>
        </div>
      ))}
    </div>
  );
}

function AssetsSection({
  assets,
  onAdd,
  onDelete,
}: {
  assets: AssetLink[];
  onAdd: (title: string, href: string) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [href, setHref] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onAdd(trimmedTitle, href.trim());
    setTitle("");
    setHref("");
  };

  return (
    <div>
      {assets.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-tertiary">No assets saved yet — add decks, screenshots, or diagrams below.</p>
      ) : (
        <div className="divide-y divide-border/40">
          {assets.map((asset) => (
            <div key={asset.id} className="group flex items-center gap-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-foreground">{asset.title}</div>
                {asset.href ? (
                  <a
                    href={asset.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono-ui text-[0.68rem] text-cyan-200/90 hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{asset.href}</span>
                  </a>
                ) : (
                  <div className="mt-0.5 font-mono-ui text-[0.68rem] text-text-tertiary/70">no link yet</div>
                )}
              </div>
              <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <GhostIconButton label={`Delete asset "${asset.title}"`} onClick={() => onDelete(asset.id)} className="hover:text-rose-300">
                  <Trash2 className="size-3.5" />
                </GhostIconButton>
              </span>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4 sm:flex-row">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Asset name"
          aria-label="Asset name"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-black/25 px-3 py-2 text-xs text-foreground placeholder:text-text-tertiary/70 focus:border-midground/30 focus:outline-none"
        />
        <input
          type="text"
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="Link or path (optional)"
          aria-label="Asset link"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-black/25 px-3 py-2 font-mono-ui text-xs text-foreground placeholder:text-text-tertiary/70 focus:border-midground/30 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-midground/12 px-3.5 py-2 text-xs font-semibold text-midground transition-colors hover:bg-midground/18"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </form>
    </div>
  );
}

function MetricsSection({ workspace, campaigns }: { workspace: Workspace; campaigns: Campaign[] }) {
  const laneCount = (lane: LaneId) => workspace.pipeline.filter((card) => card.lane === lane).length;
  const stats = [
    { label: "Ideas captured", value: String(laneCount("idea")) },
    { label: "In progress", value: String(laneCount("draft") + laneCount("review")) },
    { label: "Published", value: String(laneCount("published")) },
    { label: "Actions done", value: `${workspace.doneActions.length} / ${campaigns.length}` },
    { label: "Assets saved", value: String(workspace.assets.length) },
    { label: "Notes updated", value: workspace.notesUpdatedAt ? formatClockTime(workspace.notesUpdatedAt) : "—" },
  ];
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <article key={stat.label} className="rounded-xl bg-black/20 px-4 py-3.5">
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-tertiary">{stat.label}</div>
            <div className="mt-1.5 font-mono-ui text-2xl text-foreground">{stat.value}</div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-[0.68rem] leading-5 text-text-tertiary">
        Live counts from the pipeline, campaigns, assets, and notes on this page. No analytics, CRM, or publishing sources are connected.
      </p>
    </div>
  );
}

function NotesCard({
  notes,
  notesUpdatedAt,
  onChange,
}: {
  notes: string;
  notesUpdatedAt: number | null;
  onChange: (value: string) => void;
}) {
  return (
    <PanelCard>
      <RailHeader
        icon={NotebookPen}
        title="Scratchpad"
        action={
          <span className="font-mono-ui text-[0.62rem] text-text-tertiary">
            {notesUpdatedAt ? `saved ${formatClockTime(notesUpdatedAt)}` : "saves locally"}
          </span>
        }
      />
      <div className="p-3">
        <textarea
          value={notes}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Hooks, angles, half-formed lines — drop them here before they evaporate."
          aria-label="Project scratchpad"
          rows={9}
          className="w-full resize-y rounded-lg border border-transparent bg-black/25 p-3 text-xs leading-5 text-foreground placeholder:text-text-tertiary/70 focus:border-midground/30 focus:outline-none"
        />
      </div>
    </PanelCard>
  );
}

function agentDotTone(agent: MissionControlProfileTeamAgent): "ready" | "working" | "review" {
  if (!agent.configured) return "review";
  if (agent.status === "working" || agent.active) return "working";
  return "ready";
}

function MarketingAgentRow({ agent }: { agent: MissionControlProfileTeamAgent }) {
  const tone = agentDotTone(agent);
  const statusLabel = marketingAgentStatusLabel(agent);
  const canLaunch = agent.configured && agent.profile.trim().length > 0;

  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "ready" && "bg-emerald-400",
          tone === "working" && "animate-pulse bg-amber-400",
          tone === "review" && "bg-rose-400",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-foreground">{agent.role}</span>
        <span className="ml-2 font-mono-ui text-[0.65rem] text-text-tertiary" title={agent.detail || agent.profile || undefined}>
          {statusLabel}
          {agent.pid ? ` · ${agent.pid}` : ""}
        </span>
      </div>
      {canLaunch ? (
        <Link
          to={`/chat?profile=${encodeURIComponent(agent.profile)}`}
          aria-label={`Launch chat with ${agent.role}`}
          title="Launch chat"
          className="grid size-6 shrink-0 place-items-center rounded-md text-text-tertiary opacity-0 transition-all hover:bg-cyan-400/12 hover:text-cyan-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/60 group-hover:opacity-100"
        >
          <MessageSquare className="size-3.5" />
        </Link>
      ) : (
        <span className="shrink-0 font-mono-ui text-[0.6rem] text-text-tertiary/60" title="Configure profile before launch">
          no profile
        </span>
      )}
    </div>
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

  return (
    <PanelCard>
      <RailHeader
        icon={Users}
        title="Agent team"
        action={
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void loadMarketingTeams();
            }}
            disabled={loading || refreshing}
            aria-label="Refresh agent teams"
            title="Refresh"
            className="grid size-6 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/8 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </button>
        }
      />
      <div className="p-3">
        {error ? (
          <div role="alert" className="mb-3 rounded-lg bg-rose-500/10 p-3 text-xs leading-5 text-rose-100">
            Could not load Marketing profile teams: {error}
          </div>
        ) : null}

        {loading ? (
          <p className="px-2 py-4 text-xs text-text-tertiary">Loading Marketing profile teams…</p>
        ) : teams.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-5 text-text-tertiary">
            Mission Control has not returned the hermes-marketing or hermes-marketing-dev profile teams yet. Refresh once the backend definitions
            are loaded.
          </p>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => {
              const configuredCount = team.agents.filter((agent) => agent.configured).length;
              const activeCount = team.agents.filter((agent) => agent.active).length;
              return (
                <section key={team.team_id} aria-label={team.label}>
                  <div className="flex items-baseline justify-between gap-2 px-2 pb-1.5">
                    <h3 className="truncate text-[0.68rem] font-bold uppercase tracking-[0.14em] text-midground" title={team.project_path}>
                      {team.label}
                    </h3>
                    <span className="shrink-0 font-mono-ui text-[0.62rem] text-text-tertiary">
                      {configuredCount}/{team.agents.length} · {activeCount} active
                    </span>
                  </div>
                  <div>
                    {team.agents.map((agent) => (
                      <MarketingAgentRow key={`${team.team_id}-${agent.profile}-${agent.role}`} agent={agent} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-2 px-2 text-right font-mono-ui text-[0.62rem] text-text-tertiary/70">updated {formatMarketingTeamCheckedAt(checkedAt)}</div>
      </div>
    </PanelCard>
  );
}

export default function MarketingPage() {
  const [selectedProject, setSelectedProject] = useState<MarketingProjectId>("savant-ai-systems");
  const [activeSection, setActiveSection] = useState<SectionId>("pipeline");
  const [workspaces, setWorkspaces] = useState<Record<MarketingProjectId, Workspace>>(loadWorkspaces);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
    } catch {
      // localStorage unavailable (private mode/quota); the workspace still works in-memory.
    }
  }, [workspaces]);

  const project = MARKETING_PROJECTS.find((candidate) => candidate.id === selectedProject) ?? MARKETING_PROJECTS[0];
  const workspace = workspaces[project.id];

  const updateWorkspace = useCallback(
    (updater: (workspace: Workspace) => Workspace) => {
      setWorkspaces((previous) => ({ ...previous, [project.id]: updater(previous[project.id]) }));
    },
    [project.id],
  );

  const addPipelineCard = (lane: LaneId, title: string) =>
    updateWorkspace((current) => ({ ...current, pipeline: [...current.pipeline, { id: uid(), title, lane, createdAt: Date.now() }] }));

  const movePipelineCard = (id: string, direction: -1 | 1) =>
    updateWorkspace((current) => ({
      ...current,
      pipeline: current.pipeline.map((card) => {
        if (card.id !== id) return card;
        const nextIndex = LANE_ORDER.indexOf(card.lane) + direction;
        if (nextIndex < 0 || nextIndex >= LANE_ORDER.length) return card;
        return { ...card, lane: LANE_ORDER[nextIndex] };
      }),
    }));

  const movePipelineCardToLane = (id: string, lane: LaneId) =>
    updateWorkspace((current) => ({
      ...current,
      pipeline: current.pipeline.map((card) => (card.id === id ? { ...card, lane } : card)),
    }));

  const deletePipelineCard = (id: string) =>
    updateWorkspace((current) => ({ ...current, pipeline: current.pipeline.filter((card) => card.id !== id) }));

  const toggleCampaignAction = (campaignName: string) =>
    updateWorkspace((current) => ({
      ...current,
      doneActions: current.doneActions.includes(campaignName)
        ? current.doneActions.filter((name) => name !== campaignName)
        : [...current.doneActions, campaignName],
    }));

  const addAsset = (title: string, href: string) =>
    updateWorkspace((current) => ({ ...current, assets: [...current.assets, { id: uid(), title, href }] }));

  const deleteAsset = (id: string) =>
    updateWorkspace((current) => ({ ...current, assets: current.assets.filter((asset) => asset.id !== id) }));

  const setNotes = (value: string) =>
    updateWorkspace((current) => ({ ...current, notes: value, notesUpdatedAt: Date.now() }));

  const publishedCount = workspace.pipeline.filter((card) => card.lane === "published").length;
  const sectionCounts: Partial<Record<SectionId, number>> = {
    pipeline: workspace.pipeline.length,
    campaigns: project.campaigns.length,
    assets: workspace.assets.length,
  };

  const ProjectIcon = project.icon;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-expanded text-2xl font-black uppercase tracking-[0.08em] text-foreground">Marketing workspace</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-text-secondary">
            Plan campaigns, move content through the pipeline, and capture notes per project.
          </p>
        </div>
        <Badge className="border-0 bg-success/10 font-mono-ui text-[0.65rem] font-normal text-success">Local-only · saves in this browser</Badge>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectSwitcher selectedProject={project.id} onSelect={setSelectedProject} />
        <span className="font-mono-ui text-[0.68rem] text-text-tertiary">
          {project.campaigns.length} campaigns · {workspace.pipeline.length} in pipeline · {publishedCount} published
        </span>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <PanelCard>
          <section
            key={project.id}
            className={cn("border-b bg-gradient-to-r px-5 py-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300", project.accent)}
            aria-label={`${project.title} overview`}
          >
            <div className="flex items-center gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/25">
                <ProjectIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-current/60">{project.kicker}</div>
                <h2 className="truncate font-expanded text-base font-black uppercase tracking-[0.06em] text-current">{project.title}</h2>
              </div>
            </div>
            <p className="mt-2.5 max-w-3xl text-xs leading-5 text-current/75">{project.focus}</p>
          </section>

          <SectionTabs activeSection={activeSection} onSelect={setActiveSection} counts={sectionCounts} />

          <div
            key={`${project.id}:${activeSection}`}
            className="p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 sm:p-5"
          >
            {activeSection === "pipeline" && (
              <PipelineSection
                pipeline={workspace.pipeline}
                onAdd={addPipelineCard}
                onMove={movePipelineCard}
                onMoveToLane={movePipelineCardToLane}
                onDelete={deletePipelineCard}
              />
            )}
            {activeSection === "campaigns" && (
              <CampaignsSection campaigns={project.campaigns} doneActions={workspace.doneActions} onToggleAction={toggleCampaignAction} />
            )}
            {activeSection === "strategy" && <StrategySection strategy={project.strategy} />}
            {activeSection === "assets" && <AssetsSection assets={workspace.assets} onAdd={addAsset} onDelete={deleteAsset} />}
            {activeSection === "metrics" && <MetricsSection workspace={workspace} campaigns={project.campaigns} />}
          </div>
        </PanelCard>

        <aside className="min-w-0 space-y-5" aria-label="Marketing sidebar">
          <NotesCard notes={workspace.notes} notesUpdatedAt={workspace.notesUpdatedAt} onChange={setNotes} />
          <MarketingAgentTeamPanel />
        </aside>
      </div>
    </main>
  );
}
