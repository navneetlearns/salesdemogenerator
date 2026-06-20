# Demo Generator → Cloudflare Pages Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the demo-generator from Vercel (static + serverless) to Cloudflare Pages (static + Workers). Use branded URLs that hide the generator site.

**Architecture:** Static frontend stays unchanged (build.js → dist/). Vercel serverless functions become Cloudflare Pages Functions (file-based routing in `functions/`). Vercel Blob storage becomes Cloudflare KV for share links. Deployment via `wrangler pages deploy`.

**Tech Stack:** Node.js 18+, Handlebars, Cloudflare Pages, Cloudflare Workers (Pages Functions), Cloudflare KV

**Current State (June 20, 2026):**
- HEAD: uncommitted changes (migration in progress)
- 70/70 tests pass
- 3 brands, 22 journeys, 3 rendering paths
- Deployed at https://*.demo-generator-482.pages.dev
- Cloudflare Pages project: demo-generator
- KV namespace: SHARES (id: 69cfff0c6dbd45299d9fefb059fee0e9)
- Known issue: share Worker routing intercepts /api/health

---

## File Structure

### Files to Create
```
functions/
  _middleware.js                    CORS middleware for all API routes
  api/
    health.js                      Health check endpoint
    brands.js                      List brands endpoint
    journeys.js                    List journeys endpoint
    share.js                       Create + retrieve share links (POST/GET)
    share-cleanup.js               Background cleanup (if needed)
    experiments/
      adapt-content.js             LLM content adaptation
      save-content.js              Save adapted content overrides
wrangler.toml                      Cloudflare Pages + KV config
```

### Files to Modify
```
lib/share-store.js                 Replace @vercel/blob with KV
package.json                       Add deploy scripts, remove @vercel/blob
README.md                          Update deployment docs
```

### Files to Remove (after migration verified)
```
vercel.json                        No longer needed
```

---

## Phase 1: Cloudflare Pages Project Setup

### Task 1.1: Initialize pagecast and create Pages project

- [ ] **Step 1: Verify pagecast is available**

```bash
npx pagecast --help 2>&1 | head -5
```

Expected: pagecast help text

- [ ] **Step 2: Set up Cloudflare Pages project**

```bash
npx pagecast pages setup --project demo-generator --json
```

Expected: project created or confirmed, returns account ID and project details

If this fails with 401, run `npx pagecast` and connect Cloudflare via the admin UI first.

- [ ] **Step 3: Verify project status**

```bash
npx pagecast pages status --json
```

Expected: `{"ok":true, "project":"demo-generator", ...}`

### Task 1.2: Create KV namespace for share storage

- [ ] **Step 1: Create KV namespace**

```bash
npx wrangler kv namespace create SHARES --json
```

Expected: returns `{"id":"<32-char-hex>"}` — save this ID

- [ ] **Step 2: Create wrangler.toml**

Create `wrangler.toml` at project root:

```toml
name = "demo-generator"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[[kv_namespaces]]
binding = "SHARES"
id = "<paste-kv-namespace-id-from-step-1>"
```

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add wrangler.toml for Cloudflare Pages + KV"
```

---

## Phase 2: Migrate API Endpoints to Cloudflare Workers

Cloudflare Pages Functions use file-based routing:
- `functions/api/health.js` → `GET /api/health`
- `functions/api/share.js` → `POST/GET /api/share`

Each function exports a `default` object with a `fetch(request, env, ctx)` handler.

### Task 2.1: Create CORS middleware

- [ ] **Step 1: Create `functions/_middleware.js`**

```javascript
// functions/_middleware.js
// CORS middleware applied to all API routes

