import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Database,
  FileCheck2,
  FileText,
  Globe,
  Search,
  Users,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "amber" | "emerald" | "violet" | "rose";

interface ResearchLane {
  lane: string;
  title: string;
  owner: string;
  nextAction: string;
  tone: Tone;
}

interface SourceRow {
  source: string;
  coverage: string;
  status: string;
  guardrail: string;
}

interface TeamRole {
  role: string;
  profile: string;
  responsibility: string;
}

interface MetricRow {
  label: string;
  value: string;
  source: string;
  note: string;
}

const RESEARCH_LANES: ResearchLane[] = [
  {
    lane: "Intake",
    title: "Question framing",
    owner: "hresearchstrategist",
    nextAction: "Turn loose research asks into scope, audience, source standards, and decision criteria.",
    tone: "cyan",
  },
  {
    lane: "Discovery",
    title: "Source sweep",
    owner: "hresearchscout",
    nextAction: "Find candidate sources and label provenance before any synthesis happens.",
    tone: "violet",
  },
  {
    lane: "Evidence",
    title: "Claim extraction",
    owner: "hresearchanalyst",
    nextAction: "Separate observations, claims, contradictions, and confidence notes.",
    tone: "amber",
  },
  {
    lane: "Review",
    title: "Fact-check pass",
    owner: "hresearchfactcheck",
    nextAction: "Verify citations, flag weak claims, and block unsupported conclusions.",
    tone: "rose",
  },
  {
    lane: "Synthesis",
    title: "Brief production",
    owner: "hresearchsynth",
    nextAction: "Produce concise briefs with source-backed takeaways and open questions.",
    tone: "emerald",
  },
];

const SOURCES: SourceRow[] = [
  {
    source: "Web / docs",
    coverage: "Manual or tool-assisted source review",
    status: "Not connected live",
    guardrail: "No live crawl status is implied by this page.",
  },
  {
    source: "Papers / PDFs",
    coverage: "Literature notes and cited excerpts",
    status: "Template only",
    guardrail: "Do not summarize without retained source references.",
  },
  {
    source: "Internal notes",
    coverage: "Local markdown briefs and handoff docs",
    status: "Folder scaffolded",
    guardrail: "Keep private data out of reusable examples unless explicitly approved.",
  },
];

const TEAM: TeamRole[] = [
  {
    role: "Strategy lead",
    profile: "hresearchstrategist",
    responsibility: "Scopes questions, chooses evidence standards, and decides when a brief is decision-ready.",
  },
  {
    role: "Source scout",
    profile: "hresearchscout",
    responsibility: "Finds candidate sources, records provenance, and avoids unverified source laundering.",
  },
  {
    role: "Evidence analyst",
    profile: "hresearchanalyst",
    responsibility: "Extracts claims, compares sources, labels confidence, and tracks contradictions.",
  },
  {
    role: "Synthesis writer",
    profile: "hresearchsynth",
    responsibility: "Turns verified evidence into readable briefs, memos, and next-step recommendations.",
  },
  {
    role: "Fact checker",
    profile: "hresearchfactcheck",
    responsibility: "Audits citations, blocks unsupported claims, and keeps research outputs honest.",
  },
  {
    role: "Knowledge curator",
    profile: "hresearchcurator",
    responsibility: "Maintains brief library, tags reusable findings, and closes the feedback loop.",
  },
];

const METRICS: MetricRow[] = [
  {
    label: "Active briefs",
    value: "—",
    source: "Manual placeholder",
    note: "The Hermes Research board exists, but this tab does not read Kanban data yet.",
  },
  {
    label: "Sources reviewed",
    value: "—",
    source: "Manual placeholder",
    note: "No browser, PDF, scholar, or citation database integration is connected.",
  },
  {
    label: "Blocked claims",
    value: "—",
    source: "Manual placeholder",
    note: "Future fact-check output should surface unsupported claims here.",
  },
  {
    label: "Team profiles",
    value: "6",
    source: "Dashboard roster",
    note: "Mission Control can show these role profiles once the dashboard backend restarts.",
  },
];

const TONE_CLASSES: Record<Tone, string> = {
  amber: "border-warning/30 bg-warning/10 text-warning",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
  emerald: "border-success/30 bg-success/10 text-success",
  rose: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  violet: "border-violet-300/30 bg-violet-500/10 text-violet-100",
};

