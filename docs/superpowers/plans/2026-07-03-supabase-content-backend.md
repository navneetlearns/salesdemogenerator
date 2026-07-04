# Supabase Content Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LLM-at-runtime content adapter with a Supabase-backed Industry Profile System (scope iii: labels + messages + descriptions + WhatsApp tone), fed by adapting the 22 legacy whatsapp-mock-generator client projects. Result: deterministic build, no runtime LLM, comprehensive industry profiles, managed by Supabase admin UI.

**Architecture:** Supabase (managed Postgres + Storage + auto REST) is the single content+image backend for both the demo-generator and the migrated 22 client projects. Build-time fetch (Path A) bakes industry profiles into static `dist/{brand}/index.html`; live wizard (Path B) fetches the industry dropdown + profile on Generate and makes no `POST /api/experiments/adapt-content`. Cloudflare Pages still hosts static `dist/` and the `/p/{brand}/{slug}/` share KV. LLM becomes a dev-time optional drafter only.

**Tech Stack:** Node.js (build.js, Handlebars, ajv), Python (extraction scripts), Supabase (Postgres + Storage + REST), Cloudflare Pages + KV, Playwright (visual regression).

---

## State Refresh (verified against disk July 3, 2026)

Working tree clean, on `main`. HEAD = `dc86a05`. **3 unpushed commits** (the July 3 migration staging work: `065d623`, `5e19e2d`, `dc86a05`).

Tests/build state (from `references/project-inventory.md` June 27 + verified by HEAD log):
- 70/70 unit tests pass; 33 visual pages pass.
- 30 journey files (3 brands × 10). 8 screen types registered. Schema validation passes for all 30.
- CF Pages migration COMPLETE. Live: `https://demo-generator-482.pages.dev`. Health: `{"status":"ok"}`.
- Template optimization Phase 11 DONE (19 SVG icon partials, 35 CSS utility classes).

**Stale-doc note:** `references/project-status.md` (June 9) claims BUG-1/2/4 (hardcoded prices/dealers/products) still OPEN. Verified via the June 27 completion-plan + project-inventory — those are RESOLVED. **Task 0.1** below updates that stale doc; do NOT propagate the BUG claims into code or memory.

**Migration track state (verified July 3):**
- Phase 0 copy: DONE (22 project folders in `migration/projects/`, gitignored).
- Phase 1 manifest: DONE (`migration/manifest.json`, `manifest.csv`, scripts tracked).
- Phase 2 image extraction: DONE (236 unique images extracted, 175MB→12MB HTML).
- **Manifest findings re-verified against disk this session:**
  - 84 HTML = 56 canonical + 11 inferred-canonical + 8 hub + **9 unknown** (non-canonical journey types). The 9 unknowns ARE the Phase 5 candidates — bounded, not open-ended.
  - **Industry mapping of the 22 projects (CRITICAL — supersedes spec):**
    - cement: 1 (jkcement)
    - fmcg: 4 (Adani Wilmar, Banas Dairy, Savera, sundar_masala)
    - industrial: 6 (BlueOcean Steel, Hindalco, Orient Electric ×2 dirs, Sintex, Recykal)
    - pharma: 3 (freyr, insightzz, zydus)
    - agri: 1 (lucky_seeds)
    - other: 5 (Atharva, Haldirams-reported-as-"Campa", Mukund, SakkuGroup, Vini Fogg, pmcona) — brand_name noise from per-HTML `<title>` tags; needs reconciliation in Phase 4.
  - **Conclusion:** the spec's "mandatory: cement/fmcg/retail" seed list is WRONG. Phase 6 must seed **6 mandatory industries**: `cement`, `fmcg`, `industrial`, `pharma`, `agri`, `general` (fallback). This ripples into Phase 7's seed script.

**Credential gate (user-only, July 4):** No Supabase project exists yet. Must come from the user: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (last gitignored) in `.env`. Region `ap-south-1`. Track B (Phases 6-9) is blocked on this; Track A (Phases 3-5) is not.

> **Supabase key change (July 2026):** Supabase replaced JWT-based `anon` / `service_role` keys with non-JWT **publishable key** (client-side reads) and **secret key** (server-side writes). Both sent via `apikey` header, NOT `Authorization: Bearer`. The publishable key works for public `SELECT` from the frontend. The secret key replaces `service_role` for admin operations (seed, image upload).

---

## File Structure (created or modified)

