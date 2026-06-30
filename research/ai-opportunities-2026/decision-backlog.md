---
title: Decision backlog for AI Opportunity KB
created: 2026-06-29
status: active
---

# Decision backlog

## Decisions needed now

| ID | Decision | Recommended default | Evidence needed | Owner role |
|---|---|---|---|---|
| D1 | Which two wedges should Savant validate first? | O1 Bounded agentic workflows + O2 AI governance/readiness. | Rory network fit; 10–15 buyer interviews. | Strategy |
| D2 | What is the first proof-of-capability demo? | Intake → classify → ask missing questions → human approval → write to task/CRM → audit/ROI dashboard. | Systems Rory can demo safely without client data. | Product + Engineering |
| D3 | What target vertical gets first outreach? | Local/professional services first; healthcare admin second if HIPAA-ready vendor path is clear. | Buyer list, pain/cost signal, integration feasibility. | Growth |
| D4 | What compliance boundary should offers use? | “Technical readiness and implementation support; not legal advice.” | Counsel/partner option for formal legal review. | Security/governance |
| D5 | What KPI proves pilot value? | Time saved, response time, lead capture, error reduction, approval throughput. | Baseline from buyer before pilot. | QA/eval |
| D6 | Should professional services be pulled into the first validation batch? | Yes, if Rory can reach 5+ law/accounting/agency operators quickly. | Buyer access, practice-management integration path, confidentiality boundary. | Strategy + Growth |

## Buyer interview questions

Ask only questions that change a build/sell decision.

1. What AI tools are already being used by your team, officially or unofficially?
2. Which workflow is frequent, manual, annoying, and measurable?
3. What happens when that workflow is late or wrong?
4. How many times per week/month does it happen?
5. Which systems contain the required data?
6. What actions would AI be allowed to take directly, and what requires approval?
7. Who owns the risk if the automation makes a mistake?
8. What evidence would make this a yes for a paid pilot?
9. What would make you kill the pilot after two weeks?
10. Who besides you must approve data access, budget, and rollout?

## Evidence gaps to close next

| Gap | Why it matters | How to close |
|---|---|---|
| Buyer willingness to pay for O1/O2 | Market trend is strong, but Savant needs reachable demand. | 10–15 interviews from Rory’s network. |
| Vertical ranking | Fastest revenue may differ by network, not macro trend. | Score each vertical by access, pain, compliance friction, integration complexity. |
| Voice-agent compliance by state/industry | Recording/disclosure rules can derail SMB voice pilots. | Build legal-risk checklist; partner with counsel for final review. |
| HIPAA-ready implementation path | Healthcare admin is attractive but higher-risk. | Identify BAA-ready vendors and admin-only workflows; avoid clinical autonomy. |
| Demo system | Sales needs proof, not slides. | Build a local demo with fake data and one real integration path. |
| Pricing | Fixed offer needs a price anchor. | Compare labor cost saved and integration scope; test pilot ranges in interviews. |
| Professional-services ICP | Legal/accounting/agency/consulting all show admin pain, but the fastest wedge depends on access. | Interview 5 operators and rank by urgency, budget, and integration friction. |

## Offer hypotheses

### H1 — AI Workflow Sprint

- **Promise:** automate one bounded workflow in two weeks with human approval and measurable KPI.
- **Scope:** 1 workflow, 1–2 systems, 1 approval queue, audit log, weekly report.
- **Buyer:** owner/operator, ops manager, professional-services firm, small healthcare/admin team.
- **Pilot KPI:** time-to-response, manual hours saved, lead capture, throughput, error rate.
- **Kill criteria:** no baseline metric; no system access; irreversible action required without approval; buyer cannot assign owner.

### H2 — AI Governance Readiness Audit

- **Promise:** produce an AI inventory, risk map, and implementation roadmap in two weeks.
- **Scope:** interview stakeholders, inventory tools/use cases/vendors, classify risk, map NIST/EU-style controls, deliver evidence-pack template.
- **Buyer:** founder, CTO, compliance lead, CISO, ops leader.
- **Pilot KPI:** inventory completeness, number of high-risk gaps identified, controls adopted, procurement/security unblock.
- **Kill criteria:** buyer wants formal legal opinion only; no access to AI use cases; no executive owner.

### H3 — Agent-ready Knowledge Base Build

- **Promise:** turn messy documents into a governed, source-grounded KB for one business workflow.
- **Scope:** source ingestion, metadata/provenance, access rules, RAG eval set, freshness/update plan.
- **Buyer:** customer-support lead, ops lead, compliance-heavy service team, internal IT.
- **Pilot KPI:** answer accuracy, citation coverage, deflection, reduced search time, lower hallucination rate.
- **Kill criteria:** no source-of-truth owner; permission model unresolved; answers cannot be verified.

### H4 — Professional Services Ops Sprint

- **Promise:** recover admin time and reduce billing/follow-up leakage in one professional-services workflow.
- **Scope:** intake, document follow-up, billing narrative cleanup, passive time-capture review, or client update drafts; professional review required.
- **Buyer:** managing partner, owner/operator, operations manager.
- **Pilot KPI:** hours recovered, billable capture, billing cycle time, missed follow-ups, client response time.
- **Kill criteria:** buyer expects AI to give professional advice; no system access; no confidentiality/data-handling agreement.

### H5 — Healthcare Admin Workflow Sprint

- **Promise:** reduce administrative burden in a HIPAA-aware, human-reviewed workflow.
- **Scope:** prior-auth packet assembly, referral/fax triage, missing-information checklist, admin message triage, or quality-reporting support.
- **Buyer:** practice administrator, revenue-cycle leader, clinic ops manager.
- **Pilot KPI:** packet assembly time, first-pass completeness, denial/rework rate, backlog reduction.
- **Kill criteria:** no BAA-ready path for PHI; clinical judgment required; no compliance owner.

## Next artifacts to create

- `offers/ai-workflow-sprint.md`
- `offers/ai-governance-readiness-audit.md`
- `templates/buyer-interview-notes.md`
- `templates/pilot-scorecard.md`
- `templates/ai-controls-checklist.md`
- `opportunities/voice-messaging-service-agents.md`
- `opportunities/ai-coding-agent-enablement.md`
