# Demo Generator — Project Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the demo-generator from "functional but with residual debt" to "production-complete" — commit pending work, eliminate last hardcoded content, reduce HTML bloat, verify all 9 journeys in the wizard, and deliver the AI Premium Generation Path (Path C) for client-ready demos.

**Architecture:** Three rendering paths coexist: (A) build.js static output for fast data-driven builds, (B) demo-renderer.js client-side wizard via template-pack.json, (C) AI-generated premium HTML for reference-quality client demos. All brand content is data-driven via Handlebars — no replacement system remains.

**Tech Stack:** Node.js 18+, Handlebars, Vercel (Blob storage + serverless functions), Playwright (visual regression), OpenCode AI (content adaptation)

**Current State (June 19, 2026):**
- 43/43 tests pass
- All 21 journey outputs build clean (9 types × 3 brands)
- Content adaptation: complete (auto on Generate, 7 label files)
- Step selection: complete (all 9 journeys, wizard UI)
- Share API: complete (v1/v2/v3, Blob URL iframes)
- Replacements system: eliminated
- 8 files uncommitted (content adaptation auto-flow)
- Deployment healthy: https://demo-generator-one.vercel.app

---

## Phase 0: Commit & Deploy Pending Work (30 min)

Goal: Get the 8 uncommitted files (content adaptation auto-flow) into git and deployed to production.

### Task 0.1: Review and commit uncommitted changes

**Files:**
- Modify: `api/experiments/adapt-content.js` (journeyType fix)
- Modify: `public/index.html` (removed Adapt Content button)
- Modify: `public/js/demo-ui.js` (auto-adapt on generate, removed stale refs)
- Modify: `public/template-pack.json` (rebuilt)
- Modify: `test/experiment-ui.test.js` (updated assertions)
- Modify: `ARCHITECTURE.md`, `ISSUES_AND_RESOLUTIONS.md`, `README.md` (docs)

- [ ] **Step 1: Review the diff**

```bash
cd '/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator'
git diff HEAD --stat
```

Expected: 8 files, ~182 insertions, ~247 deletions

- [ ] **Step 2: Run tests to confirm green**

```bash
"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js
```

Expected: 43/43 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: auto content adaptation on Generate — remove manual Adapt Content button