- `migration/scripts/extract_content.py` — bulk HTML→journey-JSON extractor (generalizes `_inspect_structure.py`)
- `migration/scripts/extract_brand_metadata.py` — `:root` colors + `<title>` → brand JSON
- `migration/scripts/diff_extracted_vs_existing.py` — **NEW (amendment 2):** post-Phase-5 regression gate
- `migration/scripts/seed_industries.py` — builds seed JSON for Supabase `industries` rows from extracted content + existing `data/content/*_labels.json`
- `migration/scripts/seed_supabase_images.js` — uploads extracted 236 images + existing `assets/` to Storage bucket; populates `images_meta`
- `migration/extracted/{brand}_{journey}.json` — per-HTML structured content (gitignored except scripts)
- `migration/brand_metadata/{brand}.json` — 22 brand metadata files (gitignored; fed into Supabase `brands` rows)
- `migration/industries_seed.json` — the 6 industry profiles ready to insert (TRACKED; reviewed before Phase 7 deletion gate)
- `db/0001_init.sql` — DDL: `industries`, `brands`, `journeys`, `images_meta` + RLS policies + updated_at triggers
- `db/0002_seed_industries.sql` — inserts the 6 mandatory industry rows
- `services/content-adapter.js` — rewrite from LLM orchestrator → Supabase client (`getIndustryProfile`, `applyProfileToJourney`, `getImageUrl`)
- `public/js/demo-renderer.js`, `public/js/demo-ui.js` — Path B keeps the industry dropdown, drops `POST /api/experiments/adapt-content`
- `api/experiments/adapt-content.js`, `api/experiments/save-content.js` — DELETE after Phase 7 verification
- `data/content/*_labels.json` (7 files) — DELETE in Phase 7 only after diff-verified Supabase seed
- `data/brands/{brand}.json` (22 new), `data/journeys/{brand}_{journey}.json` (per non-canonical journey)
- `templates/partials/step*-<new_journey>.hbs` — at most 3 new modules (Phase 5 cap, see Task 5.0)
- `scripts/journey-core.js`, `build.js` — journey-id whitelist + journey plan updates
- `References/*` — keep in sync per task; this plan's state header; `legacy-project-migration.md` phase status; `content-adapter-redesign.md` Supabase decision note

---

## Track A — Credential-Free Migration

### Task 0: Stale-doc cleanups + safety baseline

**Files:**
- Modify: `references/project-status.md` (June 9 header → RESOLVED BUG notes)
- Modify: `references/legacy-project-migration.md` (Phase column + industry finding)
- Create: `.backup/data-content-labels.tar.gz` — **(amendment 1)** pre-deletion backup of the 7 label files; contents ALSO preserved in git history but this guarantees a one-command restore

- [ ] **Step 1:** Run `git log --oneline origin/main..HEAD | wc -l` and confirm the 3 unpushed commits (matches State Refresh). Run `node --test test/*.test.js` — confirm 70/70 pass; if not, STOP and reconcile.
- [ ] **Step 2:** In `references/project-status.md` change the "Current Priority Work" table header to read `> CLOSED June 27, 2026 — see references/project-inventory.md for current state` and mark BUG-1/2/3/4 rows as `RESOLVED (Phase 1, June 19)`. Do not delete — annotate.
- [ ] **Step 3:** Update `references/legacy-project-migration.md` "Industry mapping" finding: the 22 projects don't map cleanly to 3 industries; Phase 6 must seed 6 industries (cement, fmcg, industrial, pharma, agri, general). Update the Phase 6 row in its status table.
- [ ] **Step 4:** Create the backup tarball:
```bash
cd '/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator'
mkdir -p .backup && tar -czf .backup/data-content-labels.tar.gz data/content/
```
Confirm: `tar -tzf .backup/data-content-labels.tar.gz` lists 7 files. Add `.backup/` to `.gitignore`.
- [ ] **Step 5:** Commit:
```bash
git add references/project-status.md references/legacy-project-migration.md .gitignore
git commit -m "docs: state refresh — mark June bugs resolved, correct industry mapping; add pre-deletion label backup"
```

### Task 1: Phase 3 — Content extraction test (TDD)

**Files:**
- Create: `migration/scripts/test_extract_content.py`
- Create: `migration/scripts/extract_content.py` (minimal stub first)

- [ ] **Step 1: Write the failing test** using one known-good fixture (`jkcement/jk_cement_order_to_cash.html` — already inspected by `_inspect_structure.py`, 11 steps, expected messages object shape).