export async function onRequest(context) {
  const response = await context.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/_middleware.js
git commit -m "feat: add CORS middleware for Cloudflare Workers"
```

### Task 2.2: Create health endpoint

- [ ] **Step 1: Create `functions/api/health.js`**

```javascript
// functions/api/health.js
export default {
  async fetch(request, env, ctx) {
    return new Response(
      JSON.stringify({ status: 'ok', version: '1.0.0', mode: 'static' }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/health.js
git commit -m "feat: add health endpoint for Cloudflare Workers"
```

### Task 2.3: Create brands endpoint

- [ ] **Step 1: Create `functions/api/brands.js`**

This endpoint reads brand data. Since Workers can't access the filesystem, we need to bundle brand data at build time OR serve it from static files. The simplest approach: keep brand data as static JSON in `dist/` and have the Worker read it from the bundled assets.

Actually — Cloudflare Pages Functions can't read `dist/` at runtime. The cleanest solution: the brands endpoint returns a static JSON file that's part of the deploy. We'll generate it during build.

Alternative: put brand data inline in the Worker.

Simplest approach: make the brands endpoint a static JSON file served by Pages (not a Worker at all). Place it at `dist/api/brands.json` and let Pages serve it as a static asset.

Let me revise: the brands and journeys endpoints are read-only and return static data. We can serve them as static JSON files instead of Workers.

Create `functions/api/brands.js`:

```javascript
// functions/api/brands.js
// Returns brand list from static data bundled at build time
// Build script writes dist/api/brands.json with brand metadata

import brandData from '../../dist/api/brands.json' assert { type: 'json' };

export default {
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify(brandData), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

Wait — Workers can't import from dist/ at runtime. The correct approach is to use a build step that inlines the data, or serve brands.json as a static file.

Let me use the simplest approach: serve static JSON files from dist/ and skip Workers for read-only endpoints.

**Revised approach:**

- `dist/api/brands.json` — generated by build script
- `dist/api/journeys.json` — generated by build script  
- These are served as static files by Cloudflare Pages (no Worker needed)
- Only share.js and experiments/ need Workers (they have dynamic logic)

- [ ] **Step 1: Update build.js to generate static API JSON files**

Add to `build.js` after the main build completes:

```javascript
// Generate static API response files for Cloudflare Pages
const brandsSummary = brands.map(b => ({
  id: b.id,
  name: b.name,
  shortName: b.shortName,
  industry: b.industry,
  journeyCount: journeyFiles.filter(j => j.startsWith(b.id)).length,
}));

fs.writeJsonSync(path.join(outputDir, 'api', 'brands.json'), brandsSummary, { spaces: 2 });

// Generate journeys list per brand
const journeysByBrand = {};
for (const brand of brands) {
  const brandJourneys = journeyFiles
    .filter(j => j.startsWith(brand.id))
    .map(j => {
      const journeyData = fs.readJsonSync(path.join(DATA_DIR, 'journeys', j));
      return {
        id: journeyData.id,
        title: journeyData.title,
        brandId: brand.id,
        stepCount: journeyData.steps ? journeyData.steps.length : 0,
      };
    });
  journeysByBrand[brand.id] = brandJourneys;
}

fs.writeJsonSync(path.join(outputDir, 'api', 'journeys.json'), journeysByBrand, { spaces: 2 });
```

- [ ] **Step 2: Run build and verify static API files exist**

```bash
node build.js --dist
cat dist/api/brands.json
cat dist/api/journeys.json
```

Expected: JSON arrays with brand and journey data

- [ ] **Step 3: Commit**

```bash
git add build.js dist/api/
git commit -m "feat: generate static API JSON for Cloudflare Pages"
```

### Task 2.4: Create share endpoint (Worker)

- [ ] **Step 1: Create `functions/api/share.js`**

```javascript
// functions/api/share.js
// Handles POST (create share) and GET (retrieve share)
// Uses Cloudflare KV for storage

import { createShare, getShare, initHub, addJourneyToHub } from '../../lib/share-store-cf.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (request.method === 'GET') {
      return handleGet(url, env);
    }

    if (request.method === 'POST') {
      return handlePost(request, env);
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
};

async function handleGet(url, env) {
  const token = url.searchParams.get('token');
  const journeyType = url.searchParams.get('journey');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Serve individual journey blob (v3 sub-request)
  if (journeyType) {
    const html = await env.SHARES.get(`shares/${token}_${journeyType}`);
    if (!html) {
      return new Response('Journey not found', { status: 404 });
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }

  // Serve share metadata or hub page
  const share = await env.SHARES.get(`shares/${token}`, { type: 'json' });
  if (!share) {
    return new Response('Share link expired or not found', { status: 404 });
  }

  // v3: multi-blob hub
  if (share.version === 3 && share.journeyBlobs) {
    return new Response(buildHubHtml(share, token), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }

  // v1: direct HTML blob
  if (share.html) {
    return new Response(share.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }

  return new Response('Invalid share format', { status: 500 });
}

async function handlePost(request, env) {
  const body = await request.json();

  // Create new share or add journey to hub
  if (body.hubToken) {
    // v3: add journey to existing hub
    const key = `shares/${body.hubToken}_${body.journeyType}`;
    await env.SHARES.put(key, body.html, { expirationTtl: 86400 });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create new share
  const token = generateToken();
  const shareData = {
    version: body.config ? 2 : 1,
    config: body.config || null,
    journeyTypes: body.journeyTypes || [],
    html: body.html || null,
    journeyBlobs: {},
    createdAt: Date.now(),
  };

  await env.SHARES.put(`shares/${token}`, JSON.stringify(shareData), { expirationTtl: 86400 });

  const origin = url.origin || 'https://demo-generator.pages.dev';
  return new Response(JSON.stringify({
    ok: true,
    token,
    url: `${origin}/api/share?token=${token}`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateToken() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function buildHubHtml(share, token) {
  // Hub HTML that fetches journeys dynamically via Blob URL iframes
  // Reuse existing hub template logic from api/share.js
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo Hub</title></head>
<body>
<div id="hp-cards"></div>
<script>
var share = ${JSON.stringify(share)};
var token = "${token}";
// Load journey on click via Blob URL iframe
</script></body></html>`;
}
```

- [ ] **Step 2: Create `lib/share-store-cf.js` (Cloudflare KV version)**

```javascript
// lib/share-store-cf.js
// Cloudflare KV-backed share storage
// Replaces lib/share-store.js which uses @vercel/blob

export async function createShare(env, token, data) {
  await env.SHARES.put(`shares/${token}`, JSON.stringify(data), { expirationTtl: 86400 });
}

export async function getShare(env, token) {
  return env.SHARES.get(`shares/${token}`, { type: 'json' });
}

export async function initHub(env, token, metadata) {
  const shareData = {
    version: 3,
    journeyTypes: metadata.journeyTypes || [],
    journeyBlobs: {},
    createdAt: Date.now(),
  };
  await env.SHARES.put(`shares/${token}`, JSON.stringify(shareData), { expirationTtl: 86400 });
  return shareData;
}

export async function addJourneyToHub(env, hubToken, journeyType, html) {
  const key = `shares/${hubToken}_${journeyType}`;
  await env.SHARES.put(key, html, { expirationTtl: 86400 });
  // Update hub metadata
  const hubKey = `shares/${hubToken}`;
  const hub = await env.SHARES.get(hubKey, { type: 'json' });
  if (hub) {
    hub.journeyBlobs[journeyType] = true;
    await env.SHARES.put(hubKey, JSON.stringify(hub), { expirationTtl: 86400 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/share.js lib/share-store-cf.js
git commit -m "feat: Cloudflare Workers share endpoint with KV storage"
```

### Task 2.5: Create experiments endpoints (Workers)

- [ ] **Step 1: Create `functions/api/experiments/adapt-content.js`**

```javascript
// functions/api/experiments/adapt-content.js
// LLM content adaptation — calls external API

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { industry, brandName, labels, journeyType } = body;

      // Call LLM API (OpenCode / deepseek)
      const llmResponse = await fetch(env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENCODE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: `Rewrite UI labels for ${industry} industry. Brand: ${brandName}. Return JSON only.` },
            { role: 'user', content: JSON.stringify(labels) },
          ],
        }),
      });

      const result = await llmResponse.json();
      const adaptedLabels = JSON.parse(result.choices[0].message.content);

      return new Response(JSON.stringify({ ok: true, labels: adaptedLabels }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
```

- [ ] **Step 2: Create `functions/api/experiments/save-content.js`**

```javascript
// functions/api/experiments/save-content.js
// Save adapted content overrides to KV

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { sessionId, overrides } = body;

      // Store overrides in KV with session key
      const key = `overrides/${sessionId || 'default'}`;
      await env.SHARES.put(key, JSON.stringify(overrides), { expirationTtl: 86400 });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/experiments/
git commit -m "feat: Cloudflare Workers for experiments API"
```

---

## Phase 3: Update Share Store (KV Migration)

### Task 3.1: Replace Vercel Blob with KV in share-store.js

- [ ] **Step 1: Update `lib/share-store.js`**

The existing share-store.js uses `@vercel/blob`. We need to make it work with both Vercel Blob (for backward compat) and Cloudflare KV (for new deployments).

```javascript
// lib/share-store.js
// Updated to support both Vercel Blob and Cloudflare KV

const crypto = require('crypto');

const SHARE_PREFIX = 'shares/';
const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SHARE_HTML_BYTES = 4 * 1024 * 1024;

function createError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

// Detect Cloudflare Workers environment
function isCloudflareWorkers() {
  return typeof globalThis.caches !== 'undefined';
}

// KV-backed operations (Cloudflare Workers)
async function kvPut(env, key, value, ttlSeconds) {
  await env.SHARES.put(key, value, { expirationTtl: ttlSeconds || 86400 });
}

async function kvGet(env, key, type) {
  return env.SHARES.get(key, type === 'json' ? { type: 'json' } : undefined);
}

// Vercel Blob operations (existing)
let blobClient = null;
function getBlobClient() {
  if (blobClient) return blobClient;
  try {
    blobClient = require('@vercel/blob');
    return blobClient;
  } catch {
    return null;
  }
}

// Unified createShare
async function createShare(token, data, env) {
  if (env && env.SHARES) {
    // Cloudflare KV path
    await kvPut(env, SHARE_PREFIX + token + '.json', JSON.stringify(data), 86400);
  } else {
    // Vercel Blob path
    const blob = getBlobClient();
    if (blob) {
      await blob.put(SHARE_PREFIX + token + '.json', JSON.stringify(data), {
        access: 'public',
        contentType: 'application/json',
      });
    }
  }
}

// Unified getShare
async function getShare(token, env) {
  if (env && env.SHARES) {
    return kvGet(env, SHARE_PREFIX + token + '.json', 'json');
  }
  const blob = getBlobClient();
  if (blob) {
    const resp = await blob.get(SHARE_PREFIX + token + '.json');
    if (!resp) return null;
    return resp.json();
  }
  return null;
}

// Unified addJourneyToHub
async function addJourneyToHub(hubToken, journeyType, html, env) {
  const key = journeyBlobPath(hubToken, journeyType);
  if (env && env.SHARES) {
    await kvPut(env, key, html, 86400);
  } else {
    const blob = getBlobClient();
    if (blob) {
      await blob.put(key, html, { access: 'public', contentType: 'text/html' });
    }
  }
}

// Unified readJourneyBlob
async function readJourneyBlob(hubToken, journeyType, env) {
  const key = journeyBlobPath(hubToken, journeyType);
  if (env && env.SHARES) {
    return kvGet(env, key);
  }
  const blob = getBlobClient();
  if (blob) {
    const resp = await blob.get(key);
    if (!resp) return null;
    return resp.text();
  }
  return null;
}

function journeyBlobPath(hubToken, journeyType) {
  var safe = String(journeyType || 'unknown').replace(/[^a-z0-9_-]/g, '_');
  return SHARE_PREFIX + hubToken + '_' + safe + '.html';
}

function normalizeHtml(html) {
  if (typeof html !== 'string' || !html.trim()) {
    throw createError('Generated HTML is required.', 'SHARE_HTML_REQUIRED', 400);
  }
  const size = Buffer.byteLength(html, 'utf8');
  if (size > MAX_SHARE_HTML_BYTES) {
    throw createError('Generated HTML is too large to share.', 'SHARE_HTML_TOO_LARGE', 413);
  }
  return html;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  createShare,
  getShare,
  addJourneyToHub,
  readJourneyBlob,
  normalizeHtml,
  generateToken,
  SHARE_PREFIX,
  SHARE_TTL_MS,
};
```

- [ ] **Step 2: Run existing tests**

```bash
node --test test/share-store.test.js
```

Expected: Tests pass (share-store tests should still work with mocked KV)

- [ ] **Step 3: Commit**

```bash
git add lib/share-store.js
git commit -m "feat: share-store supports both Vercel Blob and Cloudflare KV"
```

---

## Phase 4: Build Config & Deploy Scripts

### Task 4.1: Update package.json

- [ ] **Step 1: Add Cloudflare deploy scripts**

```bash
cd '/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator'
```

Add to `package.json` scripts:

```json
"deploy:cf": "npx pagecast pages deploy dist/ --project demo-generator --json",
"deploy:cf:prod": "npx pagecast pages deploy dist/ --project demo-generator --branch main --json",
"preview:cf": "npx wrangler pages dev dist/ --kv SHARES"
```

- [ ] **Step 2: Remove @vercel/blob from dependencies (after migration verified)**

Keep it for now as fallback. Remove in Phase 6 after verification.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add Cloudflare Pages deploy scripts"
```

### Task 4.2: Generate static API files in build

- [ ] **Step 1: Update build.js to output API JSON**

Add after the main build loop in `build.js`:

```javascript
// Generate static API JSON files for Cloudflare Pages
const apiDir = path.join(outputDir, 'api');
fs.ensureDirSync(apiDir);

const brandsSummary = brands.map(b => ({
  id: b.id,
  name: b.name,
  shortName: b.shortName,
  industry: b.industry,
  journeyCount: journeyFiles.filter(j => j.startsWith(b.id)).length,
}));

fs.writeJsonSync(path.join(apiDir, 'brands.json'), brandsSummary, { spaces: 2 });

const journeysByBrand = {};
for (const brand of brands) {
  const brandJourneys = journeyFiles
    .filter(j => j.startsWith(brand.id))
    .map(j => {
      const journeyData = fs.readJsonSync(path.join(DATA_DIR, 'journeys', j));
      return {
        id: journeyData.id,
        title: journeyData.title,
        brandId: brand.id,
        stepCount: journeyData.steps ? journeyData.steps.length : 0,
      };
    });
  journeysByBrand[brand.id] = brandJourneys;
}

fs.writeJsonSync(path.join(apiDir, 'journeys.json'), journeysByBrand, { spaces: 2 });
```

- [ ] **Step 2: Run build and verify**

```bash
node build.js --dist
cat dist/api/brands.json
cat dist/api/journeys.json
```

Expected: Valid JSON with brand and journey data

- [ ] **Step 3: Commit**

```bash
git add build.js
git commit -m "feat: generate static API JSON in build for Cloudflare Pages"
```

---

## Phase 5: Deploy & Verify

### Task 5.1: First deployment to Cloudflare Pages

- [ ] **Step 1: Build for production**

```bash
node build.js --dist
```

Expected: dist/ contains all brand HTML + API JSON

- [ ] **Step 2: Deploy via pagecast**

```bash
npx pagecast pages deploy dist/ --project demo-generator --branch main --json
```

Expected: `{"ok":true, "url":"https://demo-generator.pages.dev"}`

- [ ] **Step 3: Verify health endpoint**

```bash
curl -s https://demo-generator.pages.dev/api/health
```

Expected: `{"status":"ok","version":"1.0.0","mode":"static"}`

### Task 5.2: Verify static API endpoints

- [ ] **Step 1: Test brands endpoint**

```bash
curl -s https://demo-generator.pages.dev/api/brands.json
```

Expected: JSON array with 3 brands

- [ ] **Step 2: Test journeys endpoint**

```bash
curl -s https://demo-generator.pages.dev/api/journeys.json
```

Expected: JSON object with brand IDs as keys, journey arrays as values

### Task 5.3: Test brand demos

- [ ] **Step 1: Verify JK Cement hub**

Open in browser: `https://demo-generator.pages.dev/dist/jk_cement/index.html`

Expected: Hub page with 6 journey cards

- [ ] **Step 2: Verify Haldirams hub**

Open in browser: `https://demo-generator.pages.dev/dist/haldirams/index.html`

Expected: Hub page with 6 journey cards

- [ ] **Step 3: Verify Sundaram Store hub**

Open in browser: `https://demo-generator.pages.dev/dist/sundaram_store/index.html`

Expected: Hub page with 6 journey cards

### Task 5.4: Test share flow

- [ ] **Step 1: Generate a share link via the wizard**

Open `https://demo-generator.pages.dev/public/preview.html`, generate a demo, click Share.

Expected: Share link created pointing to Cloudflare Pages

- [ ] **Step 2: Open share link in new tab**

Expected: Demo renders correctly via Blob URL iframe

### Task 5.5: Update README

- [ ] **Step 1: Update README.md deployment section**

Replace Vercel commands with Cloudflare Pages commands:

```markdown
## Production

Deployed at `https://demo-generator.pages.dev` (Cloudflare Pages).

### Deployment Commands

```bash
# Build for production
npm run build:dist

# Deploy to Cloudflare Pages
npx pagecast pages deploy dist/ --project demo-generator --branch main --json

# Preview locally with Workers
npm run preview:cf
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update deployment docs for Cloudflare Pages"
```

---

## Phase 6: Cleanup

### Task 6.1: Remove Vercel config

- [ ] **Step 1: Verify no Vercel references remain**

```bash
grep -rn 'vercel' . --include='*.js' --include='*.json' --include='*.md' | grep -v node_modules | grep -v '.git' | grep -v ISSUES
```

Expected: Only references in ISSUES_AND_RESOLUTIONS.md (historical) and share-store.js (fallback)

- [ ] **Step 2: Remove vercel.json**

```bash
rm vercel.json
```

- [ ] **Step 3: Remove @vercel/blob dependency (optional, keep as fallback for now)**

Leave for a few weeks in case you need to roll back.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove Vercel config — fully migrated to Cloudflare Pages"
```

---

## Dependency Graph

```
Phase 1 (CF setup) ──→ Phase 2 (Workers) ──→ Phase 3 (KV storage)
                              │
                              └──→ Phase 5 (deploy & verify)
                                        │
Phase 4 (build config) ────────────────┤
                                        │
                                        └──→ Phase 6 (cleanup)
```

Phase 1 must go first (create project + KV namespace).
Phase 2 and 4 can run in parallel.
Phase 3 depends on Phase 1 (needs KV binding).
Phase 5 depends on Phases 2, 3, 4.
Phase 6 is last — after verification.

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|-------------|
| Phase 1: CF Setup | 30 min | None |
| Phase 2: Workers | 2-3 hours | Phase 1 |
| Phase 3: KV Storage | 1 hour | Phase 1 |
| Phase 4: Build Config | 30 min | None |
| Phase 5: Deploy & Verify | 1-2 hours | Phases 2, 3, 4 |
| Phase 6: Cleanup | 15 min | Phase 5 |
| **Total** | **~5-6 hours** | |

## Success Criteria

1. All API endpoints respond correctly on Cloudflare Pages
2. Share links work (create + retrieve via KV)
3. All 3 brands render correctly from Cloudflare Pages
4. Build pipeline unchanged (build.js still works)
5. No Vercel dependencies at runtime
6. Tests still pass
7. pagecast deploy command works reliably
