# Content Adapter Redesign — Background & Approaches

> **Status:** BRAINSTORMING — approaches documented for review. No decision made yet.
> **Date:** 2026-06-30
> **Author:** Agent reconnaissance + brainstorming session

---

## 1. CURRENT SYSTEM — HOW IT WORKS

### Purpose

The content adapter rewrites 21 generic UI labels (buttons, nav items, notification text)
into industry-specific terminology. Example: "Browse Products" becomes "Browse Inventory"
for Cement, "Browse Medicines" for Pharma, "Browse Stockyard" for Steel. This makes demos
feel native to the prospect's industry.

### The Label Set

**File:** `data/content/order_to_cash_labels.json` (21 labels — the master set)

```
browseProducts, placeOrder, repeatLastOrder, currentSchemes, priceList,
viewInvoices, accountLedger, payOutstanding, orderDashboard, orderConfirmed,
newInvoiceRaised, generatePaymentAdvice, cashDiscountReminder, invoicePaymentDue,
paymentReceived, creditNoteIssued, navDashboard, navOrderHistory, navInvoices,
navPayments, navLedger
```

### Per-Journey Label Files

7 of 10 journeys have dedicated label files in `data/content/`:

| File | Journey |
|------|---------|
| `order_to_cash_labels.json` | order_to_cash (master set, 21 labels) |
| `automated_collections_labels.json` | automated_collections |
| `campaigns_queries_labels.json` | campaigns_queries |
| `dealer_engagement_labels.json` | dealer_engagement |
| `field_ops_expense_labels.json` | field_ops_expense |
| `retailer_loyalty_labels.json` | retailer_loyalty |
| `retailer_onboarding_labels.json` | retailer_onboarding |

Two journeys (`retailer_activation`, `dt_fulfillment_payment`) are GROUP_D — they have
0-1 hardcoded labels, so `getLabelsForJourney()` returns `{}` for them. No adaptation needed.

### How Labels Flow Into Templates

1. `build.js` calls: `journey.content = buildJourneyContent({})` — merges defaults only (no AI)
2. Templates reference: `{{journey.content.browseProducts}}`, `{{journey.content.placeOrder}}`, etc.
3. In `step1-self-service.hbs`: labels appear as modal row titles and screen labels
4. In `step11-nav-menu.hbs`: nav labels appear in the side navigation drawer
5. In the client wizard (`demo-renderer.js` line 331): `acceptedLabels` override defaults before rendering

### The AI Pipeline (Path B — Client Wizard Only)

1. User fills wizard: brand name, industry, products, journey type
2. User clicks Generate
3. `demo-ui.js adaptContent()` fires SILENTLY (no button — removed in June 12 refactor)
4. `POST /api/experiments/adapt-content` with: `{ industry, brandName, journeyType, products, labels }`
5. `adapt-content.js` loads industry context from `data/industries/{industryId}.json`
   - Extracts: `productCategories`, `partnerTypes`, `terminology`
6. `content-adapter.js adaptJourneyContent()`:
   - `getLabelsForJourney(journeyType)` — loads per-journey labels or defaults
   - `buildSystemPrompt()` — constructs LLM prompt with:
     - Industry name, brand name, sample products
     - Industry context (categories, partners, terminology)
     - 4 hardcoded adaptation examples (Pharma, Steel, Cement, FMCG)
     - Rules: change at least half, 2-4 words, no marketing/HTML/emoji
     - The label JSON to adapt
   - `callOpenCodeApi()` — POST to OpenCode (deepseek-v4-flash), 90s timeout, temp 0.3
     - Uses `response_format: { type: 'json_object' }`
     - `OPENCODE_API_KEY` from env
   - `validateAdaptationResponse()` — sanitizes LLM output:
     - Rejects HTML/markdown, emoji, marketing language
     - Falls back to original label if invalid
   - `buildAdaptationDiff()` — shows what changed vs original