```python
# migration/scripts/test_extract_content.py
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from extract_content import extract_content

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/projects"
RESULT_PATH = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/data/journeys/jk_cement_order_to_cash.json"

def test_step_count_matches_known():
    result = extract_content(f"{BASE}/jkcement/jk_cement_order_to_cash.html")
    assert len(result["steps"]) == 11, f"want 11 steps, got {len(result['steps'])}"

def test_step_titles_are_strings_and_nonempty():
    result = extract_content(f"{BASE}/jkcement/jk_cement_order_to_cash.html")
    for s in result["steps"]:
        assert isinstance(s["title"], str) and s["title"].strip(), f"bad title: {s}"

def test_messages_object_has_welcome():
    result = extract_content(f"{BASE}/jkcement/jk_cement_order_to_cash.html")
    assert "welcome" in result["messages"], "missing welcome message"
    assert isinstance(result["messages"]["welcome"], dict)

def test_extract_shape_matches_demo_generator_schema():
    """Each step: {num, title, description, screens[]}; each screen: {type, data}."""
    result = extract_content(f"{BASE}/jkcement/jk_cement_order_to_cash.html")
    for s in result["steps"]:
        assert set(s.keys()) >= {"num", "title", "description", "screens"}
        for screen in s["screens"]:
            assert "type" in screen and "data" in screen, f"bad screen shape: {screen}"
```

- [ ] **Step 2:** Run the test to verify it fails:
```bash
python3 -m pytest migration/scripts/test_extract_content.py -v
```
Expected: ImportError / ModuleNotFoundError on `extract_content`.

- [ ] **Step 3:** Run the existing inspector across jkcement, BlueOcean, Recykal, insightzz (one per industry group) to capture selector variations before writing the parser:
```bash
python3 migration/scripts/_inspect_structure.py > migration/structure-inspection.log 2>&1
```
Read `migration/structure-inspection.log`; note per-project selector names (`step-section`/`screen-lbl`/`screen-desc`/`msg-body`/`phone-frame`). If any project uses a radically different DOM, add a fixture to the test set rather than silently handling it.

### Task 2: Phase 3 — Content extraction implementation

**Files:**
- Modify: `migration/scripts/extract_content.py` (full implementation)
- Create: `migration/extracted/{brand}_{journey}.json` (output, gitignored)

- [ ] **Step 1:** Implement `extract_content(html_path) -> dict`:
  - Parse `step-section` divs → `steps[{num, title, description, screens[]}]`
  - `num` from `id="step-N"` or step-header ordinal
  - `title` from `.step-lbl`/`.screen-lbl` (per inspector findings)
  - `description` from `.screen-desc` (fallback: empty string — never None)
  - `screens[]` from `.phone-frame` blocks → classify `type`:
    - Has `.msg-body` and a `template`/`reply-button` marker → `whatsapp-template`
    - Has `.msg-body` only → `whatsapp-message`
    - Has document/attachment markers → `whatsapp-document`
    - Has list markers → `interactive-list`
    - Non-WhatsApp PWA block → `pwa-webview`
  - `messages` object: walk `.msg-body` bubbles by step grouping; produce `{welcome, step1, step2, …}` keyed like the existing demo-generator JSON. **CRITICAL:** do NOT inject Handlebars expressions here — substitute realistic sample text (per skill pitfall). Leave `{{brandName}}` template tokens only on the LATER seed step (Phase 6), not during migration.
