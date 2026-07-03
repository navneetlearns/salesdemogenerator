# Demo Generator — Project Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the demo-generator to a production-complete state — all rendering paths covered, deployment in sync, content adapter redesigned for reliability (Supabase-backed), legacy WhatsApp-mock-generator client projects adapted into the data-driven structure, structural debt retired, docs accurate.

**Architecture:** Static HTML demo generator (vanilla Handlebars) with 3 rendering paths (A: build.js static, B: client wizard, C: AI premium), 3 brands × 10 journeys, deployed on Cloudflare Pages with KV-backed share links. **Long-term backend: Supabase** (managed Postgres + Storage + auto REST API + admin UI) — serves as the single source of truth for content (industry profiles, brand metadata, journey overrides) and images (replaces both ad-hoc JSON files on disk and the LLM-driven content adapter). One Supabase project will serve both this repo and the legacy `whatsapp-mock-generator-main` client projects being migrated in as Track 0.

**Tech Stack:** Node.js (run via `/mnt/c/Program Files/nodejs/node.exe`), vanilla Handlebars, Cloudflare Pages + Workers Functions + KV, Playwright visual regression, Python test orchestration, Supabase (Postgres + Storage + PostgREST + RLS + Studio admin).

---

## State Refresh (July 3, 2026 — verified against filesystem + git log)

| Claim (from July 1 plan) | Actual (July 3) | Delta |
|----------------------------------------------|-----------------|-------|
| 70/70 tests pass | Not re-run today; believe stable | Verify before claiming done |
| /api/health returns HTML not JSON | `functions/api/health.js` written (untracked) | Fix WRITTEN, not committed/deployed — tracked as Phase 1 |
| 28 modified screenshots + 3 untracked files | All committed in `5a07d0e` + `780b17d` (July 2) | Phase 0 DONE — see below |
| Path C: 6/10 JK Cement, 0 Haldiram, 0 Sundaram | Confirmed — 6 files in `dist/jk_cement/premium/` | Deferred per user direction July 3 — see Track 4 (DEFERRED) |
| 23 unpushed commits to origin/main | Synced July 2 — `git log origin/main..HEAD` empty | Phase 0 DONE |
| build.js 949 lines | 949 lines / confirmed monolith | Phase 4 still open |
| 2 industry files, thin | `building_materials.json` (450B), `general.json` (207B) | Confirmed — P4 |
| 7 per-journey label files, manual | Confirmed in `data/content/` | P6 |
| Stale branches | develop, master (same commit), feature/bugfix-stabilize (has stash), feature/catalog-monolith | Cleanup still pending (Phase 5) |
| Content adapter redesign decision pending | **DECISION MADE July 3** — Approach A (Industry Profile System), scope iii (labels + messages + descriptions + WhatsApp tone), **pivot to Supabase backend** | See new spec: `docs/superpowers/specs/2026-07-03-supabase-content-backend-design.md` |
| Path C priority (build now vs defer) | **DEFERRED INDEFINITELY** by user directive July 3 (*"forget about premium — top priority is content"*) | Phase 3 marked OUT OF SCOPE |
| Industries to pre-build | Recommended Cement + FMCG + Retail (covers live brands); Pharma/Steel speculative | Confirmed in spec |
| Stash on `feature/bugfix-stabilize` | Still unapplied, still unreviewed | Defer to Phase 5 cleanup |

**New track added July 3 (USER DIRECTIVE — primary priority):** Migrate the 22 legacy `whatsapp-mock-generator-main` client projects into the demo-generator's data-driven structure. Originals untouched; copies in `migration/projects/` (untracked git). See Track 0 below.

---

## Open Work Tracks (ordered by dependency and impact, July 3 refresh)

### Track 0: Legacy Project Migration (P0 — PRIMARY, per user directive)
Adapt the 22 client projects from `whatsapp-mock-generator-main` into the
demo-generator's structure. State: foundations DONE and committed (see
spec §5 for the breakdown). Remaining: content extraction → brand JSON →
new journey-type modules → Supabase seeding. See spec
`2026-07-03-supabase-content-backend-design.md` for the full phase sequence.

### Track 1: Sync Deployment + Commit Pending Work (P0) — DONE July 2
Phase 0 of the original plan. Synced 25 commits to origin/main, committed
visual baselines + content adapter spec + plan. See ISSUES_AND_RESOLUTIONS.md
PHASE-0 entry.

### Track 2: Fix /api/health Routing (P1) — Phase 1 IN PROGRESS
`functions/api/health.js` written (untracked), returns JSON, verified locally.
Pending: commit + deploy + live verification.

### Track 3: Content Adapter Redesign via Supabase (P1 — DECISION MADE)
Spec ready at `docs/superpowers/specs/2026-07-03-supabase-content-backend-design.md`. Implements Approach A, scope iii, Supabase backend. Supersedes the flat-JSON approach in `2026-06-30-content-adapter-redesign.md`.

