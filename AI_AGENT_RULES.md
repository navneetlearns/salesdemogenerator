# AI Agent Rules

**Project:** Demo Generator (ZoTok WhatsApp Commerce Journeys)
**Date:** May 24, 2026

## Core Principles

1. DOM correctness != visual correctness
2. No frontend refactor is safe without visual validation
3. All AI-assisted edits must pass build + DOM + visual regression validation
4. Pixel/layout stability is a core product requirement

## Edit Safety Rules

5. Never modify layout-critical CSS automatically
6. Never refactor shared JS without visual validation
7. Never merge structural + visual refactors together

## Baseline Management

8. Baseline updates require explicit human approval
9. All visual regressions require generated diff artifacts

## Protected Layout Zones (AI-LAYOUT-CRITICAL)

| Zone | Files | Reason |
|------|-------|--------|
| Phone mockup shells | phone-frame.hbs, screen-wrap.hbs | Core visual identity |
| Sidebar navigation | All step partials | Navigation stability |
| Scroll-snap containers | layout.hbs, orchestrator.hbs | Horizontal scrolling |
| Step wrapper elements | All step partials | Containment/positioning |
| WhatsApp UI chrome | wa-topbar.hbs, status-bar.hbs, date-pill.hbs | Visual fidelity |
| Admin portal layouts | admin-layout partials | Back-office structure |
| Mobile scroll containers | phone-wrap, phone-layout sections | Viewport rendering |

## Validation Pipeline

Before any commit touching templates, CSS, or shared JS:
  npm run build && npm run validate

If visual regression fails:
1. Generate diff artifacts
2. Identify the breaking change
3. Fix or get approval for baseline update
4. Do NOT ship with visual regressions
