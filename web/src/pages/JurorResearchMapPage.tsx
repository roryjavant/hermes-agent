import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  Background,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import { Badge } from "@nous-research/ui/ui/components/badge";
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
  feedbackTraceActive?: boolean;
  feedbackTraceRoute?: boolean;
}

interface ZoneNodeData extends Record<string, unknown> {
  label: string;
  detail: string;
  tone: "backend" | "box" | "boundary";
}

type ResearchNode = Node<ResearchNodeData, "research">;
type ZoneNode = Node<ZoneNodeData, "zone">;
type FlowNode = ResearchNode | ZoneNode;
interface ResearchEdgeData extends Record<string, unknown> {
  label: string;
  detail: string;
  direction: "forward" | "feedback";
  sourceLabel: string;
  targetLabel: string;
  feedbackTraceActive?: boolean;
  feedbackTraceRoute?: boolean;
  onSelect?: (edgeId: string) => void;
}
type ResearchEdge = Edge<ResearchEdgeData, "research">;
type ViewMode = "logical" | "galaxy";
type PhaseId = "intake" | "sources" | "analysis" | "review" | "output";
type LegendId = PhaseId | "live-loop";

interface PhaseMeta {
  id: PhaseId;
  label: string;
  color: string;
  ring: string;
  short: string;
  detail: string;
  icon: string;
}

const PHASES: PhaseMeta[] = [
  { id: "intake", label: "Intake", short: "01", icon: "ID", color: "#67e8f9", ring: "rgba(103, 232, 249, 0.34)", detail: "Case setup and juror identity grounding before any research is trusted." },
  { id: "sources", label: "Sources", short: "02", icon: "SRC", color: "#a78bfa", ring: "rgba(167, 139, 250, 0.34)", detail: "Public records, web/social, and local context collection lanes." },
  { id: "analysis", label: "Analysis", short: "03", icon: "SIG", color: "#fbbf24", ring: "rgba(251, 191, 36, 0.34)", detail: "Evidence capture, fact extraction, corroboration, PRF enrichment, lead gating, and signal modeling." },
  { id: "review", label: "Review", short: "04", icon: "CHK", color: "#fb7185", ring: "rgba(251, 113, 133, 0.34)", detail: "Human judgment and live-box handoff checks before signals become operational." },
  { id: "output", label: "Output", short: "05", icon: "OUT", color: "#34d399", ring: "rgba(52, 211, 153, 0.34)", detail: "Live questions, strike signals, strike board, courtroom decision posture, facesheet, and coverage evaluation." },
];

const LIVE_LOOP_LEGEND = {
  id: "live-loop" as const,
  label: "Live loop",
  icon: "LOOP",
  detail: "Dashed green connections carry live courtroom outcomes back into audit, coverage, and downstream decision surfaces.",
};

const PHASE_BY_ID = new Map(PHASES.map((phase) => [phase.id, phase]));
const BASE_ZONE_NODES: ZoneNode[] = [
  zoneNode("backend-zone", "Backend evidence / research system", "Research jobs, captured evidence, facts, PRF, lead gating", "backend"),
  zoneNode("box-zone", "Box flow / live trial system", "Box state, OC Q&A, live questions, strike board, courtroom decisions", "box"),
  zoneNode("boundary-zone", "Interface boundary", "Source anchors → live payload · feedback sync → audit/eval", "boundary"),
];

