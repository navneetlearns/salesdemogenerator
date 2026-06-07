# Client-Side Dynamic Demo Generation — Design Spec

**Date:** 2026-05-27  
**Project:** ZoTok Demo Generator (`@zotok/demo-generator`)  
**Status:** Approved  

## Goal

Transform the Vercel deployment from static-only (pre-built demos for 3 fixed brands) to fully dynamic: any user can visit the site, upload their brand logo + product images, enter product details, and instantly see a tailored WhatsApp Commerce journey demo rendered in the browser. No server state, no API calls after initial page load.

## Approach: Fully Client-Side Rendering (Approach A)

All Handlebars template rendering happens in the browser. No server-side generation. The 73 Handlebars partials, journey data, and helper logic are packed into a static JSON manifest at build time and loaded on demand.

### Why this approach

- Eliminates all Vercel serverless blockers (sharp, busboy, got, /tmp sessions)
- Scales infinitely (no cold starts, no function limits)
- Instant rendering after initial template pack download (~40KB gzipped)
- Purely static Vercel deployment (no functions needed for generation)
- Offline-capable after first load

## Architecture

### Data Flow

```
User uploads logo (File) -> FileReader -> base64 data URL
User uploads product images (Files) -> FileReader -> base64 data URLs
User types brand name, picks colors -> brand JSON (client-side)
User types product names, prices -> catalog JSON (client-side)
                                        |
                                        v
                          Handlebars.render(orchestrator, {
                            brand, brandLogo (base64),
                            catalog, journey, industry,
                            cart, scripts, style
                          })
                                        |
                                        v
                              Rendered HTML -> iframe preview
```

### Vercel Deployment (Static)

- `public/` — landing page, app.js, style.css
- `public/dist/` — pre-built demos for 3 brands (unchanged)
- `public/template-pack.json` — packed templates + data for client-side rendering
- `public/js/demo-renderer.js` — Handlebars renderer
- `public/js/demo-ui.js` — wizard form logic
- `public/js/handlebars.min.js` — Handlebars runtime

API endpoints remaining: `/api/health`, `/api/brands`, `/api/journeys` (lightweight, serve static data).

Removed from deployment: `/api/generate`, `/api/session/*`, `/api/upload/*`, `/api/preview/*`, `/api/export/*`.

## Client-Side Renderer

### Template Pack (`template-pack.json`)

Built at deploy time by `scripts/build-template-pack.js`. Single JSON file containing:

```json
{
  "partials": { "step1-self-service": "...", "...": "73 partials" },
  "journeyTemplates": { "order_to_cash": "...", "field_ops_expense": "...", "...": "6" },
  "industries": { "building_materials": {...}, "general": {...} },
  "defaultJourneyData": {
    "order_to_cash": { "full jk_cement journey JSON" },
    "field_ops_expense": { "..." },
    "...": "6 journey types"
  },
  "defaultCatalog": { "full jk_cement products JSON" },
  "style": "compiled CSS string",
  "scripts": "combined JS string (journey-core + navigation + overlays)",
  "helpers": { "formatCurrency": "JS source", "eq": "...", "multiply": "...", "subtract": "...", "add": "...", "divide": "..." }
}
```

Size: ~200KB uncompressed, ~40KB gzipped. Loaded once, cached by browser.

### Rendering Pipeline (in browser)

