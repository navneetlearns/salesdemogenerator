# Demo Generator — Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining work on the demo-generator project — fix 4 P1 bugs, implement content adaptation for all 9 journeys, enable custom demos for all 9 journeys, and eliminate the brand-replacement system.

**Architecture:** The project has two independent rendering paths (server-side `build.js` and client-side `demo-renderer.js`). Every change must be verified in both. Brands use a clone-and-replace pattern (Sundaram Store clones JK Cement via `split().join()`), which must be eliminated in favor of first-class Handlebars data-driven rendering. Share links use v2 (config re-render) and v3 (multi-blob hub) architectures, both backwards-compatible with v1.

**Tech Stack:** Handlebars.js, Node.js, Vercel (serverless + Blob), Playwright (visual regression), vanilla JS client-side wizard.

**Current State:** HEAD at `bca93f9`. 38/38 tests pass. Clean working tree. v2/v3 share architecture stable. Haldiram-style two-panel hub deployed. 3 brands live. P0 bugs resolved.

---

## Phase 0: Quick Wins (P1 Bugs) — ~2-3 days

### Task 0.1: Move all prices from hardcoded template text to journey data JSON

**Files:**
- Modify: `templates/partials/step5-order-confirmed.hbs`
- Modify: `templates/partials/step7-invoice.hbs`
- Modify: `templates/partials/step8-cash-discount.hbs`
- Modify: `templates/partials/step9-payment.hbs`
- Modify: `templates/partials/step3-ai-capture.hbs`
- Modify: `data/journeys/jk_cement_order_to_cash.json` (and all brand variants — add `journey.order.summary`, `journey.payment.amount`, etc.)
- Modify: `data/brands/sundaram_store.json` — remove price entries from `replacements`
- Modify: `data/brands/sunder_masala.json` — remove price entries from `replacements`
- Verify: `public/js/demo-renderer.js` — `formatCurrency` helper registered in client-side Handlebars
- Verify: `build.js` — `formatCurrency` helper registered in server-side Handlebars
- Test: run after each template change

- [ ] **Step 1: Audit all hardcoded prices in templates**

  Search for INR values (`₹\d`, `Rs.\d`, numeric prices like `5,250`) across all partials in `templates/partials/`. List each occurrence with the template file and line.

  Run: `grep -rn "₹\|Rs\." templates/partials/ | grep -v node_modules`
  Expected: ~15-20 price references in order/confirm/payment/invoice templates.

- [ ] **Step 2: Add price amounts to journey JSON data**

  For each journey type that has prices (order_to_cash primarily), add a structured `journey.order` and `journey.payment` section:

  ```json
  {
    "journey": {
      "order": {
        "summary": [
          { "label": "8,000", "description": "Cement (2 items)" },
          { "label": "2,000", "description": "Transport" }
        ],
        "total": "10,000",
        "discount": "500"
      },
      "payment": {
        "amount": "9,500",
        "method": "Bank Transfer",
        "status": "Paid"
      }
    }
  }
  ```

  Update ALL brand variants: `jk_cement_order_to_cash.json`, `haldirams_order_to_cash.json`, `sundaram_store_order_to_cash.json`.

- [ ] **Step 3: Replace hardcoded prices with Handlebars expressions in each template**

  In `step5-order-confirmed.hbs`:
  ```
  - Replace `₹8,000` → `{{formatCurrency journey.order.summary.[0].label}}`
  - Replace `₹2,000` → `{{formatCurrency journey.order.summary.[1].label}}`
  - Replace `₹10,000` → `{{formatCurrency journey.order.total}}`
  ```

  In `step7-invoice.hbs`:
  ```
  - Replace hardcoded invoice amounts with `{{journey.order.*}}` references
  ```

  In `step8-cash-discount.hbs`, `step9-payment.hbs`, `step3-ai-capture.hbs`: same pattern.

- [ ] **Step 4: Verify `formatCurrency` helper exists in both rendering paths**

  Check `build.js` for `Handlebars.registerHelper('formatCurrency', ...)` and `public/js/demo-renderer.js` or `scripts/build-template-pack.js` for the same.

  If missing, add:
  ```javascript
  Handlebars.registerHelper('formatCurrency', function(value) {
    return '₹' + parseFloat(value).toLocaleString('en-IN');
  });
  ```