- [ ] **Step 2:** Run the test:
```bash
python3 -m pytest migration/scripts/test_extract_content.py -v
```
Expected: 4 PASS. If FAIL, inspect the actual HTML structure (not the inspector summary — the raw HTML) for the failing project; fix the parser; rerun.
- [ ] **Step 3:** Extend the test to a 2nd fixture from a DIFFERENT industry (industrial — `BlueOcean/bo_order_to_cash.html` if it exists, else `Orient/orient_order_to_cash.html`):
```python
def test_works_on_industrial_brand():
    path = f"{BASE}/BlueOcean/bo_order_to_cash.html"
    if not os.path.exists(path): path = f"{BASE}/Orient/orient_order_to_cash.html"
    result = extract_content(path)
    assert len(result["steps"]) >= 1
    assert "messages" in result
```
Run; fix selector handling if it fails.
- [ ] **Step 4:** Run the extractor across all 84 HTMLs (excluding the 8 hub pages):
```python
import os, json
from extract_content import extract_content
BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/projects"
OUT = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/extracted"
os.makedirs(OUT, exist_ok=True)
errors = []
for proj in os.listdir(BASE):
    pdir = os.path.join(BASE, proj)
    if not os.path.isdir(pdir): continue
    for fn in os.listdir(pdir):
        if not fn.endswith(".html") or "_index" in fn or fn == "index.html": continue
        try:
            r = extract_content(os.path.join(pdir, fn))
            slug = proj.lower().replace(" ", "_")
            out = os.path.join(OUT, f"{slug}__{fn.replace('.html','')}.json")
            json.dump(r, open(out,"w"), ensure_ascii=False, indent=2)
        except Exception as e:
            errors.append((proj, fn, str(e)))
print(f"extracted {len(os.listdir(OUT))} files; {len(errors)} errors")
for e in errors: print(e)
```
Expected: ~76 extracted JSONs (84 − 8 hubs), 0 errors. Any error → fix per-project, don't skip.
- [ ] **Step 5:** Add `migration/extracted/` to `.gitignore`. Commit scripts only:
```bash
git add migration/scripts/extract_content.py migration/scripts/test_extract_content.py migration/structure-inspection.log .gitignore
git commit -m "migration Phase 3: HTML→journey-JSON extractor (TDD, 76 files across 22 projects)"
```

### Task 3: Phase 4 — Brand metadata extraction

**Files:**
- Create: `migration/scripts/extract_brand_metadata.py`
- Create: `migration/scripts/test_extract_brand_metadata.py`
- Create: `migration/brand_metadata/{brand}.json` (gitignored)

- [ ] **Step 1: Failing test.**
```python
def test_brand_has_required_keys():
    from extract_brand_metadata import extract_brand_metadata
    r = extract_brand_metadata(f"{BASE}/jkcement/jk_cement_order_to_cash.html")
    for k in ("slug","name","colors","font","dealer_store_name","secondary_dealers","assets"):
        assert k in r, f"missing key {k}"
    assert isinstance(r["colors"], dict) and "brand" in r["colors"]
```
- [ ] **Step 2:** Implement `extract_brand_metadata`:
  - `slug`: project dir name → snake_case (jkcement, blueocean, …)
  - `name`: from `<title>` (first tag encountered; strip suffix after `|`/`-`)
  - `colors`: parse CSS `:root { --brand: …; --brand-dark: …; --accent: … }`
  - `font`: detect `font-family` from `body` CSS or default `{primary:"Space Grotesk"}`
  - `dealer_store_name`: from a sample bubble OR fallback `"Main Dealer"`
  - `secondary_dealers`: heuristic — leave `[]` if not detectable (Phase 7 will fill from journey data)
  - `assets`: `{logo_ref: null, hero_ref: null}` (filled by Phase 8 image upload)
- [ ] **Step 3:** Run → pass → run across all 22 project dirs, dedupe by slug (1 metadata file per brand, even if multiple journey HTMLs reference it). Output to `migration/brand_metadata/{slug}.json`.
- [ ] **Step 4:** **(manually resolve the 5 "other" brands from State Refresh):** for `Atharva`, `Campa` (actually Haldirams), `Mukund`, `SakkuGroup`, `Vini Fogg`, `pmcona` — open one HTML each and confirm the true brand name + industry. Mark each with an `industry` field (cement/fmcg/industrial/pharma/agri/general). This is a one-time pass; commit findings.
- [ ] **Step 5:** Commit:
```bash
git add migration/scripts/extract_brand_metadata.py migration/scripts/test_extract_brand_metadata.py .gitignore
git commit -m "migration Phase 4: brand metadata extractor (22 brands, industry tagging)"
```

### Task 4: Phase 5 — New journey-type modules for the 9 unknowns

**Files:**
- Create: `migration/journey_classification.json` (decision log — TRACKED)
- Modify: `scripts/journey-core.js` whitelist; `build.js` journey plan