### Track 4: Path C Premium Demos (DEFERRED INDEFINITELY)
Originally P2. User directive July 3: defer until further notice. The 6 existing JK Cement premiums in `dist/jk_cement/premium/` stay as-is. No Haldiram / Sundaram premiums to be generated.

### Track 5: Structural Debt Reduction (P3)
Split build.js (949 lines), audit residual post-HBS replacement (ARCH-1/ARCH-2), eliminate empty block partials (STR-4).

### Track 6: Branch Cleanup + Final Docs + Deploy (P3)
Delete stale branches, resolve stash on `feature/bugfix-stabilize`, final docs audit, final deploy.

---

## Phased Plan (refreshed July 3)

### Phase 0: Commit + Sync — DONE (July 2)

**Status:** ✅ COMPLETE
**Commits:** `5a07d0e`, `780b17d`
**Evidence:** `git log --oneline origin/main..HEAD` returns empty.

### Phase 1: Fix /api/health Routing — IN PROGRESS (July 2)

**Files:**
- Modify: `functions/api/health.js` (already written, untracked) — exports `onRequest`, returns JSON `{"status":"ok","version":"1.0.0","mode":"static"}` with `Content-Type: application/json`.
- Update: `ISSUES_AND_RESOLUTIONS.md` (MIGRATION-2 → RESOLVED) — already done in uncommitted diff.

- [ ] **Step 1:** Verify locally — `curl -sI http://localhost:PORT/api/health` (if preview server runs) OR inspect file content.
- [ ] **Step 2:** Commit `functions/api/health.js` + `ISSUES_AND_RESOLUTIONS.md`.
- [ ] **Step 3:** Push + wait for CF Pages auto-deploy.
- [ ] **Step 4:** Verify live — `curl -sI https://demo-generator-482.pages.dev/api/health` → `content-type: application/json`, body `{"status":"ok",...}`.

### Phase 2: Legacy Project Migration (NEW — PRIMARY)

> Reference: `docs/superpowers/specs/2026-07-03-supabase-content-backend-design.md`

**Sub-phase 2.1: Foundations — ✅ COMPLETE**

- [x] Copy 22 client projects to `migration/projects/` (commit `065d623`).
- [x] Author `migration/scripts/extract_project_manifest.py` + produce `manifest.json` / `manifest.csv` (commit `065d623`).
- [x] Author `migration/scripts/extract_images.py` + extract images (commit `5e19e2d`): 236 unique images across 80 HTML files, working HTML size 175MB → 12MB (93% reduction).

**Sub-phase 2.2: Content extraction — PENDING**

**Files:**
- Create: `migration/scripts/extract_content.py` — parses slimmed HTMLs to JSON.
- Create: `migration/extracted/{brand}_{journey}.json` — per-HTML extracted content.

- [ ] **Step 1:** Run `migration/scripts/_inspect_structure.py` (already written but uncommitted) to compare a legacy HTML structure vs `data/journeys/jk_cement_order_to_cash.json` so the extractor knows what fields to emit.
- [ ] **Step 2:** Write `migration/scripts/extract_content.py` — extract per-HTML: steps (num, title, description, screen count), screens (`screen-lbl`/`screen-desc`), message bubbles (`msg-body` content), and emit a JSON matching the `data/journeys/{brand}_{journey}.json` schema (`id, title, description, industry, brands, steps, cart, messages, dealer, order, invoice, payment, ledger, step3, productNames, hubMeta`).
- [ ] **Step 3:** Run across all 80 non-hub HTML files. Produce one JSON per legacy HTML in `migration/extracted/`.
- [ ] **Step 4:** Spot-check 2–3 outputs against the legacy HTML (visual diff) and against the existing `data/journeys/jk_cement_*.json` to confirm structural parity.
- [ ] **Step 5:** Commit `migration/scripts/extract_content.py` + `migration/scripts/_inspect_structure.py` (force-add) + `migration/extracted/` as a JSON-only dataset (extracted JSON is small, git-trackable).

**Sub-phase 2.3: Brand metadata extraction — PENDING**

- [ ] **Step 1:** Aggregate per-project brand metadata from the manifest (brand name from `<title>`, colors from CSS `:root` vars, brand `slug` from project folder name).
- [ ] **Step 2:** Generate `data/brands/{slug}.json` for each of the 22 legacy brands — match the schema of `data/brands/jk_cement.json` (`id, name, industry, colors, theme, font, dealerStoreName, secondaryDealers`).
- [ ] **Step 3:** Industry classification: map each brand to an industry (cement / fmcg / retail / steel / pharma / general) using project name + journey content. Initial mapping:
  - jkcement, OrientElectric (cement?) → cement (verify OrientElectric is actually "Orient Electric" the fans/lighting brand, not cement)
  - haldirams, sundar_masala, Banas_Diary, Atharva, freyr(?) → fmcg
  - sundaram_store, Adani Wilmar, V[N] Fogg, lucky_seeds, SakkuGroup → retail
  - BlueOcean, Hindalco, Sintex → steel/materials (verify)
  - Recykal → recycling (new industry)
  - Others → general