const BASE_NODES: ResearchNode[] = [
  researchNode("case-intake", "Case + venire intake", "intake", "Matter setup, venire rows, case posture, parties, venue, dates, geography, and research constraints.", ["Case file", "Juror list", "Court / venue context"], ["Case record", "Venire records", "Research scope", "Known entities"], ["Bad seed data creates false joins"]),
  researchNode("identity-resolution", "Juror identity resolution", "intake", "Resolve each juror into a high-confidence person record before downstream evidence is trusted.", ["Names", "Addresses", "Age bands", "Public profile hints"], ["Canonical juror profile", "Confidence score", "Ambiguity flags"], ["Common names", "Household member collisions"]),
  researchNode("source-planner", "Research job + query planner", "sources", "Claim the juror research job, hydrate state, and plan bounded searches from identity, case themes, and prior findings.", ["Canonical juror profile", "Case themes", "Pipeline settings"], ["Search plan", "Source queue", "Collection budget", "Persisted job state"], ["Over-collection", "Missing venue-specific sources", "Stale resumed state"]),
  researchNode("public-records", "Public records sweep", "sources", "Corroborate identity, affiliations, location, property, business, litigation, and other public-record context.", ["Search plan", "Juror identifiers"], ["Record hits", "Corroborating facts"], ["Stale records", "Name-only false positives"]),
  researchNode("web-social", "Web + social scan", "sources", "Search open web, social profiles, posts, images, affiliations, and issue signals.", ["Search plan", "Alias variants"], ["Posts", "Profiles", "Issue signals", "Profile images"], ["Private accounts", "Context collapse"]),
  researchNode("news-local", "Local news + civic context", "sources", "Map local stories, employers, civic memberships, organizations, schools, and venue context.", ["Venue", "Employer/location hints"], ["Local context", "Event references"], ["Weak relevance", "Duplicate syndicated stories"]),
  researchNode("evidence-capture", "Evidence capture", "analysis", "Persist source artifacts, screenshots, page text, profile image evidence, and capture summaries before facts are trusted downstream.", ["Accepted links", "Capture targets", "Source pages"], ["Evidence artifacts", "Captured page text", "Source anchors"], ["Capture login failures", "Lost source provenance"]),
  researchNode("fact-extraction", "Candidate fact extraction", "analysis", "Convert captured evidence and analyzed sources into atomic candidate facts with source links and subject scope.", ["Evidence artifacts", "Record hits", "Posts", "Articles"], ["Candidate facts", "Evidence snippets", "Subject scope"], ["Unsupported summaries", "Spouse/household facts misattributed to juror"]),
  researchNode("dedupe-corroborate", "Dedupe + corroborate", "analysis", "Merge duplicate claims, expose conflicts, and promote only facts that satisfy confidence/review rules.", ["Candidate facts", "Evidence snippets"], ["Confirmed facts", "Conflict set", "Candidate fact set", "Source graph"], ["Premature promotion", "Over-merged people"]),
  researchNode("potential-fact-pool", "Potential Relevant Fact Pool", "analysis", "Retain sourced, non-asserted case-adjacent facts with provenance, subject scope, identity confidence, caveats, and optional enrichment.", ["Candidate facts", "Confirmed facts", "Case themes"], ["potential_relevance_fact_pool", "Enrichment payload", "Source-backed snippets"], ["Noisy facts crowding the live lane", "Weak identity treated as certainty"]),
  researchNode("box-eligible-leads", "Box-Eligible Leads", "analysis", "Load the latest PRF/enrichment per juror and classify courtroom-safe leads as ask-now, ask-if-time, conditional, needs-confirmation, audit-only, or suppress.", ["Potential relevant facts", "Identity confidence", "Voir dire posture"], ["Box-ready leads", "Ask/observe triggers", "Suppressed clutter", "Priority"], ["Weak leads promoted too early", "Wrong-subject facts shown as juror facts"]),
  researchNode("opposing-counsel-lens", "Opposing Counsel Lens", "analysis", "Model what OC is likely to value, probe, rehabilitate, or strike against the same juror facts.", ["Case themes", "Potential relevant facts", "OC posture"], ["OC themes", "OC likely questions", "OC pressure points"], ["Assuming OC priorities without courtroom proof"]),
  researchNode("signal-model", "Signal model", "analysis", "Translate confirmed facts, potential leads, and OC pressure into case-relevant risks, strengths, and questions.", ["Confirmed facts", "Potential relevant facts", "Case themes", "OC themes"], ["Risk signals", "Opportunity signals", "Follow-up prompts"], ["Biased weighting", "Unexplained inference"]),
  researchNode("human-review", "Human review gate", "review", "Route high-impact findings, weak evidence, and conflicts through reviewer judgment without blocking live box flow.", ["Risk signals", "Conflict set", "Source graph"], ["Reviewer decisions", "Suppressed facts", "Clarification asks"], ["Reviewer overload", "Insufficient audit trail"]),
  researchNode("backend-box-handoff", "Backend ↔ Box handoff", "review", "Package jury-box data, confirmed facts, PRF leads, live state, seats, and source anchors into the live-safe Box payload.", ["Box-ready leads", "Reviewer decisions", "Source graph"], ["Live payload", "Source anchors", "State update contract"], ["Live UI acting on unsourced or stale backend data"]),
  researchNode("box-live-cockpit", "Box Live Cockpit", "review", "Operator surface for in-box jurors, active leads, current question, addressed seats, scratchpad, notes, Q&A, and team attention.", ["Box-ready leads", "Reviewer decisions", "Live courtroom events"], ["Live watch list", "Raised hands", "Question queue", "Scratchpad context"], ["Live state drifting from source facts"]),
  researchNode("operator-notes", "Operator notes", "review", "Freeform live notes, observed demeanor, answer fragments, and team callouts captured by the operator.", ["Live courtroom events", "Box Live Cockpit", "OC Q&A"], ["Timestamped notes", "Answer fragments", "Team callouts"], ["Notes not linked back to juror/source context"]),
  researchNode("box-live-state", "Box Live State", "review", "Persist current panel/box status, lead disposition, question status, addressed seats, answer links, and team ownership.", ["Live watch list", "Question queue", "Team notes"], ["Current box state", "Lead outcomes", "Team handoffs", "Live answer envelope"], ["Stale cockpit state"]),
  researchNode("oc-voir-dire-tracker", "OC voir dire / Q&A tracker", "review", "Capture OC questions, juror answers, rehabilitation attempts, and follow-up openings while the box is live.", ["OC likely questions", "Live courtroom events", "Current box state"], ["OC Q&A notes", "OC follow-up openings", "Rehabilitation signals"], ["Losing sequence/context of OC questions"]),
  researchNode("live-feedback-sync", "Live feedback sync", "review", "Return Box outcomes, OC answers, raised hands, lead dispositions, and strike decisions to backend audit/eval surfaces.", ["Current box state", "OC Q&A notes", "Strike board", "Courtroom decisions"], ["Disposition updates", "Answer-backed facts", "Coverage/eval updates", "Research gaps"], ["Live outcomes never making it back to backend truth"]),
  researchNode("live-questions", "Live questions / raised hands / OC Q&A", "output", "Surface our question prompts, raised-hand moments, OC questions, OC answers, and answer capture.", ["Question queue", "OC Q&A notes", "Live courtroom events"], ["Ask list", "Raised hands", "OC Q&A notes"], ["Missing context around answers"]),
  researchNode("strike-signals", "Strike Signals", "output", "Separate FACT / LEAD / OURS / OC signals so strike decisions show their evidentiary and adversarial footing.", ["Risk signals", "Opportunity signals", "Lead outcomes", "OC Q&A notes", "OC pressure points"], ["FACT signals", "LEAD signals", "OURS signals", "OC signals"], ["Blending evidence with inference"]),
  researchNode("live-strike-board", "Live Strike Board", "output", "Trial-team board for live strikes, holds, cause questions, and per-juror signal stacks.", ["Current box state", "FACT signals", "LEAD signals", "OURS signals", "OC signals"], ["Strike board", "Cause/keep notes", "Team callouts", "Decision posture"], ["Board decisions without source trace"]),
  researchNode("courtroom-decisions", "Courtroom Decisions", "output", "Turn sourced research, live answers, strike budgets, and board movement into the next trial action.", ["Strike board", "Current box state", "FACT / LEAD / OURS / OC signals", "Cause and peremptory posture"], ["Accept / keep", "Question", "Cause challenge", "Peremptory strike", "Avoid", "Research-needed flag"], ["Treating PRF or live answers as newly confirmed facts", "Losing source trace behind action posture"]),
  researchNode("facesheet", "Juror face sheet / report", "output", "Generate a concise sourced artifact with action-oriented trial team notes.", ["Reviewer decisions", "Confirmed facts", "Strike signals"], ["Face sheet", "Report", "Trial team notes"], ["Too much detail", "Missing citations"]),
  researchNode("coverage-eval", "Coverage + quality eval", "output", "Score completeness, source coverage, identity confidence, evidence quality, PRF-to-Box coverage, and live-loop gaps.", ["Face sheet", "Source graph", "Research scope", "Live feedback"], ["Coverage report", "Gaps", "Regression signals", "New research targets"], ["Green checks on stale artifacts"]),
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
  researchEdge("public-records", "evidence-capture", "accepted source"),
  researchEdge("web-social", "evidence-capture", "profile/source artifact"),
  researchEdge("news-local", "evidence-capture", "local source artifact"),
  researchEdge("evidence-capture", "fact-extraction", "captured evidence"),
  researchEdge("fact-extraction", "dedupe-corroborate", "candidate facts"),
  researchEdge("fact-extraction", "potential-fact-pool", "candidate facts"),
  researchEdge("dedupe-corroborate", "potential-fact-pool", "potential"),
  researchEdge("potential-fact-pool", "box-eligible-leads", "screen"),
  researchEdge("potential-fact-pool", "signal-model", "case-adjacent"),
  researchEdge("opposing-counsel-lens", "signal-model", "OC pressure"),
  researchEdge("signal-model", "human-review", "triage"),
  researchEdge("dedupe-corroborate", "human-review", "conflicts"),
  researchEdge("box-eligible-leads", "backend-box-handoff", "box-ready"),
  researchEdge("box-eligible-leads", "box-live-cockpit", "active leads", true),
  researchEdge("human-review", "backend-box-handoff", "reviewed"),
  researchEdge("backend-box-handoff", "box-live-cockpit", "live payload", true),
  researchEdge("backend-box-handoff", "box-live-state", "state contract", true),
  researchEdge("box-live-cockpit", "box-live-state", "live state", true),
  researchEdge("box-live-cockpit", "live-questions", "questions", true),
  researchEdge("box-live-cockpit", "operator-notes", "operator observes", true),
  researchEdge("operator-notes", "box-live-state", "note updates", true),
  researchEdge("operator-notes", "strike-signals", "observed signals", true),
  researchEdge("operator-notes", "live-feedback-sync", "notes sync", true),
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
  researchEdge("live-strike-board", "courtroom-decisions", "action posture", true),
  researchEdge("courtroom-decisions", "live-feedback-sync", "decision sync", true),
  researchEdge("courtroom-decisions", "facesheet", "trial action notes"),
  researchEdge("live-feedback-sync", "coverage-eval", "audit loop", true),
  researchEdge("human-review", "facesheet", "approved"),
  researchEdge("strike-signals", "facesheet", "report signals"),
  researchEdge("facesheet", "coverage-eval", "artifact"),
  researchEdge("coverage-eval", "source-planner", "gap loop", true),
];