1. User clicks "Generate Demo"
2. `demo-renderer.js` fetches `template-pack.json` (cached after first load)
3. Registers all 73 partials with `Handlebars.registerPartial()`
4. Registers helpers (formatCurrency, eq, multiply, subtract, add, divide)
5. Merges user input with default journey data (user's brand/logo/colors/products override defaults)
6. Compiles the orchestrator template for the selected journey type
7. Renders HTML with assembled context
8. Injects CSS (with user's brand colors) + JS as inline `<style>` and `<script>`
9. Opens in iframe or new tab

### Image Handling (No Sharp)

- Logo: FileReader reads as base64 data URL, used as brandLogo in template context
- Product images: same approach, FileReader to base64 data URL to catalog image field
- No server-side resizing needed; templates handle image sizing via CSS
- Optional v2: Canvas-based resize for large uploads (draw to 800px canvas, export as JPEG)
- Logo fallback: colored circle with brand initials if no logo uploaded

## UI / User Flow

### 3-Step Wizard

**Step 1 — Brand Identity:**
- Brand name (text input, required)
- Primary color (color picker, default #075e54)
- Secondary/dark color (color picker, default #064e46)
- Logo upload (drag-drop, PNG/JPG/WebP)
- Live preview: small phone-frame with brand name + logo in WhatsApp topbar

**Step 2 — Products:**
- "Add Product" button — adds a product row
- Each row: product image upload + name + price (INR) + unit (bag/box/pack/piece/kg/ltr)
- Min 1, max 8 products
- Live preview: small catalog card thumbnail

**Step 3 — Journey and Generate:**
- Journey type cards with descriptions and step counts
- Default: Order to Cash (most complete)
- Scaffold journeys (Dealer Engagement, Retailer Onboarding) show "Preview — placeholder content" badge
- "Generate Demo" button with progress bar
- Result: full-width iframe preview

**Iframe toolbar:** "Open in New Tab" + "Download HTML" (client-side Blob download).

### Landing Page Structure

Two sections:
1. Pre-built Demos — existing static section (3 brand cards to /dist/ links)
2. Create Your Own Demo — new wizard section

No login, no account, no session. Form state lost on refresh (acceptable for v1).

## Data Assembly

### Strategy: Overlay User Input on Reference Brand

Use jk_cement as the reference brand skeleton. User input overrides specific fields; all other data (WhatsApp messages, payment flows, invoice details) inherits from defaults.

### What User Provides vs. Defaults

User provides: Brand name, primary color, secondary color, logo image, product names (1-8), product images (1-8), product prices (1-8), product units (1-8), journey type.

Defaults: Brand name required, colors default to WhatsApp green/dark, logo defaults to colored circle with initials, product images default to colored placeholders, units default to "piece".

Auto-defaulted from reference: dealer name ("Your Store"), all IDs (placeholder patterns), financial amounts, WhatsApp messages, SAP diagram, navigation structure, step count/titles/meta.

### Color Substitution

Templates use var(--brand) and var(--brand-dark) CSS custom properties. For custom brands, replace :root values with user's chosen colors. No template changes needed.

## File Structure and Build Changes

### New Files

- public/js/demo-renderer.js — Client-side Handlebars renderer (~200 lines)
- public/js/demo-ui.js — Wizard UI logic (~300 lines)
- scripts/build-template-pack.js — Build script: packs partials+data to JSON (~150 lines)

### Modified Files

- vercel-build.sh — Add node scripts/build-template-pack.js step
- vercel.json — Remove runtime API functions, keep health/brands/journeys
- package.json — Add build:pack script
- public/index.html — Add wizard section HTML
- public/style.css — Add wizard component styles
- public/app.js — Mode detection, wire up wizard

### Unchanged Files

- build.js — core generator for static demos
- runtime/* — local dev server (kept in repo, not deployed)
- templates/, data/ — read by build-template-pack.js at build time
- dist/ — static pre-built demos

### vercel-build.sh (updated)

```bash
#!/bin/bash
set -e
npm install
npm run build:dist
rm -rf public/dist
cp -rv dist public/dist
node scripts/build-template-pack.js
echo "=== Build complete ==="
```

## Error Handling

- No logo uploaded: colored circle with brand initials
- No product images: colored placeholder cards with initials
- Template pack fails to load: error banner + retry button
- Handlebars render error: inline error message + "Try Again"
- Large logo (>5MB): Canvas resize to 800px, JPEG quality 80% (v2)
- Unsupported browser: "Please use a modern browser" message
- Journey type switch: re-render with same brand data
- Scaffold journeys: visible badge "Preview - placeholder content"

## Testing Plan

1. Template pack consistency: build-template-pack.js output renders same HTML as build.js for jk_cement
2. Client-side render comparison: compare generated HTML with pre-built dist output
3. Static demos still work: /dist/haldirams/order_to_cash.html etc. unchanged
4. Playwright DOM verification: load page, fill form, generate, verify iframe renders N visible steps
5. Cross-browser check: Chrome, Firefox, Safari

## Deployment Migration

- Existing static demos at /dist/ continue unchanged
- /api/health, /api/brands, /api/journeys continue working
- /api/generate, /api/session/*, /api/upload/*, /api/preview/*, /api/export/* removed from vercel.json but kept in repo for local dev
- runtime/preview-server.js still works locally via npm run runtime:server
- No database, no KV store, no Blob storage