- [ ] **Step 1 (CAP — amendment 3):** Cap at **3 new journey modules**. The other 6 unknowns MUST be aliased to existing canonical journeys. Open the 9 unknown journey HTMLs one category at a time and decide:
  - `daily_rate_broadcast` (BlueOcean/SakkuGroup) → likely alias of `campaigns_queries` (broadcast is a campaign)
  - `customer_groups` (BlueOcean) → likely alias of `dealer_engagement` (group enrollment)
  - `direct_enquiries` (BlueOcean) → likely alias of `campaigns_queries`
  - `support_tickets` (BlueOcean) → likely alias of `post_order_communication`
  - `erp_externalization` (OrientElectric) → likely alias of `dt_fulfillment_payment` (ERP=order/pay flow)
  - `ms_scrap_marketplace` + `ms_scrap_procurement` (Recykal) → **NEW module** — distinct marketplace model, not in canon
  - `domestic_customer_lifecycle` (freyr) → **NEW module** — pharma-specific lifecycle, not in canon
  - `defect_alert_management` (insightzz) → **NEW module** — alert workflow not covered by anything
  - `dsr_expense_claim` (Hindalco) → alias of `field_ops_expense` (DSR=Daily Sales Report)
  - `plumber_registration_engagement` (Sintex) → alias of `retailer_onboarding`
  - `retailer_ordering` (lucky_seeds) → alias of `order_to_cash`
  - `collections_finance_ptp_incentives` (zydus) → alias of `automated_collections`
  
  Final cap: 3 new (`scrap_marketplace`, `customer_lifecycle`, `defect_alert_management`); 9 aliases. If Step 1 finds a 4th genuinely-distinct unknown, STOP and consult the user before exceeding the cap.
- [ ] **Step 2:** Write the decisions to `migration/journey_classification.json` — one row per unknown: `{journey_type, decision: "alias"|"new", canonical_or_new_id, reason, source_projects}`.
- [ ] **Step 3:** For aliases — add entry to `scripts/journey-core.js` whitelist mapping (e.g. `daily_rate_broadcast → campaigns_queries`). No new partials. Update `build.js` journey plan to recognise the alias id.
- [ ] **Step 4:** For each new module (3 max):
  - Create `templates/partials/step*-<new_id>.hbs` (per-step partials)
  - Create `data/journeys/{sample_brand}_{new_id}.json` skeleton (schema-valid: `steps[].screens[]` with `type`+`data`)
  - Re-use existing screen types where possible; only add a new screen type if the existing 8 don't fit (would require `lib/screen-renderer.js` registration) — **consult the user before adding any new screen type**.
- [ ] **Step 5:** Update `references/journey-gap-analysis.md` with the cap outcome + classification log in this same commit.
- [ ] **Step 6:** Commit:
```bash
git add migration/journey_classification.json scripts/journey-core.js build.js templates/partials/step*-*.hbs data/journeys/*_*.json references/journey-gap-analysis.md
git commit -m "migration Phase 5: classify 9 unknown journeys (3 new modules + 9 aliases); cap honored"
```

### Task 5: Track-A regression gate — **(NEW TASK, amendment 2)**

**Goal:** Before Track B rewrites anything, prove the Track A output (extracted JSON + new brand metadata + new journey modules) does NOT change the existing 3 live brands' build output. If the build output drifts here, Track B should not proceed.

**Files:**
- Create: `migration/scripts/diff_extracted_vs_existing.py`

- [ ] **Step 1:** Baseline current build BEFORE Track A touched anything has already been committed at `dc86a05`. Snapshot the current `dist/` for the 3 known brands:
```bash
cd '/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator'
"/mnt/c/Program Files/nodejs/node.exe" build.js --dist
diff -r dist/jk_cement dist/haldirams dist/sundaram_store /tmp/dist-baseline/ || true
mkdir -p /tmp/dist-baseline && cp -r dist/jk_cement dist/haldirams dist/sundaram_store /tmp/dist-baseline/
sha256sum /tmp/dist-baseline/*/*.html > /tmp/dist-baseline.sha256
```
- [ ] **Step 2:** Run build AFTER Tasks 1-4 (Track A complete). The existing 3 brands' journey data under `data/journeys/jk_cement_*.json` etc. is unchanged (Track A touched only `migration/`, `scripts/journey-core.js` whitelist additions for aliases that don't affect JK/Haldiram/Sundaram, and the 3 new journey modules which the existing brands don't reference).
```bash
"/mnt/c/Program Files/nodejs/node.exe" build.js --dist
sha256sum dist/jk_cement/*.html dist/haldirams/*.html dist/sundaram_store/*.html > /tmp/dist-after.sha256
```
- [ ] **Step 3:** Diff the two SHA lists. Compare paths; expect identical hashes for the 3 known brands. If hashes differ, run `diff -r /tmp/dist-baseline dist/jk_cement` to find the drift and root-cause it in Track A before proceeding to Track B.
- [ ] **Step 4:** Run `node --test test/*.test.js` → expect 70/70 still pass.
- [ ] **Step 5:** Run `python3 test-runner.py` if a deployment URL is available (or skip Tier 2/3 until Track B deploys). If a Stage 1 build passes here, Track A is done.
- [ ] **Step 6:** Commit:
```bash
git add migration/scripts/diff_extracted_vs_existing.py
git commit -m "migration Phase 5.5: regression gate — 3 known brands build identical pre/post Track A"
```

