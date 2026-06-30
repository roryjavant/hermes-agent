---
title: Team workflow for AI Opportunity KB
created: 2026-06-29
status: active
---

# Team workflow

Goal: move each AI opportunity from trend → evidence → offer → pilot → reusable system. No opportunity should advance because it sounds exciting; it advances because a team role has supplied decision-grade evidence.

## Whole-team pass

| Role | Responsibility | Output | Stop condition |
|---|---|---|---|
| Strategy lead | Decide whether the trend maps to Savant’s positioning and Rory’s network. | Priority, target buyer, decision needed. | No reachable buyer or no clear willingness-to-pay signal. |
| Research analyst | Maintain source-grounded trend notes and freshness. | Source ledger updates, claim confidence, contradictions. | Only vendor hype or unverified statistics support the claim. |
| Product lead | Convert the trend into a productized offer. | Offer title, scope, promise, price hypothesis, timeline. | Scope cannot be made fixed enough for a pilot. |
| Engineering lead | Define feasibility and reusable build pattern. | Architecture sketch, integrations, dependencies, demo path. | Needs unavailable data/API access or unsafe autonomy. |
| Security/governance lead | Define controls and compliance boundaries. | Risk map, human approval points, logging, data-handling rules. | Requires legal/clinical/financial advice beyond implementation support. |
| Growth/sales lead | Test buyer language and channels. | Outreach copy, interview list, qualification questions. | Buyers cannot name a painful workflow or success metric. |
| QA/eval lead | Define proof and kill criteria. | Acceptance checks, benchmark/eval plan, KPI instrumentation. | No measurable baseline or success metric. |

## Operating rhythm

1. **Weekly research refresh**
   - Update `source-ledger.md` for new authoritative sources.
   - Mark claims as strong / medium / weak.
   - Retire stale claims when dates or adoption numbers are superseded.

2. **Opportunity review**
   - Each opportunity file must answer: buyer, pain, why now, MVP, risks, controls, proof, kill criteria.
   - Keep one owner per opportunity for the next evidence step.

3. **Offer shaping**
   - Promote only P1/P2 opportunities into offer drafts.
   - Offers must be fixed-scope and pilotable within 1–2 weeks unless explicitly marked strategic/longer-term.

4. **Pilot gate**
   - Do not build a client-facing pilot until the team has:
     - 3+ buyer conversations or a named internal champion.
     - A baseline metric.
     - Data/system access path.
     - Human approval and rollback plan.

5. **Reusable asset capture**
   - After a pilot, add templates/checklists/scripts to the KB rather than leaving them in chat.

## Assignment queue

| Team | First assignment | Artifact |
|---|---|---|
| Strategy | Pick two wedges to validate first. Recommended: O1 + O2. | Decision in `decision-backlog.md`. |
| Research | Deepen buyer-specific evidence for O1/O2/O3/O4/O5. | Updated opportunity notes + source ledger. |
| Product | Draft two fixed-scope offers. | Offer drafts under `offers/` if/when created. |
| Engineering | Design one proof-of-capability demo for workflow sprint. | Demo architecture note. |
| Security/governance | Create lightweight AI control checklist. | Controls checklist. |
| Growth/sales | Build a 20-person interview list and outreach script. | Interview tracker. |
| QA/eval | Define KPI and eval template for pilots. | Pilot acceptance checklist. |

## Rules of engagement

- Preserve source provenance; no anonymous “studies say” claims.
- Label vendor marketing as vendor evidence, not market proof.
- Keep legal/compliance support framed as readiness/implementation, not legal advice.
- Prefer workflows with human approval over full autonomy until the risk and ROI are proven.
- Any claim that directly affects pricing, targeting, or risk controls needs a source or an interview note.

## Current opportunity notes

- `opportunities/bounded-agentic-workflows.md`
- `opportunities/ai-governance-readiness.md`
- `opportunities/agent-ready-knowledge-bases.md`
- `opportunities/healthcare-admin-automation.md`
- `opportunities/professional-services-ops-automation.md`
