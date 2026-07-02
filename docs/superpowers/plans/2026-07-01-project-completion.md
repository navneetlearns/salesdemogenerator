# Demo Generator — Project Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the demo-generator to a production-complete state — all rendering paths covered, deployment in sync, content adapter redesigned for reliability, structural debt retired, docs accurate.

**Architecture:** Static HTML demo generator (vanilla Handlebars) with 3 rendering paths (A: build.js static, B: client wizard, C: AI premium), 3 brands × 10 journeys, deployed on Cloudflare Pages with KV-backed share links.

**Tech Stack:** Node.js (run via `/mnt/c/Program Files/nodejs/node.exe`), vanilla Handlebars, Cloudflare Pages + Workers Functions + KV, Playwright visual regression, Python test orchestration.

---

## State Refresh (verified July 1, 2026)

| Claim (from skill reference / docs, June 30) | Actual (July 1) | Gap |
|----------------------------------------------|-----------------|-----|
| 70/70 tests pass | 70/70 pass | ✓ Confirmed |
| /api/health returns HTML not JSON | Still HTML (content-type: text/html, body is full HTML doc) | Bug persists — MIGRATION-2 unresolved |
| 28 modified screenshots + untracked tests uncommitted | 28 modified screenshots + 3 untracked files (redesign spec, test-runner.py, verify-test.png) | Same — needs commit |
| Path C: 6/10 JK Cement, 0 Haldiram, 0 Sundaram | Confirmed — only dist/jk_cement/premium/ exists (6 journeys) | 24 premium demos missing |
| 23 unpushed commits to origin/main | Confirmed | Live site is 23 commits behind — missing CSS/SVG refactor, base64 hub fix, post_order journeys |
| build.js 41KB | 41KB / 949 lines | Confirmed monolith |
| 2 industry files, thin | building_materials.json (450B), general.json (207B) | Confirmed — P4 |
| 7 per-journey label files, manual | Confirmed in data/content/ | P6 |
| Stale branches | develop, master (same commit), feature/bugfix-stabilize (has stash), feature/catalog-monolith | Cleanup needed |
| Content adapter redesign decision pending | 4 approaches documented, preliminary rec = Approach 1, scope (ii) | Awaits user decision |

---

## Open Work Tracks (ordered by dependency and impact)

### Track 1: Sync Deployment + Commit Pending Work (P0)
The live site is 23 commits behind local. Everything else is moot if the deployed product is stale.

### Track 2: Fix /api/health Routing (P1)
Health returns the stealth 404 HTML page instead of JSON. The catch-all in `functions/api/share.js` intercepts `/api/health` before the health Worker responds.

### Track 3: Content Adapter Redesign (P1 — needs decision)
The core architectural debt. 7 problems (P1-P7). 4 approaches spec'd, decision pending.

### Track 4: Complete Path C Premium Demos (P2)
24 missing premium demos (Haldiram + Sundaram Store, 10 journeys each, minus the 6 JK done).

### Track 5: Structural Debt Reduction (P3)
Split build.js (949 lines), measured rendered-output inline styles/SVGs, eliminate residual post-HBS replacement (ARCH-1/ARCH-2).

### Track 6: Branch Cleanup + Final Docs + Deploy (P3)
Delete stale branches, update README/ISSUES_AND_RESOLUTIONS/ARCHITECTURE to reflect final state, final deploy.

---

## Phased Plan

### Phase 0: Commit + Sync (Track 1)

**Files:**
- Stage: 28 modified `test-screenshots/*/*.png`, `test-custom-demo.py`, `test-runner.py`, `docs/superpowers/specs/2026-06-30-content-adapter-redesign.md`, `ISSUES_AND_RESOLUTIONS.md`, `test-screenshots/custom/verify-test.png`

- [ ] **Step 1: Review the uncommitted diff scope**
```bash
cd "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
git status --short
git diff --stat
```
Expected: 28 modified + 3 untracked, plus ISSUES_AND_RESOLUTIONS.md modified.

- [ ] **Step 2: Commit pending work in two logical commits**

Commit A (test baseline + scripts):
```bash
git add test-screenshots/ test-custom-demo.py test-runner.py
git commit -m "chore: update visual regression baselines + add test-runner.py orchestrator"
```

Commit B (spec + docs):
```bash
git add docs/superpowers/specs/2026-07-01-project-completion.md docs/superpowers/specs/2026-06-30-content-adapter-redesign.md ISSUES_AND_RESOLUTIONS.md
git commit -m "docs: content adapter redesign spec + project completion plan"
```

