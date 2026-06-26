import { useLayoutEffect, useMemo, useState } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { usePageHeader } from "@/contexts/usePageHeader";
import { cn } from "@/lib/utils";
import "@xyflow/react/dist/style.css";

interface ResearchNodeData extends Record<string, unknown> {
  label: string;
  phase: PhaseId;
  summary: string;
  inputs: string[];
  outputs: string[];
  risks: string[];
}

interface ZoneNodeData extends Record<string, unknown> {
  label: string;
  detail: string;
  tone: "backend" | "box" | "boundary";
}

type ResearchNode = Node<ResearchNodeData, "research">;
type ZoneNode = Node<ZoneNodeData, "zone">;
type FlowNode = ResearchNode | ZoneNode;
type ResearchEdge = Edge<{ label?: string }>;
type ViewMode = "logical" | "galaxy";
type PhaseId = "intake" | "sources" | "analysis" | "review" | "output";

interface PhaseMeta {
  id: PhaseId;
  label: string;
  color: string;
  ring: string;
  short: string;
}

const PHASES: PhaseMeta[] = [
  { id: "intake", label: "Intake", short: "01", color: "#67e8f9", ring: "rgba(103, 232, 249, 0.34)" },
  { id: "sources", label: "Sources", short: "02", color: "#a78bfa", ring: "rgba(167, 139, 250, 0.34)" },
  { id: "analysis", label: "Analysis", short: "03", color: "#fbbf24", ring: "rgba(251, 191, 36, 0.34)" },
  { id: "review", label: "Review", short: "04", color: "#fb7185", ring: "rgba(251, 113, 133, 0.34)" },
  { id: "output", label: "Output", short: "05", color: "#34d399", ring: "rgba(52, 211, 153, 0.34)" },
];

const PHASE_BY_ID = new Map(PHASES.map((phase) => [phase.id, phase]));
const BASE_ZONE_NODES: ZoneNode[] = [
  zoneNode("backend-zone", "Backend evidence / research system", "Source discovery, extraction, dedupe, signal modeling", "backend"),
  zoneNode("box-zone", "Box flow / live trial system", "Box state, OC Q&A, live questions, strike board", "box"),
  zoneNode("boundary-zone", "Interface boundary", "Source anchors → live payload · feedback sync → audit/eval", "boundary"),
];

