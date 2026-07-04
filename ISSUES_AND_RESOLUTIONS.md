# Issues & Resolutions: Demo Generator

> Computed from live analysis of the codebase and generated output.
> Branch: `main`
> Last updated: July 4, 2026. Tests: 72/72 pass. Supabase backend live. Deployed on Cloudflare Pages.
> Local and origin/main in sync. Content adapter rewritten — no LLM runtime dependency.

---

## CLOUDFLARE PAGES MIGRATION (June 20, 2026)

### MIGRATION-1: Vercel to Cloudflare Pages

**Why:** Vercel serverless body limit (4.1MB) breaks when sharing custom demos with 29+ journeys. KV storage limited to 25MB per key. Need to scale for 20+ additional journeys.

**What changed:**
- Deployment target: Vercel → Cloudflare Pages
- API endpoints: Vercel serverless → Cloudflare Workers (Pages Functions)
- Share storage: Vercel Blob → Cloudflare KV
- Share URLs: `/api/share?token=abc` → `/p/{brand}/{slug}/` (branded, hides generator)

**Files created:**
- `functions/_middleware.js` — CORS middleware
- `functions/api/health.js` — Health check endpoint
- `functions/api/share.js` — Share create/retrieve with branded URLs
- `functions/api/experiments/adapt-content.js` — LLM content adaptation
- `functions/api/experiments/save-content.js` — Save adapted content
- `wrangler.toml` — Cloudflare Pages + KV config
- `dist/robots.txt` — Blocks all crawlers
- `dist/404.html` — Stealth 404 page

**Files modified:**
- `build.js` — Generates `dist/api/brands.json` and `dist/api/journeys.json`
- `package.json` — Added `deploy:cf`, `deploy:cf:prod`, `preview:cf` scripts

**Cloudflare Resources:**
- Pages project: `demo-generator`
- KV namespace: `SHARES` (id: `69cfff0c6dbd45299d9fefb059fee0e9`)
- Live at: `https://demo-generator-482.pages.dev`

**Security features:**
- Root URL returns stealth 404 (no site purpose revealed)
- `robots.txt: User-agent: * Disallow: /` (blocks all crawlers)
- Share links use branded paths: `/p/{brand}/{slug}/`
- No public listing of available demos

### MIGRATION-2: /api/health Returns HTML Instead of JSON — RESOLVED (July 2)

**Issue:** `GET /api/health` returned a full HTML page (stealth 404) with `Content-Type: text/html` instead of JSON.

**Root cause:** The old Vercel-style `api/health.js` (Express handler) does not run on Cloudflare Pages. No Pages Function existed at `functions/api/health.js`. The static build produced `dist/api/health.json` but the URL `/api/health` (no extension) did not match it, so CF Pages served the SPA fallback (`index.html`).

**Resolution:** Created `functions/api/health.js` as a proper Cloudflare Pages Function. It exports `onRequest`, returns 204 for OPTIONS preflight, and serves `{"status":"ok","version":"1.0.0","mode":"static"}` with `Content-Type: application/json` for GET.

**Verified:** `curl -sI https://demo-generator-482.pages.dev/api/health` returns `content-type: application/json` and body `{"status":"ok","version":"1.0.0","mode":"static"}`.

**Files changed:** `functions/api/health.js` (created).

**Status:** RESOLVED July 2, 2026.

---

## RESOLVED (June 2026)

### FIX-10: Hub page clicks broken — srcdoc/document.write don't execute scripts (June 10)

**Issues:**
1. Preview iframe used `srcdoc` — hub HTML with inline `<script>` (loadJourney, backToCards) didn't execute
2. v2 config share used `document.write()` — same problem on the share page
3. Journey cards on hub page were unclickable (onclick handlers never defined)

**Root cause:** Both `srcdoc` and `document.write()` fail to execute inline `<script>` blocks in large HTML documents. The hub HTML embeds journey data in `<script type="text/plain">` tags and defines click handlers in a regular `<script>` — neither approach runs the JavaScript reliably.

**Resolution:**
- Preview iframe: `srcdoc` → Blob URL (`URL.createObjectURL` + `iframe.src`)
- v2 config share: `document.write()` → Blob URL in iframe (loading spinner → iframe appears on load)
- Both paths now use `Blob([html], {type: "text/html"})` → `URL.createObjectURL(blob)` → `iframe.src = url`
- Scripts execute reliably in the isolated Blob URL context

### FIX-11: v3 multi-blob share — two-step upload architecture (June 10)

**Problem:** Sharing a multi-journey demo (9 journeys) sent all HTML in a single POST body (~1.8MB), hitting Vercel's ~4.1MB serverless limit (HTTP 413).

**Resolution:** Two-step upload that keeps each request small:
- **Step 1:** `POST /api/share { config, journeyTypes }` → creates hub metadata blob (~2KB), returns hub token
- **Step 2:** `POST /api/share { hubToken, journeyType, html }` → stores one journey blob (~200KB each), called N times sequentially
- **Hub page:** `GET /api/share?token=xxx` → serves Haldiram-style two-panel HTML that fetches journeys dynamically via `fetch("/api/share?token=xxx&journey=otc")` + Blob URL iframes
- Client shows upload progress ("Uploading journey 3 of 9...")
- Each request stays well under the 4.1MB limit
- Backward compatible: v1 (HTML blob) and v2 (config re-render) still work

**Files changed:** `lib/share-store.js` (initHub, addJourneyToHub), `api/share.js` (serveMultiBlobHub, route logic), `public/js/demo-ui.js` (two-step upload flow)

### FIX-12: Hub card generation syntax error — FUNCTION_INVOCATION_FAILED (June 10)

**Issue:** `serveMultiBlobHub` in `api/share.js` had a JavaScript syntax error — the `onclick` handler escaping was broken. `\\'` in a single-quoted string terminates the string, causing `SyntaxError: Invalid or unexpected token`. This crashed the entire module, making ALL POST requests to `/api/share` fail with `FUNCTION_INVOCATION_FAILED`.

**Root cause:** Building HTML with inline `onclick="loadJourney('...')"` inside a JavaScript string literal requires complex backslash escaping that doesn't work in single-quoted strings.