- [ ] **Step 3: Push to origin/main**
```bash
git push origin main
```
Expected: 25 commits pushed (23 existing + 2 new).

- [ ] **Step 4: Rebuild + deploy to Cloudflare Pages**
```bash
"/mnt/c/Program Files/nodejs/node.exe" build.js --dist
# Then deploy via wrangler or CF Pages git integration
```
Verify: `curl -s -o /dev/null -w "%{http_code}" https://demo-generator-482.pages.dev/api/brands.json` → 200.

### Phase 1: Fix /api/health Routing (Track 2)

**Files:**
- Modify: `functions/api/share.js` (remove/relax catch-all in `handleGet()`)
- Modify: `functions/api/health.js` (verify it returns JSON)

- [ ] **Step 1: Write failing test** — `GET /api/health` should return JSON `{ status: "ok" }`, not HTML.

- [ ] **Step 2: Inspect the catch-all** in `functions/api/share.js` `handleGet()` — it returns 404 HTML for any non-`/p/*` route. Change it to return `null`/passthrough for unrecognized routes OR explicitly not handle `/api/health`.

- [ ] **Step 3: Verify** — `curl -s -i https://demo-generator-482.pages.dev/api/health | head -5` → content-type: application/json, body `{"status":"ok"}`.

- [ ] **Step 4: Commit + deploy.** Update ISSUES_AND_RESOLUTIONS.md (mark MIGRATION-2 RESOLVED).

### Phase 2: Content Adapter Redesign (Track 3)

> **DECISION NEEDED before implementation.** Recommendation: **Approach 1 (Industry Profile System), scope (ii)** — labels + notification messages + screen descriptions. LLM becomes a dev-time CLI tool, not a runtime dependency.

**Files:**
- Create: `data/industries/cement.json`, `data/industries/fmcg.json`, `data/industries/pharma.json`, `data/industries/steel.json`, `data/industries/retail.json` (comprehensive profiles: labels + messages + descriptions + terminology)
- Create: `scripts/generate-industry-profile.js` — CLI LLM profile generator (uses OPENCODE_API_KEY at dev time only)
- Modify: `services/content-adapter.js` — refactor from LLM orchestrator to profile loader
- Modify: `build.js` (lines 373, 525, 669) — load industry profile, pass to template context
- Modify: `scripts/build-template-pack.js` — pack industry profiles for client-side
- Modify: `public/js/demo-renderer.js` (~line 331) — profile lookup instead of acceptedLabels merge
- Modify: `public/js/demo-ui.js` (~lines 858-918) — simplify/remove silent LLM call
- Modify/rename: `api/experiments/adapt-content.js` → repurpose or remove
- Remove: `api/experiments/save-content.js` (no runtime sessions on CF Pages)
- Update: `test/content-adapter.test.js`, `test/experiment-ui.test.js`
- Cleanup: `data/content/*_labels.json` (merge into industry profiles)

- [ ] **Step 1: Confirm approach + scope with user** (Approach 1, scope ii confirmed?)

- [ ] **Step 2: Author the cement industry profile** (`data/industries/cement.json`) — comprehensive: 21 labels + 10 messages + 10 descriptions + terminology. Use JK Cement as the reference.

- [ ] **Step 3: Write the profile loader** in `services/content-adapter.js` — `getIndustryProfile(industryId)` returns the profile; falls back to `general.json`. Ports existing tests.

- [ ] **Step 4: Wire build.js** — load profile matching brand's industry, inject into `journey.content` at the 3 call sites. Path A now uses deterministic industry labels.

- [ ] **Step 5: Wire demo-renderer.js** — client wizard looks up packed profile instead of acceptedLabels merge.

- [ ] **Step 6: Simplify demo-ui.js** — remove the silent adapt on Generate (or repurpose as "industry preview" toggle). If LLM is removed from the happy path, document OPENCODE_API_KEY as dev-time only.

- [ ] **Step 7: Build the CLI generator** — `scripts/generate-industry-profile.js --industry pharma` produces a draft JSON via OpenCode API for human review.

- [ ] **Step 8: Author remaining profiles** — fmcg, pharma, steel, retail (4 files). Run CLI, review, commit each.

- [ ] **Step 9: Merge per-journey label files** into industry profiles. Remove `data/content/*_labels.json` (7 files) after verifying coverage.

- [ ] **Step 10: Remove/repurpose** `api/experiments/adapt-content.js` and `api/experiments/save-content.js`.

- [ ] **Step 11: Update tests** — content-adapter.test (profile-based), experiment-ui.test (no LLM at runtime). Run full suite: 70+ tests pass.

