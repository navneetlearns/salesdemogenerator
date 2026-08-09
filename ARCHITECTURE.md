# Architecture

This project has two systems: a static Handlebars demo generator and an MCP server for AI-assisted journey building.

## MCP Server (`whatsapp-mock-generator-mcp/`)

An MCP (Model Context Protocol) server that exposes 6 tools for building WhatsApp mock demo journeys:

- `scaffold_project` — create project directory + brand identity docs
- `build_journey` — REQUIRES `sourceProject` + `sourceJourney` (clone from an EXISTING project; `"base"` is the explicit from-scratch escape hatch — omitting the source is a hard error) + the new company's brand pack (`industry`, `website`, `logoUrl`/`logoBase64`, `productImages`, `tagline`) → brand-swap (logo embedded via the `.ava-logo` rule, product images → `assets/products/`) → HTML skeleton; returns preview URLs + INDUSTRY/ASSETS summary immediately. Source `assets/` + logo files are copied and `<img>` logo refs repaired (new logo → `assets/brand/<logo>`, else the copied source logo) so clones never have broken images
- `verify_journey` — structure + charset + Playwright render + Meta compliance + brand-asset checks (F1-F5: manifest parses, website, industry, logo file, product images); pass `expectedSteps` (NOT auto-detected — without it the check expects 1); D1 whitelists `hr.wa-list-btn-hr`
- `serve_journey` — register a project for browser preview; returns `localUrl` + `publicUrl` (`/preview/<project-id>/`, NO auth — webview/browser friendly)
- `list_bases` — list the FULL template library (workspace + template roots + canonical base), each project with its journeys (Haldirams/SakkuGroup/HindustanRMC excluded per user directive)
- `list_industries` — industry content profiles (recipient label, units, currency, categoryTabs) from `../data/industries/` — same source of truth as the demo-generator

Transports: StdioServerTransport (CLI) and StreamableHTTPServerTransport (OpenCode Desktop via `--http` flag).

Auth: HTTP mode is bearer-token gated when `JOURNEY_BUILDER_TOKEN` is set (401 without
`Authorization: Bearer <token>`); `/health`, OPTIONS preflight, and `/preview/*` stay open
(browsers cannot send Authorization headers). Local dev without the env var runs open.

Template library: `list_bases` scans (1) the canonical base in
`whatsapp-mock-generator/skill/base-journey`, (2) scaffolded projects in the workspace
(`<workspace>/<slug>/projects/<slug>/`), (3) every project under `JOURNEY_TEMPLATE_ROOTS`
(currently the whatsapp-mock-generator projects dir — 21 template projects / 76 journeys,
plus base + workspace; Haldirams/SakkuGroup/HindustanRMC excluded per user directive
2026-08-09 even though they exist on disk). Journey discovery handles both
`journey_<flow>.html` and brand-prefixed files (`awl_*`, `vini_*`, `jk_cement_*`).
The ask-flow: pick project (structure only) → pick journey → collect the NEW company's
brand pack (industry via `list_industries`, logo, product images, website link) →
collect steps → `build_journey` with sourceProject + sourceJourney + the brand pack.

Shared assets (base-journey templates, brand_swap.py, verify_journey.py) live in `whatsapp-mock-generator/skill/` — the MCP server references them via `SKILL_ROOT`, no duplication.

Observability: every tool call is logged (`[mcp] <tool> ok|ERR <ms> <args>`) to the
service journal (`journalctl --user -u journey-builder-mcp`); the OpenCode session DB
holds full transcripts, dumpable with `whatsapp-mock-generator-mcp/scripts/session_dump.py`
(which tools an agent called, with args and outputs).

Config for OpenCode Desktop (`opencode.jsonc`) — note the Authorization header (server is token-gated):
```json
{ "mcp": { "journey-builder": { "type": "remote", "url": "http://localhost:7891/mcp",
  "headers": { "Authorization": "Bearer <JOURNEY_BUILDER_TOKEN>" }, "enabled": true } } }
```

Deployment (this machine): runs as a systemd user unit `journey-builder-mcp`
(auto-start, restart-safe; linger on). Env: `~/.config/journey-builder-mcp.env`
(chmod 600) — `JOURNEY_BUILDER_TOKEN`, `JOURNEY_BUILDER_PUBLIC_URL` (Tailscale funnel
base → public preview URLs), `JOURNEY_TEMPLATE_ROOTS`. Workspace:
`~/AgentWork/journey-output`. Public endpoint: `https://laptop-ksfr7jf4.tail45ff54.ts.net/mcp`
(reachable while this machine is on).

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