7. Returns: `{ provider, model, acceptedLabels, adaptationDiff }`
8. `demo-ui.js` stores result in `_contentAdaptation`
9. When rendering, `acceptedLabels` merge over defaults in `demo-renderer.js`

### The Save Pipeline (Runtime Sessions Only)

`POST /api/experiments/save-content`:
1. Requires active session (`runtime/session-manager`)
2. `saveContentOverrides()` writes `overrides/content.json` to session directory
3. `renderSessionContent()` re-renders all journeys with `acceptedLabels`
4. This ONLY works with the local runtime server — NOT on Cloudflare Pages static deploy

### Integration Points (7 consumers)

| File | Usage |
|------|-------|
| `build.js` | `buildJourneyContent({})` — no AI, just defaults. 3 call sites (lines 373, 525, 669) |
| `runtime/generate-session.js` | `loadContentOverrides` + `buildJourneyContent` |
| `runtime/preview-server.js` | Full AI pipeline + save + re-render |
| `api/experiments/adapt-content.js` | POST — loads industry context, calls AI, returns acceptedLabels + diff |
| `api/experiments/save-content.js` | POST — persists accepted adaptation to session |
| `runtime/serverless-builder.js` | `buildJourneyContent` |
| `public/js/demo-ui.js` (~lines 858-918) | Frontend: calls adapt, stores result, passes to renderer |

### Industry Context Files

`data/industries/` has only 2 files:

| File | Contents |
|------|----------|
| `building_materials.json` | `categoryTabs: ["All", "OPC", "PPC", "White Cement", "Specialty"]`, `partnerLabel: "Dealer"`, `unit: "bag"`. NO `productCategories`, `partnerTypes`, or `terminology` fields. |
| `general.json` | `categoryTabs: ["All"]`, `partnerLabel: "Partner"`, `unit: "unit"`. Almost empty. |

The LLM gets minimal context from these files. The 4 hardcoded examples in the prompt
(Pharma, Steel, Cement, FMCG) do more work than the industry JSON files.

---

## 2. CURRENT PROBLEMS — WHY IT NEEDS A PERMANENT SOLUTION

### P1: Only Works for Path B (Client Wizard)

`build.js` (Path A) calls `buildJourneyContent({})` with empty `acceptedLabels` — NO AI
adaptation. Static builds always use generic labels. The 3 pre-built brands (JK Cement,
Haldiram, Sundaram Store) have hardcoded industry-appropriate labels in their journey JSON,
but that's manual, not adaptive.

### P2: Hard Dependency on External LLM API (OpenCode/deepseek-v4-flash)

- Requires `OPENCODE_API_KEY` in env
- 90-second timeout — slow for a demo generation flow
- If API is down or key missing, silently falls back to original labels
  (`demo-ui.js` catch block sets `provider: 'fallback'`)
- No caching — every Generate click re-calls the LLM

### P3: Save-Content Broken on Cloudflare Pages

The save endpoint needs runtime sessions (filesystem-based `session-manager`). On CF Pages
static deploy, there are no sessions. So adaptation results can't be persisted — they're
ephemeral, lost on page refresh.

### P4: Industry Context Is Thin

Only 2 industry files exist. `building_materials.json` has `categoryTabs` but no
`productCategories`, `partnerTypes`, or `terminology`. `general.json` has almost nothing.
The LLM gets minimal structured context — it relies on the 4 hardcoded examples in the
prompt more than the data files.

### P5: No Deterministic Fallback

If the LLM fails, labels stay generic. There's no rule-based mapping like
"if industry=Cement, browseProducts=Browse Inventory". The "Phase 8+9 — rule-based fallback"
mentioned in commit `c6b81e9` is not visible in the current code — it may have been
incomplete or removed.

### P6: Per-Journey Label Files Are Manual

7 hand-written JSON files in `data/content/` define which labels each journey uses. Adding
a new journey requires manually creating a labels file. No schema validation on these files.

### P7: Labels Are Only UI Text — Not Content