---

## Track B — Supabase Backend (BLOCKED on credentials)

> **Gate:** Tasks 6-9 cannot start until the user creates the Supabase project and provides `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` in `.env`. The secret key is gitignored. Keys are sent via `apikey` header (NOT `Authorization: Bearer`) since Supabase moved from JWT to non-JWT keys in 2026. Specify them as a one-block user action; do not attempt to transact the user's Supabase credentials via `write_file` (Hermes masks tokens per the demo-generator skill pitfalls section). Ask the user to paste them into `.env` via their own terminal.

### Task 6: Phase 6 — Supabase provisioning + schema

**Files:**
- Create: `db/0001_init.sql`
- Create: `db/0002_seed_industries.sql`
- Create: `migration/industries_seed.json` (source of truth for the seed)
- Create: `scripts/supabase-client.js` (minimal read client wrapping fetch to `/rest/v1/<table>`)

- [ ] **Step 1:** Confirm `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` present in `.env`; `SUPABASE_SECRET_KEY` present and gitignored. Confirm region `ap-south-1`.
- [ ] **Step 2:** Write `db/0001_init.sql` — 4 tables, RLS policies, updated_at trigger, `demo-assets` Storage bucket note (bucket created via Dashboard or `supabase` CLI). Tables EXACTLY per spec section 3: `industries` (uuid pk, name unique, label, partner_label, unit, unit_plural, currency, currency_symbol, category_tabs jsonb, labels jsonb, messages jsonb, descriptions jsonb, terminology jsonb, created_at, updated_at), `brands` (slug unique, name, industry_id fk, colors jsonb, font jsonb, dealer_store_name, secondary_dealers jsonb, assets jsonb, theme jsonb, timestamps), `journeys` (uuid pk, brand_id fk, journey_type, messages jsonb, labels jsonb, descriptions jsonb, unique(brand_id, journey_type)), `images_meta` (uuid pk, brand_id fk nullable, image_type, storage_path, alt).
- [ ] **Step 3:** Write RLS policies:
  - All 4 tables: `CREATE POLICY "public read" ON <t> FOR SELECT USING (true);`
  - Write policies: `CREATE POLICY "admin write" ON <t> FOR ALL USING (true) WITH CHECK (true);` — Supabase's new non-JWT secret key authenticates as service_role automatically when sent as `apikey` header, bypassing RLS for writes. Then harden with: `REVOKE INSERT, UPDATE, DELETE ON <t> FROM anon, authenticated, public;` — ensures only requests with the secret key (service_role) can write, while publishable key (anon) remains read-only.
- [ ] **Step 4:** Run the DDL in Supabase Studio SQL editor (or `supabase db push`).
- [ ] **Step 5:** Create `demo-assets` Storage bucket via Dashboard; set public read.
- [ ] **Step 6:** Configure CORS: allow origin `https://demo-generator-482.pages.dev` (and `http://localhost:*` for local testing).
- [ ] **Step 7:** Build `migration/industries_seed.json` — 6 industry profiles (cement, fmcg, industrial, pharma, agri, general):
  - Merge the 7 existing `data/content/*_labels.json` → `industries.labels` (cement/fmcg cases; general holds the default 21-label set).
  - Merge per-brand `journey.messages.*` objects (from `migration/extracted/*.json`) → `industries.messages`, parameterised: replace concrete brand/dealer/product names with `{{brandName}}` `{{dealerStoreName}}` `{{product}}` `{{unitPlural}}` placeholders. Document the placeholder set at the top of the seed file.
  - `descriptions` from `step.description` objects (dedupe identical text across brands).
  - `general` row's `messages`/`labels` fallback to the existing defaults so an unknown industry still builds.
- [ ] **Step 8:** Insert the 6 rows via `db/0002_seed_industries.sql` (using the service-role key locally — not committed in plaintext; the SQL has the JSON inline).
- [ ] **Step 9 (GATE — amendment 1):** Diff the seeded `industries.labels` JSONB against the original `data/content/*_labels.json` files before Phase 7 deletes anything:
```bash
python3 -c "
import json, base_dir='data/content'
# load original
# load industries via REST
# diff label key sets + values; report any drift
"
```
If drift is found (e.g. a missing key, an unsubstituted placeholder), fix the seed BEFORE Phase 7's deletion task.
- [ ] **Step 10:** Commit:
```bash
git add db/0001_init.sql db/0002_seed_industries.sql scripts/supabase-client.js migration/industries_seed.json
git commit -m "Phase 6: Supabase schema + 6 industry seed rows (amendment 1 — diff-verified vs old labels)"
```

