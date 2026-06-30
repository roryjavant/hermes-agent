---
title: O1 — Bounded Agentic Workflow Builds
priority: P1
status: validate-first
last_updated: 2026-06-29
---

# O1 — Bounded Agentic Workflow Builds

## Buyer and decision-maker

- **Primary buyer:** owner/operator, COO, operations manager, CTO, practice administrator, head of customer support.
- **Decision-maker:** budget owner who can approve access to one workflow system and assign an internal owner.
- **Best-fit organizations:** SMBs and midmarket teams already experimenting with ChatGPT/Copilot/vertical AI but lacking production integration, auditability, or ROI proof.

## Pain and why now

AI usage is broad, but production value capture is still weak. McKinsey reports 88% of surveyed organizations use AI in at least one function, yet only about one-third have started scaling AI enterprise-wide and just 39% report enterprise-level EBIT impact. McKinsey also reports 62% are experimenting with AI agents while only 23% are scaling agentic AI somewhere in the enterprise.

That gap creates a services opportunity: companies need someone to pick a bounded workflow, wire the system safely, instrument the KPI, and prevent “pilot purgatory.”

## MVP wedge

**AI Workflow Sprint:** a 1–2 week fixed-scope build around one workflow.

Minimum scope:

1. Intake trigger: form, email, chat, phone transcript, spreadsheet, support ticket, or CRM update.
2. Classification/extraction with source citations.
3. Missing-information follow-up or internal queue.
4. Human approval before irreversible action.
5. Write-back to one system.
6. Audit log and KPI dashboard.

## Integration/data requirements

- One source-of-truth system and one action system.
- Test data or redacted production samples.
- Clear permission model.
- Human owner for approval/exception handling.

## Legal/security/compliance constraints

- Do not sell full autonomy first; sell human-approved workflow execution.
- Log inputs, outputs, tool calls, approvals, and write-backs.
- Add data-retention and vendor-data-use notes before handling client data.
- Use NIST AI RMF language for governance controls: Govern, Map, Measure, Manage.

## Proof/KPI

Pick one primary KPI before building:

- Manual hours saved per week.
- Time-to-response.
- Backlog/throughput.
- Error/rework rate.
- Lead capture or follow-up completion.
- Approval cycle time.

## Kill criteria

- No named workflow owner.
- No baseline metric.
- Buyer cannot provide sample inputs.
- Workflow requires irreversible action without approval.
- The integration path is blocked or only available through a vendor sales cycle.

## Next evidence needed

- 10–15 buyer interviews to identify repeated workflows with measurable pain.
- Pricing test: fixed pilot fee vs. implementation retainer.
- Demo using fake data: intake → classify → missing info → approval → write-back → KPI.

## Sources

- McKinsey / QuantumBlack, *The State of AI in 2025*: https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
