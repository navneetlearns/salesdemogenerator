# Demo Generator

Static HTML demo generator using vanilla Handlebars.

## Flow

`data/` + `assets/` + `templates/` -> `generated/` and, with `--dist`, portable output in `dist/`.

Core Handlebars templates are intentionally stable. Brand onboarding should prefer data, asset, and build-time patches unless a durable view-layer change is explicitly approved.

## Active Brands

| Brand | Industry | Journeys | Status |
|-------|----------|----------|--------|
| JK Cement | Building Materials | 6 standard | Complete |
| Sundaram Store | General | 6 standard | Complete (clone pattern from JK Cement) |
| Haldiram | Food & Beverages | 6 standard + 3 exclusive | Complete |

Haldiram-exclusive journeys: `campaigns_queries`, `dt_fulfillment_payment`, `retailer_activation`.

## Sunder Masala Execution-Compression Patch

Sunder Masala is onboarded as a temporary semantic clone of the JK Cement baseline:

- `data/brands/sunder_masala.json` defines a `replacements` dictionary.
- `build.js` applies those replacements to compiled HTML after Handlebars rendering and before writing output.
- Replacement order follows JSON object order, so longer phrases are listed before generic tokens.
- A small CSS block is injected into Sunder Masala output to normalize raw logo and product image sizing with `object-fit: contain`.
- SAP architecture diagram paths are mapped back to shared JK Cement diagram paths so integration visuals remain shared.
- Placeholder phone avatars and hardcoded order-item thumbnails are filled after render for Sunder Masala using the packaged brand logo and product images.
- The shared SAP diagram source lives at `assets/brands/jk_cement/sap_architecture.png`. It was extracted from the existing JK Cement HTML and is injected into the Sunder Masala SAP screen at build time.
- `scripts/clone-journeys.js` duplicates `jk_cement_*` JSON from `data/journeys` and `data/extracted` into `sunder_masala_*` files and remaps product image IDs used by the cloned data.

## Sundaram Store

Sundaram Store follows the same clone pattern as Sunder Masala (`data/brands/sundaram_store.json` -> `replacements`, `cloneFrom: sunder_masala`).

- Catalog: `data/catalogs/sundaram_store_products.json` -- four products (`p1`-`p4`, SKUs `SUN001`-`SUN004`).
- Product images: `assets/products/sundaram_store/product_sun001.png` ... `product_sun004.png` (must match normalized SKU filenames).
- Step 2 catalog grid is driven by `{{#each catalog.products}}`; all catalog entries appear in the browse screen.
- Post-render asset patch runs for every brand; SAP diagram is injected **after** all replacements so base64 is not corrupted by generic token swaps.
- Shared SAP diagram: `assets/brands/jk_cement/sap_architecture.png` (JPEG bytes allowed; MIME detected at build time).
- Production deploy: `npm run build:dist` then deploy to Vercel.

## Commands

```bash
node scripts/clone-journeys.js   # Clone baseline journey data for new brands
npm run build:dist               # Build all brands to dist/
npm run build                    # Build all brands to generated/
npm run validate                 # Run validation checks
npm run visual:test              # Run visual regression tests
```

On Windows PowerShell environments that block `npm.ps1`, use:

```bash
npm.cmd run build:dist
```

## Multi-Journey Demos

When the user selects one or more journey types in the wizard, `renderMultiJourney()` renders each journey independently and assembles the result into a hub-style HTML document. Hub cards use resilient metadata fallbacks: if `journeyDescriptions` is sparse, cards still show a title, step count, short description, and tags from `defaultJourneyData`, first-step metadata, or safe defaults. This keeps custom demo share pages from showing blank journey descriptions.

Journey content is loaded into iframes through Blob URLs rather than `srcdoc`, so nested journey scripts, menu clicks, and next/back controls execute reliably without DOM ID collisions.

The "WhatsApp Commerce OS" (home) journey renders a standalone hub landing page with clickable cards for all available journeys, serving as a navigation index.

## Secure Share Links

Generated demos can be shared through `/api/share?token=<hex>` links backed by Vercel Blob. Configure `BLOB_READ_WRITE_TOKEN` in the Vercel project environment before deploying; links expire after 24 hours and are rejected server-side after expiry.

Share links are backward compatible across three versions:

- v1: stores a single HTML blob for smaller demos.
- v2: stores render config and re-renders client-side through a Blob URL iframe.
- v3: stores hub metadata plus one blob per journey; the hub fetches each journey on demand and loads it through a Blob URL iframe.