**Resolution:** Replaced `onclick` with `data-journey` attribute + event delegation:
```javascript
// Before (broken):
cardsHtml += '<div onclick="loadJourney(\'' + jt + '\')">'
// After (works):
cardsHtml += '<div data-journey="' + jt + '">'
// + event listener:
document.getElementById("hp-cards").addEventListener("click", function(e) {
  var card = e.target.closest("[data-journey]");
  if (card) window.loadJourney(card.getAttribute("data-journey"));
});
```

### FIX-13: Safe JSON parsing for API responses (June 10)

**Issue:** Client called `res.json()` on API responses without checking Content-Type. When server returned non-JSON error pages (Vercel 502/503, infrastructure errors), client threw cryptic `Unexpected token 'A', "A server e"... is not valid JSON`.

**Resolution:** Added `safeJson()` helper that reads response as text first, then tries `JSON.parse`. On parse failure, throws a readable error with the first 200 chars of the response body. Applied to both init hub and per-journey upload POST requests.

### FIX-14: Hub card descriptions blank in custom demo/share hub (June 10)

**Issue:** Custom demo hub cards could render with blank descriptions when `journeyDescriptions` was incomplete or unavailable. The v3 share hub also had a separate server-rendered card path that showed only title/description and did not expose step count or tags.

**Root cause:** The client hub trusted `pack.journeyDescriptions` too strongly, and the server share hub in `api/share.js` maintained a compact metadata table without step/tag UI. The two paths drifted.

**Resolution:**
- Added `getHubCardMeta()` in `public/js/demo-renderer.js`.
- `buildHomePage()` and `buildMultiJourneyHtml()` now fall back through journey data, first-step metadata, and safe defaults.
- `api/share.js` v3 hub metadata now includes step counts and tags for each known journey.
- Regression coverage added in `test/demo-renderer.test.js` and `test/api-share.test.js`.

### FIX-15: Order to Cash SAP architecture diagram enlarged full-width (June 10)

**Issue:** The Order to Cash SAP architecture diagram expanded to the full available width, making the architecture image too large inside the journey.

**Root cause:** `templates/partials/step6-sap-architecture.hbs` used inline wrapper/image styles with `width:100%`, so the image scaled with the viewport/container instead of staying at a controlled diagram size.

**Resolution:**
- Replaced inline sizing with `.sap-architecture-card` and `.sap-architecture-img`.
- Added bounded sizing in `templates/layouts/style.css`: desktop max 920px wide / 560px high, mobile bounded by viewport height.
- Regenerated `public/template-pack.json` so dynamic wizard demos use the same partial/CSS.
- Added a static regression test to prevent restoring inline full-width image sizing.

### FIX-5: Hub page redesign — 4 issues resolved (June 10)

**Issues:**
1. File size too large for share link (srcdoc entity encoding doubled size)
2. Hub not rendering correctly when only 1 journey selected
3. "Back to Main Menu" links led to 404
4. Hub overflowed vertically with stacked iframes

**Resolution:**
- View-switching hub: cards view → click → journey opens (cards hidden), "← Main Menu" bar returns to cards
- Journey HTMLs stored in `<script type="text/plain">` tags (base64) — no srcdoc encoding overhead
- Blob URLs created at runtime for iframe `src`
- ALL 8 journeys shown as cards: selected are clickable, unselected dimmed with "Coming Soon" badge
- Hub-bridge script injected into every journey: intercepts `index.html`/`#main-menu` clicks, sends `postMessage("zotok:back-to-hub")` to parent
- `pushState`/`popstate` for browser back button support
- `mj-card-disabled` class (45% opacity, grayscale) for unselected journeys

### FIX-1: Handwritten order image lost quantity suffixes

**Evidence:** `generateHandwrittenOrderImage()` during a refactor dropped the `qtys = [25, 20, 12]` suffix logic that appends `- 25 tin`, `- 20 bag` to product names. Test expected `Acme Primer - 25`, got just `Acme Primer`.

**Resolution:** Restored the quantity + unit suffix logic in the product loop. Changed max products from 5 back to 3 (matches original). Default fallback line now uses `- 25 bag` / `- 20 bag` format instead of parenthetical.

---

### FIX-2: Product names not mapped to journey templates

**Evidence:** User-provided product names were applied to `step.productNames[]` arrays but NOT to `journey.productNames{}` (template-level keys like `opc53`, `ppc`) or `journey.step3.cartItems[].name`. Template rendered `JK Super OPC 53 Grade` instead of user's product name.

**Resolution:** Added two replacement blocks in `applyCatalogToJourney()`: maps catalog product names to `journey.productNames{}` object keys and `journey.step3.cartItems[].name` arrays.

---

### FIX-3: Multi-journey rendering and home page landed

**Implementation:** `renderMultiJourney()` and `buildMultiJourneyHtml()` added to `demo-renderer.js` — iframe-based hub with sticky nav bar. `buildHomePage()` renders the "WhatsApp Commerce OS" landing page. Wired into `demo-ui.js` `generate()` function to branch based on `formData.journeyTypes.length > 1`.

---

## CRITICAL BUGS (Busted Now → Mostly Resolved)

### BUG-1: Prices Are Never Replaced — Sundaram Store Shows Cement Prices (RESOLVED)

**Evidence:** Sundaram Store (a stationery shop) outputs 34 unique prices that are ALL JK Cement values. The catalog says different prices but the HTML shows JK Cement values.

**Root cause:** The `replacements` dict in brand JSON only replaces text strings. Prices are hardcoded in the template HTML as literal text — there are no `{{price}}` Handlebars expressions for them. The `split().join()` replacement system cannot know that one price should become another for a different brand because it doesn't understand currency/math.

**Resolution (June 17, 7adfc7f):**
- All prices moved into `{{formatCurrency journey.step3.cartItems.N.unitPrice}}` and `{{#each journey.step3.cartItems}}` iteration in step3-ai-capture.hbs
- Shared-brand partials now use data-driven pricing — zero hardcoded ₹ amounts remain
- Catalogs are single source of truth for prices per brand

---

### BUG-2: Secondary Dealer Names Unreplaced in Sundaram Output

**Evidence:** Secondary dealer names appear unchanged in Sundaram Store's generated HTML. The `replacements` dict only covers primary dealer but misses other dealer names in Step 4's admin dashboard.

**Resolution:**
- Short-term: Add missing secondary dealer name replacements to Sundaram's brand JSON.
- Proper: Move all dealer names into `journey.order.secondaryOrders[]` data and render with `{{#each}}`.