- [ ] **Step 5: Remove price entries from Sundaram and Sunder Masala replacements**

  In `data/brands/sundaram_store.json`, remove all price-related keys from `replacements`.
  Same for `sunder_masala.json`.

- [ ] **Step 6: Rebuild and verify all 3 brands**

  Run: `"/mnt/c/Program Files/nodejs/node.exe" build.js --dist` then check `dist/` for each brand.
  Expected: Order summary, invoice, payment screens show correct prices per brand.

- [ ] **Step 7: Run tests**

  Run: `"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js`
  Expected: All 38+ tests pass.

- [ ] **Step 8: Commit**

  ```bash
  git add templates/partials/step5-order-confirmed.hbs templates/partials/step7-invoice.hbs templates/partials/step8-cash-discount.hbs templates/partials/step9-payment.hbs templates/partials/step3-ai-capture.hbs data/journeys/*.json data/brands/*.json build.js public/js/demo-renderer.js
  git commit -m "fix: move hardcoded prices from templates to journey data JSON (BUG-1)"
  ```

### Task 0.2: Move secondary dealer names to journey data

**Files:**
- Modify: `templates/partials/step4-back-office.hbs` (or the admin dashboard partial showing dealer list)
- Modify: `data/journeys/jk_cement_order_to_cash.json` (add `journey.secondaryDealers[]`)
- Modify: all brand variants of the same journey JSON
- Modify: `data/brands/sundaram_store.json` — remove dealer name entries from `replacements`
- Modify: `data/brands/sunder_masala.json` — same

- [ ] **Step 1: Identify all hardcoded dealer names in Step 4 / admin screens**

  Search for dealer names (`Sharma Cement Stores`, `Patel Pipes`, etc.) across templates.

- [ ] **Step 2: Add `secondaryDealers` array to journey JSON**

  ```json
  {
    "journey": {
      "secondaryDealers": [
        { "name": "Patel Pipes & Hardware", "location": "Sector 12" },
        { "name": "Sharma Supermart", "location": "Industrial Area" }
      ]
    }
  }
  ```

  Add to all brand variants.

- [ ] **Step 3: Replace hardcoded dealer text with `{{#each journey.secondaryDealers}}` in templates**

- [ ] **Step 4: Remove dealer name entries from Sundaram/Sunder Masala replacements**

- [ ] **Step 5: Rebuild, verify, test, commit**

### Task 0.3: Make catalog the single source of truth for product names

**Files:**
- Modify: `data/catalogs/*.json` — ensure SKU-to-name mapping is complete
- Modify: `lib/catalog-normalizer.js` or `public/js/demo-renderer.js` (whichever has `applyCatalogToJourney()`)
- Test: rendered Sundaram output must show correct product names (e.g., "Notebook" not "OPC 53 Grade")

- [ ] **Step 1: Check `applyCatalogToJourney()` logic**

  Read the function that maps catalog product names into journey data. Verify it correctly overrides hardcoded names.

- [ ] **Step 2: Fix any mismapping**

  Ensure every template that shows a product name uses `{{productName}}` from the catalog, not a hardcoded value.

- [ ] **Step 3: Rebuild Sundaram Store and verify**

  Check `dist/sundaram_store/order_to_cash/` — product names should match the Sundaram catalog (Notebook, Pen, etc.), not JK Cement names.

---

## Phase 1: Content Adaptation for All Journeys (PEND-1) — ~2-3 days

### Task 1.1: Create label JSON files for remaining 8 journeys

**Files:**
- Create: `data/content/retailer_onboarding_labels.json`
- Create: `data/content/dealer_engagement_labels.json`
- Create: `data/content/retailer_loyalty_labels.json`
- Create: `data/content/automated_collections_labels.json`
- Create: `data/content/field_ops_expense_labels.json`
- Create: `data/content/campaigns_queries_labels.json`

- [ ] **Step 1: For each journey, extract hardcoded brand/industry text from templates**

  Use `data/content/order_to_cash_labels.json` as template — it has entries like:
  ```json
  {
    "browseProducts": "Browse Products",
    "placeOrder": "Place an Order",
    "orderConfirmed": "Order Confirmed"
  }
  ```

  For `retailer_onboarding` (48 hits), scan all `step*-retailer_onboarding.hbs` partials and `haldirams_retailer_onboarding.json` data for brand-specific text.