const BASE_NODES: ResearchNode[] = [
  researchNode("case-intake", "Case + trial intake", "intake", "Venire, case posture, claims, dates, geography, and research constraints.", ["Case file", "Juror list", "Court / venue context"], ["Research scope", "Known entities", "Timebox"], ["Bad seed data creates false joins"]),
  researchNode("identity-resolution", "Juror identity resolution", "intake", "Resolve each juror into a high-confidence person record before downstream evidence is trusted.", ["Names", "Addresses", "Age bands", "Public profile hints"], ["Canonical juror profile", "Confidence score", "Ambiguity flags"], ["Common names", "Household member collisions"]),
  researchNode("source-planner", "Source planner", "sources", "Pick public and configured sources by juror and case question.", ["Canonical juror profile", "Case themes"], ["Search plan", "Source queue", "Collection budget"], ["Over-collection", "Missing venue-specific sources"]),
  researchNode("public-records", "Public records sweep", "sources", "Corroborate identity, affiliations, location, and litigation-relevant history.", ["Search plan", "Juror identifiers"], ["Record hits", "Corroborating facts"], ["Stale records", "Name-only false positives"]),
  researchNode("web-social", "Web + social scan", "sources", "Search open web, social profiles, posts, images, affiliations, and issue signals.", ["Search plan", "Alias variants"], ["Posts", "Profiles", "Issue signals"], ["Private accounts", "Context collapse"]),
  researchNode("news-local", "Local news + civic context", "sources", "Map local stories, employers, civic memberships, and venue context.", ["Venue", "Employer/location hints"], ["Local context", "Event references"], ["Weak relevance", "Duplicate syndicated stories"]),
  researchNode("fact-extraction", "Fact extraction", "analysis", "Convert source material into atomic facts with links and juror/entity references.", ["Record hits", "Posts", "Articles"], ["Candidate facts", "Evidence snippets"], ["Unsupported summaries", "Lost source provenance"]),
  researchNode("dedupe-corroborate", "Dedupe + corroborate", "analysis", "Merge duplicate claims while preserving candidates that are useful but not yet confirmed.", ["Candidate facts", "Evidence snippets"], ["Confirmed facts", "Conflict set", "Potential relevant facts", "Source graph"], ["Premature promotion", "Over-merged people"]),
  researchNode("potential-fact-pool", "Potential Relevant Fact Pool", "analysis", "Hold sourced, case-adjacent facts that may matter in box, live questioning, or strike strategy.", ["Candidate facts", "Confirmed facts", "Case themes"], ["Potential relevant facts", "Case tags", "Source-backed snippets"], ["Noisy facts crowding the live lane"]),
  researchNode("box-eligible-leads", "Box-Eligible Leads", "analysis", "Screen the pool into leads worth watching or raising when a juror reaches the box.", ["Potential relevant facts", "Identity confidence", "Voir dire posture"], ["Box-ready leads", "Ask/observe triggers", "Priority"], ["Weak leads promoted too early"]),
  researchNode("opposing-counsel-lens", "Opposing Counsel Lens", "analysis", "Model what OC is likely to value, probe, rehabilitate, or strike against the same juror facts.", ["Case themes", "Potential relevant facts", "OC posture"], ["OC themes", "OC likely questions", "OC pressure points"], ["Assuming OC priorities without courtroom proof"]),
  researchNode("signal-model", "Signal model", "analysis", "Translate confirmed facts, potential leads, and OC pressure into case-relevant risks, strengths, and questions.", ["Confirmed facts", "Potential relevant facts", "Case themes", "OC themes"], ["Risk signals", "Opportunity signals", "Follow-up prompts"], ["Biased weighting", "Unexplained inference"]),
  researchNode("human-review", "Human review gate", "review", "Route high-impact findings, weak evidence, and conflicts through reviewer judgment without blocking live box flow.", ["Risk signals", "Conflict set", "Source graph"], ["Reviewer decisions", "Suppressed facts", "Clarification asks"], ["Reviewer overload", "Insufficient audit trail"]),
  researchNode("backend-box-handoff", "Backend ↔ Box handoff", "review", "Package backend findings into live-safe payloads and define what the box flow sends back.", ["Box-ready leads", "Reviewer decisions", "Source graph"], ["Live payload", "Source anchors", "State update contract"], ["Live UI acting on unsourced or stale backend data"]),
  researchNode("box-live-cockpit", "Box Live Cockpit", "review", "Operational view for in-box jurors, active leads, questions, objections, and team attention.", ["Box-ready leads", "Reviewer decisions", "Live courtroom events"], ["Live watch list", "Raised hands", "Question queue"], ["Live state drifting from source facts"]),
  researchNode("box-live-state", "Box Live State", "review", "Track current panel/box status, lead disposition, question status, and team ownership.", ["Live watch list", "Question queue", "Team notes"], ["Current box state", "Lead outcomes", "Team handoffs"], ["Stale cockpit state"]),
  researchNode("oc-voir-dire-tracker", "OC voir dire / Q&A tracker", "review", "Capture OC questions, juror answers, rehabilitation attempts, and follow-up openings while the box is live.", ["OC likely questions", "Live courtroom events", "Current box state"], ["OC Q&A notes", "OC follow-up openings", "Rehabilitation signals"], ["Losing sequence/context of OC questions"]),
  researchNode("live-feedback-sync", "Live feedback sync", "review", "Return box outcomes, OC answers, raised hands, and strike decisions to backend audit/eval surfaces.", ["Current box state", "OC Q&A notes", "Strike board"], ["Disposition updates", "Answer-backed facts", "Coverage/eval updates"], ["Live outcomes never making it back to backend truth"]),
  researchNode("live-questions", "Live questions / raised hands / OC Q&A", "output", "Surface our question prompts, raised-hand moments, OC questions, OC answers, and answer capture.", ["Question queue", "OC Q&A notes", "Live courtroom events"], ["Ask list", "Raised hands", "OC Q&A notes"], ["Missing context around answers"]),
  researchNode("strike-signals", "Strike Signals", "output", "Separate FACT / LEAD / OURS / OC signals so strike decisions show their evidentiary and adversarial footing.", ["Risk signals", "Opportunity signals", "Lead outcomes", "OC Q&A notes", "OC pressure points"], ["FACT signals", "LEAD signals", "OURS signals", "OC signals"], ["Blending evidence with inference"]),
  researchNode("live-strike-board", "Live Strike Board", "output", "Trial-team board for live strikes, holds, cause questions, and per-juror signal stacks.", ["Current box state", "FACT signals", "LEAD signals", "OURS signals", "OC signals"], ["Strike board", "Cause/keep notes", "Team callouts"], ["Board decisions without source trace"]),
  researchNode("facesheet", "Juror face sheet / report", "output", "Generate a concise sourced artifact with action-oriented trial team notes.", ["Reviewer decisions", "Confirmed facts", "Strike signals"], ["Face sheet", "Report", "Trial team notes"], ["Too much detail", "Missing citations"]),
  researchNode("coverage-eval", "Coverage + quality eval", "output", "Score completeness, source coverage, identity confidence, and evidence quality.", ["Face sheet", "Source graph", "Research scope"], ["Coverage report", "Gaps", "Regression signals"], ["Green checks on stale artifacts"]),
];