---

### BUG-3: Replacement Overlaps Create Silent Errors

**Evidence:** The Sundaram Store `replacements` dict has overlapping pairs where one key is a substring of another. Short keys risk false positive matches in HTML/CSS/JS context.

**Root cause:** `split(from).join(to)` operates on the entire HTML string, including CSS, JavaScript, SVG paths, and base64 data.

**Resolution:**
- Short-term: Sort replacements by key length (longest first) and add HTML-attribute-awareness. But this is a band-aid.
- Proper: Eliminate the replacement system entirely. When all content is data-driven via Handlebars, there's nothing to find-and-replace.

---

### BUG-4: Product Names Mismatch Between Catalog and Template (RESOLVED)

**Evidence:** Catalog product names and template product names are COMPLETELY DIFFERENT. Neither ever became the single source of truth.

**Resolution (June 17, data-driven catalog):**
- Catalog is now the single source of truth for product names, SKUs, and prices
- Templates use `{{#each catalog.products}}` to render product lines
- Brand onboarding uses `data/catalogs/<brand>_products.json` exclusively

---

## STRUCTURAL ISSUES

### STR-1: 200K Monolith Template (99.7% Static HTML)

**Impact:** Impossible to maintain, impossible to test, impossible to onboard a new brand without 60+ find-replace rules.

**Resolution:** Extract reusable partials (phone-frame, wa-topbar, chat-area, date-pill, modal-row, screen-wrap, step2-phones). Each step becomes a composable partial. Target: reduce template from 2495 lines to ~200-300 lines of orchestration.

---

### STR-2: 411 Inline Style Attributes

**Impact:** Colors, fonts, spacing are all hard-coded per-element. Cannot theme for different brands without replacing CSS values.

**Resolution:** Create CSS custom properties per brand (from `brand.colors`, `brand.font`) and replace inline styles with utility classes. Phase 2 (CSS extraction) and Phase 3 (partial extraction) should address this together.

---

### STR-3: 252 Inline SVGs

**Impact:** Icons (arrows, checkmarks, phone icons, chat bubbles) are duplicated as inline SVG throughout. Changes to an icon require touching every instance.

**Resolution:** Move to an SVG sprite sheet or icon partial system. Create `{{icon "arrow-right"}}`, `{{icon "check"}}` etc. as Handlebars helpers or partials.

---

### STR-4: Empty Block Partials (catalog.hbs, cart.hbs, receipt.hbs)

**Impact:** The composable architecture described in ARCHITECTURE.md is documented but not implemented. Block partials are stubs with no implementation.

**Resolution:** This is Phase 3 work — create real partial implementations that match the current monolith output, then wire them through the orchestrator.

---

## ARCHITECTURAL ISSUES

### ARCH-1: `split().join()` Replacement System is Fundamentally Broken

**Fatal flaws:**
1. **Order-dependent:** `split(from).join(to)` depends on iteration order. Longer strings MUST be replaced before shorter substrings, but JS dict iteration order isn't guaranteed for all engines.
2. **Context-blind:** It replaces in CSS, JS, SVG, base64, and URLs — not just visible text.
3. **No validation:** No way to test that replacements produced valid HTML. No diff testing against a baseline.

**Resolution:**
- Phase 3: Extract all brand-varying content into Handlebars expressions
- Phase 4: Remove the `replacements` system from `build.js`
- Add visual regression tests that compare generated HTML against approved baselines

---

### ARCH-2: Build Pipeline Applies Replacements AFTER Handlebars Compilation

**Evidence (build.js):** The pipeline is: compile Handlebars -> apply replacements -> inject SAP diagram.

This means replacements can corrupt any CSS/JS/SVG that happens to contain a replacement string.

**Resolution:** Once all content is Handlebars-driven, remove the replacement pass entirely. The build becomes: compile Handlebars -> inject assets -> done.

---

### ARCH-3: 6 Journey Types Now Implemented (was 1 of 6)

**Evidence:** The following journey types are now implemented:
- Order to Cash (6 brands)
- Field Ops & Expense (3 brands)
- Automated Collections (3 brands)
- Dealer Engagement (3 brands, scaffold only)
| Dealer Engagement | 3 brands, 3 steps | Complete (was scaffold) |
| Retailer Onboarding to Cash | 3 brands, 12 steps | Complete (was scaffold) |
| Retailer Loyalty | 3 brands, 6 steps | Complete |
| Campaigns &amp; Queries | Haldiram only | Complete |
| DT Fulfillment &amp; Payment | Haldiram only | Complete |
| Retailer Activation | Haldiram only | Complete |

---

## CLEANUP COMPLETED (June 2026)

The following stale files and directories were removed:

- **Stale brand data:** `data/catalogs/acme_default.json`, `data/catalogs/sunder_masala_products.json`, `data/industries/footwear.json` (removed brands)
- **One-time scripts:** `scripts/extract_hardcoded.js`, `scripts/merge_extracted.js` (extraction done)
- **Dead scripts:** `scripts/launch.js`, `scripts/local-public-server.js` (superseded by runtime server)
- **Test artifacts:** `scripts/test.txt`, `scripts/test_write.txt`
- **Empty logs:** `.local-server.err.log`, `.local-server.log`
- **Phase 1 docs:** `DATA_MODEL.md`, `EXTRACTION_MAP.md`, `JOURNEY_SCHEMA.md`, `MIGRATION_PLAN.md`, `SCREEN_INVENTORY.md`, `TEMPLATE_STRATEGY.md` (info absorbed into project skill)
- **Stale notes:** `VERCEL_RUNTIME_NOTES.md` (info in skill and vercel.json)
- **Stale dirs:** `api_disabled/`, `scratch/`, `runtime/frontend/`
- **Package.json:** Removed stale `"vercel"` section that overrode `vercel.json`

---

## FIXES COMPLETED (June 2026)

- **Field Ops & Expense — Layout fixes (June 9)**: Fixed WhatsApp screens appearing vertically/cut-off across 6 steps. Changed `#step-3.active`, `#step-4.active`, `#step-6.active`, `#step-9`, `.step-section.phone-layout` from `flex-wrap: wrap`/`display: block` to `flex-wrap: nowrap` with `overflow-x: auto`. Removed hardcoded step4 large illustration image. Restructured step6 and step9 images to left side with WhatsApp screens on right. Reduced step6 image from 720px to 560px. Added `overflow: hidden; max-height: 610px` to step9 image so it clips rather than overflowing. Both server-side (style.css + build.js) and client-side (template-pack.json) paths updated.

