---
name: mock-journey-builder
description: Use when building/verifying ZoTok WhatsApp mock journeys.
---

# Mock Journey Builder — brand → verified demo journey

Builds client demo journeys the whatsapp-mock-generator way: clone a proven journey
shell, brand-swap mechanically, rewrite content for the client's real world, gate on
Meta compliance + render verification, then ship (repo mirror + zip + docs).

## Setup (one time, per machine)

1. Clone the whatsapp-mock-generator repo (git clone
   https://github.com/nitinmp/whatsapp-mock-generator.git) — this is `MOCKGEN_ROOT`.
2. Install Python deps for the verification script: `pip install playwright && playwright install chromium`
3. This folder = the skill. Either:
   - **Claude Code**: copy this whole folder into `<your-project>/.claude/skills/`
     (or `~/.claude/skills/`), or
   - **Any agent**: paste the body of SKILL.md (below) into your instructions /
     AGENTS.md / GPT configuration, and attach the `references/` files as context.
4. Paths below use `MOCKGEN_ROOT`; replace it with the absolute path of your clone.
   Base journey templates ship in `base-journey/` (Hindustan RMC pair — our most
   polished shell: index + journey_contract, 10 steps, verified clean).

## Sources of truth (read before building)

| Thing | Path |
|---|---|
| Meta compliance (MANDATORY read) | `MOCKGEN_ROOT/guidelines/WHATSAPP_TEMPLATE_GUIDELINES.md` |
| CLAUDE.md (input format, screen types, visual spec) | `MOCKGEN_ROOT/CLAUDE.md` — read Input Format + Screen Types + Output Structure sections |
| Reference HTML templates (per screen type) | `MOCKGEN_ROOT/references/tmpl_*.html` (29 files) |
| Utility scripts (nav, screen-desc, index) | `MOCKGEN_ROOT/scripts/*.py` (inject_screen_descs.py, wire_journey_nav.py, gen_index.py) |
| Base journey shell (OUR convention) | `base-journey/` in this folder (index.html + journey_contract.html, 10 steps, verified clean) |
| Stock starter (CLAUDE.md's choice) | `MOCKGEN_ROOT/projects/Haldirams/journey_retailer_activation.html` (+ `index.html` for multi-journey) |

## Inputs (Phase 0 — intake)

Ask for or derive the **brand pack** (see `references/intake.md` for the template):
brand name + slug, industry, brand/accent colors, logo file or URL, positioning/tagline,
WhatsApp business/dealer name, real-world refs (screenshots/order formats — best ground
truth), and the **journey spec**: 6–10 steps, each with perspective
(buyer|seller|both|admin), screen type (full|group|webview|chat-only|notification|
admin-dashboard|admin-dashboard-flyout|campaign|diagram|flow-diagram), and screen count
(1–3). If the user gives less, derive: colors from the logo, steps from an existing
client's flow, screen types from the step description.

Pick the **base project**: default = `base-journey/` pair (our convention: docs + assets
+ zip + mirror). For single-file journeys per CLAUDE.md = Haldirams activation journey.

## Build pipeline

ALWAYS work in a scratch workspace (e.g. `~/work/<slug>/`), never inside MOCKGEN_ROOT's
projects/ until the final mirror step. Never edit the base project — clone it.

### Phase 1 — Scaffold project
```
mkdir -p <workdir>/<slug>/{projects/<Brand>,references,assets/brand}
```
Create BRAND_IDENTITY.md (brand pack), JOURNEY_ANALYSIS.md (journey spec + flow),
README.md, BUILD_LOG.md, PROJECT_STATUS.md.

### Phase 2 — Clone base
```bash
cp base-journey/index.html <workdir>/<slug>/projects/<Brand>/
cp base-journey/journey_contract.html <workdir>/<slug>/projects/<Brand>/journey_<flow>.html
```
Flow name = journey type (contract, order_to_cash, collections, field_ops_expense…).

### Phase 3 — Brand swap (mechanical)
Run `scripts/brand_swap.py` with a brand.json manifest (colors, initials, logo, titles).
It replaces `:root` CSS vars (--brand/--brand-dark/--accent), avatar initials,
`<title>`, `.journey-lbl`, index stat pills / journey card title + href, and embeds the
logo base64 ONCE (`.ava-logo` rule — never per phone frame). If any expected count
doesn't match it exits non-zero: fix manually, don't bypass.

```bash
python3 scripts/brand_swap.py --manifest brand.json --journey projects/<Brand>/journey_<flow>.html \
  --index projects/<Brand>/index.html --logo logo.png   # --dry-run to preview first
```

### Phase 4 — Content rewrite (the creative core)
Rewrite every screen for the client's real world, keeping the shell + structure:
- REAL numbers everywhere: ₹/unit, order refs (CON-2026-0527, IND-2026-0702, DC 00638),
  balances (40→22→18), timestamps with clock continuity (09:12 → 09:16 → 15:45) and
  date dividers between chapters
- WHY-caption under EVERY screen (`.screen-desc`): one-line selling insight
  ("Create is the moment the indent exists", "The buyer never gets cut out")
- Real terminology from client refs: group names, roles, order formats
- Two divergent role paths converging on one system artifact (buyer self-serve vs
  rep-in-group → same ERP voucher) shows role-awareness
- Everything mocked in pure CSS — zero images, fully self-contained
- Follow Meta rules (read `references/meta-compliance.md`); never put template cards
  in group steps; keep header/button char limits
- Sidebar steps + `const steps` array must stay in sync with step sections

### Phase 5 — Verification gate (MANDATORY, never skip)
```bash
python3 scripts/verify_journey.py projects/<Brand>/journey_<flow>.html \
  --expected-steps <N> --probes '{"1": ["<brand>"], ...}' --shots screenshots/
```
Must pass ALL checks: `<!DOCTYPE` at byte 0, `<meta charset` before byte 200,
`document.characterSet == UTF-8`, step count matches, every step navigates with zero
console/page errors, per-step text probes, Meta compliance greps. Then VISUALLY inspect
the screenshots (DM steps dark-teal top bar; group step no teal + white bar; webview no
teal; brand color present). Never declare done on file size or "it loads".

### Phase 6 — Ship
1. Copy to the repo: `cp -r projects/<Brand> MOCKGEN_ROOT/projects/` (byte-identical:
   `diff -q` must be silent)
2. Build share zip: `cd projects/<Brand> && zip -r <brand>-demo-share.zip index.html journey_*.html` (verify entries)
3. Update README/BUILD_LOG/PROJECT_STATUS with what was built + verification results
4. Screenshots into `projects/<Brand>/screenshots/`

## Pitfalls (read `references/pitfalls.md` for full signatures)

- **Charset/header-order bug (the big one)**: if the file starts with `<style>` and
  doctype/meta come later, browsers without UTF-8 sniffing show mojibake everywhere
  (`₹`→`â‚¹`, `—`→`â€"`, `·`→`Â·`). This is exactly why Phase 5 checks byte positions.
  Fix = rebuild header: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">...`
- Logo embed ONCE, never repeated per frame (bloats file, breaks embed rule)
- `const steps` is JS object literals (single quotes, unquoted keys) — regex-parse,
  never json.loads/ast.literal_eval
- Base64 data-URI icons stay inside CSS; don't paste them inline in body markup

## References

- `references/intake.md` — brand pack + journey spec template (CLAUDE.md input format)
- `references/meta-compliance.md` — condensed Meta rules + char limits
- `references/pitfalls.md` — failure signatures + fixes
- `scripts/brand_swap.py` — mechanical brand replacement (idempotent, dry-run)
- `scripts/verify_journey.py` — the render/compliance/structure gate
