import type { ReactNode } from "react";
import {
  BarChart3,
  FileText,
  Image,
  Megaphone,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "amber" | "violet" | "emerald" | "rose";

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

const TONE_CLASSES: Record<Tone, string> = {
  amber: "border-warning/30 bg-warning/10 text-warning",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  emerald: "border-success/30 bg-success/10 text-success",
  rose: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  violet: "border-violet-300/30 bg-violet-500/10 text-violet-100",
};

function SectionHeader({ icon: Icon, kicker, title, description }: { icon: typeof Sparkles; kicker: string; title: string; description: string }) {
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

export default function MarketingPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-96 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-72 rounded-full bg-cyan-300/8 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-3 border-amber-200/30 bg-amber-300/10 text-amber-100">Read-only Milestone 1</Badge>
              <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">Marketing workspace</h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                A central dashboard tab for strategy, campaigns, content, assets, and metric placeholders. This slice uses local fixture/manual data only.
              </p>
            </div>
            <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
              <div className="font-black uppercase tracking-[0.14em]">No integrations connected</div>
              <div className="mt-1 text-xs text-success/80">No publish, sync, CRM, CMS, analytics, or social API actions.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
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
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
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
      </section>

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
    </main>
  );
}
