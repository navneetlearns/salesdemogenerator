# Retailer Onboarding to Cash — Journey Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 10-step placeholder scaffold for `retailer_onboarding` with real WhatsApp phone-screen content extracted from the Haldiram's reference HTML, for all 3 active brands (JK Cement, Sundaram Store, Haldiram).

**Architecture:** The journey has two rendering paths — server-side (build.js compiles Handlebars partials into static HTML) and client-side (demo-renderer.js generates on-the-fly from template-pack data). Both paths share the same journey JSON data structure. The reference HTML is Haldiram's-branded; we extract the structural flow and apply brand-variant data per-brand through the existing replacements/brand JSON system.

**Tech Stack:** Handlebars partials, Node.js build pipeline, vanilla JS client-side renderer, JSON data files.

**Key constraint:** 12-step journey (expanded from current 10-step scaffold to match reference). Dual rendering (fix both build.js path AND demo-renderer.js path).

**Reference:** `F:\Sellerhub\Rakesh\Haldirams\journey_retailer_onboarding_to_cash.html` (3472 lines, 12-step Haldiram's journey)

---

### Task 1: Define the 12-Step Journey Structure

**Files:**
- Modify: `data/journeys/jk_cement_retailer_onboarding.json` (full rewrite)
- Create: `data/journeys/haldirams_retailer_onboarding.json`
- Create: `data/journeys/sundaram_store_retailer_onboarding.json`

**12-step structure (extracted from reference):**

| Step | Title | Screens | Content Summary |
|------|-------|---------|-----------------|
| 1 | Activation & Registration | 3 | Campaign DM → Registration WebView → App Submitted |
| 2 | Welcome & Self Service | 2 | Partner Approved → Self-service Menu (10 options) |
| 3 | Campaigns & Queries | 3 | Festive Campaign → Category Query → Price List |
| 4 | Scheme & Product Queries | 3 | Scheme Notification → AI Typing → ZoAi Explains |
| 5 | Self Service Ordering | 3 | Menu → Browse Categories → Product Selection |
| 6 | Catalog Browse & Order | 3 | WebView Catalog → Cart → Order Confirmed |
| 7 | AI Order Capture | 3 | Handwritten Note → Draft Order → Checkout |
| 8 | Distributor Confirmation | 3 | DT Receives → DT Reviews → DT Accepts |
| 9 | Order to Invoice | 3 | DT Menu → Fulfilment List → Invoice Upload |
| 10 | Invoice & Payment | 3 | Invoice on WhatsApp → UPI QR → Payment Confirmed |
| 11 | Collect Digital Orders | 3 | DT Menu → Retailer Selection → Order Nudge Sent |
| 12 | Collect Payments | 3 | Pending Invoices → Retailer nudge → Payment Reminder |

- [ ] **Step 1: Write jk_cement_retailer_onboarding.json with full 12-step data**

The JSON must include:
- `id`, `title`, `brand` fields
- 12 `steps[]` with num, displayNum, title, meta, navTitle, navDesc
- 12 `screens[]` with type identifiers (one per step, aligned with partial naming)
- `dealer` object with name, contactName, phone, address
- `messages` object with step-specific welcome/greeting/body content
- `order` object with primaryOrderId, date, items[], summary
- `cart` for catalog/checkout steps
- `invoice` object for steps 8-10
- `payment` object for step 10
- `retailer` object (new section specific to this journey): name, storeName, phone, gst
- `distributor` object (new section): name, contact, territory
- `stepN` sub-objects for step-specific data (draft orders, etc.)

Key data mappings for each brand:

**JK Cement:** Dealer="Sharma Cement Stores", Retailer="Ramesh Patel / Ganesh General Stores", Distributor="Shyam Distributors", Order prefix="JKO-", Invoice prefix="INV-"

**Haldiram's (from reference):** Retailer="Ramesh Patel / Ganesh General Stores", Distributor="Shyam Distributors", Order ID="HDIN-3892", Invoice="HINV-2147", brand colors red (#E8201E)

**Sundaram Store:** Clone from JK Cement base via replacements dict, but add real retailer_onboarding data

- [ ] **Step 2: Create haldirams_retailer_onboarding.json with Haldiram's-specific data**

Same structure as JK Cement but with:
- Brand ID: `haldirams`
- Product references matching haldirams_products.json catalog
- Haldiram's-specific dealer/retailer names
- Order/invoice data matching the reference HTML values

- [ ] **Step 3: Create sundaram_store_retailer_onboarding.json**

Clone from JK Cement structure with Sundaram Store-specific dealer/retailer names, order prefixes, product refs.

- [ ] **Step 4: Update data/brands files to register "retailer_onboarding" in their journey lists**

Check each brand's JSON to ensure `retailer_onboarding` is in the `journeys` array.

---

### Task 2: Rewrite Screen Orchestrator Template to 12 Steps

**Files:**
- Modify: `templates/screens/retailer_onboarding.hbs`

- [ ] **Step 1: Update orchestrator from 10 to 12 partial includes**

Current orchestrator:
```handlebars
{{!-- Retailer Onboarding to Cash — 10 Steps --}}
      {{> step1-retailer_onboarding}}
      {{> step2-retailer_onboarding}}
      ...
      {{> step10-retailer_onboarding}}
```

New orchestrator:
```handlebars
{{!-- Retailer Onboarding to Cash — 12 Steps --}}
      {{> step1-retailer_onboarding}}
      {{> step2-retailer_onboarding}}
      {{> step3-retailer_onboarding}}
      {{> step4-retailer_onboarding}}
      {{> step5-retailer_onboarding}}
      {{> step6-retailer_onboarding}}
      {{> step7-retailer_onboarding}}
      {{> step8-retailer_onboarding}}
      {{> step9-retailer_onboarding}}
      {{> step10-retailer_onboarding}}
      {{> step11-retailer_onboarding}}
      {{> step12-retailer_onboarding}}
```

- [ ] **Step 2: Verify no syntax errors in the orchestrator**

---

### Task 3: Write Step 1 — Activation & Registration (3 Screens)

**Files:**
- Modify: `templates/partials/step1-retailer_onboarding.hbs`

**Screen 1: Activation Campaign DM** — Marketing Template with image header. ZoTok sends a WhatsApp marketing message to prospective retailers inviting them to register.

**Screen 2: Retailer Registration** — WebView registration form. Retailer taps 'Register Now', fills business details via ZoTok-hosted WebView inside WhatsApp.

**Screen 3: Application Under Review** — Utility template confirming submission. ZoTok auto-confirms receipt with message about review process.

Template pattern (uses existing partials: status-bar, wa-topbar, date-pill, whatsapp-message):

```handlebars
{{!-- Step 1: Activation & Registration — 3 screens --}}
<div id="step-1" class="step-section active">
  <!-- Screen 1: Activation Campaign DM -->
  {{#> screen-wrap lbl="Screen 1 · Activation Campaign" type="Marketing Template — Image Header + Quick Reply"}}
    {{#> phone-frame}}
      {{> status-bar time="9:20 AM"}}
      {{> wa-topbar status="Business Account" actions="video+more" avatarSrc=brandLogo}}
      <div class="chat-area">
        {{> date-pill text="Today"}}
        {{#with journey.messages.step1.campaign}}
          {{> whatsapp-message}}
        {{/with}}
      </div>
      {{> input-bar}}
    {{/phone-frame}}
    {{#> screen-desc strong="Activation Campaign"}}
      ZoTok sends a WhatsApp marketing message to prospective retailers, inviting them to register as official retail partners.
    {{/screen-desc}}
  {{/screen-wrap}}

  <!-- Screen 2: Retailer Registration WebView -->
  {{#> screen-wrap lbl="Screen 2 · Retailer Registration" type="WebView — Registration Form"}}
    {{#> phone-frame}}
      {{> status-bar time="9:25 AM"}}
      {{> wa-topbar back=true status="Haldirams" actions="more" avatarSrc=brandLogo}}
      <div class="webview-area" style="flex:1;background:#fff;display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;padding:20px;">
          <div style="font-size:28px;margin-bottom:12px;">📝</div>
          <h3 style="font-size:16px;color:#111;margin-bottom:8px;">Retail Partner Registration</h3>
          <p style="font-size:13px;color:#666;margin-bottom:16px;">Fill in your business details to get started</p>
          <div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:left;">
            <div style="font-size:12px;color:#888;margin-bottom:4px;">Store Name: <strong style="color:#111;">Ganesh General Stores</strong></div>
            <div style="font-size:12px;color:#888;margin-bottom:4px;">Owner: <strong style="color:#111;">Ramesh Patel</strong></div>
            <div style="font-size:12px;color:#888;margin-bottom:4px;">Phone: <strong style="color:#111;">+91 98765 43210</strong></div>
            <div style="font-size:12px;color:#888;">GST: <strong style="color:#111;">08AABCU9603R1ZM</strong></div>
          </div>
          <div style="margin-top:16px;padding:10px;background:#075E54;color:#fff;border-radius:8px;font-weight:600;font-size:14px;">✓ Registration Submitted</div>
        </div>
      </div>
    {{/phone-frame}}
    {{#> screen-desc strong="Registration Form"}}
      Retailer taps 'Register Now' and fills in their business details via a ZoTok-hosted WebView form opened inside WhatsApp.
    {{/screen-desc}}
  {{/screen-wrap}}

  <!-- Screen 3: Application Submitted -->
  {{#> screen-wrap lbl="Screen 3 · Application Under Review" type="Utility Template — Text Header, No Buttons"}}
    {{#> phone-frame}}
      {{> status-bar time="9:32 AM"}}
      {{> wa-topbar status="Business Account" actions="video+more" avatarSrc=brandLogo}}
      <div class="chat-area">
        {{> date-pill text="Today"}}
        {{#with journey.messages.step1.submitted}}
          {{> whatsapp-message}}
        {{/with}}
      </div>
      {{> input-bar}}
    {{/phone-frame}}
    {{#> screen-desc strong="Application Submitted"}}
      ZoTok auto-confirms receipt of the registration. The brand's team reviews details before activating the retail partner.
    {{/screen-desc}}
  {{/screen-wrap}}
</div>
```

- [ ] **Step 1: Write step1-retailer_onboarding.hbs** with the 3-screen template above
- [ ] **Step 2: Add the `campaign` and `submitted` message blocks in journey JSON**

---

### Task 4: Write Steps 2 through 12 Templates

**Files:**
- Modify: `templates/partials/step2-retailer_onboarding.hbs` through `step12-retailer_onboarding.hbs`
- Modify: `templates/partials/step11-retailer_onboarding.hbs` (new)
- Modify: `templates/partials/step12-retailer_onboarding.hbs` (new)

Each step follows the same pattern as step1: 3 screen-wrap blocks containing phone-frame + screen-desc.

**Step 2 — Welcome & Self Service (2 screens):**
- Screen 1: Partner Approved — Session interactive message with reply button. Retailer receives "Welcome! Your application has been approved."
- Screen 2: Self Service Menu — Interactive list with 10 options (Order Now, Browse Products, Current Schemes, Price List, Invoices, Payments, My Account, AI Assistant, Credit Note, Support)

**Step 3 — Campaigns & Queries (3 screens):**
- Screen 1: Diwali Festive Campaign — Marketing template with image header. "Stock up for Diwali! 🪔 Bhujia, Mathri & Assorted Gift Packs..."
- Screen 2: Product Category Query — Interactive list for category selection
- Screen 3: Price List Response — Utility template with document header showing trade prices

**Step 4 — Scheme & AI Queries (3 screens):**
- Screen 1: Scheme Notification — Marketing template: "Buy 10 ctns Aloo Bhujia 400g → Get 2 ctns FREE + ₹500 ZoPs"
- Screen 2: AI Typing — Session message showing ZoAi typing indicator
- Screen 3: AI Explains — Hinglish response explaining scheme terms

**Step 5 — Self Service Ordering (3 screens):**
- Screen 1: Menu Navigation — Session interactive, retailer selects 'Order Now'
- Screen 2: Browse Products — Interactive list with product categories
- Screen 3: Product Selection — Catalog view with items

**Step 6 — Catalog Browse & Order (3 screens):**
- Screen 1: Browse Catalog — Commerce WebView showing product catalog
- Screen 2: Cart Review — WebView cart with items and totals
- Screen 3: Order Received — Utility template: "Order ID: HDIN-3892, Items: 4, Value: ₹7,840"

**Step 7 — AI Order Capture (3 screens):**
- Screen 1: Handwritten Note — Session message with photo attachment + "Order Note" caption
- Screen 2: Draft Order — Interactive template with extracted order: items, quantities, totals
- Screen 3: Checkout — Commerce WebView cart review

**Step 8 — Distributor Confirmation (3 screens):**
- Screen 1: DT Receives Order — Utility template alerting distributor
- Screen 2: DT Order Review — Commerce WebView order review portal
- Screen 3: DT Accepts Order — Utility template: "Order Confirmed. Your order has been confirmed and is being processed."

**Step 9 — Order to Invoice (3 screens):**
- Screen 1: Distributor Menu — Interactive list
- Screen 2: Orders to Process — WebView fulfilment list
- Screen 3: Upload Invoice — WebView invoice upload with AI parse

**Step 10 — Invoice & Payment (3 screens):**
- Screen 1: Invoice Shared — Utility template with document: invoice PDF with payment link
- Screen 2: Payment Reminder — UPI QR code + Pay Now button
- Screen 3: Payment Received — Confirmation template: "Payment of ₹7,448 received"

**Step 11 — Collect Digital Orders (3 screens):**
- Screen 1: Distributor Menu — Interactive list
- Screen 2: Select Retailers — WebView retailer nudge list
- Screen 3: Order Nudge Sent — Utility template sent to selected retailers

**Step 12 — Collect Payments (3 screens):**
- Screen 1: Distributor Menu — Interactive list
- Screen 2: Pending Invoices — WebView invoice payment tracker
- Screen 3: Payment Reminder — Invoice nudge sent to retailer

- [ ] **Step 1: Write step2-retailer_onboarding.hbs**
- [ ] **Step 2: Write step3-retailer_onboarding.hbs**
- [ ] **Step 3: Write step4-retailer_onboarding.hbs**
- [ ] **Step 4: Write step5-retailer_onboarding.hbs**
- [ ] **Step 5: Write step6-retailer_onboarding.hbs**
- [ ] **Step 6: Write step7-retailer_onboarding.hbs**
- [ ] **Step 7: Write step8-retailer_onboarding.hbs**
- [ ] **Step 8: Write step9-retailer_onboarding.hbs**
- [ ] **Step 9: Write step10-retailer_onboarding.hbs**
- [ ] **Step 10: Write step11-retailer_onboarding.hbs** (new file)
- [ ] **Step 11: Write step12-retailer_onboarding.hbs** (new file)
- [ ] **Step 12: Verify all 12 partials render without syntax errors** via `npm run build`

---

### Task 5: Add Shared Partials Needed by Retailer Onboarding

**Files:**
- Create: `templates/partials/input-bar.hbs` (if not already extracted)
- Create: `templates/partials/screen-desc.hbs` (extract screen description card pattern)

The retailer_onboarding templates reference `{{#> screen-desc}}...{{/screen-desc}}` and `{{#> input-bar}}...{{/input-bar}}` partial blocks. Check if these already exist in the partials directory or need to be created.

- [ ] **Step 1: Check existing partials** — verify screen-wrap.hbs, phone-frame.hbs exist
- [ ] **Step 2: Create input-bar.hbs** if not already available
- [ ] **Step 3: Create screen-desc.hbs** if not already available
- [ ] **Step 4: Verify partials register correctly** in build.js

---

### Task 6: Add retailer_onboarding Data for Brands

**Files:**
- Modify: `data/brands/haldirams.json` — add journey reference
- Check: `data/brands/jk_cement.json` — verify journey exists
- Check: `data/catalogs/jk_cement_products.json` — verify product IDs match whats used in journey

- [ ] **Step 1: Verify haldirams.json has `retailer_onboarding` in journeys list**
- [ ] **Step 2: Create Haldiram-specific product data** in catalog if needed for the journey
- [ ] **Step 3: Create cloned journey data** for Sundaram Store via clone-journeys script

---

### Task 7: Update Build Pipeline (build.js)

**Files:**
- Modify: `build.js`

The build pipeline at line 520-528 already handles retailer_onboarding. It reads the journey JSON, builds context, and renders. No changes should be needed to the rendering pipeline itself, but verify:

- [ ] **Step 1: Run `npm run build`** and verify no errors for retailer_onboarding
- [ ] **Step 2: Verify generated output** at `generated/jk_cement/retailer_onboarding.html` contains real WhatsApp screens, not "🚧 placeholder"

---

### Task 8: Update Client-Side Renderer (demo-renderer.js)

**Files:**
- Modify: `public/js/demo-renderer.js`

The client-side renderer needs to render `retailer_onboarding` journey type when a user generates via the wizard. Currently it delegates to generic rendering. Add:

1. A `retailer_onboarding` case in the render switch or if-else chain (similar to `order_to_cash`, `field_ops_expense`, etc.)
2. Journey-specific data structure handling
3. The journey description needs `scaffold: false` instead of `true`

- [ ] **Step 1: Find the rendering dispatch** in demo-renderer.js where journey types are handled
- [ ] **Step 2: Add retailer_onboarding to the journeyDescriptions** in template-pack.json with `scaffold: false`
- [ ] **Step 3: Wire the journey type** through the render pipeline

---

### Task 9: Update Journey Descriptions (template-pack)

**Files:**
- Verify: `public/template-pack.json` (template scaffold markings)

- [ ] **Step 1: Change `scaffold: true` to `scaffold: false`** for `retailer_onboarding` in journeyDescriptions
- [ ] **Step 2: Update `steps` count** from 10 to 12 in the description

---

### Task 10: Build and Verify

- [ ] **Step 1: Run `npm run build`** — should succeed with 3 brands × 12 journeys = 36+ HTML files
- [ ] **Step 2: Run `npm test`** — all 15 tests must still pass
- [ ] **Step 3: Run `npm run validate`** — no validation errors
- [ ] **Step 4: Visual check** — open `generated/jk_cement/retailer_onboarding.html` in browser, verify 12 steps render with real phone screens

---

### Task 11: Fix Existing Journey Data (BUG-1, BUG-2, BUG-4 from ISSUES_AND_RESOLUTIONS)

While we're adding new journey content, fix the 3 P0 bugs that affect all journeys:

**BUG-1: Prices never replaced** — Add price overrides to each brand's journey JSON data (short-term fix). Prices should be in journey.cart.summary.orderValue, journey.order.items[].lineTotal, etc.

**BUG-2: Secondary dealer names unreplaced** — Add secondary dealer names to Sundaram Store's journey JSON under `dealer.secondaryDealers[]`.

**BUG-4: Product name mismatch** — Ensure all product names in journey JSON reference catalog product IDs consistently.

- [ ] **Step 1: Add price fields to all brand journey JSONs** for retailer_onboarding
- [ ] **Step 2: Add secondary dealer names** to Sundaram Store journey data
- [ ] **Step 3: Verify product names** match catalog entries

---

### Task 12: Final Verification

- [ ] **Step 1: Run `npm run build:dist`** — builds to dist/ for all brands
- [ ] **Step 2: Run full test suite** — `node --test test/*.test.js`
- [ ] **Step 3: Visual inspection** of the generated retailer_onboarding HTML for JK Cement
- [ ] **Step 4: Run `npm run validate`**
- [ ] **Step 5: Commit** — all changes in a single coherent commit group

---

## Self-Review Checklist

1. **Spec coverage:** Every step in the reference HTML is mapped to a template step. All 12 steps are implemented for JK Cement, Haldiram's, Sundaram Store.
2. **Placeholder scan:** No "TBD", "TODO", "coming soon" in any template after this plan.
3. **Dual rendering:** Both server-side (build.js via Handlebars partials) and client-side (demo-renderer.js) are covered.
4. **Type consistency:** Journey JSON fields match what templates expect (journey.messages.step1.*, journey.order.*, etc.).
5. **Brand variation:** JK Cement gets cement-appropriate content, Haldiram's gets FMCG/snacks content, Sundaram Store gets general retail content.
6. **Dealer store name injection:** The existing dealerStoreName injection in build.js automatically applies to retailer_onboarding messages.