The adapter changes button labels and nav items. It does NOT adapt:
- Product names (handled by catalog data)
- Dealer names (handled by build.js enrichment)
- WhatsApp conversation text (hardcoded in journey JSON)
- Screen descriptions (hardcoded in templates)
- Notification message body text (hardcoded in journey JSON)

A prospect viewing a Cement demo notices the WhatsApp conversation says "Place an order for
cement bags" while the button says "Raise Material Request" — half-adapted feel.

---

## 3. SCOPE QUESTION (UNRESOLVED)

Before choosing an approach, decide what the permanent solution should adapt:

| Scope | What gets adapted | Effort Impact |
|-------|-------------------|---------------|
| **(i)** | Just the 21 UI labels (buttons, nav items) | Smallest — architecture fix only |
| **(ii)** | Labels + notification messages + screen descriptions | Medium — extends data model, more template work |
| **(iii)** | Labels + messages + descriptions + WhatsApp conversation tone | Largest — every journey JSON needs restructuring |

**Recommendation:** Scope (ii). The 21 labels are the tip of the iceberg. Conversation text
and screen descriptions are where industry mismatch is most visible. A Cement demo that says
"Place an Order" on the button but "Browse our latest products" in the WhatsApp message feels
half-adapted. Expanding to (ii) makes the whole demo feel native without the massive refactor
of (iii).

---

## 4. APPROACHES (4 OPTIONS)

### Approach 1: Industry Profile System (Data-First)

Create comprehensive industry profiles in `data/industries/{industry}.json`. Each profile is
a complete dictionary covering labels, messages, descriptions, and terminology.

**Profile JSON structure:**
```json
{
  "id": "cement",
  "label": "Cement & Building Materials",
  "partnerLabel": "Dealer",
  "unit": "bag",
  "unitPlural": "bags",
  "labels": {
    "browseProducts": "Browse Inventory",
    "placeOrder": "Raise Material Request",
    "priceList": "Price Bulletin",
    "viewInvoices": "View Bills",
    "orderConfirmed": "Indent Confirmed",
    ...
  },
  "messages": {
    "welcome": "Welcome to {{brandName}}! Browse our latest inventory and place your material request.",
    "orderConfirmed": "Your material request {{orderId}} has been confirmed. {{qty}} bags will be dispatched.",
    "paymentReceived": "Payment of {{amount}} received against bill {{invoiceId}}.",
    ...
  },
  "descriptions": {
    "step1": "Dealer opens the {{brandName}} catalog and browses available cement grades",
    "step3": "Dealer raises a material request for the selected grades",
    ...
  },
  "terminology": {
    "order": "indent",
    "product": "grade",
    "invoice": "bill",
    "customer": "dealer"
  },
  "productCategories": ["OPC", "PPC", "White Cement", "Specialty"]
}
```

**Template integration:** Templates use `{{industry.labels.browseProducts}}` or a helper
`{{industryLabel "browseProducts"}}`.

**LLM role:** A CLI script (`scripts/generate-industry-profile.js`) that takes an industry
name and generates a draft profile JSON using the LLM. You review it, tweak it, commit it.
The LLM never runs at demo-generation time.

**New industry workflow:** `node scripts/generate-industry-profile.js --industry pharma`
→ review output → commit `data/industries/pharma.json`. Done.

| Pros | Cons |
|------|------|
| Zero runtime dependencies — pure data lookup | Adding a new industry requires a manual step (run script, review, commit) |
| Works across all 3 paths (A, B, C) — it's just data | Can't adapt to completely novel industries on the fly |
| Human-reviewed quality — no surprise LLM output | Profile JSON files need maintenance when labels change |
| Fast — no API call, no timeout | |
| Easy to debug — it's just JSON files | |

**Effort:** 2-3 days. Create ~5 industry profiles, write the CLI generator, refactor
templates to use industry helpers, update build.js to load profiles.

---

### Approach 2: Template-Native Industry System

Instead of a separate adaptation layer, make industry awareness a native part of the
Handlebars template system. Register helpers:

```handlebars
{{t "browseProducts"}}           → looks up industry.labels.browseProducts
{{tMsg "welcome" brand=brand}}   → looks up industry.messages.welcome, interpolates brand
{{tDesc "step1" brand=brand}}    → looks up industry.descriptions.step1
```

The `content-adapter.js` module becomes a profile loader + helper registrar, not an LLM
orchestrator. Every template partial gets updated to use `{{t "..."}}` instead of
`{{journey.content.browseProducts}}`.

The data model is the same as Approach 1 (industry profiles), but the integration point
is different — it's in the template layer, not the data layer.

| Pros | Cons |
|------|------|
| Cleanest architecture — adaptation is how templates work, not a bolt-on | Largest refactor — every template partial needs updating (85 partials) |
| No "journey.content" intermediary object to maintain | Must register helpers in 3 places (build.js, build-template-pack.js, demo-renderer.js) |
| Helpers can do smart fallbacks (industry → default → raw key) | Higher risk of regression — touching every template |
| Extensible — add a helper, all templates get the capability | Slower to implement |

**Effort:** 4-5 days. Same data work as Approach 1, plus comprehensive template refactor.

---

### Approach 3: Tiered Hybrid (Deterministic + LLM Enhancement)

Three tiers of adaptation, merged at runtime:

- **Tier 1:** Industry profile JSON (deterministic baseline — always works)
- **Tier 2:** Brand-level overrides in `data/brands/{brand}.json` (e.g., JK Cement customizes "bags (50kg)")
- **Tier 3:** LLM enhancement (optional, cached in CF KV by industry+journey hash)

**At demo-generation time:**
1. Load Tier 1 profile for the selected industry
2. Apply Tier 2 brand overrides if they exist
3. If no Tier 1 profile exists for this industry AND LLM is available → call LLM, cache result in KV
4. If LLM fails → fall back to generic "general" profile
5. Merge all tiers, render

The LLM becomes a fallback for unknown industries, not the primary path. Known industries
(cement, fmcg, pharma, steel, retail) use pre-built profiles. New industries get
LLM-generated labels on first use, cached for reuse.

| Pros | Cons |
|------|------|
| Works perfectly for known industries (fast, reliable) | Most complex — three-tier merge logic |
| Gracefully handles unknown industries (LLM fallback) | KV caching adds infrastructure complexity |
| Brand-level customization without code changes | Tier 3 still has cold-start latency for new industries |
| Best of deterministic and LLM worlds | More moving parts to maintain |

**Effort:** 3-4 days. Industry profiles + brand override schema + KV cache layer + LLM
fallback path.

---

### Approach 4: Pre-Computed Matrix (Build-Time Generation)

During `npm run build:dist`, generate a complete matrix of adapted content for every
industry × journey combination. Output: `dist/api/adapted-content.json`:

```json
{
  "cement": {
    "order_to_cash": { "labels": {...}, "messages": {...} },
    "field_ops_expense": { "labels": {...}, "messages": {...} },
    ...
  },
  "pharma": { ... },
  "fmcg": { ... }
}
```

The build script uses the LLM (or deterministic profiles) to generate this matrix. At
runtime, the client wizard fetches this static JSON file and looks up the right
industry × journey cell. Zero API calls at runtime.

**New industry workflow:** Add it to a config list, re-run build, the matrix includes it.
Deploy.

| Pros | Cons |
|------|------|
| Cleanest for static hosting (CF Pages) — it's just a static JSON file | New industry requires rebuild + redeploy |
| Runtime is a simple fetch + lookup — no Workers, no KV, no LLM | Matrix can get large (5 industries × 10 journeys × 21 labels + messages = ~50KB, manageable) |
| Predictable — what you build is what you ship | No runtime flexibility — can't adapt to an industry not in the matrix |
| Easy to inspect — open the JSON, see exactly what every demo will show | Build time increases (LLM calls during build) |

**Effort:** 2 days. Build script enhancement + static JSON generation + client-side lookup.

---

