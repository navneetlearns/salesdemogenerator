# Open Action Items — WhatsApp Mock Generator / journey-builder MCP

Created 2026-08-09. Priorities: P1 = next / blocking value · P2 = strategic, scheduled · P3 = backlog.
Status legend: in progress / not started / blocked.

| Pri | Item | Status | Notes |
|-----|------|--------|-------|
| P1 | Feature A — content adaptation for new companies | VALIDATED 2026-08-10, SHIPPED v1.5.0 | TEST PASSED — hypothesis confirmed: agent with context (reference project + industry knowledge) rewrote all content itself. Evidence: zero Banas text/logo refs (70+20 removed), 37 Meditech refs, 8/8 steps navigate, 44/44 agent verify, audit script all-green, visual pixel probes correct. NO rewrite machinery, NO classifier — never build them. v1.5.0 ships the workflow: stage_for_edit → agent adapts → finalize_journey (auto leak guard) + logoPath/productImagePaths intake + spawnSync probes fix (root cause of the 08-09 verify failures). Follow-ups done: probes hardening, leak guard, path portability (/proc/mounts + EDIT_STAGING_DIR env-gated). Remaining: optional medical_equipment industry profile (P3). |
| P1 | Package the MCP as a cross-platform plugin (OpenCode + Claude + ChatGPT) | not started | Driver: MCP share/hosting complexity (Tailscale funnel on personal laptop, token handouts, public repo clone-with-siblings). Goal: one distribution story — install on any platform, no laptop dependency. Do: cloud hosting (recipe in journey-builder-mcp skill references; card-free PaaS picks: Koyeb/Zeabur — Render requires a card + free tier auto-sleeps, VM still battle-tested), plugin format per platform (Claude Code plugin, OpenCode MCP/plugin, ChatGPT custom GPT/actions), single source repo. |
| P2 | Decide the deterministic boundary vs the sales-demo-generator (Vercel/Supabase) project | not started | Same content-adaptation problem solved there data-driven (industries.messages + {{placeholders}} + per-brand journey overrides). Decision: MCP = agent-authored bespoke demos; demo-generator = deterministic self-serve. Bridge: port industry message templates into MCP industry profiles as the fallback when steps[] omitted. Note: 3 journey-type Handlebars partials still open in demo-generator (July). |

## Design context (2026-08-09)

- Deterministic vs agent control: server is deterministic on structure/mechanics/verification; agent authors creative content. Reliability comes from the verify gate (source-leak, leftover placeholders, empty messages), not from more determinism.
- The 2026-08-09 test build (OpenCode run 5652cf3f) proved content does NOT change per company today: steps[] is a stub, industry profile is dead data in the manifest, and nothing fails on source-content inheritance (Banas Dairy leaked into a meditech build).