const FEEDBACK_TRACE_EDGE_IDS = new Set([
  "box-live-cockpit-live-questions",
  "operator-notes-box-live-state",
  "operator-notes-strike-signals",
  "operator-notes-live-feedback-sync",
  "box-live-state-oc-voir-dire-tracker",
  "oc-voir-dire-tracker-live-questions",
  "box-live-state-live-feedback-sync",
  "oc-voir-dire-tracker-live-feedback-sync",
  "oc-voir-dire-tracker-strike-signals",
  "live-questions-strike-signals",
  "strike-signals-live-strike-board",
  "live-strike-board-courtroom-decisions",
  "courtroom-decisions-live-feedback-sync",
  "live-feedback-sync-coverage-eval",
  "coverage-eval-source-planner",
]);

const FEEDBACK_TRACE_NODE_IDS = new Set([
  "source-planner",
  "box-live-cockpit",
  "operator-notes",
  "box-live-state",
  "oc-voir-dire-tracker",
  "live-questions",
  "strike-signals",
  "live-strike-board",
  "courtroom-decisions",
  "live-feedback-sync",
  "coverage-eval",
]);

const VISIBLE_EDGE_CHIP_IDS = new Set([
  "source-planner-web-social",
  "web-social-evidence-capture",
  "evidence-capture-fact-extraction",
  "fact-extraction-potential-fact-pool",
  "potential-fact-pool-box-eligible-leads",
  "box-eligible-leads-backend-box-handoff",
  "backend-box-handoff-box-live-cockpit",
  "box-live-cockpit-box-live-state",
  "box-live-cockpit-live-questions",
  "live-questions-strike-signals",
  "strike-signals-live-strike-board",
  "live-strike-board-courtroom-decisions",
  "courtroom-decisions-live-feedback-sync",
  "live-feedback-sync-coverage-eval",
  "coverage-eval-source-planner",
]);

type EdgeChipSegment = "source" | "middle" | "target" | "label";
type EdgeChipPlacement = { segment: EdgeChipSegment; t: number; dx?: number; dy?: number };

const EDGE_CHIP_PLACEMENTS: Record<string, EdgeChipPlacement> = {
  "source-planner-web-social": { segment: "middle", t: 0.5, dy: -46 },
  "web-social-evidence-capture": { segment: "middle", t: 0.5, dy: -46 },
  "evidence-capture-fact-extraction": { segment: "middle", t: 0.5, dy: -46 },
  "fact-extraction-potential-fact-pool": { segment: "middle", t: 0.5, dy: -46 },
  "potential-fact-pool-box-eligible-leads": { segment: "middle", t: 0.5, dy: -46 },
  "box-eligible-leads-backend-box-handoff": { segment: "middle", t: 0.5, dy: -46 },
  "backend-box-handoff-box-live-cockpit": { segment: "middle", t: 0.5, dy: -46 },
  "box-live-cockpit-box-live-state": { segment: "middle", t: 0.5, dy: -46 },
  "box-live-cockpit-live-questions": { segment: "middle", t: 0.5, dy: 52 },
  "operator-notes-box-live-state": { segment: "middle", t: 0.5, dx: -140, dy: 70 },
  "operator-notes-strike-signals": { segment: "middle", t: 0.5, dx: -110, dy: 132 },
  "operator-notes-live-feedback-sync": { segment: "middle", t: 0.5, dx: -260, dy: 340 },
  "box-live-state-oc-voir-dire-tracker": { segment: "middle", t: 0.5, dx: 250, dy: 52 },
  "oc-voir-dire-tracker-live-questions": { segment: "middle", t: 0.5, dx: 106, dy: 30 },
  "box-live-state-live-feedback-sync": { segment: "middle", t: 0.5, dx: -86, dy: 132 },
  "oc-voir-dire-tracker-live-feedback-sync": { segment: "middle", t: 0.5, dx: 88, dy: 130 },
  "oc-voir-dire-tracker-strike-signals": { segment: "middle", t: 0.5, dx: 96, dy: 84 },
  "live-questions-strike-signals": { segment: "middle", t: 0.5, dy: -46 },
  "strike-signals-live-strike-board": { segment: "middle", t: 0.5, dy: -52 },
  "live-strike-board-courtroom-decisions": { segment: "middle", t: 0.5, dy: -46 },
  "courtroom-decisions-live-feedback-sync": { segment: "middle", t: 0.5, dx: 58 },
  "live-feedback-sync-coverage-eval": { segment: "middle", t: 0.5, dy: 58 },
  "coverage-eval-source-planner": { segment: "label", t: 0.5, dy: 60 },
};

