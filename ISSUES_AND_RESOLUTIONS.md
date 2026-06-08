# Issues & Resolutions: Demo Generator

> Computed from live analysis of the codebase and generated output.
> Branch: `main`
> Last updated: June 2026

---

## CRITICAL BUGS (Busted Now)

### BUG-1: Prices Are Never Replaced — Sundaram Store Shows Cement Prices

**Evidence:** Sundaram Store (a stationery shop) outputs 34 unique prices that are ALL JK Cement values. The catalog says different prices but the HTML shows JK Cement values.

**Root cause:** The `replacements` dict in brand JSON only replaces text strings. Prices are hardcoded in the template HTML as literal text — there are no `{{price}}` Handlebars expressions for them. The `split().join()` replacement system cannot know that one price should become another for a different brand because it doesn't understand currency/math.

**Resolution:** 
- Short-term: Add price replacements to each brand's `replacements` dict. But this is order-dependent and breaks if line totals change per quantity.
- Proper: Move ALL prices into journey/financial data in the JSON. Use `{{formatCurrency cart.summary.orderValue}}`, `{{formatCurrency product.lineTotal}}`, etc. Pre-compute at build time.

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

### BUG-4: Product Names Mismatch Between Catalog and Template

**Evidence:** Catalog product names and template product names are COMPLETELY DIFFERENT. Neither ever became the single source of truth.

**Resolution:**
- Decide which naming convention is correct.
- Create a single `products` array in the journey JSON that is THE authority for product names, SKUs, and prices.
- Use `{{#each products}}` to render product lines, not hardcoded text.

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
| Retailer Onboarding to Cash | 3 brands, 12 steps | Complete (was scaffold) |
| Retailer Loyalty | 3 brands, 6 steps | Complete |
| Dealer Engagement | 3 brands, 3 steps | Complete (was scaffold) |
- **Campaigns & Queries** (Haldiram only)
- **DT Fulfillment & Payment** (Haldiram only)
- **Retailer Activation** (Haldiram only)

One scaffold journey (Dealer Engagement) still needs real content.

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

- **Retailer Onboarding to Cash (scaffold → complete, 10→12 steps)**: Replaced all 10 placeholder partials (step1-step10) with 12 real WhatsApp phone-screen templates (step1-step12) extracted from Haldiram's reference HTML. Includes: activation campaign, registration WebView, partner approval, self-service menu, campaigns & queries, AI scheme explanation (Hinglish), self-service ordering, catalog browse, AI order capture, distributor confirmation, invoice upload, payment collection, and order/payment nudges. Data-driven for all 3 brands (JK Cement, Haldiram's, Sundaram Store). Server-side build and client-side renderer both updated.

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

## RESOLUTION PRIORITY

| Priority | Issue | Type | Effort | Impact |
|---|---|---|---|---|
| **P0** | BUG-1: Prices never replaced | Bug | Medium | Every brand shows wrong prices |
| **P0** | BUG-2: Secondary dealers unreplaced | Bug | Low | Admin portal shows wrong names |
| **P0** | BUG-4: Product name mismatch | Bug | Low | Catalog data = single source of truth |
| **P1** | BUG-3: Replacement overlaps | Bug | Medium | Silent HTML corruption risk |
| **P2** | STR-1: 200K monolith | Architecture | High | Root cause of all issues |
| **P2** | STR-2: 411 inline styles | Architecture | High | Brand theming impossible |
| **P2** | STR-3: 252 inline SVGs | Architecture | Medium | Icon changes painful |
| **P2** | ARCH-1: Replacement system | Architecture | High | Must be eliminated |
| **P2** | ARCH-2: Post-HBS replacement | Architecture | Medium | Gone when ARCH-1 resolved |
| **P3** | STR-4: Empty block partials | Architecture | Medium | Needed for composition |
