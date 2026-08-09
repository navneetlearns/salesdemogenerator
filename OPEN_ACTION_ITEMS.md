# Open Action Items — WhatsApp Mock Generator / journey-builder MCP

Created 2026-08-09. Priorities: P1 = next / blocking value · P2 = strategic, scheduled · P3 = backlog.
Status legend: in progress / not started / blocked.

| Pri | Item | Status | Notes |
|-----|------|--------|-------|
| P1 | Feature A — content adaptation for new companies | in progress | APPROACH PIVOTED 2026-08-09: no rewrite engine, no classifier/slot-mapper (journeys vary infinitely — mapping is a losing game). Test agent-driven adaptation ONCE: give the agent enough context (reference project = structure/steps, industry knowledge = vocabulary) and let it rewrite the built HTML directly. Test package: whatsapp-mock-generator-mcp/test/content-adaptation-test.md + scripts/audit_content_rewrite.sh. Decision gate: PASS → invest in context quality only (+ optional --forbid leak guard in verify); FAIL → record missed content types, fix narrowly per failure class. |
| P1 | Package the MCP as a cross-platform plugin (OpenCode + Claude + ChatGPT) | not started | Driver: MCP share/hosting complexity (Tailscale funnel on personal laptop, token handouts, public repo clone-with-siblings). Goal: one distribution story — install on any platform, no laptop dependency. Do: cloud hosting (recipe exists in journey-builder-mcp skill references), plugin format per platform (Claude Code plugin, OpenCode MCP/plugin, ChatGPT custom GPT/actions), single source repo. |
| P2 | Decide the deterministic boundary vs the sales-demo-generator (Vercel/Supabase) project | not started | Same content-adaptation problem solved there data-driven (industries.messages + {{placeholders}} + per-brand journey overrides). Decision: MCP = agent-authored bespoke demos; demo-generator = deterministic self-serve. Bridge: port industry message templates into MCP industry profiles as the fallback when steps[] omitted. Note: 3 journey-type Handlebars partials still open in demo-generator (July). |

## Design context (2026-08-09)

- Deterministic vs agent control: server is deterministic on structure/mechanics/verification; agent authors creative content. Reliability comes from the verify gate (source-leak, leftover placeholders, empty messages), not from more determinism.
- The 2026-08-09 test build (OpenCode run 5652cf3f) proved content does NOT change per company today: steps[] is a stub, industry profile is dead data in the manifest, and nothing fails on source-content inheritance (Banas Dairy leaked into a meditech build).
