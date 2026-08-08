# Architecture

This project has two systems: a static Handlebars demo generator and an MCP server for AI-assisted journey building.

## MCP Server (`whatsapp-mock-generator-mcp/`)

An MCP (Model Context Protocol) server that exposes 5 tools for building WhatsApp mock demo journeys:

- `scaffold_project` — create project directory + brand identity docs
- `build_journey` — clone base journey → brand-swap via Python scripts → HTML skeleton
- `verify_journey` — structure + charset + Playwright render + Meta compliance checks
- `serve_journey` — serve the journey on a local port for browser preview
- `list_bases` — show available base journey templates

Transports: StdioServerTransport (CLI) and StreamableHTTPServerTransport (OpenCode Desktop via `--http` flag).

Shared assets (base-journey templates, brand_swap.py, verify_journey.py) live in `whatsapp-mock-generator/skill/` — the MCP server references them via `SKILL_ROOT`, no duplication.

Config for OpenCode Desktop (`opencode.jsonc`):
```json
{ "mcp": { "journey-builder": { "type": "remote", "url": "http://localhost:7891/mcp", "enabled": true } } }
```

See `whatsapp-mock-generator-mcp/README.md` for full setup instructions.

## Handlebars Demo Generator

This system generates static demo HTML from structured data and shared Handlebars templates.

## Runtime Shape

- `data/brands/*.json`: brand metadata, colors, asset references, and optional build-time semantic replacements.
- `data/catalogs/*.json`: product catalog data used by cards, carts, and receipts.
- `data/journeys/*.json`: ordered journey steps and screen composition data.
- `data/extracted/*.json`: extracted baseline journey/content data that can be cloned for demo onboarding.
- `assets/`: brand, product, and shared fallback assets.
- `templates/`: Handlebars layouts, partials, and screen blocks.
- `build.js`: validates data, runs the asset pipeline, renders Handlebars, applies temporary post-render virtualization, writes `generated/`, and packages `dist/`.

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