const LOGICAL_POSITIONS: Record<string, { x: number; y: number }> = {
  "case-intake": { x: 0, y: 360 },
  "identity-resolution": { x: 430, y: 360 },
  "source-planner": { x: 880, y: 360 },
  "public-records": { x: 1380, y: 40 },
  "web-social": { x: 1380, y: 360 },
  "news-local": { x: 1380, y: 680 },
  "evidence-capture": { x: 1900, y: 360 },
  "fact-extraction": { x: 2400, y: 360 },
  "dedupe-corroborate": { x: 2920, y: 650 },
  "potential-fact-pool": { x: 2920, y: 80 },
  "box-eligible-leads": { x: 3440, y: 80 },
  "opposing-counsel-lens": { x: 3440, y: 950 },
  "signal-model": { x: 3440, y: 430 },
  "human-review": { x: 3960, y: 650 },
  "backend-box-handoff": { x: 3960, y: 360 },
  "box-live-cockpit": { x: 4480, y: 80 },
  "operator-notes": { x: 4480, y: 500 },
  "box-live-state": { x: 5000, y: 80 },
  "live-questions": { x: 5000, y: 500 },
  "oc-voir-dire-tracker": { x: 5000, y: 950 },
  "live-strike-board": { x: 5520, y: 80 },
  "strike-signals": { x: 5520, y: 500 },
  "live-feedback-sync": { x: 5520, y: 950 },
  "courtroom-decisions": { x: 6040, y: 80 },
  facesheet: { x: 6040, y: 500 },
  "coverage-eval": { x: 6560, y: 500 },
};

const GALAXY_POSITIONS: Record<string, { x: number; y: number }> = {
  "case-intake": { x: 280, y: 430 },
  "identity-resolution": { x: 700, y: 430 },
  "source-planner": { x: 1160, y: 430 },
  "public-records": { x: 1620, y: 100 },
  "web-social": { x: 1700, y: 430 },
  "news-local": { x: 1620, y: 760 },
  "evidence-capture": { x: 2160, y: 430 },
  "fact-extraction": { x: 2680, y: 430 },
  "dedupe-corroborate": { x: 3220, y: 720 },
  "potential-fact-pool": { x: 3220, y: 150 },
  "box-eligible-leads": { x: 3760, y: 150 },
  "opposing-counsel-lens": { x: 3760, y: 1020 },
  "signal-model": { x: 3760, y: 430 },
  "human-review": { x: 4300, y: 720 },
  "backend-box-handoff": { x: 4300, y: 430 },
  "box-live-cockpit": { x: 4840, y: 150 },
  "operator-notes": { x: 4840, y: 580 },
  "box-live-state": { x: 5380, y: 150 },
  "live-questions": { x: 5380, y: 580 },
  "oc-voir-dire-tracker": { x: 5380, y: 1020 },
  "live-strike-board": { x: 5920, y: 150 },
  "strike-signals": { x: 5920, y: 580 },
  "live-feedback-sync": { x: 5920, y: 1020 },
  "courtroom-decisions": { x: 6460, y: 150 },
  facesheet: { x: 6460, y: 580 },
  "coverage-eval": { x: 7000, y: 580 },
};

const LOGICAL_ZONE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "backend-zone": { x: -260, y: -1600, width: 4020, height: 5600 },
  "box-zone": { x: 3760, y: -1600, width: 3160, height: 5600 },
  "boundary-zone": { x: 3600, y: -1600, width: 520, height: 5600 },
};

const GALAXY_ZONE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "backend-zone": { x: 80, y: -1600, width: 3940, height: 5800 },
  "box-zone": { x: 4020, y: -1600, width: 3260, height: 5800 },
  "boundary-zone": { x: 3820, y: -1600, width: 520, height: 5800 },
};

const nodeTypes = { research: ResearchFlowNode, zone: ZoneFlowNode };
const edgeTypes = { research: ResearchFlowEdge };
const RESEARCH_NODE_WIDTH = 268;
const RESEARCH_NODE_HEIGHT = 128;
const NODE_CLICK_DETAIL_ZOOM = 1;

function edgeChipPoint(id: string, sourceX: number, sourceY: number, targetX: number, targetY: number, labelX: number, labelY: number): { x: number; y: number } {
  const placement = EDGE_CHIP_PLACEMENTS[id] ?? { segment: "middle", t: 0.5 };
  const t = Math.min(0.92, Math.max(0.08, placement.t));
  const centerX = sourceX + (targetX - sourceX) / 2;
  const offsetX = placement.dx ?? 0;
  const offsetY = placement.dy ?? 0;

  if (placement.segment === "label") {
    return { x: labelX + offsetX, y: labelY + offsetY };
  }

  if (placement.segment === "source") {
    return { x: sourceX + (centerX - sourceX) * t + offsetX, y: sourceY + offsetY };
  }

  if (placement.segment === "target") {
    return { x: centerX + (targetX - centerX) * t + offsetX, y: targetY + offsetY };
  }

  return { x: centerX + offsetX, y: sourceY + (targetY - sourceY) * t + offsetY };
}

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
  const sourceLabel = BASE_NODES.find((node) => node.id === source)?.data.label ?? source;
  const targetLabel = BASE_NODES.find((node) => node.id === target)?.data.label ?? target;
  const isDedupeToPotentialPool = source === "dedupe-corroborate" && target === "potential-fact-pool";
  const isOcLensToSignalModel = source === "opposing-counsel-lens" && target === "signal-model";
  const isCockpitToOperatorNotes = source === "box-live-cockpit" && target === "operator-notes";
  const isFeedback = animated || source === "coverage-eval" || source === "live-feedback-sync" || target === "live-feedback-sync";
  const upwardHandoff = isDedupeToPotentialPool || isOcLensToSignalModel;
  const shouldShowArrowhead = true;
  const markerColor = isFeedback ? "#34d399" : "#b4c2ff";
  return {
    id: `${source}-${target}`,
    type: "research",
    source,
    sourceHandle: isCockpitToOperatorNotes ? "bottom-source" : upwardHandoff ? "top-source" : undefined,
    target,
    targetHandle: isCockpitToOperatorNotes ? "top-target" : upwardHandoff ? "bottom-target" : undefined,
    animated,
    markerEnd: shouldShowArrowhead
      ? {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          height: 20,
          width: 20,
        }
      : undefined,
    data: {
      label,
      direction: isFeedback ? "feedback" : "forward",
      sourceLabel,
      targetLabel,
      detail: `${sourceLabel} sends “${label}” into ${targetLabel}. Click the connected nodes to see the source and destination responsibilities, inputs, outputs, and watch-outs.`,
    },
    style: {
      stroke: isFeedback ? "#34d399" : "rgba(180, 194, 255, 0.52)",
      strokeWidth: animated ? 2.6 : 2,
      strokeDasharray: isFeedback ? "8 8" : undefined,
      filter: isFeedback ? "drop-shadow(0 0 8px rgba(52, 211, 153, 0.7))" : "drop-shadow(0 0 6px rgba(125, 211, 252, 0.28))",
    },
  };
}

function ResearchFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps<ResearchEdge>) {
  const [smoothEdgePath, smoothLabelX, smoothLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const isDedupeConflictReviewEdge = id === "dedupe-corroborate-human-review";
  const conflictLaneY = Math.max(sourceY, targetY) + 120;
  const conflictSourceDoglegX = sourceX + 120;
  const conflictTargetDoglegX = targetX - 120;
  const edgePath = isDedupeConflictReviewEdge
    ? `M ${sourceX},${sourceY} L ${conflictSourceDoglegX},${sourceY} L ${conflictSourceDoglegX},${conflictLaneY} L ${conflictTargetDoglegX},${conflictLaneY} L ${conflictTargetDoglegX},${targetY} L ${targetX},${targetY}`
    : smoothEdgePath;
  const labelX = isDedupeConflictReviewEdge ? (conflictSourceDoglegX + conflictTargetDoglegX) / 2 : smoothLabelX;
  const labelY = isDedupeConflictReviewEdge ? conflictLaneY : smoothLabelY;
  const feedbackTraceActive = Boolean(data?.feedbackTraceActive);
  const feedbackTraceRoute = Boolean(data?.feedbackTraceRoute);
  const visibleStyle = feedbackTraceActive
    ? feedbackTraceRoute
      ? {
          ...style,
          animation: "none",
          filter: "drop-shadow(0 0 14px rgba(248, 113, 113, 0.95))",
          opacity: 1,
          stroke: "#ef4444",
          strokeDasharray: "none",
          strokeWidth: selected ? 5 : 4.2,
        }
      : {
          ...style,
          animation: "none",
          filter: "none",
          opacity: 0.14,
          stroke: "rgba(148, 163, 184, 0.28)",
          strokeDasharray: "none",
          strokeWidth: 1.2,
        }
    : selected
      ? { ...style, stroke: "#e0f2fe", strokeWidth: 3.4, filter: "drop-shadow(0 0 12px rgba(125, 211, 252, 0.85))" }
      : style;
  const selectEdge = () => data?.onSelect?.(id);
  const chipPoint = edgeChipPoint(id, sourceX, sourceY, targetX, targetY, labelX, labelY);
  const directionGlyph = data?.direction === "feedback" ? "↺" : "→";
  const shouldShowChip = selected || (feedbackTraceActive && feedbackTraceRoute) || VISIBLE_EDGE_CHIP_IDS.has(id);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={visibleStyle} />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: "pointer", pointerEvents: "stroke" }}
        onClick={(event) => {
          event.stopPropagation();
          selectEdge();
        }}
      />
      {shouldShowChip ? (
        <EdgeLabelRenderer>
        <button
          type="button"
          className={cn(
            "nodrag nopan pointer-events-auto absolute inline-flex max-w-[11.75rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase leading-none tracking-[0.12em] shadow-lg backdrop-blur-md transition-colors",
            feedbackTraceActive && feedbackTraceRoute
              ? "border-red-200/70 bg-red-500 text-white shadow-[0_0_16px_rgba(248,113,113,0.7)]"
              : feedbackTraceActive
                ? "border-slate-500/10 bg-slate-950/35 text-slate-500 opacity-35"
                : selected
              ? "border-midground bg-midground text-background-base"
              : data?.direction === "feedback"
                ? "border-emerald-200/25 bg-emerald-950/85 text-emerald-100 hover:border-emerald-200/60 hover:text-emerald-50"
                : "border-white/10 bg-black/85 text-slate-100 hover:border-midground/70 hover:text-midground",
          )}
          style={{ transform: `translate(-50%, -50%) translate(${chipPoint.x}px, ${chipPoint.y}px)`, zIndex: selected ? 80 : 60 }}
          onClick={(event) => {
            event.stopPropagation();
            selectEdge();
          }}
          aria-label={`${selected ? "Hide" : "Show"} details for ${data?.label ?? "flow"} connection`}
          title={data?.detail ?? data?.label ?? "flow"}
        >
          <span aria-hidden="true" className="text-[10px] leading-none opacity-80">{directionGlyph}</span>
          <span className="truncate">{data?.label ?? "flow"}</span>
        </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function nodeRoleIcon(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("intake") || normalized.includes("identity")) return "ID";
  if (normalized.includes("source") || normalized.includes("records") || normalized.includes("web") || normalized.includes("news")) return "SRC";
  if (normalized.includes("fact") || normalized.includes("dedupe")) return "FACT";
  if (normalized.includes("signal") || normalized.includes("strike")) return "SIG";
  if (normalized.includes("review") || normalized.includes("handoff")) return "CHK";
  if (normalized.includes("box") || normalized.includes("cockpit") || normalized.includes("state")) return "BOX";
  if (normalized.includes("notes") || normalized.includes("q&a") || normalized.includes("questions")) return "QA";
  if (normalized.includes("decision") || normalized.includes("action")) return "ACT";
  if (normalized.includes("face") || normalized.includes("report")) return "RPT";
  if (normalized.includes("coverage") || normalized.includes("eval")) return "EVAL";
  return "FLOW";
}

function ResearchFlowNode({ data, selected }: NodeProps<ResearchNode>) {
  const phase = PHASE_BY_ID.get(data.phase);
  const color = phase?.color ?? "#94a3b8";
  const roleIcon = nodeRoleIcon(data.label);
  const feedbackTraceDimmed = Boolean(data.feedbackTraceActive && !data.feedbackTraceRoute);
  const feedbackTraceRoute = Boolean(data.feedbackTraceActive && data.feedbackTraceRoute);
  return (
    <div
      className={cn(
        "group relative h-32 w-[268px] overflow-hidden rounded-[1.35rem] border px-3.5 py-3",
        "bg-[linear-gradient(145deg,rgba(15,23,42,0.97),rgba(3,7,18,0.92)_58%,rgba(2,6,23,0.97))] text-left shadow-2xl backdrop-blur-xl transition-transform duration-150",
        feedbackTraceDimmed && "opacity-35 saturate-50",
        feedbackTraceRoute && "scale-[1.03]",
        selected && "scale-[1.04]",
      )}
      style={{
        borderColor: feedbackTraceRoute ? "#ef4444" : `${color}cc`,
        boxShadow: feedbackTraceRoute
          ? "0 0 0 1px rgba(255,255,255,0.1) inset, 0 20px 42px rgba(0,0,0,0.36), 0 0 54px rgba(248,113,113,0.9)"
          : `0 0 0 1px rgba(255,255,255,0.1) inset, 0 18px 36px rgba(0,0,0,0.38), 0 0 ${selected ? 48 : 24}px ${phase?.ring ?? "rgba(148,163,184,0.25)"}`,
      }}
    >
      <Handle className="!size-2 !border-0" position={Position.Left} style={{ background: color }} type="target" />
      <Handle className="!size-2 !border-0" position={Position.Right} style={{ background: color }} type="source" />
      <Handle className="!size-2 !border-0" id="top-source" position={Position.Top} style={{ background: color }} type="source" />
      <Handle className="!size-2 !border-0" id="top-target" position={Position.Top} style={{ background: color }} type="target" />
      <Handle className="!size-2 !border-0" id="bottom-source" position={Position.Bottom} style={{ background: color }} type="source" />
      <Handle className="!size-2 !border-0" id="bottom-target" position={Position.Bottom} style={{ background: color }} type="target" />
      <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: `radial-gradient(circle at 16% 4%, ${phase?.ring ?? "rgba(148,163,184,0.24)"}, transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.08), transparent 34%)` }} />
      <div className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full blur-2xl opacity-22" style={{ backgroundColor: color }} />
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-8 bg-gradient-to-t from-slate-950/88 to-transparent" />
      <div className="relative flex items-center justify-between gap-3">
        <span className="max-w-[10.5rem] truncate rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-200/78">
          {phase?.short} · {phase?.label}
        </span>
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full border text-[8px] font-black leading-none shadow-[0_0_14px_currentColor]"
          style={{ borderColor: color, color: feedbackTraceRoute ? "#ef4444" : color, background: "rgba(2,6,23,0.72)" }}
          title={`${data.label} role`}
        >
          {roleIcon}
        </span>
      </div>
      <div className="relative mt-2 min-h-[1.15rem] truncate text-[15px] font-black leading-[1.12] tracking-[-0.015em] text-slate-50">{data.label}</div>
      <p className="relative mt-1.5 line-clamp-2 text-[10px] font-medium leading-[1.25] text-slate-300/78">{data.summary}</p>
    </div>
  );
}