- adapt-content.js now uses req.body.journeyType (was hardcoded order_to_cash)
- demo-ui.js: adaptContent() called silently during generate(), no separate button
- Removed content review panel (Accept/Reset/Save)
- Hub B/C notices preserved as only user-facing adaptation indicator
- Updated tests for auto-adapt flow"
```

- [ ] **Step 4: Deploy to Vercel production**

```bash
"/mnt/c/Program Files/nodejs/node.exe" "C:/Users/sumit/AppData/Roaming/npm/node_modules/vercel/dist/index.js" deploy --prod --yes
```

Expected: Deploy succeeds, health check returns `{"status":"ok"}`

- [ ] **Step 5: Verify production health**

```bash
curl -s https://demo-generator-one.vercel.app/api/health
```

Expected: `{"status":"ok","version":"1.0.0","mode":"static"}`

---

## Phase 1: Eliminate Last Hardcoded Prices (1 day)

Goal: Convert the final 11 hardcoded prices in Step 3 (AI capture cart/checkout WebView) to data-driven Handlebars expressions. This is the last content that isn't parameterized.

### Task 1.1: Add Step 3 cart data to journey JSONs

**Files:**
- Modify: `data/journeys/jk_cement_order_to_cash.json`
- Modify: `data/journeys/haldirams_order_to_cash.json`
- Modify: `data/journeys/jk_cement_field_ops_expense.json` (if Step 3 exists there)

- [ ] **Step 1: Inspect current Step 3 partial for hardcoded values**

```bash
grep -n '₹\|INR\|1,46\|1,28\|800\|350' templates/partials/step3-ai-capture.hbs
```

Expected: ~11 price occurrences in cart items, line totals, tax, order value

- [ ] **Step 2: Add cartItems array to journey JSON**

Add to `journey.step3` in each brand's order_to_cash JSON:

```json
"step3": {
  "cartItems": [
    {"name": "{{productNames.opc53}}", "qty": "500 bags", "unitPrice": "₹350", "lineTotal": "₹1,75,000"},
    {"name": "{{productNames.ppc}}", "qty": "200 bags", "unitPrice": "₹320", "lineTotal": "₹64,000"}
  ],
  "subtotal": "₹2,39,000",
  "gst": "₹28,680",
  "total": "₹2,67,680"
}
```

(Actual values per brand — JK Cement prices differ from Haldirams)

- [ ] **Step 3: Update step3-ai-capture.hbs to use Handlebars expressions**

Replace each hardcoded price with `{{formatCurrency journey.step3.cartItems.N.unitPrice}}` or iterate with `{{#each journey.step3.cartItems}}`.

- [ ] **Step 4: Verify formatCurrency helper is registered in both paths**

```bash
grep -n 'formatCurrency' build.js scripts/build-template-pack.js
```

Expected: Helper registered in both build.js (server) and build-template-pack.js (client)

- [ ] **Step 5: Rebuild and run tests**

```bash
"/mnt/c/Program Files/nodejs/node.exe" build.js --dist
"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js
"/mnt/c/Program Files/nodejs/node.exe" scripts/build-template-pack.js
```

Expected: Build succeeds, 43/43 tests pass, template-pack rebuilt

- [ ] **Step 6: Verify no hardcoded prices remain**

```bash
grep -rn '₹[0-9]' templates/partials/ | grep -v '{{' | grep -v 'screen-desc'
```

Expected: Zero matches (all prices go through Handlebars)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: data-driven Step 3 prices — last hardcoded content eliminated

- Added cartItems/subtotal/gst/total to journey JSONs
- step3-ai-capture.hbs now uses {{formatCurrency}} for all prices
- Zero hardcoded ₹ amounts remain in template partials"
```

---

## Phase 2: Field Ops Base64 → File References (1 day)

Goal: Replace 8 inline base64 data URIs in field_ops partials with `<img src>` references to extracted assets in `assets/field_ops/`. Reduces per-brand HTML from ~8.5MB to manageable size.

### Task 2.1: Audit base64 images in field_ops partials

**Files:**
- Inspect: `templates/partials/step*-field-ops.hbs` (15 files)
- Assets: `assets/field_ops/fo_*.png` (8 files)

- [ ] **Step 1: Find all base64 data URIs in field_ops partials**

```bash
grep -c 'data:image/png;base64' templates/partials/step*-field-ops.hbs
```

Expected: 8 occurrences across 6 partials (steps 3, 5, 6, 8, 9, and possibly others)

- [ ] **Step 2: Map each base64 to its extracted asset**

```bash
ls -la assets/field_ops/
```

Expected: 8 PNG files (fo_*.png)

- [ ] **Step 3: Replace base64 with {{fieldOpsImage}} helper calls**

In each partial, replace:
```html
<img src="data:image/png;base64,iVBORw0KGgo..." />
```
with:
```html
<img src="{{fieldOpsImage "fo_expense_form.png"}}" />
```

- [ ] **Step 4: Verify assets are copied to dist/ and public/**

```bash
grep -n 'field_ops' build.js | grep -i copy
```

Expected: Copy block for `assets/field_ops/` → `dist/assets/field_ops/` AND `public/assets/field_ops/`

- [ ] **Step 5: Rebuild and verify size reduction**

```bash
"/mnt/c/Program Files/nodejs/node.exe" build.js --dist
ls -la dist/jk_cement/ | grep field_ops
wc -c generated/jk_cement/field_ops_expense.html
```

Expected: HTML size reduced by ~4.5MB (from ~8.5MB to ~4MB)

- [ ] **Step 6: Run tests**

```bash
"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js
```

Expected: 43/43 pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "perf: replace field_ops base64 with file references — 50% HTML size reduction

- 8 inline data URIs replaced with {{fieldOpsImage}} helper
- Assets served from dist/assets/field_ops/ and public/assets/field_ops/
- field_ops_expense.html reduced from ~8.5MB to ~4MB per brand"
```

---

## Phase 3: Custom Demo Wizard — All 9 Journeys Audit (1 day)

Goal: Verify the client-side wizard (template-pack.json path) correctly renders all 9 journey types with proper step selection, not just the 6 standard ones.

### Task 3.1: Audit knownMismatches in buildDynamicOrchestrator()

**Files:**
- Modify: `public/js/demo-renderer.js` (buildDynamicOrchestrator function)
- Modify: `scripts/build-template-pack.js` (if mapping logic differs)

- [ ] **Step 1: Check current knownMismatches entries**

```bash
grep -A 10 'knownMismatches' public/js/demo-renderer.js
```

Expected: Only `field_ops_expense→field-ops` and `automated_collections→collections`

- [ ] **Step 2: Map all 9 journey IDs to their partial naming conventions**

| Journey ID | Partial prefix | Needs mismatch entry? |
|------------|---------------|----------------------|
| order_to_cash | step*-self-service, step*-order-confirmed | No (direct match) |
| field_ops_expense | step*-field-ops | Yes (already exists) |
| automated_collections | step*-collections | Yes (already exists) |
| dealer_engagement | step*-dealer_engagement | Check |
| retailer_onboarding | step*-retailer_onboarding | Check |
| retailer_loyalty | step*-retailer_loyalty | Check |
| campaigns_queries | step*-campaigns_queries | Check |
| dt_fulfillment_payment | step*-dt_fulfillment_payment | Check |
| retailer_activation | step*-retailer_activation | Check |

- [ ] **Step 3: Verify partial names exist in template-pack.json**

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const pack = require('./public/template-pack.json');
const partials = Object.keys(pack.partials);
const journeys = ['dealer_engagement','retailer_onboarding','retailer_loyalty','campaigns_queries','dt_fulfillment_payment','retailer_activation'];
journeys.forEach(j => {
  const matching = partials.filter(p => p.includes(j.replace(/_/g,'-')) || p.includes(j));
  console.log(j + ': ' + matching.length + ' partials → ' + matching.slice(0,3).join(', '));
});
"
```

Expected: Each journey has at least 2+ matching partials

- [ ] **Step 4: Add any missing mismatch entries**

If a journey ID uses underscores but partials use hyphens (or vice versa), add to knownMismatches.

- [ ] **Step 5: Test each journey type in the wizard**

For each of the 9 journey types:
1. Open `public/preview.html` in Firefox
2. Fill brand identity (use JK Cement defaults)
3. Select the journey type
4. Click Generate
5. Verify: no "undefined" text, correct step count, navigation works

- [ ] **Step 6: Rebuild template-pack and commit**

```bash
"/mnt/c/Program Files/nodejs/node.exe" scripts/build-template-pack.js
git add -A
git commit -m "fix: add knownMismatches for all 9 journey types in wizard

- Verified partial name mapping for dealer_engagement, retailer_onboarding,
  retailer_loyalty, campaigns_queries, dt_fulfillment_payment, retailer_activation
- All 9 journeys render correctly in client-side wizard"
```

---

## Phase 4: AI Premium Generation Path — Path C (3-5 days)

Goal: Generate reference-quality static HTML demos via AI for client-facing presentations. These coexist with build.js output at `dist/{brand}/premium/`.

### Task 4.1: Create generation spec (CLAUDE.md equivalent)

**Files:**
- Create: `docs/premium-generation-spec.md`

- [ ] **Step 1: Define brand specs for JK Cement and Haldirams**

Document for each brand:
- Brand name, industry, colors (--brand, --brand-dark, --accent)
- Logo (base64 or path)
- Product catalog with realistic prices
- Dealer names and contact info

- [ ] **Step 2: Define journey step specs**

For each of the 6 standard journeys, specify:
- Step count and titles
- Perspective (buyer/seller/both)
- Screen types per step (full/group/webview/notification)
- Target screens per step: 2-3 minimum
- Content density target: multi-turn conversations, not single messages

- [ ] **Step 3: Define quality targets**

| Metric | Current (Path A) | Target (Path C) |
|--------|-----------------|-----------------|
| File size (OTC) | 1.2 MB | ≥ 2.5 MB |
| Screens per step | 1-2 | 2-3 |
| Message turns | 1 per screen | 2-4 per screen |
| Business data | Generic | Specific (order IDs, ₹ amounts, IST times) |
| Brand logo | Relative path | Base64 inline |
| Screen descriptions | Brief | Contextual cards |

### Task 4.2: Generate premium HTML for JK Cement × order_to_cash

**Files:**
- Create: `dist/jk_cement/premium/journey_order_to_cash.html`

- [ ] **Step 1: Use reference file as quality benchmark**

Open `projects/Banas_Diary/journey_order_to_cash.html` (from whatsapp-mock-generator) as the quality target. Same CSS classes, same structure, but with JK Cement content.

- [ ] **Step 2: Generate the premium HTML**

Using the spec from Task 4.1, generate a complete standalone HTML file with:
- All 11 steps of order_to_cash
- Multi-turn WhatsApp conversations per screen
- Realistic JK Cement business data (order IDs like JKC-5923, prices in INR)
- Base64-embedded logo
- Screen description cards
- Color-coded step tags
- Full navigation (showDesktopStep, arrow keys, prev/next)

- [ ] **Step 3: Validate against quality checklist**

- File size ≥ 2.5 MB ✓
- 2-3 screens per step ✓
- Multi-turn conversations ✓
- Realistic business data ✓
- Base64 logo ✓
- Screen descriptions ✓
- Navigation works ✓

- [ ] **Step 4: Place in premium directory**

```bash
mkdir -p dist/jk_cement/premium/
# Copy generated file
```

### Task 4.3: Generate remaining premium journeys (5 more for JK Cement)

**Files:**
- Create: `dist/jk_cement/premium/journey_field_ops_expense.html`
- Create: `dist/jk_cement/premium/journey_automated_collections.html`
- Create: `dist/jk_cement/premium/journey_dealer_engagement.html`
- Create: `dist/jk_cement/premium/journey_retailer_onboarding.html`
- Create: `dist/jk_cement/premium/journey_retailer_loyalty.html`

- [ ] **Step 1: Generate each using reference files from the table in AI strategy**

| Journey | Reference Source |
|---------|-----------------|
| field_ops_expense | Adani Wilmar / Orient |
| automated_collections | Banas_Diary |
| dealer_engagement | Banas_Diary |
| retailer_onboarding | Haldirams |
| retailer_loyalty | Banas_Diary |

- [ ] **Step 2: Validate each against quality checklist**

- [ ] **Step 3: Commit all premium outputs**

```bash
git add dist/jk_cement/premium/
git commit -m "feat: AI premium demos for JK Cement — 6 journeys, reference quality

- Path C rendering: AI-generated standalone HTML
- 2-3× content density vs build.js output
- Multi-turn conversations, realistic data, base64 logos
- Coexists with build.js static output"
```

### Task 4.4: Integrate premium demos into hub page

**Files:**
- Modify: `dist/jk_cement/index.html` (or template that generates it)

- [ ] **Step 1: Add "Premium Demo" links to hub cards**

Each journey card in the hub page gets a secondary link: "View Premium Demo" pointing to `premium/journey_{type}.html`

- [ ] **Step 2: Verify links work after deployment**

```bash
"/mnt/c/Program Files/nodejs/node.exe" "C:/Users/sumit/AppData/Roaming/npm/node_modules/vercel/dist/index.js" deploy --prod --yes
```

---

## Phase 5: Final Cleanup & Hardening (1 day)

### Task 5.1: Remove dead code

**Files:**
- Delete: `prod-demo-renderer.js` (stale copy, not referenced)
- Verify: `sunder_masala_journey.json` was removed (debt item #9)

- [ ] **Step 1: Confirm prod-demo-renderer.js is unreferenced**

```bash
grep -rn 'prod-demo-renderer' . --include='*.js' --include='*.html' --include='*.json' | grep -v node_modules | grep -v '.git'
```

Expected: Zero references

- [ ] **Step 2: Delete dead files**

```bash
rm prod-demo-renderer.js
# Check for sunder_masala_journey.json
ls data/journeys/sunder* 2>/dev/null
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove dead code — prod-demo-renderer.js, stale journey JSONs"
```

### Task 5.2: Final build verification

- [ ] **Step 1: Full clean build**

```bash
"/mnt/c/Program Files/nodejs/node.exe" build.js --dist
"/mnt/c/Program Files/nodejs/node.exe" scripts/build-template-pack.js
"/mnt/c/Program Files/nodejs/node.exe" --test test/*.test.js
```

Expected: Build succeeds, 43+/43+ tests pass

- [ ] **Step 2: Verify all 3 brands render correctly**

```bash
for brand in jk_cement haldirams sundaram_store; do
  echo "=== $brand ==="
  ls dist/$brand/index.html 2>/dev/null && echo "OK" || echo "MISSING"
done
```

Expected: All 3 brands have index.html

- [ ] **Step 3: Deploy final state**

```bash
"/mnt/c/Program Files/nodejs/node.exe" "C:/Users/sumit/AppData/Roaming/npm/node_modules/vercel/dist/index.js" deploy --prod --yes
```

### Task 5.3: Update project documentation

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Update README with Path C documentation**

Add section about premium demos: what they are, how to generate, where they live.

- [ ] **Step 2: Update ARCHITECTURE.md with three-path diagram**

```
Path A: build.js → generated/ + dist/ [fast, data-driven]
Path B: demo-renderer.js → template-pack.json [client-side, custom]
Path C: AI premium → dist/{brand}/premium/ [rich, reference-quality]
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: update README and ARCHITECTURE for project completion state"
```

---

## Dependency Graph

```
Phase 0 (commit/deploy) ──→ Phase 1 (prices) ──→ Phase 2 (base64)
                                    │
                                    └──→ Phase 3 (wizard audit)
                                                │
Phase 4 (AI premium) ← independent, can start after Phase 0
                                                │
Phase 5 (cleanup) ← after all above complete
```

Phase 0 must go first (clean working tree).
Phase 1 and 3 can run in parallel.
Phase 2 depends on Phase 1 (same partials may overlap).
Phase 4 is independent — can start any time after Phase 0.
Phase 5 is last — final verification.

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 0: Commit & Deploy | 30 min | None |
| Phase 1: Hardcoded Prices | 1 day | Phase 0 |
| Phase 2: Field Ops Base64 | 1 day | Phase 1 |
| Phase 3: Wizard Audit | 1 day | Phase 0 |
| Phase 4: AI Premium (6 journeys) | 3-5 days | Phase 0 |
| Phase 5: Cleanup | 1 day | All above |
| **Total** | **~8-10 days** | |

## Success Criteria

1. Zero hardcoded ₹ amounts in template partials
2. Field ops HTML < 5MB per brand (from ~8.5MB)
3. All 9 journey types render correctly in client-side wizard
4. 6 premium demos live at dist/jk_cement/premium/ (≥2.5MB each)
5. 43+ tests passing
6. Production deployed and healthy
7. Clean git history (no uncommitted work)