- **Field Ops & Expense — Hardcoded JK Cement URLs removed (June 9)**: Replaced 3 hardcoded `jkcement.zotok.ai` URLs in steps 12, 13, 14 with generic `zotok.ai` equivalents. `expense.jkcement.zotok.ai` → `expense.zotok.ai`, `claims.jkcement.zotok.ai` → `claims.zotok.ai`.

- **Step Selection for Custom Demos** — Complete (June 9). Users can select/deselect individual steps when creating custom demos via the wizard. Architecture: runtime dynamic orchestrator + `remapStepReferences()` + `buildDynamicOrchestrator()` + `knownMismatches` for `field_ops_expense→field-ops` and `automated_collections→collections`. Step checklist UI with Select All/Deselect All toggle. 25 tests pass. Step titles shown in checklist.

- **Hub Index Pages** — Implemented (June 9, uncommitted). Each brand gets a hub index.html (Orient-style two-panel layout) at `dist/{brand}/index.html` linking to all journey HTMLs. Template: `templates/hub.hbs`. 3 Haldiram-exclusive journeys added to `build-template-pack.js` JOURNEY_IDS and journeyDescriptions.

- **Content-Type Safety** — Implemented (June 9, uncommitted). All 3 fetch call sites in `demo-ui.js` (`/api/share`, `/api/experiments/adapt-content`, `/api/experiments/save-content`) check Content-Type header before calling `.json()`. Pre-flight size check for share endpoint to prevent Vercel 413 errors.

- **Bug status (refreshed July 3, see plan `docs/superpowers/plans/2026-07-03-supabase-content-backend.md`)** — BUG-1 (prices never replaced) RESOLVED June 17 (data-driven prices); BUG-4 (product name mismatch) RESOLVED June 17 (data-driven catalog); BUG-2 (secondary dealers unreplaced) and BUG-3 (replacement overlaps) PARTIALLY RESOLVED by data-driven design — the Supabase content-adapter redesign (Phase 7) addresses the remainder by sourcing all conversation text from industry profiles.

- **Retailer Onboarding to Cash (scaffold → complete, 10→12 steps)**

- **Dealer Engagement (scaffold → complete)**: Replaced 3 placeholder partials (step1-step3) with real WhatsApp phone-screen templates extracted from Banas_Diary reference HTML (WhatsApp mock generator projects). Includes: bulk purchase campaign → product category selection → price list response → scheme notification → AI Hinglish explanation → loyalty points inquiry → credit balance query → SE escalation. Data-driven for all 3 brands. Fixed `scaffold: true` hardcoded in `scripts/build-template-pack.js` that was blocking client-side wizard.

- **validate.js:** Fixed syntax error (literal newlines in JS string literals) and cwd bug (was running from `scripts/` dir, causing `scripts/scripts/visual-test.js` path). Now uses project root as cwd.
- **share-store.test.js:** Fixed URL format assertion — test expected `/share/<token>` (path-based) but implementation returns `/api/share?token=<hex>` (query-based).
- **Visual baselines:** Regenerated after template fixes (558 screenshots, 380 changed).
- **modal-send-wrap raw text:** Fixed missing `<div class="` opening tag in `step1-self-service.hbs` line 275 that caused literal "modal-send-wrap">" to render on screen.
- **Dealer store name (server-side):** Injected `brand.dealerStoreName` into journey messages via build.js — replaces hardcoded "Sharma Cement Stores" in welcome message and dealer.name for all brands.
- **Dealer store name (client-side):** Added `INDUSTRY_STORE_NAMES` mapping in `demo-renderer.js` — generates industry-specific store names (e.g., "Sharma Pharma Store", "Sharma Steel Store", "Sharma Food Store") based on selected industry. Replaces "Your Store" fallback.
- **Product categories (server-side):** Derived from catalog data instead of hardcoded journey JSON. Build.js groups products by category field and creates 3 sections: main category, secondary categories, Offers & Solutions.
- **Product categories (client-side):** Added `INDUSTRY_CATEGORIES` mapping in `demo-renderer.js` — assigns industry-specific categories to user-entered products based on industry selection. `applyCatalogToJourney()` now derives step1 sections from categorized products.
- **Handwritten order image:** Updated `handwrittenOrderDataUri()` to use `brand.dealerStoreName` and catalog product names (industry-specific) instead of hardcoded generic names.
- **Draft order screen:** Updated `step3-ai-capture.hbs` to show structured product list with catalog names instead of just summary data.
- **Content diff panel collapse:** Added `collapseContentDiff()` in `demo-ui.js` — diff panel now minimizes after Accept (shows "N labels accepted and applied") or Save (shows "Content saved and applied to demo"). Action buttons hide after collapse, reappear on Reset.

## NEW FEATURES (June 2026)

- **Content Adapter** (`services/content-adapter.js`): LLM-powered industry label adaptation via OpenCode API (deepseek-v4-flash). Adapts 21 UI labels per industry (Pharma, Steel, Cement, FMCG). Validates responses (no HTML, no emoji, no marketing language), falls back to original on invalid output. Now includes industry context (product categories, partner types, terminology) in LLM prompt.
- **Adapt Content API** (`api/experiments/adapt-content.js`): POST endpoint that accepts `{sessionId, industry, brandName, labels, products}` and returns adapted labels with a diff. Loads industry data from `data/industries/` and passes as context to LLM.
- **Save Content API** (`api/experiments/save-content.js`): POST endpoint that saves adapted content overrides to a runtime session filesystem.
- **Default Labels** (`data/content/order_to_cash_labels.json`): 21 generic UI labels used as the base for adaptation.

---

## PENDING WORK (June 2026)

### PEND-1: Content Adaptation for All Journeys — RESOLVED (June 12)

All 7 label JSON files exist in `data/content/`. The API endpoint now reads `req.body.journeyType` per journey type instead of hardcoding `order_to_cash`. Adaptation runs automatically when the user clicks Generate — no separate button needed. Group D journeys skip adaptation; Group B/C show hub notices. Server-side tests pass for all 9 journey types.

**Adaptation Difficulty Ranking (June 10 analysis):**

