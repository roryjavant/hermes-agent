---
title: O3 — Agent-Ready Knowledge Bases
priority: P1
status: validate
last_updated: 2026-06-29
---

# O3 — Agent-Ready Knowledge Bases

## Buyer and decision-maker

- **Primary buyer:** customer support leader, operations lead, compliance-heavy service team, internal IT/enablement owner.
- **Decision-maker:** owner of the source material and the workflow where answers/actions will be used.

## Pain and why now

Teams want AI agents, but their knowledge is scattered across PDFs, docs, Slack, old SOPs, spreadsheets, help centers, and individual memory. Poor source hygiene turns AI into a demo toy: answers are ungrounded, stale, permission-blind, or impossible to audit.

McKinsey’s 2025 AI survey points to knowledge management as one of the top functions where organizations report AI use. That makes knowledge-base construction a near-term wedge: it is useful alone and becomes infrastructure for later agentic workflows.

## MVP wedge

**Agent-Ready Knowledge Base Build:** turn one messy knowledge domain into a governed, source-grounded KB for one workflow.

Deliverables:

1. Source inventory and owner map.
2. Canonical documents with metadata and provenance.
3. Access-control assumptions.
4. RAG/eval question set.
5. Freshness and update process.
6. “Approved answer” layer for high-risk topics.
7. Integration plan for chat, support, workflow agent, or internal search.

## Integration/data requirements

- Source documents and a named source owner.
- Access boundaries: public/internal/confidential/customer-specific.
- Representative questions and failure examples.
- Target workflow where the KB will be used.

## Legal/security/compliance constraints

- Do not mix permission tiers in one uncontrolled index.
- Preserve citations and source timestamps.
- Mark stale or disputed sources.
- Add review before customer-facing or regulated answers.

## Proof/KPI

- Answer accuracy on eval set.
- Citation coverage.
- Reduction in search/escalation time.
- Deflection rate for support/internal questions.
- Freshness SLA met.

## Kill criteria

- No source-of-truth owner.
- Permission model unresolved.
- Content is mostly tribal knowledge with no validation path.
- Buyer cannot define the workflow the KB supports.

## Next evidence needed

- Identify 3 real candidate knowledge domains: customer support, compliance/SOP, sales enablement, implementation docs.
- Build a before/after demo with eval questions and grounded citations.

## Sources

- McKinsey / QuantumBlack, *The State of AI in 2025*: https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