const BASE_EDGES: ResearchEdge[] = [
  researchEdge("case-intake", "identity-resolution", "seed"),
  researchEdge("identity-resolution", "source-planner", "profile"),
  researchEdge("case-intake", "source-planner", "case lens"),
  researchEdge("source-planner", "public-records", "queue"),
  researchEdge("source-planner", "web-social", "queue"),
  researchEdge("source-planner", "news-local", "queue"),
  researchEdge("public-records", "fact-extraction", "evidence"),
  researchEdge("web-social", "fact-extraction", "evidence"),
  researchEdge("news-local", "fact-extraction", "context"),
  researchEdge("fact-extraction", "dedupe-corroborate", "candidates"),
  researchEdge("fact-extraction", "potential-fact-pool", "candidate facts"),
  researchEdge("dedupe-corroborate", "potential-fact-pool", "potential"),
  researchEdge("potential-fact-pool", "box-eligible-leads", "screen"),
  researchEdge("potential-fact-pool", "opposing-counsel-lens", "OC lens"),
  researchEdge("case-intake", "opposing-counsel-lens", "case posture"),
  researchEdge("dedupe-corroborate", "signal-model", "confirmed"),
  researchEdge("potential-fact-pool", "signal-model", "case-adjacent"),
  researchEdge("opposing-counsel-lens", "signal-model", "OC pressure"),
  researchEdge("case-intake", "signal-model", "themes"),
  researchEdge("signal-model", "human-review", "triage"),
  researchEdge("dedupe-corroborate", "human-review", "conflicts"),
  researchEdge("box-eligible-leads", "backend-box-handoff", "box-ready"),
  researchEdge("human-review", "backend-box-handoff", "reviewed"),
  researchEdge("backend-box-handoff", "box-live-cockpit", "live payload", true),
  researchEdge("backend-box-handoff", "box-live-state", "state contract", true),
  researchEdge("box-live-cockpit", "box-live-state", "live state", true),
  researchEdge("box-live-cockpit", "live-questions", "questions", true),
  researchEdge("opposing-counsel-lens", "oc-voir-dire-tracker", "OC plan"),
  researchEdge("box-live-state", "oc-voir-dire-tracker", "box sequence", true),
  researchEdge("oc-voir-dire-tracker", "live-questions", "OC Q&A", true),
  researchEdge("box-live-state", "live-feedback-sync", "disposition", true),
  researchEdge("oc-voir-dire-tracker", "live-feedback-sync", "OC answers", true),
  researchEdge("box-live-state", "live-strike-board", "panel state", true),
  researchEdge("signal-model", "strike-signals", "signals"),
  researchEdge("opposing-counsel-lens", "strike-signals", "OC lens"),
  researchEdge("oc-voir-dire-tracker", "strike-signals", "OC answers", true),
  researchEdge("live-questions", "strike-signals", "answers"),
  researchEdge("strike-signals", "live-strike-board", "FACT / LEAD / OURS / OC", true),
  researchEdge("live-strike-board", "live-feedback-sync", "strike decision", true),
  researchEdge("live-feedback-sync", "coverage-eval", "audit loop", true),
  researchEdge("human-review", "facesheet", "approved"),
  researchEdge("strike-signals", "facesheet", "report signals"),
  researchEdge("facesheet", "coverage-eval", "artifact"),
  researchEdge("coverage-eval", "source-planner", "gap loop", true),
];

