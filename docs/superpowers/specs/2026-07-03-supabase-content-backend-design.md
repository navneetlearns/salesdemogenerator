# Supabase Content Backend — Design Spec

> **Status:** APPROVED by user decision July 3, 2026. Supersedes the flat-JSON
> approach in `2026-06-30-content-adapter-redesign.md`.
> **Date:** 2026-07-03
> **Author:** Agent brainstorming session (Q&A confirmed by user across 4 turns)

---

## 1. CONTEXT — WHAT THIS REPLACES

The original content adapter redesign
(`docs/superpowers/specs/2026-06-30-content-adapter-redesign.md`) proposed
"Industry Profile System, data-first" with profiles as flat JSON files under
`data/industries/*.json`. Two user direction changes during brainstorming
shifted the design:

1. **July 3 — Decision A:** Approach 1 confirmed (Industry Profile System),
   scope (iii) confirmed (labels + notification messages + screen descriptions
   + WhatsApp conversation tone — the heaviest scope).
2. **July 3 — Decision B:** Switch from flat JSON files to a **database**.
   First considered PocketBase (self-host Go, SQLite, auto REST + image
   storage); user pivoted to **Supabase** for a managed, always-on solution
   that bends toward a long-term goal.
3. **July 3 — Decision C (long-term scope):** ONE Supabase project serves as
   the permanent content + image backend for BOTH:
   - the **demo-generator** project (this repo)
   - the **whatsapp-mock-generator-main** client projects at
     `F:\Sellerhub\whatsapp-mock-generator-main\` (22 client projects,
     84 HTML journey files, ~197MB)
   Cost: replace ad-hoc folders-of-JSON on disk with structured Postgres +
   Storage + auto REST API + admin UI in one managed service.

---

## 2. ARCHITECTURE — ONE PROJECT, TWO HOSTS

```
            ┌──────────────────────────────────────────┐
            │            Supabase Project              │
            │  (managed Postgres + Storage + Studio)   │
            │                                          │
            │  tables:                                 │
            │   industries     (cement, fmcg, retail…)  │
            │   brands         (jk_cement, haldirams…) │
            │   journeys       (project_wide content)  │
            │   images-meta    (refs to Storage files) │
            │                                          │
            │  storage.bucket: demo-assets              │
            │   (PNG/JPG/SVG — brand logos, product    │
            │    photos, hero banners, field-ops photos)│
            │                                          │
            │  auto REST:  /rest/v1/<table>?filter=…    │
            │  RLS:        public read, admin write     │
            │              service-role key (build only) │
            └────────────┬─────────────────────┬───────┘
                  build-time |              live |
                            |                     |
              ┌─────────────▼─────┐    ┌──────────▼──────────┐
              │   demo-generator   │    │      browser       │
              │   build.js  Path A │    │  demo-renderer.js  │
              │   (fetches during   │    │  + demo-ui.js      │
              │    static build)    │    │  Path B (live)     │
              │   -> dist/ output   │    │  fetch + render    │
              └─────────────────────┘    └────────────────────┘
                            |                     |
                            └──────────┬──────────┘
                                       ▼
                          ┌─────────────────────┐
                          │  Cloudflare Pages   │
                          │  static dist/ +     │
                          │  /p/ share KV      │
                          └─────────────────────┘