### Task 7: Phase 7 — content-adapter.js rewrite

**Files:**
- Modify: `services/content-adapter.js`
- Modify: `build.js:373`, `build.js:525`, `build.js:669`
- Modify: `scripts/build-template-pack.js`
- Modify: `public/js/demo-renderer.js` (≈ line 331), `public/js/demo-ui.js`
- Modify: `test/content-adapter.test.js`
- DELETE (only after Step 8): `api/experiments/adapt-content.js`, `api/experiments/save-content.js`
- DELETE (only after Step 9): `data/content/*_labels.json` (7 files; backup at `.backup/data-content-labels.tar.gz`)

- [ ] **Step 1:** Write failing test in `test/content-adapter.test.js`:
```javascript
const { getIndustryProfile } = require('../services/content-adapter');
test('getIndustryProfile(cement) returns seeded profile with 21 labels', async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://test';
  const profile = await getIndustryProfile('cement');
  expect(profile).toBeTruthy();
  expect(Object.keys(profile.labels).length).toBe(21);
  expect(profile.messages.welcome).toMatch(/{{brandName}}/);
});
```
- [ ] **Step 2:** Implement `services/content-adapter.js` as a Supabase client:
  - `getIndustryProfile(name)` → `GET /rest/v1/industries?name=eq.<name>&apikey=<ANON>` (falls back to `general`)
  - `applyProfileToJourney(journey, profile, brand)` → substitutes placeholders in `profile.messages`/`labels`/`descriptions` with brand's `name`/`dealer_store_name`/`products[0]`
  - `getImageUrl(imageMeta)` → returns `https://<project>.supabase.co/storage/v1/object/public/demo-assets/<storage_path>`
  - No LLM code, no `OPENCODE_API_KEY` reference.
- [ ] **Step 3:** Modify `build.js` (lines ~373/525/669) to call `getIndustryProfile` for each brand's industry and `applyProfileToJourney` before rendering.
- [ ] **Step 4:** Modify `scripts/build-template-pack.js` to pack fetched industry profiles for client-side rendering (replaces the labels-merge at demo-renderer.js:331).
- [ ] **Step 5:** Modify `public/js/demo-renderer.js:~331` — remove `acceptedLabels` merge; use packed industry profile directly.
- [ ] **Step 6:** Modify `public/js/demo-ui.js`:
  - Industry dropdown fetched live from `GET /rest/v1/industries?select=name,label&order=label.asc`
  - On Generate: `applyProfileToJourney(payload, fetchedProfile, brand)` client-side. NO `POST /api/experiments/adapt-content`.
- [ ] **Step 7:** Run `node --test test/content-adapter.test.js` → pass.
- [ ] **Step 8:** DELETE `api/experiments/adapt-content.js` + `save-content.js`. Run `grep -rn 'adapt-content\|save-content' public/ services/ build.js scripts/` → expect empty.
- [ ] **Step 9 (DELETE GATE — amendment 1 final):** Only after Task 6 Step 9 diff-ed clean AND this task's Path B tests pass: delete `data/content/*_labels.json` (7 files). Verify against `.backup/data-content-labels.tar.gz` if needed.
- [ ] **Step 10:** Commit:
```bash
git add services/content-adapter.js build.js scripts/build-template-pack.js public/js/demo-renderer.js public/js/demo-ui.js test/content-adapter.test.js
git rm api/experiments/adapt-content.js api/experiments/save-content.js
git rm data/content/*_labels.json
git commit -m "Phase 7: content-adapter rewrite to Supabase profile client; remove LLM runtime path + 7 legacy label files (amendment 1 backdrop)"
```

### Task 8: Phase 8 — Image upload to Supabase Storage

**Files:**
- Create: `scripts/seed-supabase-images.js`

- [ ] **Step 1:** Implement `seed-supabase-images.js`:
  - Walk `migration/projects/*/_images/` (236 unique extracted images) + existing `assets/brands/`, `assets/products/`, `assets/fallbacks/`.
  - For each file: compute path `{brand_slug}/{type}/{filename}`, upload to `demo-assets` bucket via Supabase Storage API (Bearer=service-role key).
  - Insert `images_meta` row (`brand_id`, `image_type` inferred from folder, `storage_path`, `alt`).
