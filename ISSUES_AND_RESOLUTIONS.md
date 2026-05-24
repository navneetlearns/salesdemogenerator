# Issues & Resolutions: Demo Generator

> Computed from live analysis of the codebase and generated output.
> Branch: `feature/catalog-monolith`

---

## CRITICAL BUGS (Busted Now)

### BUG-1: Prices Are Never Replaced — Sundaram Store Shows Cement Prices

**Evidence:** Sundaram Store (a stationery shop) outputs 34 unique ₹ prices that are ALL JK Cement values. The catalog says ₹110/notebook and ₹90/drawing book, but the HTML shows ₹4,032, ₹15,840, ₹1,46,800, ₹42,18,240.00.

**Root cause:** The `replacements` dict in brand JSON only replaces text strings. `[PRICES]` are hardcoded in the template HTML as literal text — there are no `{{price}}` Handlebars expressions for them. The `split().join()` replacement system cannot know that ₹4,032 should become ₹110 for a different brand because it doesn't understand currency/math.

**Resolution:** 
- Short-term: Add price replacements to each brand's `replacements` dict (e.g., `₹4,032` → `₹440`). But this is order-dependent and breaks if line totals change per quantity.
- Proper: Move ALL prices into journey/financial data in the JSON. Use `{{formatCurrency cart.summary.orderValue}}`, `{{formatCurrency product.lineTotal}}`, etc. Pre-compute at build time. This is Phase 3-4 of the migration plan.

---

### BUG-2: "Dairy" Store Names Unreplaced in Sundaram Output

**Evidence:** `Om Sai Dairy Store` and `Kishor Dairy Works` appear unchanged in Sundaram Store's generated HTML. These are secondary dealers in the admin portal (Step 4). The `replacements` dict doesn't include these names.

**Root cause:** The `replacements` dict only covers primary dealer (`Sharma Cement Stores` → `Sharma Notebook Stores`) but misses the two other dealer names that appear in Step 4's admin dashboard.

**Resolution:**
- Short-term: Add `Om Sai Dairy Store` → `Acme Dairy Store` (or appropriate stationery store names) to Sundaram's replacements.
- Proper: Move all dealer names into `journey.order.secondaryOrders[]` data and render with `{{#each}}`.

---

### BUG-3: Replacement Overlaps Create Silent Errors

**Evidence:** The Sundaram Store `replacements` dict has 59 rules, including 28 overlapping pairs where one key is a substring of another. Examples:
- `'JK Cement'` overlaps with `'JK Cement India'`, `'Explore JK Cement catalog'`, `'Team,<br>JK Cement India'`
- Short keys like `'OPC'`, `'PPC'`, `'Masala'`, `'Spices'` (< 8 chars) risk false positive matches in HTML/CSS/JS context

**Root cause:** `split(from).join(to)` operates on the entire HTML string, including CSS, JavaScript, SVG paths, and base64 data. The order in the dict matters: longer strings must be replaced before shorter substrings. There's no validation or test suite to catch regressions.

**Resolution:**
- Short-term: Sort replacements by key length (longest first) and add HTML-attribute-awareness. But this is a band-aid.
- Proper: Eliminate the replacement system entirely. When all content is data-driven via Handlebars, there's nothing to find-and-replace. This is the end goal of Phase 4.

---

### BUG-4: Product Names Mismatch Between Catalog and Template

**Evidence:** 
- Catalog says: `JK Cement OPC 43`, `JK Cement PPC 53`, `JK Cement Ready Mix`
- Template says: `JK Super OPC 53 Grade (50kg)`, `JK Super OPC 43 Grade (50kg)`, `JKSuper Protect PPC (50kg)`

These are COMPLETELY DIFFERENT product names. The catalog data was written later and doesn't match the hand-crafted HTML.

**Root cause:** The template was written first with made-up product names. The catalog JSON was added later with different naming conventions. Neither ever became the single source of truth.

**Resolution:**
- Decide which naming convention is correct (the template's detailed names or the catalog's short names).
- Create a single `products` array in the journey JSON that is THE authority for product names, SKUs, and prices shown in every step.
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

**Impact:** The composable architecture described in ARCHITECTURE.md is documented but not implemented. `screen-registry.js` maps `catalog` → `screen-catalog` partial, but the actual file (`blocks/catalog.hbs`) is a stub with no implementation.

**Resolution:** This is Phase 3 work — create real partial implementations that match the current monolith output, then wire them through the orchestrator.

---

### STR-5: Dead sunder_masala_journey.json

**Evidence:** `data/journeys/sunder_masala_journey.json` has a `screens` array with `{type: "catalog"}, {type: "cart"}, {type: "receipt"}` but these reference the empty block partials. The real journey is `sunder_masala_order_to_cash.json` which is cloned from JK Cement.