const LOGICAL_POSITIONS: Record<string, { x: number; y: number }> = {
  "case-intake": { x: 0, y: 360 },
  "identity-resolution": { x: 440, y: 360 },
  "source-planner": { x: 920, y: 360 },
  "public-records": { x: 1430, y: 40 },
  "web-social": { x: 1430, y: 360 },
  "news-local": { x: 1430, y: 680 },
  "fact-extraction": { x: 1980, y: 360 },
  "dedupe-corroborate": { x: 2480, y: 580 },
  "potential-fact-pool": { x: 2480, y: 140 },
  "box-eligible-leads": { x: 2980, y: 140 },
  "opposing-counsel-lens": { x: 2980, y: 860 },
  "signal-model": { x: 2980, y: 580 },
  "human-review": { x: 3480, y: 580 },
  "backend-box-handoff": { x: 3230, y: 320 },
  "box-live-cockpit": { x: 3480, y: 140 },
  "box-live-state": { x: 3980, y: 140 },
  "oc-voir-dire-tracker": { x: 3980, y: 800 },
  "live-feedback-sync": { x: 4480, y: 800 },
  "live-questions": { x: 3980, y: 470 },
  "strike-signals": { x: 4480, y: 470 },
  "live-strike-board": { x: 4480, y: 140 },
  facesheet: { x: 5000, y: 470 },
  "coverage-eval": { x: 5480, y: 470 },
};

const GALAXY_POSITIONS: Record<string, { x: number; y: number }> = {
  "case-intake": { x: 320, y: 410 },
  "identity-resolution": { x: 720, y: 410 },
  "source-planner": { x: 1190, y: 410 },
  "public-records": { x: 1640, y: 90 },
  "web-social": { x: 1740, y: 410 },
  "news-local": { x: 1640, y: 730 },
  "fact-extraction": { x: 2240, y: 410 },
  "dedupe-corroborate": { x: 2700, y: 640 },
  "potential-fact-pool": { x: 2700, y: 170 },
  "box-eligible-leads": { x: 3220, y: 170 },
  "opposing-counsel-lens": { x: 3220, y: 920 },
  "signal-model": { x: 3220, y: 640 },
  "human-review": { x: 3740, y: 640 },
  "backend-box-handoff": { x: 3480, y: 360 },
  "box-live-cockpit": { x: 3740, y: 170 },
  "box-live-state": { x: 4260, y: 170 },
  "oc-voir-dire-tracker": { x: 4260, y: 860 },
  "live-feedback-sync": { x: 4780, y: 860 },
  "live-questions": { x: 4260, y: 520 },
  "strike-signals": { x: 4780, y: 520 },
  "live-strike-board": { x: 4780, y: 170 },
  facesheet: { x: 5320, y: 520 },
  "coverage-eval": { x: 5840, y: 520 },
};

const LOGICAL_ZONE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "backend-zone": { x: -220, y: -1400, width: 3440, height: 5200 },
  "box-zone": { x: 3220, y: -1400, width: 2660, height: 5200 },
  "boundary-zone": { x: 3000, y: -1400, width: 500, height: 5200 },
};

const GALAXY_ZONE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "backend-zone": { x: 140, y: -1400, width: 3520, height: 5400 },
  "box-zone": { x: 3660, y: -1400, width: 2500, height: 5400 },
  "boundary-zone": { x: 3440, y: -1400, width: 500, height: 5400 },
};

const nodeTypes = { research: ResearchFlowNode, zone: ZoneFlowNode };

function researchNode(
  id: string,
  label: string,
  phase: PhaseId,
  summary: string,
  inputs: string[],
  outputs: string[],
  risks: string[],
): ResearchNode {
  return {
    id,
    type: "research",
    position: { x: 0, y: 0 },
    data: { label, phase, summary, inputs, outputs, risks },
  };
}

function zoneNode(id: string, label: string, detail: string, tone: ZoneNodeData["tone"]): ZoneNode {
  return {
    id,
    type: "zone",
    position: { x: 0, y: 0 },
    data: { label, detail, tone },
    draggable: false,
    selectable: false,
    focusable: false,
    deletable: false,
    zIndex: -10,
  };
}

function researchEdge(source: string, target: string, label: string, animated = false): ResearchEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    animated,
    label,
    type: "smoothstep",
    style: {
      stroke: animated ? "#34d399" : "rgba(180, 194, 255, 0.52)",
      strokeWidth: animated ? 2.6 : 2,
      filter: animated ? "drop-shadow(0 0 8px rgba(52, 211, 153, 0.7))" : "drop-shadow(0 0 6px rgba(125, 211, 252, 0.28))",
    },
    labelStyle: {
      fill: "rgba(226, 232, 240, 0.92)",
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
    labelBgStyle: {
      fill: "rgba(3, 7, 18, 0.9)",
      fillOpacity: 0.94,
    },
  };
}