function ZoneFlowNode({ data }: NodeProps<ZoneNode>) {
  const toneClass = {
    backend: "border-sky-200/10 bg-[radial-gradient(circle_at_22%_22%,rgba(103,232,249,0.075),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.28),rgba(2,6,23,0.08)_68%,transparent)] text-sky-100/72",
    box: "border-emerald-200/10 bg-[radial-gradient(circle_at_78%_24%,rgba(52,211,153,0.075),transparent_34%),linear-gradient(135deg,transparent,rgba(2,6,23,0.08)_34%,rgba(6,78,59,0.18))] text-emerald-100/72",
    boundary: "border-amber-200/0 bg-[linear-gradient(90deg,transparent,rgba(251,191,36,0.035)_44%,rgba(251,191,36,0.14)_50%,rgba(251,191,36,0.035)_56%,transparent)] text-amber-100/68",
  }[data.tone];
  const labelClass = data.tone === "boundary" ? "left-1/2 top-32 -translate-x-1/2" : data.tone === "backend" ? "left-28 top-28" : "right-28 top-28";

  return (
    <div className={cn("relative h-full w-full rounded-[2rem] border backdrop-blur-[1px]", toneClass)}>
      <div className="pointer-events-none absolute inset-8 rounded-[1.75rem] border border-white/[0.035]" />
      <div className={cn("absolute rounded-full border border-current/15 bg-slate-950/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] backdrop-blur-sm", labelClass)}>
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

function NodeDetails({ node, onCollapse }: { node: ResearchNode; onCollapse: () => void }) {
  const phase = PHASE_BY_ID.get(node.data.phase);
  return (
    <aside className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-current/15 bg-background-base/72 p-4 shadow-2xl shadow-black/30 backdrop-blur xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Badge className="max-w-full truncate">{phase?.label ?? node.data.phase}</Badge>
          <h2 className="mt-3 text-lg font-bold leading-tight text-midground">{node.data.label}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span aria-hidden="true" className="size-3 rounded-full shadow-[0_0_18px_currentColor]" style={{ backgroundColor: phaseColor(node.data.phase), color: phaseColor(node.data.phase) }} />
          <button
            type="button"
            onClick={onCollapse}
            className="grid size-8 place-items-center rounded-full border border-current/15 bg-black/20 text-sm font-black leading-none text-text-tertiary transition-colors hover:border-current/30 hover:text-midground"
            aria-label="Collapse details pane"
            title="Collapse details pane"
          >
            ×
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm leading-6 text-text-secondary">{node.data.summary}</p>
      <DetailList label="Inputs" values={node.data.inputs} />
      <DetailList label="Outputs" values={node.data.outputs} />
      <DetailList label="Watch-outs" values={node.data.risks} tone="risk" />
    </aside>
  );
}

function CollapsedDetailsRail({ node, onExpand }: { node: ResearchNode; onExpand: () => void }) {
  const phase = PHASE_BY_ID.get(node.data.phase);
  return (
    <aside className="hidden min-h-0 rounded-2xl border border-current/15 bg-background-base/72 p-2 shadow-2xl shadow-black/30 backdrop-blur xl:sticky xl:top-4 xl:flex xl:h-[calc(100dvh-7rem)] xl:flex-col xl:items-center xl:gap-3">
      <button
        type="button"
        onClick={onExpand}
        className="grid size-9 place-items-center rounded-full border border-current/20 bg-black/25 text-base font-black leading-none text-midground transition-colors hover:border-current/35 hover:bg-black/35"
        aria-label="Expand details pane"
        title={`Expand details pane: ${node.data.label}`}
      >
        ›
      </button>
      <span aria-hidden="true" className="size-3 rounded-full shadow-[0_0_18px_currentColor]" style={{ backgroundColor: phaseColor(node.data.phase), color: phaseColor(node.data.phase) }} />
      <div className="mt-2 max-h-[32rem] truncate [writing-mode:vertical-rl] rotate-180 text-[10px] font-black uppercase tracking-[0.22em] text-text-tertiary">
        {phase?.label ?? node.data.phase} · Details
      </div>
    </aside>
  );
}

function EdgeDetails({ edge, onCollapse }: { edge: ResearchEdge; onCollapse: () => void }) {
  const data = edge.data;
  if (!data) {
    return null;
  }
  return (
    <aside className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-current/15 bg-background-base/72 p-4 shadow-2xl shadow-black/30 backdrop-blur xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Badge className="max-w-full truncate">Flow chip</Badge>
          <h2 className="mt-3 text-lg font-bold leading-tight text-midground">{data.label}</h2>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-current/15 bg-black/20 text-sm font-black leading-none text-text-tertiary transition-colors hover:border-current/30 hover:text-midground"
          aria-label="Collapse details pane"
          title="Collapse details pane"
        >
          ×
        </button>
      </div>
      <p className="mb-4 text-sm leading-6 text-text-secondary">{data.detail}</p>
      <DetailList label="Direction" values={[data.direction === "feedback" ? "Feedback loop: live or eval outcomes feed back into research/audit state." : "Forward flow: source, analysis, review, or courtroom output advances to the next step."]} />
      <DetailList label="From" values={[data.sourceLabel]} />
      <DetailList label="To" values={[data.targetLabel]} />
      <DetailList
        label="Why it matters"
        values={[
          `“${data.label}” is the handoff contract between these two workflow steps.`,
          "Use it to trace what information should exist before downstream work relies on it.",
        ]}
      />
    </aside>
  );
}

function FeedbackTraceDetails({ onCollapse }: { onCollapse: () => void }) {
  return (
    <aside className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-red-300/25 bg-red-950/18 p-4 shadow-2xl shadow-red-950/20 backdrop-blur xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Badge className="max-w-full truncate border-red-300/30 bg-red-500/15 text-red-100">Feedback trace</Badge>
          <h2 className="mt-3 text-lg font-bold leading-tight text-red-50">How a juror answer bubbles back</h2>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-red-200/20 bg-black/20 text-sm font-black leading-none text-red-100/70 transition-colors hover:border-red-200/40 hover:text-red-50"
          aria-label="Collapse details pane"
          title="Collapse details pane"
        >
          ×
        </button>
      </div>
      <p className="mb-4 text-sm leading-6 text-red-50/78">
        Red routes isolate the live-answer return path: question/answer capture gets converted into strike signals, strike decisions, audit updates, and new source-planning gaps.
      </p>
      <DetailList
        label="Answer path"
        values={[
          "Live questions / OC Q&A captures the juror answer.",
          "Strike Signals turns the answer into FACT / LEAD / OURS / OC signal stacks.",
          "Live Strike Board ranks the risk and passes the posture into Courtroom Decisions.",
          "Courtroom Decisions records accept, question, cause, peremptory, avoid, or research-needed action.",
          "Live feedback sync sends dispositions and answer-backed facts back to backend truth.",
          "Coverage + quality eval audits what changed and loops gaps back to Source planner.",
        ]}
        tone="risk"
      />
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
  const { getZoom, setCenter } = useReactFlow<FlowNode, ResearchEdge>();
  const viewMode: ViewMode = "logical";
  const [selectedId, setSelectedId] = useState("potential-fact-pool");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [activeLegendId, setActiveLegendId] = useState<LegendId | null>(null);
  const [feedbackTraceEnabled, setFeedbackTraceEnabled] = useState(false);


  useLayoutEffect(() => {
    setTitle("Juror Research Flow");
    return () => setTitle(null);
  }, [setTitle]);

  const feedbackTraceActive = feedbackTraceEnabled;
  const flowNodes = useMemo<FlowNode[]>(() => {
    const baseNodes = [...layoutZones(cloneZones(), viewMode), ...layoutNodes(cloneNodes(), viewMode)];
    if (!feedbackTraceActive) {
      return baseNodes;
    }

    return baseNodes.map((node) =>
      isResearchNode(node)
        ? {
            ...node,
            data: {
              ...node.data,
              feedbackTraceActive: true,
              feedbackTraceRoute: FEEDBACK_TRACE_NODE_IDS.has(node.id),
            },
          }
        : node,
    );
  }, [feedbackTraceActive, viewMode]);
  const edges = useMemo<ResearchEdge[]>(
    () => BASE_EDGES.map((edge) => {
      const data = edge.data;
      const direction: ResearchEdgeData["direction"] = data?.direction === "feedback" ? "feedback" : "forward";
      return {
        ...edge,
        selected: edge.id === selectedEdgeId,
        data: {
          label: data?.label ?? "flow",
          detail: data?.detail ?? "Workflow handoff between these steps.",
          feedbackTraceActive,
          feedbackTraceRoute: FEEDBACK_TRACE_EDGE_IDS.has(edge.id),
          direction,
          sourceLabel: data?.sourceLabel ?? edge.source,
          targetLabel: data?.targetLabel ?? edge.target,
          onSelect: (edgeId: string) => {
            if (selectedEdgeId === edgeId) {
              setSelectedEdgeId(null);
              return;
            }

            setSelectedEdgeId(edgeId);
            setDetailsCollapsed(false);
          },
        },
        style: { ...edge.style },
      };
    }),
    [feedbackTraceActive, selectedEdgeId],
  );
  const selectedNode = flowNodes.find((node): node is ResearchNode => isResearchNode(node) && node.id === selectedId) ?? flowNodes.find(isResearchNode);
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) ?? null : null;
  const researchNodes = useMemo(() => flowNodes.filter(isResearchNode), [flowNodes]);
  const activePhaseId: PhaseId | null = activeLegendId && activeLegendId !== LIVE_LOOP_LEGEND.id ? activeLegendId : null;
  const activePhase = activePhaseId ? PHASE_BY_ID.get(activePhaseId) ?? null : null;
  const activeLegend = activeLegendId === LIVE_LOOP_LEGEND.id ? LIVE_LOOP_LEGEND : activePhase;
  const activeLegendCount = activePhase ? researchNodes.filter((node) => node.data.phase === activePhase.id).length : null;

  const selectNodeById = useCallback(
    (nodeId: string) => {
      const node = researchNodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }

      setSelectedId(node.id);
      setSelectedEdgeId(null);
      setDetailsCollapsed(false);
      setCenter(
        node.position.x + (node.measured?.width ?? node.width ?? RESEARCH_NODE_WIDTH) / 2,
        node.position.y + (node.measured?.height ?? node.height ?? RESEARCH_NODE_HEIGHT) / 2,
        {
          duration: 420,
          zoom: Math.max(getZoom(), NODE_CLICK_DETAIL_ZOOM),
        },
      );
    },
    [getZoom, researchNodes, setCenter],
  );
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      if (!isResearchNode(node)) {
        return;
      }

      selectNodeById(node.id);
    },
    [selectNodeById],
  );

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col gap-4 p-4 lg:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.78)_54%,rgba(8,13,28,0.9))] px-4 py-3 shadow-2xl shadow-black/35 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_24%,rgba(103,232,249,0.18),transparent_30%),radial-gradient(circle_at_44%_18%,rgba(251,191,36,0.12),transparent_24%),radial-gradient(circle_at_78%_20%,rgba(52,211,153,0.14),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative flex flex-wrap items-center gap-2">
          {PHASES.map((phase, index) => (
            <div className="flex items-center gap-2" key={phase.id}>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeLegendId === phase.id
                    ? "border-white/30 bg-white/12 text-midground"
                    : "border-current/15 bg-black/25 text-text-secondary hover:border-white/25 hover:text-midground",
                )}
                onClick={() => setActiveLegendId((current) => (current === phase.id ? null : phase.id))}
                aria-expanded={activeLegendId === phase.id}
              >
                <span className="grid size-6 place-items-center rounded-full border border-current/25 bg-black/30 text-[8px] font-black leading-none shadow-[0_0_14px_currentColor]" style={{ color: phase.color }}>
                  {phase.icon}
                </span>
                {phase.label}
              </button>
              {index < PHASES.length - 1 ? (
                <span className="relative hidden h-px w-9 bg-gradient-to-r from-current/25 via-current/55 to-current/25 text-cyan-100/60 sm:inline-block" aria-hidden="true">
                  <span className="absolute -right-1 -top-[5px] text-[10px] leading-none text-current">›</span>
                </span>
              ) : null}
            </div>
          ))}
          <span className="hidden h-px w-9 bg-gradient-to-r from-emerald-300/25 via-emerald-300/55 to-emerald-300/25 sm:inline-block" aria-hidden="true" />
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              activeLegendId === LIVE_LOOP_LEGEND.id
                ? "border-emerald-200/45 bg-emerald-300/12 text-emerald-50"
                : "border-emerald-300/25 bg-emerald-950/20 text-emerald-100/90 hover:border-emerald-200/40 hover:text-emerald-50",
            )}
            onClick={() => setActiveLegendId((current) => (current === LIVE_LOOP_LEGEND.id ? null : LIVE_LOOP_LEGEND.id))}
            aria-expanded={activeLegendId === LIVE_LOOP_LEGEND.id}
          >
            <span className="grid size-6 place-items-center rounded-full border border-emerald-300/35 bg-black/30 text-[8px] font-black leading-none text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.8)]">
              {LIVE_LOOP_LEGEND.icon}
            </span>
            {LIVE_LOOP_LEGEND.label}
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] transition-colors",
              feedbackTraceEnabled
                ? "border-red-200/70 bg-red-500 text-white shadow-[0_0_18px_rgba(248,113,113,0.65)]"
                : "border-red-300/25 bg-red-950/25 text-red-100/90 hover:border-red-200/45 hover:text-red-50",
            )}
            onClick={() => {
              setFeedbackTraceEnabled((current) => !current);
              setActiveLegendId(null);
              setSelectedEdgeId(null);
            }}
            aria-pressed={feedbackTraceEnabled}
            title="Highlight how live answers and strike decisions feed back into audit, coverage, and source planning"
          >
            <span className="h-0 w-7 border-t-[3px] border-red-400 shadow-[0_0_12px_rgba(248,113,113,0.85)]" />
            Trace feedback
          </button>
          {activeLegend ? (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-white/15 bg-slate-950/95 p-3 text-sm text-slate-200 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-midground">
                {activePhase ? <span className="size-2 rounded-full shadow-[0_0_14px_currentColor]" style={{ backgroundColor: activePhase.color, color: activePhase.color }} /> : <span className="h-0 w-7 border-t-2 border-dashed border-emerald-300" />}
                {activeLegend.label}
              </div>
              <p className="leading-5 text-text-secondary">{activeLegend.detail}</p>
              {activeLegendCount !== null ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">{activeLegendCount} nodes in this phase</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className={cn("grid min-h-[780px] flex-1 gap-4", detailsCollapsed ? "xl:grid-cols-[minmax(0,1fr)_52px]" : "xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]")}>
        <section className="relative min-h-[700px] overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#05060d_0%,#070b14_48%,#050b0d_100%)] shadow-2xl shadow-black/35 ring-1 ring-white/5">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background: `radial-gradient(ellipse at 12% 42%, rgba(103, 232, 249, 0.14), transparent 34%),
                radial-gradient(ellipse at 32% 32%, rgba(167, 139, 250, 0.11), transparent 32%),
                radial-gradient(ellipse at 50% 48%, rgba(251, 191, 36, 0.09), transparent 34%),
                radial-gradient(ellipse at 66% 46%, rgba(251, 113, 133, 0.075), transparent 32%),
                radial-gradient(ellipse at 84% 44%, rgba(52, 211, 153, 0.13), transparent 36%)`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_26%,rgba(103,232,249,0.08),transparent_30%),radial-gradient(circle_at_48%_36%,rgba(251,191,36,0.055),transparent_32%),radial-gradient(circle_at_82%_35%,rgba(52,211,153,0.075),transparent_30%),linear-gradient(90deg,rgba(226,232,240,0.052)_1px,transparent_1px),linear-gradient(rgba(226,232,240,0.052)_1px,transparent_1px)] bg-[size:100%_100%,100%_100%,100%_100%,72px_72px,72px_72px]" />
          <div className="pointer-events-none absolute inset-0 opacity-22 [background-image:radial-gradient(circle,rgba(203,213,225,0.5)_1px,transparent_1.5px)] [background-size:46px_46px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_54%,rgba(2,6,23,0.82)_100%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_18%,transparent_82%,rgba(0,0,0,0.32))]" />
          <div className="pointer-events-none absolute inset-x-8 top-0 z-10 h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-6 top-6 z-10 grid grid-cols-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 shadow-2xl shadow-black/20 backdrop-blur-sm">
            {PHASES.map((phase) => (
              <div
                key={phase.id}
                className="relative min-h-14 border-r border-white/10 px-4 py-3 last:border-r-0"
                style={{
                  background: `linear-gradient(135deg, ${phase.ring}, transparent 72%)`,
                }}
              >
                <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase leading-none tracking-[0.2em] text-slate-100/82">
                  <span className="size-2 rounded-full shadow-[0_0_14px_currentColor]" style={{ backgroundColor: phase.color, color: phase.color }} />
                  {phase.short} · {phase.label}
                </div>
                <div className="truncate text-[10px] font-medium leading-tight text-slate-300/60">{phase.detail}</div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-full border border-white/12 bg-slate-950/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-100/78 shadow-lg shadow-black/30 backdrop-blur-md">
            Drag canvas · scroll to zoom · click a node
          </div>
          <ReactFlow
            key="logical"
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: -980, y: 285, zoom: 0.42 }}
            minZoom={0.12}
            maxZoom={1.4}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedEdgeId(null)}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(226, 232, 240, 0.075)" gap={46} />
          </ReactFlow>
        </section>

        {selectedNode ? (
          detailsCollapsed ? (
            <CollapsedDetailsRail node={selectedNode} onExpand={() => setDetailsCollapsed(false)} />
          ) : feedbackTraceEnabled ? (
            <FeedbackTraceDetails onCollapse={() => setDetailsCollapsed(true)} />
          ) : selectedEdge ? (
            <EdgeDetails edge={selectedEdge} onCollapse={() => setDetailsCollapsed(true)} />
          ) : (
            <NodeDetails node={selectedNode} onCollapse={() => setDetailsCollapsed(true)} />
          )
        ) : null}
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
