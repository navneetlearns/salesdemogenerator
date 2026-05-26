# Architecture Guardrails

**Project:** Demo Generator (ZoTok WhatsApp Commerce Journeys)
**Date:** May 24, 2026
**Purpose:** Strict rules to maintain architecture stability, prevent regression, and enforce data-driven rendering.

---

## 1. No Inline Base64 in Partials

All images must be resolved through the asset pipeline or via brandLogo / journey.* Handlebars variables.

- NO: src="data:image/jpeg;base64,..." inside .hbs files
- YES: src="{{brandLogo}}" with unquoted variable name

**Rationale:** Base64 images bloat partials (13KB+ each), prevent brand variation, and are unreviewable in diff.

## 2. No Hardcoded Prices in Templates

All monetary values must use the formatCurrency helper with journey.* context path.

- NO: raw INR number like 1,46,800 in any .hbs file
- YES: {{formatCurrency journey.order.summary.orderValue}}

**Rationale:** Hardcoded prices break brand variation. The formatCurrency helper in build.js handles Indian-style formatting.

## 3. No Brand-Specific Literals in Reusable Partials

Reusable partials must not contain brand-specific names, colors, or copy.

- NO: "JK Cement" in any partial that serves multiple brands
- NO: "jkcement.zotok.ai" URLs in partials
- YES: {{brand.name}}, {{brand.shortName}}

## 4. All Assets Resolved Through Config

Brand logos, product images, and journey assets must go through the existing asset pipeline.

- NO: src="../../assets/brands/jk_cement/logo.png" (hardcoded brand path)
- YES: src="{{brandLogo}}" (resolved at build time)

## 5. No Direct Shared Mutable JS Globals

Shared JavaScript must not mutate globals from other journey types.

- NO: window.descTimer (must be namespaced)
- YES: if (typeof goTo === "undefined") { window.goTo = scrollToStep; }

## 6. No Duplicate DOM IDs

Every id attribute in the generated HTML must be unique.

- NO: Two elements with id="step-5" in the same HTML
- Sidebar uses data-step="N" or class-based targeting

**Verification:** Query document.querySelectorAll("[id]") and check for duplicates.

## 7. Reusable Components Must Be Journey-Agnostic

Partials in templates/partials/ should not assume a specific journey type unless the filename explicitly declares it.

- YES: wa-topbar.hbs works for OTC, FO, AC, DE, RO, RL
- YES: step3-ai-capture.hbs is OTC-specific (named with journey context)

**Naming convention:**
- step<N>-<journey>.hbs: journey-specific step partials
- *.hbs (no prefix): reusable components

## 8. Preserve Deterministic Rendering

Same input data produces same output HTML, every time.

- NO: Template logic depending on random values or external state
- NO: Handlebars helpers with side effects (mutating data during render)
- YES: Build-time computation enriches data before rendering

## 9. No Cross-Partial Side Effects

Partials must not depend on variables set by other partials.

- All shared state passes through the top-level context
- Use block partial parameters explicitly: {{#> screen-wrap label="..."}}

## 10. No Business Logic Inside Templates

Handlebars is a rendering engine, not a computation engine.

- NO: Arithmetic or string manipulation in templates
- YES: {{formatCurrency journey.payment.amount}} (simple display)
- All data transformation happens in build.js

## 11. Multi-Journey Structural Consistency

Each journey type must register with all required CSS selectors, JS functions, and navigation patterns.

- Dark sidebar (.sb-step / .step-panel) for Automated Collections
- Light sidebar (.step-item / .step-section) for OTC and Field Ops

**Process for adding a new journey:** See references/multi-journey-build.md.

## 12. Build Context Must Be Shared

The buildJourneyContext() helper must serve ALL journey types.

- NO: Adding a new context property only to one journey's render block
- Always add new context properties to the shared builder function

## Enforcement

These guardrails are enforced by:
1. Pre-commit scan: automated check for data:image and INR in partials
2. Playwright DOM audit: step counts, image loading, ID uniqueness, console errors
3. Code review: no partial introduces patterns from the NO list above


## 13. Visual Regression Validation (MANDATORY)

- NO: Merging structural refactors without visual validation
- NO: Updating baselines without explicit human approval
- YES: Run npm run visual:test before any commit touching visual output
- YES: Verify all 3 viewports (desktop 1440x900, tablet 768x1024, mobile 390x844)
- Threshold: maxDiffPixelRatio <= 0.01 (1%)

## 14. Required Validation Order

1. npm run build
2. node build/layout-fingerprint.js
3. npm run visual:test

## 15. AI Safety Rules

1. Never modify layout-critical CSS automatically
2. Never refactor shared JS without visual validation
3. Never merge structural + visual refactors together
4. Never update baselines automatically after large refactors
5. Baseline updates require explicit approval
6. All visual regressions require generated diff artifacts