## 5. COMPARISON SUMMARY

| Dimension | Approach 1 (Profile) | Approach 2 (Template-Native) | Approach 3 (Tiered Hybrid) | Approach 4 (Pre-Computed) |
|-----------|----------------------|-------------------------------|----------------------------|---------------------------|
| Runtime dependency | None | None | LLM (fallback only) | None |
| Works for Path A | Yes | Yes | Yes | Yes |
| Works for Path B | Yes | Yes | Yes | Yes |
| Works for Path C | Yes | Yes | Yes | Needs build hook |
| New industry | CLI + commit | CLI + commit | Automatic (LLM) | Rebuild + deploy |
| Refactor scope | build.js + templates | All 85 partials | build.js + templates + KV | build.js + client lookup |
| Regression risk | Medium | High | Medium | Low |
| Effort | 2-3 days | 4-5 days | 3-4 days | 2 days |
| Best for | Reliable, self-contained | Long-term elegance | Maximum flexibility | Static hosting purity |

---

## 6. RECOMMENDATION (PRELIMINARY)

**Approach 1 (Industry Profile System)** is the sweet spot of reliability, simplicity, and
coverage. The LLM becomes a development tool (CLI script) not a runtime dependency. Every
demo generation is a pure data lookup. New industries are one CLI command + review + commit.
And it naturally extends to messages and descriptions (if scope ii is chosen) without
architectural changes.

**Approach 3 (Tiered Hybrid)** is the most feature-rich but adds complexity that may not be
needed — the brand override tier and KV caching are solving problems that might not arise
if the industry profiles are comprehensive enough.

**Approach 2 (Template-Native)** is the most elegant but the refactor scope (85 partials) is
high-risk for the benefit.

**Approach 4 (Pre-Computed Matrix)** is interesting but rigid — requiring a rebuild for new
industries defeats the purpose of a wizard.

**Recommended scope:** (ii) — Labels + notification messages + screen descriptions.

---

## 7. DECISION PENDING

The following decisions need to be made before implementation:

1. **Scope:** (i) labels only, (ii) labels + messages + descriptions, or (iii) everything
2. **Approach:** 1, 2, 3, or 4 (or a hybrid combination)
3. **Industries to pre-build:** Cement, FMCG, Pharma, Steel, Retail, Construction? Others?
4. **Fate of existing content-adapter.js:** Refactor into profile loader, or replace entirely?
5. **Fate of per-journey label files (data/content/):** Merge into industry profiles, or keep separate?
6. **LLM CLI tool priority:** Build the profile generator first, or manually author profiles?

---

## APPENDIX A: Files Involved in Any Redesign

### Files to Create
- `data/industries/{industry}.json` — 5+ industry profile files
- `scripts/generate-industry-profile.js` — CLI LLM generator (Approach 1/2/3)

### Files to Modify
- `services/content-adapter.js` — refactor from LLM orchestrator to profile loader
- `build.js` — load industry profiles, pass to template context (3 call sites: lines 373, 525, 669)
- `scripts/build-template-pack.js` — register helpers / pack profiles for client-side
- `public/js/demo-renderer.js` (line 331) — use profile lookup instead of acceptedLabels merge
- `public/js/demo-ui.js` (lines 858-918) — remove or simplify adaptContent() LLM call
- `api/experiments/adapt-content.js` — either remove or repurpose as profile generator endpoint
- `api/experiments/save-content.js` — likely remove (no runtime sessions on CF Pages)
- `templates/partials/step1-self-service.hbs` — update label references
- `templates/partials/step11-nav-menu.hbs` — update label references
- Other partials that reference `journey.content.*` — audit and update

### Files to Potentially Remove
- `data/content/*_labels.json` — 7 per-journey label files (if merged into industry profiles)
- `api/experiments/save-content.js` — if no runtime session support needed

### Test Files to Update
- `test/content-adapter.test.js` — update for new profile-based behavior
- `test/experiment-ui.test.js` — update if adaptContent flow changes