The v3 hub card metadata is server-rendered from stable journey defaults in `api/share.js`, so share-link hubs show step counts and tags even when the stored share payload only contains journey types and blob paths.

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check |
| `GET /api/brands` | List all brands |
| `GET /api/journeys?brand=<id>` | List journeys for a brand |
| `POST /api/share` | Create a share link |
| `GET /api/share?token=<hex>` | Retrieve a shared demo by token |
| `POST /api/experiments/adapt-content` | Adapt UI labels for an industry via LLM |
| `POST /api/experiments/save-content` | Save adapted content overrides to a session |

## Content Adapter

The content adapter (`services/content-adapter.js`) uses an LLM (OpenCode API, deepseek-v4-flash) to rewrite generic UI labels into industry-specific terminology. For example, "Browse Products" becomes "Browse Medicines" for Pharma or "Browse Stockyard" for Steel. The adapter validates responses (no HTML, no emoji, no marketing language) and falls back to original labels on invalid output. Default labels are in `data/content/order_to_cash_labels.json`.

## Add A New Brand

1. Create brand JSON at `data/brands/<brand_id>.json`.
2. Add required fields: `id`, `name`, `shortName`, `industry`, `colors`, and logo asset references.
3. Store the logo at `assets/brands/<brand_id>/logo.png`.
4. Store product images at `assets/products/<brand_id>/`.
5. Add catalog data at `data/catalogs/<brand_id>_products.json`.
6. If cloning from JK Cement, add a `replacements` object in the brand JSON for brand names, dealer names, product/category labels, order prefixes, and shared asset paths.
7. Clone baseline journey data if needed:

```bash
node scripts/clone-journeys.js
```

8. Build the distributable output:

```bash
npm run build:dist
```

9. The final browser file is `dist/<brand_id>/index.html`.
10. The development copy is `generated/<brand_id>/order_to_cash.html`.

## Add More Journeys

1. Create a journey JSON file in `data/journeys/` named `<brand_id>_<journey_id>.json`.
2. Add the journey `id`, `title`, `subtitle`, `brandId`, `steps`, `screens`, cart data, and messages.
3. Keep step numbers in `num` and sidebar labels in `displayNum`. Use `10`, not `"100"`, for step 10.
4. Add extracted or supporting journey data in `data/extracted/` if the journey uses extracted baseline content.
5. Add any journey-specific product references to the brand catalog in `data/catalogs/<brand_id>_products.json`.
6. Put journey-specific images under `assets/products/<brand_id>/` or shared images under an existing shared asset folder.
7. If a cloned journey contains hardcoded baseline text, add temporary replacement entries in `data/brands/<brand_id>.json`.
8. Run:

```bash
npm run build:dist
```

9. Check final output at `dist/<brand_id>/index.html`.

## Project Structure

```
data/
  brands/           Brand JSON files (one per brand)
  catalogs/         Product catalog JSON files
  content/          Content label defaults (order_to_cash_labels.json)
  industries/       Industry definitions
  journeys/         Journey/step data files
assets/
  brands/<id>/      Brand logos
  products/<id>/    Product images
templates/
  layouts/          Page layout templates
  partials/         Reusable UI components
  screens/          Full-screen templates
services/
  content-adapter.js  LLM-powered industry label adaptation
api/
  experiments/      Content adaptation experiment endpoints
scripts/
  build-template-pack.js
  clone-journeys.js
  debug-overlay.js
  journey-core.js
  navigation.js
  overlays.js
  scaffold_brand.js
  validate.js
  visual-baseline.js
  visual-compare-haldirams-source.js
  visual-test.js
generated/          Build output (per-brand HTML)
dist/               Packaged output for deployment
```

## Production

Deployed at `https://demo-generator-one.vercel.app` (static mode on Vercel).

QA preview deployments at `https://demo-generator-*.vercel.app` (created by `vercel deploy`).

### Production Deployments

| Date | Commit | Changes |
|------|--------|---------|
| June 17 | HEAD (73934bc + uncommitted) | Navigation fix: Blob URL iframe rendering for hub preview + journey cards. Production now matches local HEAD. Content adaptation for all 9 journeys. |
| ~June 12 | `119e5e2` | Hub card metadata and SAP diagram sizing |
| ~June 10 | `dcd1f60` | v3 multi-blob share architecture |

### Deployment Commands

```bash
# QA deploy (creates new preview URL)
vercel deploy

# Production deploy (aliases to production domain)
vercel --prod --yes

# View all deployments
vercel list
```

## Documentation

- `ARCHITECTURE.md` -- Build pipeline and replacement system design
- `ARCHITECTURE_GUARDRAILS.md` -- Edit safety rules and validation pipeline
- `AI_AGENT_RULES.md` -- AI-assisted edit safety guardrails
- `ISSUES_AND_RESOLUTIONS.md` -- Known bugs and architectural issues
- `USER_MANUAL.md` -- Non-technical user guide for adding brands
