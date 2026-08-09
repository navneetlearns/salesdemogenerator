# Content Adaptation Test — agent-driven (single session)

Hypothesis: an OpenCode agent given enough context (reference project for structure,
industry knowledge for vocabulary) reliably rewrites a new company's journey content
itself. If true, no server-side rewrite machinery is ever needed.

Run this ONCE in OpenCode Desktop (the real product path). Then audit with
`scripts/audit_content_rewrite.sh`.

## Session brief — paste into OpenCode

```
You are building a ZoTok WhatsApp demo journey for a NEW company. The journey-builder
MCP tools are wired up (journey-builder). Follow this flow exactly.

COMPANY (brand pack):
- brandName: Meditech Surgical Supplies (slug: meditech_surgicals_v2)
- industry: medical equipment (hospitals, surgical consumables)
- logo: <logo URL or omit — use avatar initials MS>
- website: https://meditech.example
- tagline: (optional)

FLOW:
1. Call list_bases. Pick the source project banas_diary and source journey
   order_to_cash. The source provides STRUCTURE and STEP COUNT ONLY.
2. Call build_journey with sourceProject=banas_diary, sourceJourney=order_to_cash,
   brandName/logo/website from the pack above, industry=general (no medical profile
   yet — see note).
3. THE BUILD IS A SHELL. The cloned HTML still contains the source company's content.
   Your job now is the content adaptation: open the built journey_*.html and index.html
   and rewrite EVERY content-bearing text for Meditech Surgical Supplies. You have
   file tools — edit directly.

WHAT TO REWRITE (every item, no exceptions):
- Every .msg-body text in every phone frame — rewrite as realistic meditech
  conversations (hospital procurement officer ordering surgical consumables:
  sterile gloves, sutures, syringes, cannulas; price quotes in ₹ per unit/case;
  GST; delivery ETA; credit terms). Keep sender/receiver direction as-is.
- Every .screen-desc (the why-caption under each screen) — one-line business
  insight for THIS industry.
- Every .screen-lbl ("Screen 1 · ...") — new screen names for this flow.
- Sidebar .step-lbl entries and the const steps array titles/descs.
- .wa-contact-name (topbar) — "Meditech Surgical Supplies".
- Numbers, refs, timestamps — realistic, with clock continuity across screens
  (e.g., 09:12 → 09:16 → 15:45), date pills between chapters, refs like
  ORD-2026-1042, INV-2026-0887.
- Keep the shell: section count, phone frames, layout, screen types. Do NOT add
  or remove screens. If the source has 8 steps, the result has 8 steps.

INDUSTRY CONTEXT (use your own knowledge, this is the vocabulary test):
- partnerLabel: procurement officer / hospital admin (the BUYER side)
- units: units, boxes, cases (not bags)
- currency: ₹ (INR)
- real flow: catalog/browse → order → approval by hospital admin → dispatch with
  batch/lot numbers → invoice + payment via UPI/credit terms

HARD RULES:
- ZERO references to the source company: no "Banas", no "Banas Dairy", no
  banas-dairy-logo.png anywhere in either file. Strip or replace the logo ref.
- Meta compliance: no template cards in group steps; header/button char limits;
  ZoTok footer on every phone screen.
- After editing: call verify_journey with journeyPath + expectedSteps=8 and
  probes containing "Meditech" (and step-specific text you wrote).
- Report: preview URL, verify result, and a list of every screen you rewrote.
- Do NOT stop at "built". A build without content adaptation is a failed demo.
```

Note: industry=general is fine for this test (the agent supplies industry
knowledge itself — that's the point). A medical_equipment profile is a separate
follow-up if the test passes.

## Audit (after the session)

```bash
bash scripts/audit_content_rewrite.sh \
  ~/AgentWork/journey-output/meditech_surgicals_v2/projects/meditech_surgicals_v2/journey_order_to_cash.html \
  "Banas|banas|BANAS" "banas-dairy-logo" "Meditech" 8
```

PASS bar: audit script all-green AND verify_journey all-green AND a human visual
pass over the preview (every screen shows Meditech content, no source remnants).

DECISION GATE:
- PASS → abandon rewrite-engine ideas permanently. Invest only in context quality
  (AGENTS.md content-rewrite instructions, surfacing the industry profile in the
  build response). Optionally add the cheap --forbid leak guard to verify.
- FAIL → record exactly which content types got missed (messages? captions?
  sidebar? labels?) and where the agent stopped. Then decide: more/better context
  for those specific spots, or narrow deterministic help ONLY for that failure
  class. Never a general journey mapper.
