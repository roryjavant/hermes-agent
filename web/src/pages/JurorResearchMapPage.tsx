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
  { id: "analysis", label: "Analysis", short: "03", icon: "SIG", color: "#fbbf24", ring: "rgba(251, 191, 36, 0.34)", detail: "Fact extraction, corroboration, potential leads, OC lensing, and signal modeling." },
  { id: "review", label: "Review", short: "04", icon: "CHK", color: "#fb7185", ring: "rgba(251, 113, 133, 0.34)", detail: "Human judgment and live-box handoff checks before signals become operational." },
  { id: "output", label: "Output", short: "05", icon: "OUT", color: "#34d399", ring: "rgba(52, 211, 153, 0.34)", detail: "Live questions, strike signals, strike board, facesheet, and coverage evaluation." },
];

const LIVE_LOOP_LEGEND = {
  id: "live-loop" as const,
  label: "Live loop",
  icon: "LOOP",
  detail: "Dashed green connections carry live courtroom outcomes back into audit, coverage, and downstream decision surfaces.",
};

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
  researchNode("operator-notes", "Operator notes", "review", "Freeform live notes, observed demeanor, answer fragments, and team callouts captured by the operator.", ["Live courtroom events", "Box Live Cockpit", "OC Q&A"], ["Timestamped notes", "Answer fragments", "Team callouts"], ["Notes not linked back to juror/source context"]),
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
  researchEdge("fact-extraction", "dedupe-corroborate", "Social Candidates"),
  researchEdge("fact-extraction", "potential-fact-pool", "candidate facts"),
  researchEdge("dedupe-corroborate", "potential-fact-pool", "potential"),
  researchEdge("potential-fact-pool", "box-eligible-leads", "screen"),
  researchEdge("potential-fact-pool", "signal-model", "case-adjacent"),
  researchEdge("opposing-counsel-lens", "signal-model", "OC pressure"),
  researchEdge("signal-model", "human-review", "triage"),
  researchEdge("dedupe-corroborate", "human-review", "conflicts"),
  researchEdge("box-eligible-leads", "backend-box-handoff", "box-ready"),
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
  researchEdge("live-strike-board", "live-feedback-sync", "strike decision", true),
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
  "live-strike-board-live-feedback-sync",
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
  "live-feedback-sync",
  "coverage-eval",
]);

type EdgeChipSegment = "source" | "middle" | "target" | "label";

const EDGE_CHIP_PLACEMENTS: Record<string, { segment: EdgeChipSegment; t: number }> = {
  "case-intake-identity-resolution": { segment: "target", t: 0.82 },
  "identity-resolution-source-planner": { segment: "source", t: 0.82 },
  "case-intake-source-planner": { segment: "source", t: 0.18 },
  "public-records-fact-extraction": { segment: "source", t: 0.74 },
  "web-social-fact-extraction": { segment: "source", t: 0.64 },
  "news-local-fact-extraction": { segment: "source", t: 0.74 },
  "dedupe-corroborate-human-review": { segment: "target", t: 0.78 },
  "backend-box-handoff-box-live-state": { segment: "source", t: 0.5 },
  "box-live-cockpit-live-questions": { segment: "source", t: 0.36 },
  "box-live-cockpit-operator-notes": { segment: "middle", t: 0.56 },
  "operator-notes-box-live-state": { segment: "middle", t: 0.34 },
  "operator-notes-strike-signals": { segment: "source", t: 0.44 },
  "operator-notes-live-feedback-sync": { segment: "middle", t: 0.72 },
  "box-live-state-oc-voir-dire-tracker": { segment: "middle", t: 0.72 },
  "oc-voir-dire-tracker-live-questions": { segment: "middle", t: 0.42 },
  "box-live-state-live-feedback-sync": { segment: "middle", t: 0.36 },
  "oc-voir-dire-tracker-live-feedback-sync": { segment: "source", t: 0.52 },
  "box-live-state-live-strike-board": { segment: "target", t: 0.58 },
  "signal-model-strike-signals": { segment: "target", t: 0.78 },
  "oc-voir-dire-tracker-strike-signals": { segment: "middle", t: 0.58 },
  "live-questions-strike-signals": { segment: "target", t: 0.5 },
  "strike-signals-live-strike-board": { segment: "middle", t: 0.44 },
  "live-strike-board-live-feedback-sync": { segment: "middle", t: 0.28 },
  "human-review-facesheet": { segment: "source", t: 0.45 },
  "strike-signals-facesheet": { segment: "source", t: 0.56 },
  "facesheet-coverage-eval": { segment: "source", t: 0.5 },
  "coverage-eval-source-planner": { segment: "middle", t: 0.5 },
};

