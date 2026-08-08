# whatsapp-mock-generator — ZoTok demo journey tooling

Everything related to building ZoTok WhatsApp client demo journeys with the
whatsapp-mock-generator approach. Two parts:

## `skill/` — the Mock Journey Builder skill (ours)

The reusable build kit: brand pack + reference project → complete, Meta-compliant,
verified journey (clone → brand-swap → content → gate → ship).

- `SKILL.md` — the instructions (paths use `MOCKGEN_ROOT` — set it to your
  whatsapp-mock-generator clone, or use the bundled `base-journey/`)
- `README.md` — install guide per tool (Claude Code / ChatGPT / any LLM)
- `references/` — intake template, Meta compliance rules, pitfalls
- `scripts/` — `brand_swap.py` (mechanical rebrand, idempotent) +
  `verify_journey.py` (render/compliance gate; needs `pip install playwright &&
  playwright install chromium`)
- `base-journey/` — Hindustan RMC shell pair (index + journey_contract.html,
  10 steps) — the recommended clone base
- `chatgpt-kit/` — paste-ready instructions for ChatGPT / any chat LLM

> **MCP integration:** The `whatsapp-mock-generator-mcp/` sibling directory is an
> MCP server that wraps these scripts as tools for OpenCode Desktop. It reads
> `skill/scripts/` and `skill/base-journey/` directly — no files are duplicated.
> See `whatsapp-mock-generator-mcp/README.md` for setup.

## `source/` — whatsapp-mock-generator rules + templates (reference)

Copied from the upstream project (see attribution). The AI instructions
(`CLAUDE.md`), Meta compliance guidelines, 29 screen reference templates +
campaign templates, and 6 utility scripts that the skill builds on.

> `references/graphics/` (journey photos, ~13MB) is NOT included — fetch from the
> upstream repo if a journey needs them.

## Attribution

- Upstream project: **nitinmp/whatsapp-mock-generator**
  (https://github.com/nitinmp/whatsapp-mock-generator) — `source/` is a copy of its
  rules/templates/scripts, kept here so the team has one place to clone.
- `skill/` and `base-journey/` are ZoTok-internal work (built 2026-08-07).

## Quick start (skill)

```bash
pip install playwright && playwright install chromium
python3 skill/scripts/verify_journey.py skill/base-journey/journey_contract.html \
  --expected-steps 10    # first-run gate check: expect all PASS
```

Then follow `skill/SKILL.md` (or `skill/README.md`) for a brand build.