function ResearchFlowNode({ data, selected }: NodeProps<ResearchNode>) {
  const phase = PHASE_BY_ID.get(data.phase);
  const color = phase?.color ?? "#94a3b8";
  return (
    <div
      className={cn(
        "relative h-[104px] w-[228px] overflow-hidden rounded-2xl border px-4 py-3",
        "bg-slate-950/88 text-left shadow-2xl backdrop-blur-md transition-transform duration-150",
        selected && "scale-[1.04]",
      )}
      style={{
        borderColor: color,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 ${selected ? 44 : 26}px ${phase?.ring ?? "rgba(148,163,184,0.25)"}`,
      }}
    >
      <Handle className="!size-2 !border-0" position={Position.Left} style={{ background: color }} type="target" />
      <Handle className="!size-2 !border-0" position={Position.Right} style={{ background: color }} type="source" />
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: `radial-gradient(circle at 18% 12%, ${phase?.ring ?? "rgba(148,163,184,0.24)"}, transparent 46%)` }} />
      <div className="relative flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200/80">
          {phase?.short} · {phase?.label}
        </span>
        <span className="size-2.5 rounded-full shadow-[0_0_16px_currentColor]" style={{ background: color, color }} />
      </div>
      <div className="relative mt-2 text-[15px] font-black leading-tight text-slate-50">{data.label}</div>
      <p className="relative mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-300/82">{data.summary}</p>
    </div>
  );
}

function ZoneFlowNode({ data }: NodeProps<ZoneNode>) {
  const toneClass = {
    backend: "border-sky-200/8 bg-[linear-gradient(90deg,rgba(14,165,233,0.16),rgba(14,165,233,0.06)_70%,rgba(14,165,233,0.015))] text-sky-100/72",
    box: "border-emerald-200/8 bg-[linear-gradient(90deg,rgba(16,185,129,0.015),rgba(16,185,129,0.07)_26%,rgba(16,185,129,0.16))] text-emerald-100/72",
    boundary: "border-amber-200/0 bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.04)_22%,rgba(251,191,36,0.11)_50%,rgba(251,191,36,0.04)_78%,transparent)] text-amber-100/68",
  }[data.tone];
  const labelClass = data.tone === "boundary" ? "left-1/2 top-32 -translate-x-1/2" : data.tone === "backend" ? "left-28 top-28" : "right-28 top-28";

  return (
    <div className={cn("relative h-full w-full rounded-[2rem] border", toneClass)}>
      <div className={cn("absolute rounded-full border border-current/15 bg-black/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] backdrop-blur-[2px]", labelClass)}>
        {data.label}
        <span className="ml-2 text-[9px] font-semibold normal-case tracking-normal opacity-60">{data.detail}</span>
      </div>
    </div>
  );
}

function layoutNodes(nodes: ResearchNode[], mode: ViewMode): ResearchNode[] {
  const positions = mode === "galaxy" ? GALAXY_POSITIONS : LOGICAL_POSITIONS;
  return nodes.map((node) => ({ ...node, position: positions[node.id] ?? node.position }));
}

function layoutZones(nodes: ZoneNode[], mode: ViewMode): ZoneNode[] {
  const positions = mode === "galaxy" ? GALAXY_ZONE_POSITIONS : LOGICAL_ZONE_POSITIONS;
  return nodes.map((node) => {
    const position = positions[node.id];
    return position
      ? {
          ...node,
          position: { x: position.x, y: position.y },
          style: { width: position.width, height: position.height },
        }
      : node;
  });
}

function cloneNodes(): ResearchNode[] {
  return BASE_NODES.map((node) => ({ ...node, data: { ...node.data } }));
}

function cloneZones(): ZoneNode[] {
  return BASE_ZONE_NODES.map((node) => ({ ...node, data: { ...node.data } }));
}

function isResearchNode(node: FlowNode): node is ResearchNode {
  return node.type === "research";
}

function phaseColor(phase: PhaseId): string {
  return PHASE_BY_ID.get(phase)?.color ?? "#94a3b8";
}

function NodeDetails({ node }: { node: ResearchNode }) {
  const phase = PHASE_BY_ID.get(node.data.phase);
  return (
    <aside className="min-h-0 rounded-2xl border border-current/15 bg-background-base/72 p-4 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Badge>{phase?.label ?? node.data.phase}</Badge>
          <h2 className="mt-3 text-lg font-bold leading-tight text-midground">{node.data.label}</h2>
        </div>
        <span aria-hidden="true" className="mt-1 size-3 rounded-full shadow-[0_0_18px_currentColor]" style={{ backgroundColor: phaseColor(node.data.phase), color: phaseColor(node.data.phase) }} />
      </div>
      <p className="mb-4 text-sm leading-6 text-text-secondary">{node.data.summary}</p>
      <DetailList label="Inputs" values={node.data.inputs} />
      <DetailList label="Outputs" values={node.data.outputs} />
      <DetailList label="Watch-outs" values={node.data.risks} tone="risk" />
    </aside>
  );
}

function DetailList({ label, values, tone = "default" }: { label: string; values: string[]; tone?: "default" | "risk" }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">{label}</h3>
      <ul className="space-y-1.5 text-sm text-text-secondary">
        {values.map((value) => (
          <li className="flex gap-2" key={value}>
            <span className={cn("mt-2 size-1.5 rounded-full", tone === "risk" ? "bg-rose-300" : "bg-midground")} />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JurorResearchMapContent() {
  const { setTitle } = usePageHeader();
  const [viewMode, setViewMode] = useState<ViewMode>("logical");
  const [selectedId, setSelectedId] = useState("potential-fact-pool");

  useLayoutEffect(() => {
    setTitle("Juror Research Flow");
    return () => setTitle(null);
  }, [setTitle]);

  const nodes = useMemo<FlowNode[]>(() => [...layoutZones(cloneZones(), viewMode), ...layoutNodes(cloneNodes(), viewMode)], [viewMode]);
  const edges = useMemo(() => BASE_EDGES.map((edge) => ({ ...edge, data: { ...edge.data }, style: { ...edge.style } })), []);
  const selectedNode = nodes.find((node): node is ResearchNode => isResearchNode(node) && node.id === selectedId) ?? nodes.find(isResearchNode);

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col gap-4 p-4 lg:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-current/15 bg-slate-950/72 p-5 shadow-2xl shadow-black/30">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.22),transparent_30%),radial-gradient(circle_at_74%_12%,rgba(167,139,250,0.18),transparent_28%),radial-gradient(circle_at_62%_80%,rgba(52,211,153,0.16),transparent_32%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-text-tertiary">Product logic constellation</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-midground">Juror research flow, from intake to live strike board and OC pressure</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Candidate Facts → Potential Relevant Fact Pool → Backend ↔ Box handoff → Box Live Cockpit → Live Strike Board, with return sync for OC Q&A, strike decisions, and FACT / LEAD / OURS / OC signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" outlined={viewMode !== "logical"} onClick={() => setViewMode("logical")}>Logical flow</Button>
            <Button size="sm" outlined={viewMode !== "galaxy"} onClick={() => setViewMode("galaxy")}>Galaxy view</Button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {PHASES.map((phase) => (
            <span className="inline-flex items-center gap-2 rounded-full border border-current/15 bg-black/25 px-3 py-1.5 text-xs font-semibold text-text-secondary" key={phase.id}>
              <span className="size-2 rounded-full shadow-[0_0_14px_currentColor]" style={{ backgroundColor: phase.color, color: phase.color }} />
              {phase.label}
            </span>
          ))}
        </div>
      </section>

      <div className="grid min-h-[780px] flex-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="relative min-h-[700px] overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#020617] shadow-2xl shadow-black/30">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,64,175,0.24),transparent_42%),linear-gradient(90deg,rgba(34,211,238,0.07)_1px,transparent_1px),linear-gradient(rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:100%_100%,80px_80px,80px_80px]" />
          <div className="pointer-events-none absolute inset-0 opacity-80 [background-image:radial-gradient(circle,rgba(148,220,255,0.42)_1px,transparent_1.4px)] [background-size:38px_38px]" />
          <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-full border border-cyan-200/15 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/80">
            Drag canvas · scroll to zoom · click a node
          </div>
          <ReactFlow
            key={viewMode}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultViewport={viewMode === "galaxy" ? { x: 24, y: 158, zoom: 0.15 } : { x: 24, y: 154, zoom: 0.16 }}
            minZoom={0.1}
            maxZoom={1.4}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(125, 211, 252, 0.18)" gap={46} />
          </ReactFlow>
        </section>

        {selectedNode ? <NodeDetails node={selectedNode} /> : null}
      </div>
    </div>
  );
}

export default function JurorResearchMapPage() {
  return (
    <ReactFlowProvider>
      <JurorResearchMapContent />
    </ReactFlowProvider>
  );
}