function SectionHeader({ icon: Icon, kicker, title, description }: { icon: typeof Search; kicker: string; title: string; description: string }) {
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

function ResearchCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/72 shadow-2xl shadow-black/15", className)}>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

export default function ResearchPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/20">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-96 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-72 rounded-full bg-violet-300/8 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-3 border-cyan-200/30 bg-cyan-300/10 text-cyan-100">Read-only Milestone 1</Badge>
              <h1 className="font-expanded text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">Research workspace</h1>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                A central dashboard tab for research intake, source review, evidence analysis, synthesis, and fact-check guardrails. This slice uses local fixture/manual data only.
              </p>
            </div>
            <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
              <div className="font-black uppercase tracking-[0.14em]">Evidence-first, no claims implied</div>
              <div className="mt-1 text-xs text-success/80">No crawler, scholar, citation, notes, or publishing integration is connected yet.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <ResearchCard>
          <SectionHeader
            icon={Search}
            kicker="Pipeline"
            title="Research operating loop"
            description="A read-only workflow shape for getting from a question to a source-backed brief without losing provenance."
          />
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
            {RESEARCH_LANES.map((item) => (
              <article key={`${item.lane}-${item.title}`} className={cn("rounded-2xl border p-4", TONE_CLASSES[item.tone])}>
                <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] opacity-80">{item.lane}</div>
                <h3 className="mt-3 min-h-[3.25rem] break-words font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{item.title}</h3>
                <div className="mt-3 rounded-xl border border-current/15 bg-black/18 px-3 py-2 text-xs text-current">{item.owner}</div>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{item.nextAction}</p>
              </article>
            ))}
          </div>
        </ResearchCard>

        <ResearchCard>
          <SectionHeader
            icon={Database}
            kicker="Evidence"
            title="Source coverage"
            description="Current data-source expectations are explicit so the tab does not overstate live research coverage."
          />
          <div className="overflow-hidden rounded-2xl border border-border/60">
            {SOURCES.map((source) => (
              <div key={source.source} className="border-b border-border/50 bg-background-base/45 p-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{source.source}</h3>
                  <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">{source.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-text-secondary">{source.coverage}</p>
                <p className="mt-2 text-xs leading-5 text-text-tertiary">{source.guardrail}</p>
              </div>
            ))}
          </div>
        </ResearchCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <ResearchCard>
          <SectionHeader
            icon={BookOpen}
            kicker="Output"
            title="Brief standard"
            description="Each research output should make the confidence boundary visible before anyone acts on it."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Question", "The exact decision or curiosity being answered."],
              ["Evidence", "Quoted or linked support, with source and date captured."],
              ["Takeaway", "A concise synthesis that distinguishes fact, inference, and recommendation."],
              ["Open risks", "Contradictions, missing sources, stale assumptions, and follow-up checks."],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
                <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-midground">{label}</div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{value}</p>
              </div>
            ))}
          </div>
        </ResearchCard>

        <ResearchCard>
          <SectionHeader
            icon={Users}
            kicker="Team"
            title="Research role profiles"
            description="Domain-specialist agents for research work, separate from generic planner/builder/reviewer dev support."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {TEAM.map((role) => (
              <article key={role.profile} className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{role.role}</h3>
                  <Badge className="border-violet-300/25 bg-violet-500/10 text-violet-100">{role.profile}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{role.responsibility}</p>
              </article>
            ))}
          </div>
        </ResearchCard>
      </section>

      <ResearchCard>
        <SectionHeader
          icon={BarChart3}
          kicker="Metrics"
          title="Manual research placeholders"
          description="No live counts are claimed until board, source, and citation integrations are intentionally connected."
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
      </ResearchCard>

      <ResearchCard>
        <SectionHeader
          icon={BookOpen}
          kicker="Knowledge handoff"
          title="Feed verified research into the Knowledge Base"
          description="When a brief is source-backed enough to keep, save it as Markdown in Hermes Research or the matching domain knowledge base."
        />
        <div className="flex flex-col gap-3 rounded-2xl border border-midground/25 bg-midground/10 p-4 text-sm leading-6 text-text-secondary md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-black uppercase tracking-[0.14em] text-midground">Research → Markdown knowledge base</div>
            <p className="mt-1">The bare-bones flow is manual first: write the brief, fact-check it, then add it to `/knowledge-base` as a durable Markdown file.</p>
          </div>
          <a className="inline-flex shrink-0 items-center justify-center rounded-full border border-midground/30 bg-midground/15 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-midground transition-colors hover:bg-midground/25" href="/knowledge-base">
            Open Knowledge Base
          </a>
        </div>
      </ResearchCard>

      <ResearchCard>
        <SectionHeader
          icon={FileCheck2}
          kicker="Guardrails"
          title="Claim safety contract"
          description="The research team should make unsupported, stale, or speculative conclusions hard to ship by accident."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            [FileText, "Cited or caveated", "Every conclusion needs a source, a confidence label, or an explicit caveat."],
            [Globe, "Source recency", "Record when a source was checked so stale data is visible later."],
            [FileCheck2, "Fact-check gate", "A fact-check role blocks briefs that conflate source text with model inference."],
          ].map(([Icon, title, body]) => {
            const GuardIcon = Icon as typeof FileText;
            return (
              <div key={title as string} className="rounded-2xl border border-border/60 bg-background-base/45 p-4">
                <GuardIcon className="size-5 text-midground" />
                <h3 className="mt-3 font-expanded text-sm font-black uppercase tracking-[0.08em] text-foreground">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{body as string}</p>
              </div>
            );
          })}
        </div>
      </ResearchCard>
    </main>
  );
}
