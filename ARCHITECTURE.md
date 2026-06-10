# Architecture

This project has **two independent rendering paths** that must be updated together for any change affecting demo output.

## Dual Rendering Architecture

### Path A: Server-Side Static Build (`build.js`)

`build.js` reads `data/`, `assets/`, and `templates/`, renders Handlebars server-side, applies post-render patches (brand replacements, asset injection), and writes `generated/` and `dist/`. This produces pre-built, self-contained HTML files for known brands.

### Path B: Client-Side Dynamic Wizard (`demo-renderer.js` + `demo-ui.js`)

At build time, `scripts/build-template-pack.js` packs all Handlebars partials, helpers, journey data, brand defaults, and layout templates into `public/template-pack.json`. At runtime, the browser loads this pack, the user fills a wizard form, and `DemoRenderer.render()` compiles and renders the demo entirely client-side. No server calls after initial page load.

**Critical:** Any change to rendering logic (partials, helpers, brand building, product name mapping, journey templates) must be verified against BOTH paths. The `demo-renderer.js` renderer is a self-contained re-implementation of the build pipeline for the browser.

### Key Client-Side Files

| File | Responsibility |
|------|---------------|
| `public/js/demo-renderer.js` | Handlebars renderer — loads pack, builds brand/catalog/journey/cart, compiles templates |
| `public/js/demo-ui.js` | Wizard UI — form collection, preview iframe, share links, step selection, journey selection |
| `public/template-pack.json` | Build-time manifest of all partials, helpers, journey data, defaults |
| `public/preview.html` | Wizard landing page (entry point for client-side generation) |
| `scripts/build-template-pack.js` | Builds template-pack.json from source data and templates |

### Client-Side Public API (`DemoRenderer`)

```javascript
DemoRenderer.render(userInput)            // Render a single journey
DemoRenderer.renderMultiJourney(userInput) // Render 2+ journeys as iframe hub
DemoRenderer.loadPack()                    // Load template-pack.json (cached)
DemoRenderer.buildBrand(userInput)         // Merge user input with default brand
DemoRenderer.buildCatalog(userInput)       // Build catalog from user products
DemoRenderer.buildJourney(type, brand, cat, steps) // Build journey data context
DemoRenderer.getJourneySteps(type)         // Get step metadata for a journey
DemoRenderer.remapStepReferences(html, fullSteps, selectedSteps) // Remap step IDs for custom demos
DemoRenderer.downloadHtml(html, filename)  // Trigger browser download
```

## Multi-Journey Rendering

When the user selects 2+ journey types in the wizard, `renderMultiJourney()` renders each journey independently via `render()` and assembles the results into a single hub-style HTML document:

- Each journey is wrapped in an `<iframe>` via Blob URL (`URL.createObjectURL`) to avoid DOM ID collisions
- A Haldiram-style two-panel layout: left panel shows brand info, right panel shows journey cards
- Clicking a card fetches the journey HTML on demand, creates a Blob URL, and loads it in an iframe
- Journey HTML data embedded in `<script type="text/plain">` tags, parsed by inline script at load time
- `renderMultiJourney()` returns both the hub HTML and `journeyResults` array (individual journey HTMLs) for multi-blob share

`renderMultiJourney()` and `buildMultiJourneyHtml()` are in `demo-renderer.js` and exposed on the `DemoRenderer` public API.

## Share Architecture (3 versions, backward compatible)

### v1: HTML Blob Share (legacy)
Single POST with `{ html: "..." }` → stores full hub HTML as one blob. Works for small demos but fails when HTML exceeds Vercel's ~4.1MB body limit.

### v2: Config-Based Share
Single POST with `{ config: {...} }` → stores render config (~2KB). Share page loads Handlebars + demo-renderer.js, re-renders client-side via `renderMultiJourney(config)`. Hub HTML loaded in iframe via Blob URL. Works for any number of journeys with no size limit.

### v3: Multi-Blob Share (new)
Two-step upload for pre-rendered multi-journey demos:
1. `POST { config, journeyTypes }` → creates hub metadata blob (~2KB), returns hub token
2. `POST { hubToken, journeyType, html }` → stores one journey blob (~200KB each), called N times sequentially

Hub page (`GET /api/share?token=xxx`) serves Haldiram-style two-panel HTML that fetches individual journeys via `fetch("/api/share?token=xxx&journey=otc")` + Blob URL iframes. Each request stays under the 4.1MB limit. Client shows upload progress.

**Key insight:** `srcdoc` and `document.write()` don't execute inline `<script>` blocks reliably in large HTML. All rendering paths now use Blob URLs (`URL.createObjectURL` + `iframe.src`).

## Home Page (WhatsApp Commerce OS)

Selecting "home" as the journey type renders a standalone hub landing page via `buildHomePage()`. It lists all available journeys as clickable cards with descriptions, step counts, and tags. The home page is built entirely client-side from `pack.journeyDescriptions` and served as a self-contained HTML document.

## Server-Side Build Pipeline

`data/brands/*.json`: brand metadata, colors, asset references, and optional build-time semantic replacements.
`data/catalogs/*.json`: product catalog data used by cards, carts, and receipts.
`data/journeys/*.json`: ordered journey steps and screen composition data.
`data/extracted/*.json`: extracted baseline journey/content data that can be cloned for demo onboarding.
`assets/`: brand, product, and shared fallback assets.
`templates/`: Handlebars layouts, partials, and screen blocks.
`build.js`: validates data, runs the asset pipeline, renders Handlebars, applies temporary post-render virtualization, writes `generated/`, and packages `dist/`.

## Sunder Masala Virtualization Layer

Sunder Masala is currently implemented as an execution-compression clone of JK Cement. The view layer is not refactored for this onboarding. Instead, `build.js` performs brand-scoped post-render transformation when a brand has `replacements`.

The build order is:

1. Load and validate brand, catalog, and journey JSON.
2. Run the asset pipeline.
3. Render screen and layout Handlebars.
4. Apply `brand.replacements` to the final HTML string (first pass).
5. Run the post-render asset patch (logos, product thumbnails, handwritten-order SVG).
6. Apply `brand.replacements` again when present (handwritten SVG and other late-injected copy).
7. Inject the shared SAP architecture diagram last (after all replacements, so inlined image data is not altered).
8. Inject CSS image normalization for raw assets when the brand uses replacements.
9. Validate and write HTML.
10. Package `dist/<brand>/`.

This keeps the patch isolated and reversible: removing the Sunder `replacements` object and clone outputs returns the system to normal data-driven rendering.

## Shared Integration Assets

Global integration visuals, including SAP architecture diagrams, must remain shared. Sunder Masala replacement entries map accidental brand-local SAP diagram paths back to JK Cement/shared paths. If the diagram filename changes later, update only the relevant replacement entries in `data/brands/sunder_masala.json`.

The current shared SAP diagram source is `assets/brands/jk_cement/sap_architecture.png` (may be PNG or JPEG on disk). It is injected as a data URI into the SAP architecture screen when the baseline template still contains `data:image/placeholder`. Do not run generic replacement tokens (for example substring `"Cement"`) after this injection.

## Asset Path Handling

Brand asset references may be written as either filenames or repo-style paths such as `assets/brands/sunder_masala/logo.png`. The asset pipeline normalizes brand asset values to basenames before looking inside the active brand asset directory.

During `--dist` builds, optimized dist assets are mirrored back into `generated/<brand>/assets` so the generated HTML and packaged dist HTML both resolve the same `./assets/...` paths.

## Template Boundary

Handlebars templates and screen orchestration are intentionally untouched for this patch. String virtualization is temporary and should not become the permanent content model for new demos.