```

- **Build-time fetch (Path A):** `build.js` fetches industry profile + image
  URLs from Supabase during static build, bakes absolute Supabase image URLs
  into `dist/{brand}/index.html`. Build machine must reach Supabase. No API
  key beyond the anon key (read-only, public).
- **Live fetch (Path B):** the client wizard's industry dropdown reads
  `/rest/v1/industries` live; adding a row in Supabase Studio instantly
  appears. On Generate, fetches the chosen profile live and renders. No
  silent LLM call, no `OPENCODE_API_KEY` in any shipped runtime path.
- **Cloudflare Pages** still hosts static `dist/` + the `/p/{brand}/{slug}/`
  share catch-all as today. Supabase is a separate HTTPS backend reachable
  from frontend and build; CORS configured on Supabase project settings to
  allow the CF Pages origin.

---

## 3. SUPABASE SCHEMA — tables, columns, RLS, storage

### Table: `industries`
One row per industry. Comprehensive profile (labels + messages + descriptions
+ terminology) — the source of truth that replaces per-brand JSON duplication
of `journey.messages.*` objects.

| column         | type        | notes                                              |
|----------------|-------------|----------------------------------------------------|
| `id`           | uuid pk     | default `gen_random_uuid()`                        |
| `name`         | text unique | `"cement"`, `"fmcg"`, `"retail"`, `"pharma"`…      |
| `label`        | text        | display label                       |
| `partner_label`| text        | `"Dealer"` / `"Partner"` / `"Distributor"`…        |
| `unit`         | text        | `"bag"` / `"unit"` / `"case"`…                     |
| `unit_plural`  | text        | `"bags"` / `"units"`…                              |
| `currency`     | text        | default `"INR"`                                    |
| `currency_symbol` | text     | default `"₹"`                                      |
| `category_tabs`| jsonb       | `["All","OPC","PPC",…]`                             |
| `labels`       | jsonb       | 21 keys → industry-specific labels                 |
| `messages`     | jsonb       | welcome + step1..N conversation content with       |
|                |             | `{{brandName}}` `{{dealerStoreName}}` `{{product}}` |
|                |             | placeholders  (scope iii — WhatsApp tone included) |
| `descriptions` | jsonb       | per-step screen descriptions, also templated       |
| `terminology`  | jsonb       | product_categories, partner_types, units, etc.      |
| `created_at`   | timestamptz | default now()                                      |
| `updated_at`   | timestamptz | default now(), trigger-updated                     |

### Table: `brands`
One row per brand. Replaces `data/brands/<brand>.json`.

| column              | type        | notes                                          |
|---------------------|-------------|------------------------------------------------|
| `id`                | uuid pk     |                                                |
| `slug`              | text unique | `"jk_cement"`, `"haldirams"`…                  |
| `name`              | text        | display name                    |
| `industry_id`       | uuid fk     | → `industries.id`                              |
| `colors`            | jsonb       | `{brand:"#E30613", brand_dark:"#B30510", …}`   |
| `font`              | jsonb       | `{primary:"Space Grotesk", mono:"JetBrains…"}`|
| `dealer_store_name` | text        |                                                |
| `secondary_dealers` | jsonb       | array                                           |
| `assets`            | jsonb       | hero_banner, logo refs to `images-meta` rows    |
| `theme`             | jsonb       |                                                |
| `created_at`        | timestamptz |                                                |
| `updated_at`        | timestamptz |                                                |

### Table: `journeys`
Per-(brand, journey_type) override content. Until scope iii completes
migrating all conversation text into industry profiles, this table holds
brand-specific overrides of the industry profile defaults.

| column         | type        | notes                                                  |
|----------------|-------------|--------------------------------------------------------|
| `id`           | uuid pk     |                                                        |
| `brand_id`     | uuid fk     | → `brands.id`                                          |
| `journey_type` | text        | `"order_to_cash"`, `"automated_collections"`, …        |
| `messages`     | jsonb       | brand-specific overrides (after superset merge)       |
| `labels`       | jsonb       | brand-specific overrides                               |
| `descriptions` | jsonb       | brand-specific overrides                               |
| `created_at`   | timestamptz |                                                        |
| `updated_at`   | timestamptz |                                                        |
| unique: `(brand_id, journey_type)`                |

### Table: `images_meta`
One row per stored image file.

| column        | type        | notes                                                  |
|---------------|-------------|--------------------------------------------------------|
| `id`          | uuid pk     |                                                        |
| `brand_id`    | uuid fk     | → `brands.id` (nullable for shared assets)            |
| `image_type`  | text        | `"hero"` `"product"` `"logo"` `"fallback"` `"field_ops"`|
| `storage_path`| text        | path inside `demo-assets` bucket                       |
| `alt`         | text        |                                                        |
| `created_at`  | timestamptz |                                                        |

### Row-Level Security
- All four tables: `SELECT` policy `USING (true)` — public read, no anon
  key needed in frontend (anon key only for rate-limit attribution).
- `INSERT`/`UPDATE`/`DELETE` policies: allow-all with `USING (true) WITH CHECK (true)` — Supabase's new non-JWT secret key authenticates as service_role when sent as `apikey` header, bypassing RLS. Harden with `REVOKE INSERT, UPDATE, DELETE ON <t> FROM anon, authenticated, public`.
  — admin-only, key never shipped to frontend.

### Storage
- Bucket `demo-assets` — public read, admin write.
- Path convention: `{brand_slug}/{type}/{filename}` — e.g.
  `jk_cement/logo/logo.png`, `jk_cement/product/product_001.png`.
- Public URL pattern:
  `https://<project>.supabase.co/storage/v1/object/public/demo-assets/<path>`