| Group | Journeys | Industry Hits | Priority |
|-------|----------|--------------|----------|
| **A — Critical** | order_to_cash (37), retailer_onboarding (48), dealer_engagement (28) | Heavily brand-specific: "JK Cement", product names, "bags", schemes | First |
| **B — Moderate** | retailer_loyalty (14), automated_collections (12) | "bags", "cement", "Scheme" terms | Second |
| **C — Low** | field_ops_expense (6), campaigns_queries (7) | Hardcoded customer names, generic terms | Third |
|| **D — Clean** | retailer_activation (1), dt_fulfillment_payment (0) | Almost no brand text — adaptation skipped | Skip |

### PEND-2: Custom Demo for All 9 Journeys
Client-side wizard currently supports all 9 journeys (verified via `build-template-pack.js` JOURNEY_IDS). But `buildDynamicOrchestrator()` has `knownMismatches` only for `field_ops_expense→field-ops` and `automated_collections→collections`. Need to:
- Audit all 9 journeys for partial naming conventions vs journey IDs
- Add any missing `knownMismatches` entries
- Verify step selection works for each journey type in the wizard
- Test with all 3 brands

### PEND-3: Shareable Hub Links (Multi-Journey Share) — RESOLVED (June 10)
**Resolution:** Implemented three-tier share architecture:
- **v1:** HTML blob (legacy, limited to ~4MB)
- **v2:** Config-based (~2KB, re-renders client-side via Blob URL iframe)
- **v3:** Multi-blob two-step upload (each journey stored separately, hub fetches on demand)

Client automatically selects v3 for multi-journey shares (2+ journeys). Hub page uses Haldiram-style two-panel layout with `data-journey` attribute + event delegation for card clicks. All rendering paths use Blob URLs instead of srcdoc/document.write.

### PEND-4: Deploy Uncommitted Work — RESOLVED (June 17)
All work committed and deployed. Live at https://demo-generator-one.vercel.app.

Recent deploys:
- **June 17**: Production deployed to HEAD (73934bc) — includes Blob URL navigation fix, content adaptation for all 9 journeys, hub card fixes. Production now matches local.
- **QA preview**: https://demo-generator-b4vjix47a-navneetsiwan-9595s-projects.vercel.app (aliased to latest preview)

Files verified on production:
- `demo-ui.js`: 34,816 bytes (was 39,259 — removed Adapt Content button, added Blob URL rendering)
- `demo-renderer.js`: 67,450 bytes (was 65,912 — added `renderMultiJourney`, `buildMultiJourneyHtml`)

**Share-link verification (production-verified, June 17):**
- v2 config-based share: 200 OK at 800KB payload
- v3 init hub: 200 OK at 427B payload
- v3 journey upload: 200 OK at 1.41 MB
- v1 HTML blob: 200 OK at 2MB, 413 at 4.5MB (expected — Vercel serverless body limit)
- Hub page: 10.3 KB with loadJourney, setFrame, fetch — all script tags matched
- Journey blob: 1.41 MB with scrollToStep, const steps, hub bridge — 0 escaped script tags
- No current failures caused by payload size. Logo data URLs dominate config payloads (96% of config size).

---

---

### FIX-16: Field ops illustration images missing in custom demos (June 10)

**Issue:** Field Ops & Expense journey steps 3, 5, 6, 8, 9 had large illustration images (`assets/field_ops/fo_*.png`) that appeared in static builds but were missing in client-side custom demos. Images used hardcoded relative paths (`../../assets/field_ops/`) that don't resolve inside Blob URL iframes. Additionally, step 6 had three references to the same order-note photo (`fo_02b8234f14bc.png`) — the ZoAi draft-order image header — that was also missing.

**Root cause:** The 8 field_ops PNG/JPEG images (totaling ~4.5MB) only existed at `assets/field_ops/` and were never copied to `dist/` or `public/` by the build pipeline. Templates used hardcoded relative paths that work in static builds (file system resolution) but fail in client-side custom demos (Blob URL context — no file system).

**Resolution:**
- Created `{{fieldOpsImage "filename"}}` Handlebars helper registered in both `build.js` (server-side, returns `../../assets/field_ops/`) and `build-template-pack.js` (client-side, returns `/assets/field_ops/`)
- Added field_ops asset copy to `build.js`: copies `assets/field_ops/` to `dist/assets/field_ops/` (static) and `public/assets/field_ops/` (Vercel serving)
- Updated all 6 template partials to use `{{fieldOpsImage "fo_xxx.png"}}` instead of hardcoded relative paths

**Files changed:** `build.js`, `scripts/build-template-pack.js`, `templates/partials/step{3,5,6,8,9}-field-ops.hbs`

### FIX-17: Step 12 layout gap and "undefined" text (June 10)

**Issue:** Field Ops step 12 had excessive gap between WhatsApp screens and literal "undefined" text appearing above screens.

**Root cause:** Step 12 used `class="step-section phone-layout"` which applies `flex-wrap: nowrap; overflow-x: auto` — a horizontal scrolling layout. Other steps use the standard `step-section` class (vertical stacking). The horizontal layout forced screens side-by-side creating gaps. "undefined" text was from missing Handlebars partial references in the `buildDynamicOrchestrator` client-side renderer.

**Resolution:**
- Changed step 12 to `class="step-section"` (standard vertical layout)
- Added graceful placeholder in `buildDynamicOrchestrator` for missing step partials: emits a placeholder div instead of silently skipping steps

**Files changed:** `templates/partials/step12-field-ops.hbs`, `public/js/demo-renderer.js`

### FIX-18: Duplicate navigation buttons in automated_collections journey (June 10)

**Issue:** The automated_collections journey showed two sets of Previous/Next navigation buttons at the bottom.

**Root cause:** The `step11-collections.hbs` partial contained a complete page wrapper (`screens-area` + `nav-bar` + `<script>` block with step data and `goTo()` handler). When included inside the standard `base.hbs` layout (which already has a `{{> nav-bar}}`), the nav bar appeared twice.

**Resolution:** Removed the nav-bar, page wrapper divs, and standalone script block from `step11-collections.hbs`. Navigation is now handled exclusively by the base layout's nav-bar + mobile-nav.

**Files changed:** `templates/partials/step11-collections.hbs`

### FIX-19: "undefined" text from client-side step renderer (June 10)

**Issue:** Custom demos with step selection showed literal "undefined" text when some selected steps couldn't find their template partials.