- [ ] **Step 4:** Copy brand logos from `migration/projects/<brand>/_images/` (where extracted from the index HTML) → `assets/brands/{slug}/logo.png`. Many legacy projects don't have a separate logo file; for those, default to a placeholder.
- [ ] **Step 5:** Commit brand JSON + extracted logos.

**Sub-phase 2.4: New journey-type modules (for 9 unknowns) — PENDING**

**Files:** (TBD after Sub-phase 2.3 reveals the actual step/screen content of the 9 non-canonical journeys)
- Create: `templates/partials/step{N}-{journey_name}.hbs` for each genuinely-new journey.
- Update: journey-id whitelist (`scripts/journey-core.js`, `build.js` journey plan).
- Or: add alias entries mapping legacy names to canonical journeys where overlap is strong.

- [ ] **Step 1:** For each of the 9 unknown journey types (see spec §5 list), open the extracted JSON from Sub-phase 2.2 and compare step titles + screen descriptions with the nearest canonical journey. Classify as (a) reuse-canonical (alias), (b) new-journey-needed.
- [ ] **Step 2:** For each new-journey-needed: plan new partials (one per WhatsApp chat screen layout the journey introduces), add to `templates/partials/`, register in `journey-core.js`.
- [ ] **Step 3:** For each reuse-canonical: add an alias entry in `journey-core.js` so the legacy project's journeys map to the canonical id at build time.

### Phase 3: Content Adapter via Supabase (DECISION MADE)

> Reference: `docs/superpowers/specs/2026-07-03-supabase-content-backend-design.md` (supersedes the flat-JSON approach documented in `2026-06-30-content-adapter-redesign.md`).

**Prerequisite:** Supabase project provisioned by user (URL + anon key + service-role key in `.env`). Agent cannot create Supabase projects on the user's behalf.