const LOGICAL_POSITIONS: Record<string, { x: number; y: number }> = {
  "case-intake": { x: 0, y: 360 },
  "identity-resolution": { x: 440, y: 360 },
  "source-planner": { x: 920, y: 360 },
  "public-records": { x: 1430, y: 40 },
  "web-social": { x: 1430, y: 360 },
  "news-local": { x: 1430, y: 680 },
  "fact-extraction": { x: 2060, y: 360 },
  "dedupe-corroborate": { x: 2680, y: 620 },
  "potential-fact-pool": { x: 2680, y: 120 },
  "box-eligible-leads": { x: 3360, y: 120 },
  "opposing-counsel-lens": { x: 3360, y: 930 },
  "signal-model": { x: 3360, y: 620 },
  "human-review": { x: 4040, y: 620 },
  "backend-box-handoff": { x: 4020, y: 330 },
  "box-live-cockpit": { x: 4700, y: 120 },
  "operator-notes": { x: 4700, y: 520 },
  "box-live-state": { x: 5380, y: 120 },
  "oc-voir-dire-tracker": { x: 5380, y: 930 },
  "live-feedback-sync": { x: 6060, y: 930 },
  "live-questions": { x: 5380, y: 520 },
  "strike-signals": { x: 6060, y: 520 },
  "live-strike-board": { x: 6060, y: 120 },
  facesheet: { x: 6740, y: 520 },
  "coverage-eval": { x: 7420, y: 520 },
};

const GALAXY_POSITIONS: Record<string, { x: number; y: number }> = {
  "case-intake": { x: 320, y: 410 },
  "identity-resolution": { x: 720, y: 410 },
  "source-planner": { x: 1190, y: 410 },
  "public-records": { x: 1640, y: 90 },
  "web-social": { x: 1740, y: 410 },
  "news-local": { x: 1640, y: 730 },
  "fact-extraction": { x: 2260, y: 410 },
  "dedupe-corroborate": { x: 2880, y: 690 },
  "potential-fact-pool": { x: 2880, y: 150 },
  "box-eligible-leads": { x: 3560, y: 150 },
  "opposing-counsel-lens": { x: 3560, y: 980 },
  "signal-model": { x: 3560, y: 690 },
  "human-review": { x: 4240, y: 690 },
  "backend-box-handoff": { x: 4220, y: 380 },
  "box-live-cockpit": { x: 4920, y: 150 },
  "operator-notes": { x: 4920, y: 560 },
  "box-live-state": { x: 5600, y: 150 },
  "oc-voir-dire-tracker": { x: 5600, y: 980 },
  "live-feedback-sync": { x: 6280, y: 980 },
  "live-questions": { x: 5600, y: 560 },
  "strike-signals": { x: 6280, y: 560 },
  "live-strike-board": { x: 6280, y: 150 },
  facesheet: { x: 6980, y: 560 },
  "coverage-eval": { x: 7660, y: 560 },
};

const LOGICAL_ZONE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "backend-zone": { x: -260, y: -1600, width: 4160, height: 5600 },
  "box-zone": { x: 3900, y: -1600, width: 3900, height: 5600 },
  "boundary-zone": { x: 3660, y: -1600, width: 560, height: 5600 },
};