**Root cause:** `buildDynamicOrchestrator()` in `demo-renderer.js` silently skipped steps when `partials[partialName]` was falsy. The resulting `parts.join('\n')` produced a string with missing content that Handlebars rendered as "undefined".

**Resolution:** Added `console.warn` for missing partials and a placeholder div with "Step content not available for this selection" message instead of silently skipping.

**Files changed:** `public/js/demo-renderer.js`

### FIX-20: Content adaptation API hardcoded to order_to_cash (June 12)

**Issue:** The `/api/experiments/adapt-content` endpoint always called `getLabelsForJourney('order_to_cash')` regardless of which journey type the client sent. Label files for retailer_onboarding (78 labels), dealer_engagement (25), retailer_loyalty (35), automated_collections (45), field_ops_expense (42), and campaigns_queries (29) were never loaded server-side — only the 21 OTC labels were used.

**Root cause:** Line 50 of `api/experiments/adapt-content.js` had hardcoded `journeyType: 'order_to_cash'` instead of reading `req.body.journeyType`.

**Resolution:** Changed to `journeyType: req.body.journeyType || 'order_to_cash'`. Now the correct per-journey label file feeds into the AI adaptation prompt.

**Files changed:** `api/experiments/adapt-content.js`

### FIX-21: Adapt Content button removed — automatic adaptation on generate (June 12)

**Issue:** Users had to click a separate "Adapt Content" button after generating a demo, then Accept/Reset/Save the results. This was a multi-step friction point.

**Resolution:** 
- Removed Adapt Content button and content review panel from `public/index.html`
- `generate()` now automatically calls `adaptContent()` silently before rendering
- Adaptation runs in the background during the progress bar — if it succeeds, adapted labels are used; if it fails, original labels are used silently
- Removed all content review UI functions: `updateAdaptButtonVisibility`, `updateAdaptButtonState`, `setContentPanelVisible`, `collapseContentDiff`, `renderContentDiff`, `acceptContent`, `resetContent`, `saveContent`
- The button hiding (Group D journeys) and hub notices (Group B/C) are preserved

**Files changed:** `public/index.html`, `public/js/demo-ui.js`, `test/experiment-ui.test.js`

### FIX-22: Stale function references broke all wizard buttons (June 12)

**Issue:** The Next, Prev, Generate, and all other wizard buttons stopped working. Clicking any button did nothing.

**Root cause:** When `acceptContent`, `resetContent`, and `saveContent` functions were removed in FIX-21, their references in the `demoUI` public API object (lines 979-981) were left behind:
```javascript
var demoUI = {
    ...
    acceptContent: acceptContent,  // ReferenceError — undefined
    resetContent: resetContent,    // ReferenceError — undefined
    saveContent: saveContent,      // ReferenceError — undefined
    ...
};
```
This caused a ReferenceError when the IIFE executed, preventing `global.demoUI = demoUI;` from ever running. Since `window.demoUI` was never created, all `onclick="demoUI.xxx()"` handlers failed silently.

**Resolution:** Removed the three stale references from the `demoUI` object.

**Files changed:** `public/js/demo-ui.js`

### FIX-23: Step-partial bridge for schema renderer — Path B wiring (June 20)

**Issue:** The schema-driven renderer (`renderSchemaScreen`) in `build.js` and
`build-template-pack.js` only knew about `screen-{type}` partials. It couldn't
render existing step partials (e.g., `step1-self-service`, `step3-ai-capture`)
which contain full WhatsApp screens with layout, messages, and phone frames.

**Resolution:** Added a `step-partial` screen type to `renderSchemaScreen`:
- When `screen.type === 'step-partial'`, it reads `screen.data.partialName`,
  looks up the named partial (e.g., `step3-ai-capture`), and renders it with
  the full journey context (`this`) instead of just `screen.data`.
- Non-step schema screens continue to use `screen-{type}` partials with
  `screen.data` context as before.
- Applied to both `build.js` (server-side) and `scripts/build-template-pack.js`
  (client-side, packed into `template-pack.json`).

**Files changed:** `build.js`, `scripts/build-template-pack.js`, `public/template-pack.json`

### FIX-24: Premium generation — Path C (June 20)

**Issue:** The project had two rendering paths (static build and client wizard)
but lacked standalone reference-quality demos for client presentations. The
Haldirams reference files (3.8MB each, rich WhatsApp conversations, base64
images) showed the target quality but were hand-crafted for one brand only.

**Resolution:** Created `scripts/generate-premium.js` — a Node.js generator
that produces standalone premium HTML files with:
- Multi-turn WhatsApp conversations (2-4 messages per screen)
- Realistic business data (order IDs like JKC-2026-0417, ₹ amounts, IST dates)
- Sidebar step navigation with keyboard shortcuts (ArrowRight/ArrowLeft)
- Base64-embedded brand logo (SVG)
- Inline CSS (no external dependencies), screen description cards
- 2-3 phone frames per step, 3-15 steps per journey

Generated 6 JK Cement premium journeys in `dist/jk_cement/premium/`.

**Files created:** `scripts/generate-premium.js`, `docs/premium-generation-spec.md`,
`assets/brands/jk_cement/logo.svg`

### FIX-25: prod-demo-renderer.js removed — dead file (June 20)

**Issue:** `prod-demo-renderer.js` was a stale copy unreferenced by any HTML,
JS, or JSON file in the project. It was dead code that could confuse future
developers.

**Resolution:** Confirmed zero references via grep across all `.js`, `.html`,
`.json` files, then deleted the file.

**Files changed:** deleted `prod-demo-renderer.js`

### FIX-26: Premium generation auto-runs on dist build (June 20)

**Issue:** `build.js --dist` wipes `dist/` via `clearDir()`, which deletes any
premium files generated before the build. This required a separate manual step
after each build.

**Resolution:** Added a post-build hook in `build.js` that runs
`node scripts/generate-premium.js all` after the dist build completes. The hook
gracefully skips if the generator script is missing, making it safe for CI/CD.

**Files changed:** `build.js`

### FIX-27: PEND-2 — Custom demo for all 9 journey types verified complete (June 20)

**Issue:** `buildDynamicOrchestrator()` in `demo-renderer.js` had
`knownMismatches` only for `field_ops_expense→field-ops` and
`automated_collections→collections`. While partials existed for all 9
journeys, the mapping was not audited.

