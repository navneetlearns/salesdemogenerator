# Mock Journey Builder — shareable skill package

Builds ZoTok WhatsApp demo journeys for any client: brand pack + reference project →
complete, Meta-compliant, verified journey (clone → brand-swap → content → gate → ship).

## Contents

| Item | What it is |
|---|---|
| `SKILL.md` | The skill (instructions). Paths use `MOCKGEN_ROOT` — set it to your clone of whatsapp-mock-generator. |
| `references/` | intake.md (brand pack + journey spec template), meta-compliance.md (Meta rules), pitfalls.md (failure signatures) |
| `scripts/` | brand_swap.py (mechanical rebrand, idempotent, `--dry-run`), verify_journey.py (render/compliance gate; needs `pip install playwright && playwright install chromium`) |
| `base-journey/` | Hindustan RMC shell pair (index.html + journey_contract.html, 10 steps) — the recommended clone base |

## Install per tool

### Claude Code (recommended — the mock-generator workflow is Claude Code)

1. `git clone https://github.com/nitinmp/whatsapp-mock-generator.git`
2. Copy this folder into the repo (or your home):
   ```bash
   cp -r mock-journey-builder <repo>/.claude/skills/
   # or: cp -r mock-journey-builder ~/.claude/skills/
   ```
3. Install Python deps: `pip install playwright && playwright install chromium`
4. Run `claude` in the repo and say: "create a journey for <Brand> …"

### ChatGPT / any LLM (no Claude Code needed)

Use `chatgpt-kit/GPT-INSTRUCTIONS.md` — a paste-ready instruction set built for
chat assistants (custom GPTs, ChatGPT Projects, plain chats). Three levels:

1. **Plain chat** — paste the instructions file into any LLM (ChatGPT free, Gemini,
   Copilot). Works without code execution: the swap + verification checklists are
   written so the model does the work inline.
2. **ChatGPT Project** — new Project → paste instructions into Custom instructions →
   upload `references/` + `base-journey/` as files.
3. **Custom GPT (best for team)** — one person builds it: Instructions = the file,
   Knowledge = references + base-journey, Capabilities = Code Interpreter (so the
   bundled scripts run + screenshots are possible), then share the GPT link.

### Other agents (Codex CLI, Cursor, Windsurf, any LLM)

- Paste the SKILL.md body into your instructions file (AGENTS.md / .cursor/rules /
  system prompt) and attach `references/` as context.
- Scripts run locally with python3 + playwright (see above).

## First-run checklist (any tool)

- [ ] MOCKGEN_ROOT points at your whatsapp-mock-generator clone
- [ ] `python3 scripts/brand_swap.py --dry-run ...` prints a plan
- [ ] `python3 scripts/verify_journey.py base-journey/journey_contract.html --expected-steps 10`
      → all PASS (proves the gate works on your machine before you build anything)