- [ ] **Step 2: Create each label JSON file with all labelable text**

  Group A first (retailer_onboarding ~48 labels, dealer_engagement ~28), then Group B (retailer_loyalty ~14, automated_collections ~12), then Group C (field_ops_expense ~6, campaigns_queries ~7).

- [ ] **Step 3: No label files for Group D**

  `retailer_activation` (1 hit) and `dt_fulfillment_payment` (0 hits) — no files needed. The content adapter should skip these.

### Task 1.2: Wire content-adapter to resolve labels per journey type

**Files:**
- Modify: `services/content-adapter.js`
- Modify: `public/js/demo-ui.js`
- Modify: `api/experiments/adapt-content.js` (if it exists)
- Test: `test/content-adapter.test.js`

- [ ] **Step 1: Add `getLabelsForJourney(journeyType)` in content-adapter.js**

  ```javascript
  function getLabelsForJourney(journeyType) {
    try {
      return require(`../data/content/${journeyType}_labels.json`);
    } catch (e) {
      return {}; // No labels = skip adaptation
    }
  }
  ```

- [ ] **Step 2: Update client-side label loading**

  In `demo-ui.js`, load labels dynamically from `data/content/` based on selected journey type.

- [ ] **Step 3: Hide "Adapt Content" button for Group D journeys**

  ```javascript
  var groupD = ['retailer_activation', 'dt_fulfillment_payment'];
  if (groupD.includes(selectedJourneyType)) {
    document.getElementById('adapt-btn').style.display = 'none';
  }
  ```

- [ ] **Step 4: Run tests and verify**

  Run: `"/mnt/c/Program Files/nodejs/node.exe" --test test/content-adapter.test.js`
  Expected: Pass — adapter should fall back to empty labels for unlisted journeys.

### Task 1.3: Hub page notices for unadapted journeys

- [ ] **Step 1: Add CSS class + notice banner for Groups B/C**

  In hub HTML, show subtle notice: "Demo content — may not reflect your industry" as a small banner on Group B/C journey cards.

- [ ] **Step 2: Group A shows Adapt button prominently**

  These get a highlighted "Customize Content" call-to-action.

---

## Phase 2: Custom Demo Step Selection for All Journeys (PEND-2) — ~1 day

### Task 2.1: Audit all 9 journey IDs vs partial naming conventions

- [ ] **Step 1: List all journey type IDs and check template partial naming**

  Journey types: `order_to_cash`, `field_ops_expense`, `automated_collections`, `dealer_engagement`, `retailer_onboarding`, `retailer_loyalty`, `campaigns_queries`, `dt_fulfillment_payment`, `retailer_activation`.

  For each, check if template partials exist as `step1-{convention}.hbs`, `step2-{convention}.hbs`, etc.

- [ ] **Step 2: Identify naming mismatches**

  Example mismatches already known: `field_ops_expense` → partials use `step*-field-ops.hbs` (underscore vs hyphen). `automated_collections` → partials use `step*-collections.hbs`.

### Task 2.2: Add missing `knownMismatches` in `buildDynamicOrchestrator()`

**Files:**
- Modify: `public/js/demo-renderer.js` (the `buildDynamicOrchestrator` function) or wherever step mapping lives

- [ ] **Step 1: Find `buildDynamicOrchestrator` or equivalent**

  Search for the function that maps journey type IDs to partial names/directories.

- [ ] **Step 2: Add mappings for all 9 journey types**

  Currently has: `field_ops_expense → field-ops`, `automated_collections → collections`
  Add: `dealer_engagement → dealer_engagement`, `retailer_onboarding → retailer_onboarding`,
  `retailer_loyalty → retailer_loyalty`, `campaigns_queries → campaigns_queries`,
  `dt_fulfillment_payment → dt_fulfillment_payment`, `retailer_activation → retailer_activation`

### Task 2.3: Verify step selection in wizard for each journey type × all 3 brands

- [ ] **Step 1: Run wizard with each journey type, select subset of steps**

  For each of the 9 journey types, create a custom demo with step selection enabled. Verify:
  - All steps listed
  - Selecting a subset renders correctly
  - Selected step count matches