**Resolution:** Delete `sunder_masala_journey.json`. The correct naming convention is `{brand}_{journey_type}.json`.

---

### STR-6: Duplicate Catalog Files

**Evidence:** `sunder_masala_products.json` and `sunder_masala_catalog.json` have identical content (same 2 products).

**Resolution:** Keep one canonical file per brand. Use `{brand}_catalog.json` as the convention. Delete the duplicate.

---

### STR-7: Acme Brand is Incomplete

**Evidence:** Acme has only 2 journey steps (vs 11 for JK Cement), an empty assets folder (only `.gitkeep`), and no `replacements`, `cloneFrom`, or `productMappings`. Building Acme produces a broken demo with JK Cement's full flow but Acme's name on the logo.

**Resolution:** Acme needs either:
1. A full `replacements` dict (60+ rules) like Sundaram Store, OR
2. The data-driven migration must be done first so Acme works with just data + assets

---

### STR-8: JK Cement Missing Product Images

**Evidence:** `assets/brands/jk_cement/` has only `sap_architecture.png`. No product images, no logo file. The brand relies on the `product.png` fallback for everything.

**Resolution:** Need actual product images (OPC 43, PPC 53, Ready Mix) and logo at minimum. Add `logo.png` with transparent background.

---

## ARCHITECTURAL ISSUES

### ARCH-1: `split().join()` Replacement System is Fundamentally Broken

**The system documented as "intentionally temporary" and "intentionally unstable" (ARCHITECTURE.md) has 3 fatal flaws:**
1. **Order-dependent:** `split(from).join(to)` depends on iteration order. Longer strings MUST be replaced before shorter substrings, but JS dict iteration order isn't guaranteed for all engines.
2. **Context-blind:** It replaces in CSS, JS, SVG, base64, and URLs — not just visible text. Short keys like `OPC` could match CSS class names or SVG path data.
3. **No validation:** No way to test that replacements produced valid HTML. No diff testing against a baseline.

**Resolution:** This is the core problem. The entire solution is:
- Phase 3: Extract all brand-varying content into Handlebars expressions
- Phase 4: Remove the `replacements` system from `build.js`
- Add visual regression tests that compare generated HTML against approved baselines

---

### ARCH-2: Build Pipeline Applies Replacements AFTER Handlebars Compilation

**Evidence (build.js L344-383):** The pipeline is:
1. Compile Handlebars template with brand data
2. Apply `split().join()` replacements on the compiled HTML
3. Inject SAP diagram (AFTER replacements to avoid base64 corruption)

This means replacements can corrupt any CSS/JS/SVG that happens to contain a replacement string.

**Resolution:** Once all content is Handlebars-driven, remove the replacement pass entirely. The build becomes: compile Handlebars → inject assets → done.

---

### ARCH-3: Only 1 of 6 Journey Types Implemented

**Evidence:** The parent directory has source HTML for 6 journeys:
- Order to Cash ✅ (implemented)
- Dealer Engagement ❌
- Field Ops & Expense ❌
- Retailer Onboarding ❌
- Automated Collections ❌
- Retailer Loyalty ❌

**Resolution:** Must complete the data-driven migration for Order to Cash first. Then use the partial library as the foundation to build out the other 5 journey types. Each new journey type = new journey JSON + new step partials.

---

## RESOLUTION PRIORITY

| Priority | Issue | Type | Effort | Impact |
|---|---|---|---|---|
| **P0** | BUG-1: Prices never replaced | Bug | Medium | Every brand shows wrong prices |
| **P0** | BUG-2: Secondary dealers unreplaced | Bug | Low | Admin portal shows wrong names |
| **P0** | BUG-4: Product name mismatch | Bug | Low | Catalog data = single source of truth |
| **P1** | BUG-3: Replacement overlaps | Bug | Medium | Silent HTML corruption risk |
| **P1** | STR-8: JK Cement missing images | Content | Low | Demo uses falling images |
| **P1** | STR-5: Dead journey file | Cleanup | Trivial | Misleading dead code |
| **P1** | STR-6: Duplicate catalog files | Cleanup | Trivial | Confusion |
| **P2** | STR-1: 200K monolith | Architecture | High | Root cause of all issues |
| **P2** | STR-2: 411 inline styles | Architecture | High | Brand theming impossible |
| **P2** | STR-3: 252 inline SVGs | Architecture | Medium | Icon changes painful |
| **P2** | ARCH-1: Replacement system | Architecture | High | Must be eliminated |
| **P2** | ARCH-2: Post-HBS replacement | Architecture | Medium | Gone when ARCH-1 resolved |
| **P3** | STR-4: Empty block partials | Architecture | Medium | Needed for composition |
| **P3** | STR-7: Acme incomplete | Content | Medium | Depends on P2 completion |
| **P3** | ARCH-3: 5 more journey types | Feature | Very High | Repeat P2/P3 for each journey |