**Files:**
- Create: Supabase migrations (DDL + RLS policies + storage bucket) — saved as `supabase/migrations/YYYYMMDDHHMMSS_init.sql` (or raw SQL in `migration/supabase/schema.sql`).
- Seed data: `migration/supabase/seed-industries.sql`, `migration/supabase/seed-brands.sql` — Cement, FMCG, Retail profiles + JK Cement, Haldirams, Sundaram Store brand rows.
- Create: `services/supabase-client.js` — minimal PostgREST fetch helpers (uses anon key only).
- Modify: `services/content-adapter.js` — rewrite from LLM orchestrator to Supabase profile loader. `getIndustryProfile(industryName)` and `applyProfileToJourney(profile, journey, brand)`.
- Modify: `build.js` (lines 373, 525, 669) — call `applyProfileToJourney` instead of `buildJourneyContent({})`.
- Modify: `public/js/demo-renderer.js` (~331) — fetch profile live instead of `acceptedLabels` merge.
- Modify: `public/js/demo-ui.js` (~858–918) — populate wizard industry dropdown from `/rest/v1/industries`; remove silent adapt call.
- Modify: `scripts/build-template-pack.js` — pack industry profiles for client-side.
- Remove: `api/experiments/adapt-content.js`, `api/experiments/save-content.js`.
- Remove: `data/content/*_labels.json` (7 manual label files — merged into industry profiles in `industries.labels`).
- Update: `test/content-adapter.test.js`, `test/experiment-ui.test.js`.
- Update: `.env.example` to document `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1:** Confirm Supabase credentials present in `.env` (user action — cannot proceed until done).
- [ ] **Step 2:** Apply schema migration. Tables: `industries`, `brands`, `journeys`, `images_meta`. Configure RLS (public read, admin write). Create `demo-assets` bucket with public read.
- [ ] **Step 3:** Seed Cement / FMCG / Retail industry rows by hand-authoring JSON content using existing demo-generator data as source (`data/industries/building_materials.json`, `data/content/order_to_cash_labels.json`, data/journeys/jk_cement_order_to_cash.json's `messages` object). Migrate to scope iii by promoting WhatsApp conversation text into profile `messages` (parameterize `{{brandName}}`, `{{dealerStoreName}}`).
- [ ] **Step 4:** Write `services/supabase-client.js` + `services/content-adapter.js` rewrite. Port existing tests.
- [ ] **Step 5:** Wire build.js. Run `node build.js --dist` against Supabase; build all 3 live brands without LLM calls.
- [ ] **Step 6:** Wire demo-renderer.js + demo-ui.js. Run client wizard; verifying industry dropdown loads live from Supabase.
- [ ] **Step 7:** Upload existing images in `assets/brands/`, `assets/products/` to `demo-assets` bucket. Populate `images_meta` rows. Update templates to reference Supabase Storage URLs (or use build-time URL rewriting).
- [ ] **Step 8:** Delete `api/experiments/adapt-content.js`, `save-content.js`, `data/content/*_labels.json`. Update tests.
- [ ] **Step 9:** Run full suite — `node --test test/*.test.js` (70+), `python3 test-runner.py` (visual regression). Update docs in same commit: README adapter section, ISSUES_AND_RESOLUTIONS FIX-28 → RESOLVED, ARCHITECTURE.md content flow + new Supabase layer.

### Phase 4: Structural Debt Reduction (UNCHANGED from original P3)

- [ ] **Step 1:** Measure real rendered-output debt — `grep` for `style="` and `<svg` in `generated/*/journey.html` and `dist/*/index.html` (NOT partials dir, which overcounts after extraction).
- [ ] **Step 2:** Split build.js — extract data-loader, enricher, renderer, dist-packager, premium-hook into `lib/` modules. Keep build.js as orchestrator (<200 lines). Run tests after each extraction.
- [ ] **Step 3:** Eliminate residual post-HBS replacement (ARCH-1/ARCH-2).
- [ ] **Step 4:** Commit module-extraction commits individually with passing tests between each.

### Phase 5: Branch Cleanup + Final Docs + Deploy (UNCHANGED)

- [ ] **Step 1:** Resolve stash on `feature/bugfix-stabilize` (`git stash show -p stash@{0}`).
- [ ] **Step 2:** Delete stale branches — develop, master, feature/bugfix-stabilize, feature/catalog-monolith (after confirming no unique work).
- [ ] **Step 3:** Full docs audit — README (brand table → 22 migration entries or pointer to migration doc, premium status = deferred, content adapter → Supabase), ARCHITECTURE.md (new Supabase layer diagram + content flow), ISSUES_AND_RESOLUTIONS.md (mark all resolved / mark premium deferred), USER_MANUAL.md (new Supabase-backed wizard flow).
- [ ] **Step 4:** Final build + test + visual regression.
- [ ] **Step 5:** Push + deploy. Verify live: brands.json, health, a premium URL, a share URL.

---

## Verification Checklist (refreshed July 3)

After all phases, verify:

1. `"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js` → all pass (70+)
2. `curl -sI https://demo-generator-482.pages.dev/api/health` → `content-type: application/json`, body `{"status":"ok"}`
3. `curl -s -o /dev/null -w "%{http_code}" https://demo-generator-482.pages.dev/api/brands.json` → 200
4. `curl -s -o /dev/null -w "%{http_code}" https://demo-generator-482.pages.dev/p/jk_cement/test/` → not 404 vanity
5. `grep -rn OPENCODE_API_KEY api/ services/ public/` → 0 hits (dev-time only)
6. `python3 test-runner.py` → visual regression passes against deployed URL
7. `git log --oneline origin/main..HEAD` → empty
8. `wc -l build.js` → <200 lines (orchestrator only)
9. `ls migration/extracted/*.json | wc -l` → 80+ extracted JSONs (one per legacy journey HTML)
10. `ls data/brands/*.json` → at least the original 3 (jk_cement, haldirams, sundaram_store) plus any legacy brands added via Sub-phase 2.3 (or those entries exist as Supabase `brands` rows, depending on Phase 3 completion order)
11. Supabase: `/rest/v1/industries` returns ≥3 rows (cement, fmcg, retail); `/rest/v1/brands` returns ≥3 rows.
12. Supabase Storage: `demo-assets` bucket contains the active brands' logos + product images; `GET` on a Storage URL returns 200.

---

## Decisions Required Before Implementation

1. ✅ **Content Adapter approach:** Approach 1 (Industry Profile System) — CONFIRMED July 3.
2. ✅ **Content Adapter scope:** (iii) labels + messages + descriptions + WhatsApp tone — CONFIRMED July 3.
3. ✅ **Storage backend:** Supabase (Postgres + Storage + auto REST + Studio) — CONFIRMED July 3.
4. ✅ **Industries to pre-build:** Cement + FMCG + Retail (covers live brands) — CONFIRMED July 3.
5. ✅ **Path C priority:** DEFER INDEFINITELY per user directive July 3.
6. ✅ **22 legacy client projects:** PRIMARY priority — adapt to demo-generator without touching originals.
7. ⏳ **Supabase project credentials:** User must create the Supabase project and supply URL + anon key + service-role key to `.env`. Blocked on this before Phase 3 starts.
8. ⏳ **Stash on `feature/bugfix-stabilize`:** Review + decide apply or drop. Defer to Phase 5.