- [ ] **Step 12: Commit + update docs** (README content adapter section, ISSUES_AND_RESOLUTIONS FIX-28 → RESOLVED, ARCHITECTURE.md content flow).

### Phase 3: Complete Path C Premium Demos (Track 4)

**Files:**
- Modify: `scripts/generate-premium.js` — add Haldiram + Sundaram Store brand support (logos, data, journey configs)

- [ ] **Step 1: Add Haldiram config** to generate-premium.js — brand data, logo (SVG), 10 journey templates.

- [ ] **Step 2: Generate Haldiram premium** — `node scripts/generate-premium.js all --brand haldirams` → `dist/haldirams/premium/` (10 files).

- [ ] **Step 3: Visual verify** — open 2-3 Haldiram premiums, check WhatsApp convo text, brand colors.

- [ ] **Step 4: Add Sundaram Store config** → generate 10 premiums → `dist/sundaram_store/premium/`.

- [ ] **Step 5: Update README premium section** (was "6 JK Cement", now "all 3 brands × 10 journeys").

- [ ] **Step 6: Commit + rebuild dist + deploy.**

### Phase 4: Structural Debt Reduction (Track 5)

- [ ] **Step 1: Measure real rendered-output debt** — grep `style="` and `<svg` in `generated/*/journey.html` and `dist/*/index.html` (NOT the partials dir, which overcounts after extraction).

- [ ] **Step 2: Split build.js** — extract: data-loader, enricher, renderer, dist-packager, premium-hook into `lib/` modules. Keep build.js as orchestrator (<200 lines). Run tests after each extraction to catch scope bugs.

- [ ] **Step 3: Eliminate residual post-HBS replacement** (ARCH-1/ARCH-2) — audit `data/brands/*.json` `replacements` objects; convert remaining string swaps to data-driven Handlebars context.

- [ ] **Step 4: Commit** module-extraction commits individually with passing tests between each.

### Phase 5: Branch Cleanup + Final Docs + Deploy (Track 6)

- [ ] **Step 1: Resolve stash** on `feature/bugfix-stabilize` — inspect `git stash show -p stash@{0}`, decide apply or drop.

- [ ] **Step 2: Delete stale branches** — develop, master, feature/bugfix-stabilize, feature/catalog-monolith (after confirming no unique work).

- [ ] **Step 3: Full docs audit** — README (brand table 6→10 journeys, premium status, content adapter), ARCHITECTURE.md (new module structure), ISSUES_AND_RESOLUTIONS.md (mark all resolved), USER_MANUAL.md (wizard flow if content adapter changed).

- [ ] **Step 4: Final build + test + visual regression** — `node build.js --dist`, run suite (expect 70+), `python3 test-runner.py`.

- [ ] **Step 5: Push + deploy.** Verify live: brands.json, health, a premium URL, a share URL.

---

## Verification Checklist

After all phases, verify:

1. `"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js` → all pass (70+)
2. `curl -s -i https://demo-generator-482.pages.dev/api/health` → `content-type: application/json`, body `{"status":"ok"}`
3. `curl -s -o /dev/null -w "%{http_code}" https://demo-generator-482.pages.dev/api/brands.json` → 200
4. `curl -s -o /dev/null -w "%{http_code}" https://demo-generator-482.pages.dev/p/jk_cement/test/` → not 404 vanity
5. `ls dist/{jk_cement,haldirams,sundaram_store}/premium/ | wc -l` → 30 (10 per brand)
6. `python3 test-runner.py` → visual regression passes against deployed URL
7. `git log --oneline origin/main..HEAD` → empty (deployed = local)
8. No `data/content/*_labels.json` files remain (merged into industry profiles)
9. `OPENCODE_API_KEY` is referenced only in `scripts/generate-industry-profile.js` (dev-time), not in any runtime path
10. `wc -l build.js` → <200 lines (orchestrator only)

---

## Decisions Required Before Implementation

1. **Content Adapter approach:** Approach 1 (Industry Profile, data-first) confirmed? Or 2/3/4?
2. **Content Adapter scope:** (i) labels only, (ii) labels + messages + descriptions [recommended], or (iii) + WhatsApp tone?
3. **Industries to pre-build:** Cement, FMCG, Pharma, Steel, Retail — which? Others?
4. **Path C priority:** Complete all 24 missing premiums now, or defer until content adapter lands (so premiums use new industry labels)?
5. **Stash on feature/bugfix-stabilize:** Apply it or drop it?