**Verification:** Inspected template-pack.json's 92 partials against all 9
journey types:
- `order_to_cash`: 11 stepPartialOverrides — all OK
- `field_ops_expense`: 15 partials (via knownMismatches → field-ops)
- `automated_collections`: 11 partials (via knownMismatches → collections)
- 6 underscore-named journeys: dealer_engagement (3), retailer_onboarding (12),
  retailer_loyalty (6), campaigns_queries (3), dt_fulfillment_payment (5),
  retailer_activation (2) — all match directly via journeyType ID.
- No additional knownMismatches needed.

**Status:** All 9 journey types render correctly in the client-side wizard.

### FIX-28: Content Adapter Redesign — Brainstorming Doc (June 30)

**Issue:** The content adapter has 7 structural problems (P1-P7): only works for Path B,
hard dependency on live LLM API, save-content broken on CF Pages, thin industry context,
no deterministic fallback, manual per-journey label files, and adapts only UI labels not
content. See `docs/superpowers/specs/2026-06-30-content-adapter-redesign.md` for full
background and 4 proposed approaches.

**Status:** BRAINSTORMING — 4 approaches documented, decision pending.

## July 2, 2026 — Project Completion Execution

### PHASE-0: Commit + Sync (July 2)

Committed 28 visual regression baselines + test-runner.py + test-custom-demo.py + content-adapter redesign spec + project completion plan. Pushed all 23 previously-unpushed commits + 2 new commits to origin/main.

**Commits:**
- `5a07d0e` — `chore: update visual regression baselines + add test-runner.py orchestrator` (30 files)
- `780b17d` — `docs: content adapter redesign spec + project completion plan` (3 files)

**Deploy:** `node build.js --dist` rebuilt all 3 brands x 10 journeys. CF Pages auto-deployed via git integration. Live site verified byte-identical to local. `git log --oneline origin/main..HEAD` is empty.

### PHASE-1: Fix /api/health Routing (July 2)

Created `functions/api/health.js` — a proper CF Pages Function returning JSON. The original MIGRATION-2 diagnosis (blaming `functions/api/share.js` catch-all) was wrong; the real cause was a missing health Pages Function, causing CF Pages to serve the SPA fallback. Pending commit + push + live verification.

---

## Status Table (July 2)

| Priority | Issue | Type | Effort | Status |
|----------|-------|------|--------|--------|
| **P0** | MIGRATION-2: /api/health returns HTML | Bug | Low | RESOLVED July 2 (Phase 1) |
| **P0** | PHASE-0: Commit + sync 25 commits to origin | Deploy | Low | COMPLETE July 2 |
| **P0** | PEND-1: Content adaptation for all journeys | Feature | High | RESOLVED June 12 |
| **P0** | FIX-10: Hub clicks broken | Bug | Medium | RESOLVED June 10 |
| **P0** | FIX-11: v3 multi-blob share | Feature | High | RESOLVED June 10 |
| **P0** | FIX-12: Hub card syntax error | Bug | Medium | RESOLVED June 10 |
| **P0** | FIX-21: Auto content adaptation on Generate | Feature | Medium | RESOLVED June 12 |
| **P1** | FIX-14: Hub card descriptions/metadata blank | Bug | Low | RESOLVED June 10 |
| **P1** | FIX-15: SAP architecture diagram oversized | Bug | Low | RESOLVED June 10 |
| **P1** | FIX-22: Stale function refs broke wizard buttons | Bug | Low | RESOLVED June 12 |
| **P1** | FIX-23: Step-partial bridge for schema renderer | Bug | Low | RESOLVED June 20 |
| **P1** | FIX-27: PEND-2 — All 9 journeys verified in wizard | Feature | Medium | RESOLVED June 20 |
| **P1** | BUG-1: Prices never replaced | Bug | Medium | RESOLVED June 17 (data-driven prices) |
| **P1** | BUG-4: Product name mismatch | Bug | Low | RESOLVED June 17 (data-driven catalog) |
| **P2** | FIX-16: Field ops images missing | Bug | Medium | RESOLVED June 10 |
| **P2** | FIX-17: Step 12 layout gap + "undefined" text | Bug | Low | RESOLVED June 10 |
| **P2** | FIX-18: Duplicate nav buttons | Bug | Low | RESOLVED June 10 |
| **P2** | FIX-19: "undefined" from client renderer | Bug | Low | RESOLVED June 10 |
| **P2** | FIX-20: Content adaptation hardcoded to OTC | Bug | Low | RESOLVED June 12 |
| **P2** | FIX-24: Premium generation Path C | Feature | High | RESOLVED June 20 |
| **P2** | FIX-25: prod-demo-renderer.js dead file | Cleanup | Low | RESOLVED June 20 |
| **P2** | FIX-26: Premium auto-run on dist build | Feature | Medium | RESOLVED June 20 |
| **P2** | BUG-2: Secondary dealers unreplaced | Bug | Low | PARTIALLY RESOLVED |
| **P2** | BUG-3: Replacement overlaps | Bug | Medium | PARTIALLY RESOLVED (data-driven reduced risk) |
| **P2** | ARCH-1: Replacement system | Architecture | High | PARTIALLY RESOLVED (data-driven eliminated need for most) |
| **P2** | ARCH-2: Post-HBS replacement | Architecture | Medium | PARTIALLY RESOLVED |
| **P3** | STR-1: build.js 949-line monolith | Architecture | High | Still open — Phase 4 |
| **P3** | STR-2: 411 inline styles | Architecture | High | RESOLVED July 2 (659 inline styles extracted to CSS utility classes) |
| **P3** | STR-3: 252 inline SVGs | Architecture | Medium | RESOLVED July 2 (551 inline SVGs extracted, 19 icon partials created) |

---

## July 3, 2026 — Long-term Architecture Pivot + Migration Track

### ARCH-PIVOT-1: Content Adapter → Supabase Backend (DECISION)

**Decision:** Replace the flat-JSON industry-profile approach (the documented 2026-06-30 redesign spec) with **Supabase** (managed Postgres + Storage + auto REST API + admin Studio) as the single source of truth for content and images.

