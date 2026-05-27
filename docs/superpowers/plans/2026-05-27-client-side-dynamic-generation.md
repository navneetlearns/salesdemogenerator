# Client-Side Dynamic Demo Generation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable any visitor to the Vercel-deployed demo generator to upload brand assets and instantly preview a tailored WhatsApp Commerce journey demo in the browser - no server state, no API calls for generation.

**Architecture:** All rendering happens client-side. A build-time script packs 73 Handlebars partials + 6 journey templates + helper logic + default data into a single JSON manifest. The browser loads this manifest, registers partials, and renders with user-provided brand data (logo, colors, products, journey type) in an iframe.

**Tech Stack:** Handlebars (client-side runtime), vanilla JS (no framework), CSS custom properties for brand colors, FileReader API for image uploads, Blob API for HTML download.

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `scripts/build-template-pack.js` | Build script: reads partials, layouts, journey JSONs, helpers, CSS, JS and writes `public/template-pack.json` |
| `public/js/demo-renderer.js` | Client-side: fetches template pack, registers partials/helpers, assembles context, renders via Handlebars |
| `public/js/demo-ui.js` | Client-side: 3-step wizard UI, image upload handling, form data collection |
| `public/js/handlebars.min.js` | Handlebars runtime |

### Modified Files

| File | Change |
|---|---|
| `vercel-build.sh` | Add template pack build step |
| `vercel.json` | Remove runtime API functions |
| `package.json` | Add build:pack script |
| `public/index.html` | Add wizard section HTML |
| `public/style.css` | Add wizard styles |
| `public/app.js` | Add wizard init |

---

## Task 1: Build Template Pack Script

**Files:** Create `scripts/build-template-pack.js`, modify `package.json`, modify `vercel-build.sh`

Steps:
- [ ] Create build-template-pack.js that packs all partials, journey templates, layouts, industries, default journey data, default brand, default catalog, scripts, and helpers into public/template-pack.json
- [ ] Add "build:pack" script to package.json
- [ ] Add `node scripts/build-template-pack.js` to vercel-build.sh after dist copy
- [ ] Run the script and verify output
- [ ] Commit

---

## Task 2: Client-Side Demo Renderer

**Files:** Create `public/js/demo-renderer.js`, create `public/js/handlebars.min.js`

Steps:
- [ ] Create demo-renderer.js with loadPack(), render(userInput), downloadHtml(), placeholder generators
- [ ] Download Handlebars runtime to public/js/handlebars.min.js
- [ ] Test loadPack() returns 73 partials and 6 journeys
- [ ] Commit

---

## Task 3: Wizard UI

**Files:** Create `public/js/demo-ui.js`, modify `public/index.html`, `public/style.css`, `public/app.js`

Steps:
- [ ] Add wizard section HTML to index.html (3-step form, journey cards, iframe preview)
- [ ] Add wizard CSS to style.css
- [ ] Create demo-ui.js with init(), step navigation, logo upload, product rows, journey cards, generate, open in new tab, download
- [ ] Update app.js init() to wire up wizard
- [ ] Full flow test: brand name, colors, logo, products, journey selection, generate
- [ ] Commit

---

## Task 4: Update Vercel Configuration

**Files:** Modify `vercel.json`

Steps:
- [ ] Remove runtime API functions from vercel.json (keep health, brands, journeys only)
- [ ] Verify build locally
- [ ] Commit

---

## Task 5: End-to-End Testing & Deployment

Steps:
- [ ] Full local build + template pack generation
- [ ] Local browser test (all wizard interactions, generation, preview)
- [ ] Deploy to Vercel
- [ ] Final commit and push