const GALAXY_ZONE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  "backend-zone": { x: 120, y: -1600, width: 4040, height: 5800 },
  "box-zone": { x: 4160, y: -1600, width: 3900, height: 5800 },
  "boundary-zone": { x: 3920, y: -1600, width: 560, height: 5800 },
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

  if (placement.segment === "label") {
    return { x: labelX, y: labelY };
  }

  if (placement.segment === "source") {
    return { x: sourceX + (centerX - sourceX) * t, y: sourceY };
  }

  if (placement.segment === "target") {
    return { x: centerX + (targetX - centerX) * t, y: targetY };
  }

  return { x: centerX, y: sourceY + (targetY - sourceY) * t };
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
  const isFactPoolToSignalModel = source === "potential-fact-pool" && target === "signal-model";
  const isSourceToFactExtraction = target === "fact-extraction" && ["public-records", "web-social", "news-local"].includes(source);
  const upwardHandoff = isDedupeToPotentialPool || isOcLensToSignalModel;
  const shouldShowArrowhead = upwardHandoff || isFactPoolToSignalModel || isSourceToFactExtraction;
  return {
    id: `${source}-${target}`,
    type: "research",
    source,
    sourceHandle: upwardHandoff ? "top-source" : undefined,
    target,
    targetHandle: upwardHandoff ? "bottom-target" : undefined,
    animated,
    markerEnd: shouldShowArrowhead
      ? {
          type: MarkerType.ArrowClosed,
          color: "#b4c2ff",
          height: 20,
          width: 20,
        }
      : undefined,
    data: {
      label,
      sourceLabel,
      targetLabel,
      detail: `${sourceLabel} sends “${label}” into ${targetLabel}. Click the connected nodes to see the source and destination responsibilities, inputs, outputs, and watch-outs.`,
    },
    style: {
      stroke: animated ? "#34d399" : "rgba(180, 194, 255, 0.52)",
      strokeWidth: animated ? 2.6 : 2,
      filter: animated ? "drop-shadow(0 0 8px rgba(52, 211, 153, 0.7))" : "drop-shadow(0 0 6px rgba(125, 211, 252, 0.28))",
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
  const conflictLaneY = Math.min(sourceY, targetY) - 260;
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
      <EdgeLabelRenderer>
        <button
          type="button"
          className={cn(
            "nodrag nopan pointer-events-auto absolute rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] shadow-lg backdrop-blur transition-colors",
            feedbackTraceActive && feedbackTraceRoute
              ? "border-red-200/70 bg-red-500 text-white shadow-[0_0_16px_rgba(248,113,113,0.7)]"
              : feedbackTraceActive
                ? "border-slate-500/10 bg-slate-950/35 text-slate-500 opacity-35"
                : selected
              ? "border-midground bg-midground text-background-base"
              : "border-white/10 bg-black/80 text-slate-100 hover:border-midground/70 hover:text-midground",
          )}
          style={{ transform: `translate(-50%, -50%) translate(${chipPoint.x}px, ${chipPoint.y}px)`, zIndex: selected ? 80 : 60 }}
          onClick={(event) => {
            event.stopPropagation();
            selectEdge();
          }}
          aria-label={`${selected ? "Hide" : "Show"} details for ${data?.label ?? "flow"} connection`}
          title={data?.detail ?? data?.label ?? "flow"}
        >
          {data?.label ?? "flow"}
        </button>
      </EdgeLabelRenderer>
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
        "bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.9)_60%,rgba(15,23,42,0.94))] text-left shadow-2xl backdrop-blur-md transition-transform duration-150",
        feedbackTraceDimmed && "opacity-35 saturate-50",
        feedbackTraceRoute && "scale-[1.03]",
        selected && "scale-[1.04]",
      )}
      style={{
        borderColor: feedbackTraceRoute ? "#ef4444" : color,
        boxShadow: feedbackTraceRoute
          ? "0 0 0 1px rgba(255,255,255,0.1) inset, 0 20px 42px rgba(0,0,0,0.36), 0 0 54px rgba(248,113,113,0.9)"
          : `0 0 0 1px rgba(255,255,255,0.08) inset, 0 20px 42px rgba(0,0,0,0.34), 0 0 ${selected ? 52 : 30}px ${phase?.ring ?? "rgba(148,163,184,0.25)"}`,
      }}
    >
      <Handle className="!size-2 !border-0" position={Position.Left} style={{ background: color }} type="target" />
      <Handle className="!size-2 !border-0" position={Position.Right} style={{ background: color }} type="source" />
      <Handle className="!size-2 !border-0" id="top-source" position={Position.Top} style={{ background: color }} type="source" />
      <Handle className="!size-2 !border-0" id="top-target" position={Position.Top} style={{ background: color }} type="target" />
      <Handle className="!size-2 !border-0" id="bottom-source" position={Position.Bottom} style={{ background: color }} type="source" />
      <Handle className="!size-2 !border-0" id="bottom-target" position={Position.Bottom} style={{ background: color }} type="target" />
      <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: `radial-gradient(circle at 18% 8%, ${phase?.ring ?? "rgba(148,163,184,0.24)"}, transparent 44%), linear-gradient(180deg, rgba(255,255,255,0.07), transparent 34%)` }} />
      <div className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full blur-2xl opacity-28" style={{ backgroundColor: color }} />
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
          "Live Strike Board records the team decision or hold/cause posture.",
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
      return {
        ...edge,
        selected: edge.id === selectedEdgeId,
        data: {
          label: data?.label ?? "flow",
          detail: data?.detail ?? "Workflow handoff between these steps.",
          feedbackTraceActive,
          feedbackTraceRoute: FEEDBACK_TRACE_EDGE_IDS.has(edge.id),
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
      <section className="relative overflow-hidden rounded-3xl border border-current/15 bg-slate-950/72 px-4 py-3 shadow-2xl shadow-black/30">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(125,211,252,0.14),transparent_30%),radial-gradient(circle_at_74%_12%,rgba(167,139,250,0.12),transparent_28%),radial-gradient(circle_at_62%_80%,rgba(52,211,153,0.1),transparent_32%)]" />
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
        <section className="relative min-h-[700px] overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#020617] shadow-2xl shadow-black/30">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_44%_36%,rgba(59,130,246,0.22),transparent_38%),radial-gradient(circle_at_82%_28%,rgba(250,204,21,0.12),transparent_28%),radial-gradient(circle_at_30%_82%,rgba(20,184,166,0.16),transparent_34%),linear-gradient(90deg,rgba(34,211,238,0.052)_1px,transparent_1px),linear-gradient(rgba(34,211,238,0.052)_1px,transparent_1px)] bg-[size:100%_100%,100%_100%,100%_100%,80px_80px,80px_80px]" />
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle,rgba(148,220,255,0.46)_1px,transparent_1.5px)] [background-size:42px_42px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(2,6,23,0.62)_100%)]" />
          <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-full border border-cyan-200/15 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/78 shadow-lg backdrop-blur">
            Drag canvas · scroll to zoom · click a node
          </div>
          <ReactFlow
            key="logical"
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={{ x: 24, y: 154, zoom: 0.13 }}
            minZoom={0.1}
            maxZoom={1.4}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedEdgeId(null)}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(125, 211, 252, 0.18)" gap={46} />
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