**Drivers:**
1. The `journey.messages.*` objects in `data/journeys/{brand}_{journey}.json` are duplicated per-brand — Supabase eliminates this with one `industries` row per industry sourced by both rendering paths.
2. Long-term goal: ONE Supabase project serves both this repo and the legacy `whatsapp-mock-generator-main` 22-client-project corpus (now being migrated — see MIGRATION-1 below).
3. Image storage: moves from `assets/` folders on disk + base64-in-HTML bloat to Supabase Storage with native URL serving.
4. Removes the LLM (OPENCODE_API_KEY) from the runtime path entirely — LLM becomes dev-time optional only.

**Spec:** `docs/superpowers/specs/2026-07-03-supabase-content-backend-design.md` — full schema (tables: `industries`, `brands`, `journeys`, `images_meta`), RLS policies, storage bucket, integration by rendering path.

**Supersedes:** `docs/superpowers/specs/2026-06-30-content-adapter-redesign.md` (the flat-JSON Approaches 1–4 spec; Approach 1 content is preserved but the storage layer changes from JSON files to Supabase rows).

**Scope:** Approach 1 (Industry Profile System), scope **iii** (labels + notification messages + screen descriptions + WhatsApp conversation tone — the heaviest scope). Partially-approved scope (iii) requires parameterizing WhatsApp conversation text in journey JSONs into Handlebars templates sourced from industry profile rows.

### Path C Premium Demos — DEFERRED indefinitely

User directive July 3: *"forget about premium — top priority is content."* The 6 existing JK Cement premiums in `dist/jk_cement/premium/` stay frozen. The 24 missing Haldiram + Sundaram premiums (Track 4 of the original completion plan) are out of scope until further notice. FIX-24, FIX-26 (premium generation feature work) remain RESOLVED as historical; new premium work is not tracked.

### MIGRATION-1: 22 Legacy Client Projects → Demo-Generator (PRIMARY, July 3)

**Directive:** *"the 22 client projects in whatsapp-mock-generator need to be adapted to our logic in demo generator—primary and priority task. We will not touch the original files—make a copy of them in demo generator and work on it. start working on it first."*

**Source:** `F:\Sellerhub\whatsapp-mock-generator-main\whatsapp-mock-generator-main\projects\` — 22 client project folders, 84 HTML journey files, ~197MB total, deployed on AWS Amplify (ap-south-1). Clients: Adani Wilmar, Atharva, Banas_Diary, BlueOcean, freyr, Haldirams, Hindalco, insightzz, jkcement, lucky_seeds, Mukund, Orient, OrientElectric, pmcona, RCPL, Recykal, SakkuGroup, Savera, Sintex, sundar_masala, V[N] Fogg, zydus.

**Staged copy + manifest + image extraction (DONE):**

- Copied 22 client project folders to `migration/projects/` (untracked in git, regenerable from the upstream zip). Originals untouched.
- `migration/scripts/extract_project_manifest.py` profiles each legacy HTML (brand colors from CSS `:root`, brand name from `<title>`, journey type canonical/inferred/unknown, step/screen/phone-frame counts, base64 image count + bytes, inline CSS/JS size, step-screen labels, message bubble samples). Outputs `migration/manifest.json` + `migration/manifest.csv`. Committed in `065d623`.
- `migration/scripts/extract_images.py` walks `migration/projects/` and rewrites each HTML in place, extracting every base64-embedded image to per-project `_images/` folders and replacing inline data with relative URLs. Extracted 236 unique images across 80 HTML files (deduped against ~921 raw in-HTML occurrences). Working size: 175MB → 12MB (93% reduction). Committed in `5e19e2d`.

**Findings from the manifest (driving the remaining migration scope):**

- 84 HTML files across 21 project directories (RCPL is empty).
- 8 hub / `index.html` files — per-project navigation hubs (no `.step-section` content; exist as launchers, not journey data). Listed in the manifest as `journey_kind=hub`.
- 9 non-canonical journey types beyond the demo-generator's 10 — must be classified as new journey modules OR aliases of canonical journeys:
  - BlueOcean: `customer_groups`, `direct_enquiries`, `support_tickets`
  - OrientElectric: `erp_externalization`
  - Recykal: `ms_scrap_marketplace`, `ms_scrap_procurement`
  - freyr: `domestic_customer_lifecycle`
  - insightzz: `defect_alert_management`
  - Hindalco: `dsr_expense_claim` (likely aliases `field_ops_expense`)
  - Sintex: `plumber_registration_engagement` (likely aliases `retailer_onboarding`)
  - SakkuGroup: `daily_rate_broadcast` (likely aliases `campaigns_queries`)
  - lucky_seeds: `retailer_ordering` (likely aliases `order_to_cash`)
  - zydus: `collections_finance_ptp_incentives` (likely aliases `automated_collections`)
- 25 distinct brand entities recoverable from `<title>` tags — these seed the eventual Supabase `brands` rows.
- Total inline CSS across files: 2,458 KB (collapses to ~shared dist/style.css).
- Total inline JS: 644 KB (collapses to ~shared app.js).

**Remaining migration sub-phases:** see `docs/superpowers/plans/2026-07-01-project-completion.md` § Phase 2 (Sub-phases 2.2 content extraction → 2.3 brand metadata extraction → 2.4 new journey-type modules). Phase 3 (Supabase provisioning + content-adapter rewrite) depends on the user supplying Supabase project credentials.

| Priority | Issue | Type | Effort | Status |
|----------|-------|------|--------|--------|
| **P0** | MIGRATION-1: 22 legacy client projects → demo-generator architecture | Migration | High | FOUNDATIONS DONE July 3 (copy + manifest + image extraction committed); content extraction, brand metadata, journey-type modules PENDING |
| **P0** | ARCH-PIVOT-1: Content adapter → Supabase backend | Architecture | High | DECISION July 3, spec written; implementation BLOCKED on user-provisioning Supabase credentials |
| **P0** | PHASE-1: Commit + deploy `/api/health` fix | Bug | Low | Code WRITTEN July 2 (untracked); commit + deploy + verify PENDING |
| **P1** | Content adapter implementation (scope iii: labels + messages + descriptions + WhatsApp tone) | Feature | High | SPEC READY; pending Supabase provisioning + Sub-phase 2.2 content extraction |
| **P1** | Sequence: Content/Migration first; Path C premiums OUT OF SCOPE | Directive | n/a | CONFIRMED July 3 |
| **P3** | STR-4: Empty block partials | Architecture | Medium | Still open — scheduled for Phase 4 (build.js split) |