- [ ] **Step 2:** Run it. Verify a few public URLs return 200 (e.g. `curl -I https://<proj>.supabase.co/storage/v1/object/public/demo-assets/jk_cement/logo/logo.svg`).
- [ ] **Step 3:** Commit:
```bash
git add scripts/seed-supabase-images.js
git commit -m "Phase 8: upload 236 migration images + existing assets to Supabase Storage demo-assets"
```

### Task 9: Phase 9 — Build, regression, deploy

**Deployment gate (amendment 5):** Two-stage — preview branch first, smoke test, then promote to main.

- [ ] **Step 1:** Run `node build.js --dist` with `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` exported. Verify all 3 live brands (JK Cement, Haldirams, Sundaram) build with no LLM calls (no `OPENCODE_API_KEY` referenced).
- [ ] **Step 2:** Verify `dist/{brand}/index.html` references Supabase Storage URLs (no base64, no local `assets/` paths):
```bash
grep -rE 'data:image/|src="\./assets/' dist/jk_cement/ dist/haldirams/ dist/sundaram_store/ | wc -l
```
Expected: 0. Non-zero means an image URL wasn't rewritten — fix `services/content-adapter.js getImageUrl`.
- [ ] **Step 3:** Run `node --test test/*.test.js` → 70+ pass.
- [ ] **Step 4:** Deploy to PREVIEW:
```bash
source .env && export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
npx wrangler pages deploy dist/ --project-name demo-generator --branch preview-supabase
```
- [ ] **Step 5:** Smoke the preview URL:
  - `curl -s https://<preview-hash>.demo-generator-482.pages.dev/api/health.json` → JSON `{"status":"ok"}`
  - Open the wizard: confirm the industry dropdown lists the 6 industries; pick `cement`; generate `order_to_cash`; confirm no `POST /api/experiments/adapt-content` in DevTools; confirm Supabase Storage URLs in the network tab.
  - Run `python3 test-runner.py` with `TEST_URL=<preview>`.
- [ ] **Step 6 (amendment 4 — RLS re-verify):** Run on the preview:
```bash
# publishable key cannot write to industries
TOKEN=$(grep SUPABASE_PUBLISHABLE_KEY .env | cut -d= -f2)
curl -X POST "$SUPABASE_URL/rest/v1/industries" \
  -H "apikey: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"attack"}'
```
Expected: 401/403. If 201, RLS is broken — fix `0001_init.sql` policies.
- [ ] **Step 7:** PROMOTE to main:
```bash
npx wrangler pages deploy dist/ --project-name demo-generator --branch main
```
Confirm `https://demo-generator-482.pages.dev/api/health.json` returns ok.
- [ ] **Step 8:** Push the now-stale 3 base commits + Track A + Track B:
```bash
git push origin main
```
- [ ] **Step 9:** Update docs in this same commit: README API table; `references/content-adapter-redesign.md` status → COMPLETE; `references/legacy-project-migration.md` → Phase 6 DONE; this plan's State Refresh header to reflect ship date.

---

## Verification Checklist

After all tasks, verify:

1. `node build.js --dist` builds 3 live brands with zero LLM calls (no `OPENCODE_API_KEY` referenced at runtime).
2. `dist/jk_cement/index.html` references Supabase Storage URLs (no `data:image/`, no `./assets/` paths).
3. Client wizard Path B: industry dropdown populated from `/rest/v1/industries`; Generate makes no `POST /api/experiments/adapt-content`.
4. `grep -rn OPENCODE_API_KEY api/ services/ public/` → empty (amendment 4 spirit).
5. `python3 test-runner.py` all 3 tiers pass against the production preview URL.
6. `curl https://demo-generator-482.pages.dev/api/health.json` → `{"status":"ok",...}`.
7. `migration/extracted/*.json` exists for all 76 non-hub legacy journeys.
8. Track A regression gate (Task 5): 3 known brands built byte-identical pre/post.
9. **amendment 1:** `.backup/data-content-labels.tar.gz` exists and restores cleanly (`tar -tzf | wc -l` == 7).
10. **amendment 4:** anon key `POST /rest/v1/industries` returns 401/403 (RLS enforced).
11. **amendment 5:** preview deploy ran and smoke checks passed BEFORE main promotion.
12. `git push origin main` succeeded (clears the original 3 unpushed + all new commits).