---

## 4. WHAT THIS RETIRES (mapped to the P1–P7 problem list)

| Problem | Resolution in this design                            |
|---------|------------------------------------------------------|
| P1: Path-A-only adaptation            | both paths fetch real profile                        |
| P2: LLM at runtime                     | LLM removed from runtime; dev-time optional draft     |
| P3: save-content broken on CF         | no save endpoint; Supabase IS persistence             |
| P4: thin industry context             | comprehensive profiles in industry rows               |
| P5: no deterministic fallback         | every lookup deterministic; `general` row fallback    |
| P6: 7 manual per-journey label files  | labels live in industry row; files deleted            |
| P7: UI labels only (scope i)          | scope iii: labels + messages + descriptions + tone   |

---

## 5. MIGRATION TRACK (PRIMARY) — 22 LEGACY CLIENT PROJECTS

User directive July 3 (verbatim, paraphrased): *"the 22 client projects in
whatsapp-mock-generator need to be adapted to our logic in demo-generator —
primary and priority task. Don't touch original files; copy them into
demo-generator and work on the copy."*

### State as of this spec (July 3, 2026)

Completed and committed:

- **Copied** the 22 client project folders (~197MB, 84 HTML files) from
  `F:\Sellerhub\whatsapp-mock-generator-main\whatsapp-mock-generator-main\projects\`
  to `demo-generator/migration/projects/` (untracked — upstream regenerable;
  only scripts + manifest are tracked in git).
- **Manifest extractor**
  (`migration/scripts/extract_project_manifest.py`) profiles every legacy
  HTML: brand colors (CSS `:root` vars), brand name (`<title>` tag), journey
  type (canonical / inferred / unknown / hub), step / screen counts, base64
  image count + total embedded image bytes, inline CSS / JS size,
  per-step screen labels, sample message bubbles. Produces
  `migration/manifest.json` + `migration/manifest.csv`.
- **Image extractor**
  (`migration/scripts/extract_images.py`) walks `migration/projects/` and
  rewrites each HTML in place, extracting every base64-embedded image to a
  per-project `_images/` folder and replacing inline data with relative URLs.
  Result: 236 unique images extracted across 80 HTML files, working size
  dropped from 175MB to 12MB (93% reduction).
- Reference git commits: `065d623` (manifest baseline),
  `5e19e2d` (image extractor).

### Findings from the manifest (what adaptation must address)

- 84 HTML files across 21 project directories (one folder, `RCPL`, is empty).
- 9 non-canonical journey types beyond the demo-generator's 10:
  - BlueOcean: `customer_groups`, `direct_enquiries`, `support_tickets`
  - OrientElectric: `erp_externalization`
  - Recykal: `ms_scrap_marketplace`, `ms_scrap_procurement`
  - freyr: `domestic_customer_lifecycle`
  - insightzz: `defect_alert_management`
  - Hindalco: `dsr_expense_claim`
  - Sintex: `plumber_registration_engagement`
  - SakkuGroup: `DT Fulfilment` (varies) + `daily_rate_broadcast`
  - lucky_seeds: `retailer_ordering`
  - zydus: `collections_finance_ptp_incentives`
  These need either (a) new journey-type module definitions in the
  demo-generator, or (b) explicit mapping to nearest canonical journey
  (e.g. `dsr_expense_claim` ≈ `field_ops_expense`).
- 25 distinct brand entities recoverable from `<title>` tags and CSS
  `:root` color variables — these seed the `brands` table seed data.
- Total inline CSS across all 84 files: 2,458 KB. After consolidation into the
  demo-generator's shared `dist/style.css`, collapses to a few KB per brand.
- Total inline JS: 644 KB. Most duplicates the demo-generator's nav / hub
  logic; collapses to one shared `app.js`.

### Remaining migration work (per-phase, in dependency order)

- **Phase 2 — Content extraction (HTML → JSON):** parse the slimmed HTMLs
  to extract steps (num, title, description), screens (`screen-lbl` /
  `screen-desc` content, phone-frame counts), message bubbles (`msg-body`
  text), and the legacy `journey.messages` equivalents into structured JSON
  matching `data/journeys/{brand}_{journey}.json`'s schema. One extraction
  per legacy HTML; outputs go to `migration/extracted/{brand}_{journey}.json`.
- **Phase 3 — Brand metadata extraction:** colors, fonts, names from
  `<title>` + CSS `:root` → `data/brands/{brand}.json` (and eventually Supabase
  `brands` rows).
- **Phase 4 — New journey-type modules:** for the 9 non-canonical journeys,
  add new partials under `templates/partials/` and new entries in the
  journey-id whitelist (`scripts/journey-core.js`, `build.js` journey plan).
  Alternatively, classify them as aliases of canonical journeys if the
  content overlaps strongly.
- **Phase 5 — Supabase provisioning + schema:** create the project, run the
  DDL, set RLS policies, configure CORS, create the `demo-assets` bucket,
  seed `industries` rows (cement, fmcg, retail as minimum for live brands).
- **Phase 6 — Content-adapter.js rewrite:** swap the LLM-orchestrator for a
  Supabase-client profile loader. Wire into `build.js` (lines 373, 525, 669)
  and `demo-renderer.js` (~331). Delete `api/experiments/adapt-content.js`
  and `api/experiments/save-content.js`. Update tests.
- **Phase 7 — Image upload to Supabase Storage:** upload the 236 extracted
  image files (plus demo-generator's existing `assets/`) to the
  `demo-assets` bucket, populate the `images_meta` rows.
- **Phase 8 — Verify build + visual regression:** `node build.js --dist`
  against Supabase-backed data, run `test/*` (70+ tests), run
  `python3 test-runner.py` (visual diff). Deploy to CF Pages.

---

## 6. WHAT'S EXPLICITLY OUT OF SCOPE (per user direction July 3)

- **Path C premium demos:** originally Track 4 in the completion plan (24
  missing premium demos for Haldiram + Sundaram). User directive July 3:
  *"forget about premium — top priority is content."* Deferred indefinitely.
- **Pharma / Steel industry profiles:** speculative; no live brand uses them
  yet. Build only when a prospect requests them.
- **Replacing the per-brand JSON physical files in `data/brands/` and
  `data/journeys/`:** Supabase becomes the authority, but the build still
  needs the data accessible at build time. Initially, `build.js` fetches
  from Supabase at build time; files under `data/` may stay as a local
  cache or be deleted in a later phase.

---

## 7. CREDENTIALS REQUIRED (not yet provisioned)

- Supabase project URL: `https://<project-ref>.supabase.co`
- Supabase anon key (public, read-only) — shipped to frontend
- Supabase service-role key (admin, write) — used ONLY by build/seed
  scripts, never shipped to the frontend
- Project region preference: `ap-south-1` (Mumbai) — matches the
  whatsapp-mock-generator's existing AWS Amplify deployment and the Indian
  client base (JK Cement, Haldirams, Hindalco, Adani Wilmar, Banas Dairy,
  Orient Electric, Sundar Masala, Zydus, Sintex, etc. are all India-based)

The user must create the Supabase project (the agent cannot create
Supabase projects on the user's behalf). Once the URL + keys are in hand,
put them in the demo-generator's `.env` file as
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (the
latter gitignored).

---

## 8. VERIFICATION — when the design is implemented

1. `node build.js --dist` with `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` set →
   builds all 3 live brands (JK Cement, Haldiram, Sundaram Store) end-to-end
   without LLM calls.
2. `node build.js --dist` → output `dist/{brand}/index.html` references
   Supabase Storage URLs for images (no base64, no `assets/` paths).
3. Client wizard Path B: industry dropdown lists industries fetched from
   `/rest/v1/industries`; on Generate, no `POST /api/experiments/adapt-content`
   call is made.
4. `python3 test-runner.py` visual regression → 70+ tests pass.
5. `grep -rn OPENCODE_API_KEY api/ services/ public/` → no hits (the
   key appears only in `scripts/generate-industry-profile.js` if that
   dev-time helper is ever built).
6. `curl https://demo-generator-482.pages.dev/api/health` →
   `content-type: application/json`, body `{"status":"ok",...}`.
7. The 22 legacy client projects under `migration/projects/` exist as
   extractable JSON in `migration/extracted/` and as the eventual Supabase
   rows (out of scope to seed all 22 in one phase; only the 3 live brands
   + cement + fmcg + retail seeded initially).