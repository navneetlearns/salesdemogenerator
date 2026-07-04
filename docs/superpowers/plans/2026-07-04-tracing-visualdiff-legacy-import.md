# Demo Generator Completion — Tracing, Visual Diff & Legacy Import

> **For agentic workers:** Inline sequential execution (no subagent dispatch tool available in Hermes CLI).

**Goal:** Stabilize the project with systematic error tracing and visual regression testing, then import the 22 legacy brands into the live UI.

**Architecture:** Add a lightweight structured logger (pino) to all build-time and service files for debuggable error traces; extend the existing Playwright test pipeline with pixel-level visual diffs of actual journey pages; then bulk-import legacy brand+journey data into `data/journeys/` and wire the industry dropdown to Supabase.

**Tech Stack:** Node.js (pino for logging), Playwright (pixel diff), Python (data import), Supabase REST API.

---

## Tasks

### Task 1: Structured logging across all services

**Files:**
- Create: `lib/logger.js` — pino-based logger with call-site context
- Modify: `build.js` — replace ad-hoc console.log/warn/error with logger
- Modify: `services/content-adapter.js` — replace console.warn with logger
- Modify: `scripts/supabase-client.js` — add request tracing
- Modify: `scripts/build-template-pack.js` — structured logging
- Modify: `scripts/generate-premium.js` — structured logging
- Install: `pino` npm package

- [ ] **Step 1: Install pino**
  Run: `npm install pino` in the project root.

- [ ] **Step 2: Create `lib/logger.js`**
  Exports a logger factory with file/line context via `pino` + `Error.stack`. Provides:
  - `log.info(ctx, msg)` — general info
  - `log.warn(ctx, msg)` — warnings
  - `log.error(ctx, err)` — errors with stack traces
  - `log.debug(ctx, msg)` — verbose debug
  Each logger is bound to a module name.

- [ ] **Step 3: Instrument `services/content-adapter.js`**
  Replace console.warn calls with structured logger calls, include industry name, brand, etc. in context objects.

- [ ] **Step 4: Instrument `build.js`**
  Replace console.log in the main build pipeline with structured logging calls. Add timing info per brand.

- [ ] **Step 5: Instrument `scripts/supabase-client.js`**
  Add request/response logging for every Supabase API call (method, table, status, duration).

- [ ] **Step 6: Verify build still works + 72/72 tests pass**
  Run: `node build.js --dist` then `node --test test/*.test.js`

- [ ] **Step 7: Commit**

### Task 2: Visual diff testing for journey look-and-feel

**Files:**
- Create: `test/test-visual-diff.py` — Playwright pixel-diff for all 30 journey pages
- Modify: `test-runner.py` — add Tier 4: visual diff
- Create: `test-screenshots/diff-baseline/` — baseline directory (not committed in git, generated first run)

- [ ] **Step 1: Create visual diff test script**
  Python script using Playwright to:
  1. Navigate to each of the 30 journey pages (3 brands × 10 journeys)
  2. Take full-page screenshot
  3. Compare against baseline screenshot using pixelmatch
  4. Report any pages with >1% pixel difference
  5. Save diffs to `test-screenshots/diff/`

- [ ] **Step 2: Run first pass to generate baselines**
  Target local `dist/` served via a dev server. Generate baseline screenshots.

- [ ] **Step 3: Integrate with `test-runner.py`**
  Add Tier 4: visual diff to the existing runner. Run all 4 tiers.

- [ ] **Step 4: Commit**

### Task 3: Import legacy brands to UI

**Files:**
- Create: `scripts/import-legacy-brands.js` — imports migration/extracted JSONs into data/journeys/
- Modify: `data/brands/` — add 22 brand JSON files
- Modify: `build.js` — pick up new brands

- [ ] **Step 1: Write import script**
  Reads `migration/extracted/*.json` and `migration/brand_metadata/*.json`, generates per-brand per-journey files in `data/journeys/` and brand config files in `data/brands/`.

- [ ] **Step 2: Run import**
  Generates ~22 brand JSONs + ~76 journey JSONs.

- [ ] **Step 3: Build and verify**
  Run build. Verify new brands appear in `dist/api/brands.json`.

- [ ] **Step 4: Commit**

### Task 4: Live industry dropdown from Supabase

**Files:**
- Modify: `public/js/demo-ui.js` — fetch industries from Supabase via publishable key
- Modify: `public/js/demo-renderer.js` — remove hardcoded acceptedLabels merge
- Remove: `public/js/app.js` — old hardcoded industry list

- [ ] **Step 1: Wire demo-ui.js to fetch from Supabase**
  On wizard load, `GET /rest/v1/industries?select=name,label&order=label.asc` with publishable key.

- [ ] **Step 2: Remove old hardcoded lists**
  Clean up.

- [ ] **Step 3: Build, test, verify**
  Check the wizard's industry dropdown loads from Supabase.

- [ ] **Step 4: Commit, push, deploy**

---

## Verification Checklist

1. `node build.js --dist` succeeds with structured logs visible
2. `node --test test/*.test.js` → 72/72 pass
3. `python3 test-runner.py` → all 4 tiers pass (including visual diff)
4. `dist/api/brands.json` includes legacy brands after import
5. Client wizard industry dropdown loads from Supabase
6. `git push origin main` deploys to Cloudflare Pages