- [ ] **Step 2: Test Sundaram Store specifically**

  Sundaram uses `split().join()` replacement — ensure step selection works correctly for a clone brand.

---

## Phase 3: Architecture Debt (P2, Long-term) — ~5-8 days

### Task 3.1: Extract Handlebars expressions from monolith (eliminate hardcoded text)

**Files:**
- Modify: Each template partial — replace hardcoded brand names, product names, categories with `{{variable}}` expressions
- Modify: `data/brands/*.json` — ensure all needed context variables exist
- Modify: `data/journeys/*.json` — ensure journey data drives all screen text

- [ ] **Step 1: Start with highest-impact partials**

  `step1-self-service.hbs`, `step2-catalog.hbs`, `step4-back-office.hbs`, `step5-order-confirmed.hbs`, `step6-sap-architecture.hbs`, `step7-invoice.hbs`, `step8-cash-discount.hbs`, `step9-payment.hbs`.

- [ ] **Step 2: Each partial → own branch + visual regression test**

  For each partial, make the changes, run `npm run visual:test`, verify baseline matches.

- [ ] **Step 3: Run all tests**

  After each batch of partials, run the full test suite.

### Task 3.2: CSS custom properties for brand theming

- [ ] **Step 1: Extract inline color styles into CSS variables**

  Replace `style="color: #1565C0"` with `style="color: var(--brand-primary)"`.

- [ ] **Step 2: Define CSS variables per brand in hub and journey pages**

  In `<head>` section, inject `:root { --brand-primary: #1565C0; ... }` from `brand.colors`.

- [ ] **Step 3: Remove `brandColor`/`brandColorDark` hardcoded references from templates**

### Task 3.3: SVG sprite system

- [ ] **Step 1: Identify all inline SVGs**

  Search for `<svg` across all partials. Extract unique SVG icons.

- [ ] **Step 2: Create icon helper: `{{icon "arrow-right"}}`**

  Build an icon sprite (inline SVG definitions) and a `Handlebars.registerHelper('icon', name => ...)`.

- [ ] **Step 3: Replace inline SVGs with helper calls**

### Task 3.4: Implement block partials (catalog.hbs, cart.hbs, receipt.hbs)

- [ ] **Step 1: Wire catalog.hbs as a composable component**

  Currently stubs — replace with actual Handlebars partials that accept context.

- [ ] **Step 2: Wire cart.hbs, receipt.hbs the same way**

### Task 3.5: Remove `split().join()` replacement system

- [ ] **Step 1: Verify ALL content is Handlebars-driven**

  Check every template partial — no hardcoded brand names, product names, prices, dealer names, or industry-specific text.

- [ ] **Step 2: Remove replacement pass from `build.js`**

  Remove the `replacements` post-processing step in the build pipeline.

- [ ] **Step 3: Remove `replacements` key from brand JSONs**

  In `data/brands/sundaram_store.json`, `data/brands/sunder_masala.json` — remove the entire `replacements` block.

- [ ] **Step 4: Sundaram Store becomes first-class brand**

  Like Haldirams — its own journey data JSONs, not a clone. No post-render string manipulation.

- [ ] **Step 5: Full visual regression pass**

  Run `npm run visual:test` for all 3 brands. Compare baselines.

---

## Dependency Graph

```
Phase 0 (quick bugs) ──→ Phase 3 (architecture)
       │
       └──→ Phase 1 (content adaptation)
                │
                └──→ Phase 2 (step selection)
```

Phases 0 and 1 can partially overlap (they touch different files). Phase 2 depends on Phase 1's journey-type mapping. Phase 3 depends on Phase 0 (can't remove replacements until all prices/names are data-driven).

---

## Key Architecture Constraints (from ARCHITECTURE_GUARDRAILS.md)

1. No inline base64 in partials — use `{{brandLogo}}` variables
2. No hardcoded prices in templates — use `{{formatCurrency journey.*}}`
3. No brand-specific literals in reusable partials — use `{{brand.name}}`
4. All assets resolved through config pipeline
5. No cross-partial side effects — shared state via top-level context
6. Deterministic rendering — same input = same output
7. Visual regression validation mandatory before merge
8. Both paths (build.js and demo-renderer.js) must be updated together
9. Template-pack.json must be rebuilt after partial changes
10. Hub cards use data-journey + event delegation (not onclick strings)
