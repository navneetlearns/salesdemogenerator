#!/usr/bin/env node
/**
 * journey-builder-mcp — MCP server for building ZoTok WhatsApp mock demo journeys.
 *
 * Tools exposed:
 *   scaffold_project  — create project dir + docs from a brand pack
 *   build_journey     — clone base journey + brand-swap + write content
 *   verify_journey    — run structure/render/compliance checks
 *   serve_journey     — serve a journey dir on a local port for browser preview
 *
 * Protocol: MCP 2024-11-05 (StdioServerTransport)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename, dirname, extname, sep } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { randomUUID } from 'crypto';

// ── paths ───────────────────────────────────────────────────────────────────
// Resolve relative to the package root, not a hardcoded home dir
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..');

// Shared assets live in sibling repo — no duplication
const SKILL_ROOT   = join(PACKAGE_ROOT, '..', 'whatsapp-mock-generator', 'skill');
const BASE_DIR     = join(SKILL_ROOT, 'base-journey');
const BRAND_SWAP   = join(SKILL_ROOT, 'scripts', 'brand_swap.py');
const VERIFY       = join(SKILL_ROOT, 'scripts', 'verify_journey.py');

// Industry content profiles — single source of truth with the demo-generator
// (repo-root data/industries/*.json). Shapes the new company's content:
// recipient label, units, currency, product categories.
const INDUSTRY_DIR = join(PACKAGE_ROOT, '..', 'data', 'industries');

// ── helpers ──────────────────────────────────────────────────────────────────

// ── preview registry + static file serving ────────────────────────────────────
// serve_journey + list_bases register projects here; /preview/<id>/ serves them
// with NO auth (browsers/webviews can't send Authorization headers). Only
// registered project dirs are reachable; path traversal is rejected.
const previewRoots = new Map(); // id -> absolute project dir
const previewIdOf  = new Map(); // absolute project dir -> id

function registerPreview(projectDir, preferredId) {
  const abs = resolve(projectDir);
  const existing = previewIdOf.get(abs);
  if (existing) return existing;
  const baseId = preferredId || slugify(basename(abs)) || 'project';
  let id = baseId, n = 2;
  while (previewRoots.has(id)) id = `${baseId}_${n++}`;
  previewRoots.set(id, abs);
  previewIdOf.set(abs, id);
  return id;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.md':   'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

function servePreviewFile(req, res) {
  const urlPath = decodeURIComponent((req.url || '').split('?')[0]);
  const m = urlPath.match(/^\/preview\/([^/]+)(\/.*)?$/);
  if (!m) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Bad preview path'); return; }
  const root = previewRoots.get(m[1]);
  if (!root) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Preview project not found'); return; }
  const rel = (m[2] || '/').replace(/^\/+/, '');
  const target = resolve(root, rel);
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Forbidden'); return;
  }
  let finalPath = target;
  try {
    if (existsSync(finalPath) && statSync(finalPath).isDirectory()) finalPath = join(finalPath, 'index.html');
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
  if (!existsSync(finalPath)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
  const ext = extname(finalPath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(finalPath));
}

// ── project / template discovery ──────────────────────────────────────────────
function projectBrand(projDir) {
  const idFile = join(projDir, 'BRAND_IDENTITY.md');
  if (existsSync(idFile)) {
    const m = readFileSync(idFile, 'utf-8').match(/Brand Name:\s*(.+)/);
    if (m) return m[1].trim();
  }
  return basename(projDir);
}

function journeysIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.html') && !/^index\.html$/i.test(f) && !/_index\.html$/i.test(f))
    .map(f => f.replace(/^journey_/, '').replace(/\.html$/, ''))
    .sort();
}

function scanProjects() {
  const found = [];
  const seen = new Set();

  // canonical base (whatsapp-mock-generator/skill/base-journey)
  if (existsSync(BASE_DIR)) {
    registerPreview(BASE_DIR, 'base');
    found.push({ id: 'base', name: 'Base journey (canonical)', path: BASE_DIR, journeys: journeysIn(BASE_DIR), source: 'base' });
    seen.add(resolve(BASE_DIR));
  }

  // workspace scaffolded projects: <workspace>/<slug>/projects/<slug>/
  if (existsSync(workspaceDir)) {
    for (const slug of readdirSync(workspaceDir)) {
      const proj = join(workspaceDir, slug, 'projects', slug);
      if (!existsSync(proj) || !seen.add(resolve(proj))) continue;
      const j = journeysIn(proj);
      if (j.length) found.push({ id: registerPreview(proj), name: projectBrand(proj), path: proj, journeys: j, source: 'workspace' });
    }
  }

  // template roots (JOURNEY_TEMPLATE_ROOTS): the root itself, its direct
  // subdirs, and <sub>/projects/<brand> dirs (HindustanRMC-style nesting)
  for (const root of TEMPLATE_ROOTS) {
    if (!existsSync(root)) continue;
    const dirs = [root];
    for (const sub of readdirSync(root)) {
      const p = join(root, sub);
      if (!statSync(p).isDirectory()) continue;
      if (sub === 'projects') {
        // root/projects/<brand>/ pattern (HindustanRMC-style)
        for (const b of readdirSync(p)) dirs.push(join(p, b));
      } else {
        dirs.push(p);
        const pp = join(p, 'projects');
        if (existsSync(pp)) for (const b of readdirSync(pp)) dirs.push(join(pp, b));
      }
    }
    for (const d of dirs) {
      if (!seen.add(resolve(d))) continue;
      const j = journeysIn(d);
      if (j.length) found.push({ id: registerPreview(d), name: projectBrand(d), path: d, journeys: j, source: 'template' });
    }
  }
  // user directive (2026-08-09): certain brands are NOT part of the template
  // library even though they exist on disk (Rakesh/Haldirams, Sakku Group,
  // demo-generator/HindustanRMC) — list_bases must not list them
  const EXCLUDED_BRANDS = ['haldiram', 'sakku', 'hindustanrmc'];
  const isExcludedBrand = (p) => {
    const n = basename(p).toLowerCase().replace(/[\s_]/g, '');
    return EXCLUDED_BRANDS.some((x) => n.includes(x));
  };
  return found.filter((p) => !isExcludedBrand(p.path));
}

// spawnSync (NO shell) — execSync+join mangles any arg containing spaces:
// `--forbid ["Banas Dairy"]` gets shell-split, json.loads then explodes. This
// was the root cause of the meditech session's verify_journey failures.
function runPy(script, args = [], timeoutSec = 60) {
  try {
    const out = spawnSync('python3', [script, ...args], {
      encoding: 'utf-8',
      timeout: timeoutSec * 1000,
      cwd: process.env.WORKSPACE_DIR || workspaceDir,
    });
    const ok = out.status === 0;
    return { ok, stdout: out.stdout || '', stderr: out.stderr || '' };
  } catch (e) {
    return { ok: false, stdout: '', stderr: e.message };
  }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── tool handlers ─────────────────────────────────────────────────────────────

function downloadAsset(url, destPath, label) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) })
    .then(async (res) => {
      if (!res.ok) return { ok: false, error: `${label}: HTTP ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(destPath, buf);
      return { ok: true, bytes: buf.length, path: destPath };
    })
    .catch((e) => ({ ok: false, error: `${label}: ${e.message}` }));
}

function safeExt(name, fallback) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.split('?')[0].split('#')[0]);
  return m ? `.${m[1].toLowerCase()}` : fallback;
}

function safeArgs(args = {}) {
  const a = { ...args };
  if (a.logoBase64) a.logoBase64 = `<base64 ${Math.round((a.logoBase64.length * 3) / 4)}B>`;
  if (a.productImages) a.productImages = `[${a.productImages.length} urls]`;
  if (a.productImagePaths) a.productImagePaths = `[${a.productImagePaths.length} paths]`;
  if (a.steps) a.steps = `${a.steps.length} steps`;
  const s = JSON.stringify(a);
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
}

// ── path portability: Windows <-> WSL translation, auto-discovered ──────────
// No hardcoded drive letters. The F: -> /mnt/f mapping comes from /proc/mounts
// (drvfs entries), so this adapts to ANY WSL machine. Non-WSL hosts (native
// Linux / Mac) get POSIX paths passed through untouched.
let WINDOWS_MOUNTS = {}; // drive letter (lowercase) -> mount point
try {
  const mounts = readFileSync('/proc/mounts', 'utf-8').split('\n');
  for (const line of mounts) {
    const m = /^([A-Za-z]):\s+(\S+)\s+drvfs\s/.exec(line);
    if (m) WINDOWS_MOUNTS[m[1].toLowerCase()] = m[2];
  }
} catch { /* not WSL — POSIX only */ }

function toServerPath(p) {
  if (!p) return p;
  const norm = p.replace(/\\/g, '/');
  // Windows drive path: F:\foo\bar -> /mnt/f/foo/bar
  let m = /^([A-Za-z]):\/(.*)$/.exec(norm);
  if (m) {
    const drive = m[1].toLowerCase();
    const root = WINDOWS_MOUNTS[drive] || `/mnt/${drive}`;
    return m[2] ? `${root}/${m[2]}` : root;
  }
  // WSL UNC from Windows: \\wsl$\Ubuntu\home\... -> /home/...
  m = /^\/\/wsl(?:\$|\.localhost)\/[^/]+(\/.*)$/i.exec(norm);
  if (m) return m[1];
  // already POSIX
  return norm;
}

function toWindowsPath(p) {
  const m = /^\/mnt\/([a-z])\/(.*)$/.exec(p);
  if (m) return `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}`;
  return p; // POSIX (native Linux/Mac) — client file tools handle it directly
}

function existsAsPath(p) {
  try { return existsSync(toServerPath(p)); } catch { return false; }
}

// Staging root for the content-adaptation workflow. ENV-GATED: unset on other
// machines = no staging (clients whose file tools reach the workspace edit in
// place). Set here in the systemd env file to a Windows-visible location.
const STAGING_DIR = process.env.EDIT_STAGING_DIR || '';

const CONTENT_CHECKLIST = [
  'CONTENT ADAPTATION — rewrite EVERY content-bearing text for the NEW company:',
  ' 1. Every message (.msg-body) in every phone frame — real conversations for this',
  '    industry (products, prices, refs, GST, terms). Keep sender/receiver as-is.',
  ' 2. Every .screen-desc (why-caption under each screen) — one-line insight.',
  ' 3. Every .screen-lbl — new screen names for this flow.',
  ' 4. Sidebar .step-lbl entries + the const steps array titles/descs.',
  ' 5. .wa-contact-name (topbar) — the NEW brand name.',
  ' 6. Numbers, refs, timestamps — realistic, clock continuity (09:12 -> 09:16),',
  '    date pills between chapters, refs like ORD-2026-1042.',
  ' 7. Keep the shell: section count, phone frames, layout, screen types.',
  ' 8. ZERO references to the source company (name, logo file) anywhere.',
  ' 9. Save as UTF-8 WITHOUT BOM (PowerShell Set-Content adds a BOM — breaks the',
  '    A1 doctype-at-byte-0 check). Use UTF8NoBOM or write from an editor.',
  '10. When done: call finalize_journey to sync back + auto-verify (leak guard on).',
].join('\n');

const tools = {

  /** Create project dir + brand-identity.md + journey-analysis.md from brand pack */
  scaffold_project: {
    description: 'Create a new mock-journey project directory with brand docs',
    inputSchema: {
      type: 'object',
      required: ['brandName', 'slug'],
      properties: {
        brandName:       { type: 'string', description: 'Full brand/company name' },
        slug:            { type: 'string', description: 'Folder-safe identifier (e.g. acme_cements)' },
        industry:       { type: 'string', description: 'e.g. FMCG, construction, automotive' },
        brandColor:      { type: 'string', description: 'Primary brand hex colour (e.g. #1E3A8A)' },
        accentColor:     { type: 'string', description: 'CTA/highlight hex colour' },
        logoPath:        { type: 'string', description: 'Absolute path to brand logo PNG (optional)' },
        avatarInitials:  { type: 'string', description: '1-4 char initials when no logo (e.g. AC)' },
        tagline:         { type: 'string', description: 'Brand positioning tagline' },
        whatsappBizName: { type: 'string', description: 'Name shown in WhatsApp chat header' },
        projectDir:      { type: 'string', description: 'Output dir override (default: <workspace>/<slug>)' },
      },
    },
    handler: async ({ brandName, slug, industry, brandColor, accentColor, logoPath,
                      avatarInitials, tagline, whatsappBizName, projectDir }) => {
      const outDir = resolve(projectDir || join(process.env.WORKSPACE_DIR || workspaceDir, slug));
      const projDir = join(outDir, 'projects', slug);
      mkdirSync(join(projDir, 'references'), { recursive: true });
      mkdirSync(join(projDir, 'assets', 'brand'), { recursive: true });
      mkdirSync(join(projDir, 'screenshots'), { recursive: true });

      const brandColorVal  = brandColor  || '#2563EB';
      const accentColorVal = accentColor || '#F59E0B';

      const identity = [
        `# Brand Identity — ${brandName}`,
        '',
        '```',
        `Brand Name:       ${brandName}`,
        `Industry:         ${industry || 'TBD'}`,
        `Brand Color:      ${brandColorVal}`,
        `Accent Color:     ${accentColorVal}`,
        `Logo:             ${logoPath || 'not provided'}`,
        `Avatar Initials:  ${avatarInitials || 'TBD'}`,
        `Positioning:      ${tagline || 'TBD'}`,
        `WhatsApp Biz:     ${whatsappBizName || brandName}`,
        '```',
      ].join('\n');

      const analysis = [
        `# Journey Analysis — ${brandName}`,
        '',
        '## Journey Spec (fill in before build)',
        '',
        '```',
        'Step 1: <what triggers the journey>',
        '  - Perspective: buyer | seller | both | admin',
        '  - Screen: full | group | webview | chat-only | notification | admin-dashboard | diagram',
        '  - Screens: 1 | 2 | 3',
        '',
        'Step 2: ...',
        '```',
        '',
        '## Base Project',
        '',
        `Default: HindustanRMC pair (${BASE_DIR})`,
        'Single-journey variant: Haldirams journey_retailer_activation.html',
        '',
        '## Output Convention',
        '',
        `  projects/${slug}/index.html              — landing page`,
        `  projects/${slug}/journey_<name>.html     — journey (multi-step) page`,
        `  projects/${slug}/screenshots/            — verification screenshots`,
      ].join('\n');

      writeFileSync(join(projDir, 'BRAND_IDENTITY.md'), identity);
      writeFileSync(join(projDir, 'JOURNEY_ANALYSIS.md'), analysis);
      writeFileSync(join(projDir, 'README.md'),
        `# ${brandName} — WhatsApp Demo Journey\n\nProject dir: \`${projDir}`);

      if (logoPath && existsSync(logoPath)) {
        cpSync(logoPath, join(projDir, 'assets', 'brand', basename(logoPath)));
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            projectDir: projDir,
            files: {
              'BRAND_IDENTITY.md': identity,
              'JOURNEY_ANALYSIS.md': analysis,
            },
          }, null, 2),
        }],
      };
    },
  },

  /**
   * Clone the base journey HTML, apply brand swap, and write per-step content.
   * Step content is an array of { step, screenType, perspective, messages, caption }.
   */
  build_journey: {
    description: 'Build a NEW journey by cloning an EXISTING project (sourceProject + sourceJourney from list_bases) and brand-swapping it. ALWAYS pass sourceProject and sourceJourney — building without a source produces a generic placeholder, never do that. Use sourceProject="base" only when no existing project matches.',
    inputSchema: {
      type: 'object',
      required: ['brandName', 'slug', 'journeyName', 'sourceProject'],
      properties: {
        brandName:       { type: 'string' },
        slug:            { type: 'string' },
        journeyName:     { type: 'string', description: 'Journey type slug (e.g. contract, order_to_cash)' },
        brandColor:      { type: 'string' },
        accentColor:     { type: 'string' },
        logoBase64:      { type: 'string', description: 'Base64 PNG for logo embed (optional)' },
        avatarInitials:  { type: 'string' },
        journeyLabel: { type: 'string', description: 'Label shown on journey page (e.g. "Rate Contract")' },
        sourceProject: { type: 'string', description: 'REQUIRED. Project id from list_bases (e.g. v_n_fogg, banas_diary). The new journey is cloned from this existing project. Use "base" only when no existing project matches.' },
        sourceJourney: { type: 'string', description: 'REQUIRED (unless sourceProject="base"). Journey name within sourceProject, e.g. vini_order_to_cash. Pick from the project\'s journeys in list_bases.' },
        industry: { type: 'string', description: 'Industry id from list_industries (e.g. building_materials, footwear, general). Content profile for the NEW company: recipient label, units, currency, product categories. Defaults to general.' },
        website: { type: 'string', description: 'New company\'s website URL — stored in the brand manifest for content/CTAs.' },
        logoUrl: { type: 'string', description: 'URL of the NEW company logo — downloaded, saved once in assets/brand/, embedded via the .ava-logo rule. Alternative to logoPath/logoBase64.' },
        logoPath: { type: 'string', description: 'LOCAL path to the NEW company logo (Windows e.g. D:\\Sales\\Acme\\logo.png or WSL /path) — read from disk, saved to assets/brand/. This is the "user selects the stored asset location" intake. Alternative to logoUrl/logoBase64.' },
        productImages: { type: 'array', items: { type: 'string' }, description: 'URLs of NEW company product images (1-3) — downloaded to assets/products/ for use in step content.' },
        productImagePaths: { type: 'array', items: { type: 'string' }, description: 'LOCAL paths of NEW company product images (Windows or WSL paths) — read from disk, copied to assets/products/. The "user selects the stored assets folder" intake.' },
        tagline: { type: 'string', description: 'Positioning/tagline for the new company (optional)' },
        steps: {
          type: 'array',
          description: 'Array of step objects — see SKILL.md intake spec',
          items: {
            type: 'object',
            required: ['step', 'screenType', 'perspective', 'messages', 'caption'],
            properties: {
              step:        { type: 'number' },
              screenType:  { type: 'string' },
              perspective: { type: 'string' },
              messages:    { type: 'array', items: { type: 'string' } },
              caption:     { type: 'string', description: 'One-line business insight shown below the screen' },
            },
          },
        },
        projectDir:      { type: 'string' },
      },
    },
    handler: async ({
      brandName, slug, journeyName, brandColor, accentColor,
      logoBase64, avatarInitials, journeyLabel, steps, projectDir,
      sourceProject, sourceJourney, industry, website, logoUrl, logoPath,
      productImages, productImagePaths, tagline,
    }) => {
      if (!sourceProject) {
        return { content: [{ type: 'text', text: 'ERROR: build_journey requires sourceProject. Run list_bases, pick an existing project id, and pass it with sourceProject + sourceJourney. Building without a source produces a generic placeholder — never do that. (Explicit escape hatch: sourceProject="base" only when no existing project matches.)' }], isError: true };
      }
      if (sourceProject !== 'base' && !sourceJourney) {
        const src = scanProjects().find(p => p.id === sourceProject || resolve(p.path) === resolve(sourceProject) || p.path === sourceProject);
        const journeys = src ? src.journeys.join(', ') : '(run list_bases to see available projects)';
        return { content: [{ type: 'text', text: `ERROR: sourceJourney is required when building from an existing project. Journeys available in ${sourceProject}: ${journeys}` }], isError: true };
      }
      const outDir  = resolve(projectDir || join(process.env.WORKSPACE_DIR || workspaceDir, slug));
      const projDir = join(outDir, 'projects', slug);
      const indexPath = join(projDir, 'index.html');
      const journeyPath = join(projDir, `journey_${journeyName}.html`);
      const assetsDir = join(projDir, 'assets', 'brand');
      mkdirSync(assetsDir, { recursive: true });

      // NEW COMPANY brand pack: industry profile + logo + product images + website
      const industryId = industry || 'general';
      let industryProfile = null;
      const industryFile = join(INDUSTRY_DIR, `${industryId}.json`);
      if (existsSync(industryFile)) {
        try { industryProfile = JSON.parse(readFileSync(industryFile, 'utf-8')); } catch { industryProfile = null; }
      }
      if (!industryProfile) {
        industryProfile = {
          id: industryId, label: industryId,
          partnerLabel: 'Partner', unit: 'unit', unitPlural: 'units',
          currency: 'INR', currencySymbol: '₹', categoryTabs: ['All'],
        };
      }

      let logoFile = null;
      let logoSource = null;
      if (logoUrl) {
        const dest = join(assetsDir, `logo${safeExt(logoUrl, '.png')}`);
        const dl = await downloadAsset(logoUrl, dest, 'logo');
        if (!dl.ok) return { content: [{ type: 'text', text: `ERROR: logo download failed — ${dl.error}. Pass a valid logoUrl (or logoPath / logoBase64).` }], isError: true };
        logoFile = dest; logoSource = logoUrl;
      } else if (logoPath) {
        const src = toServerPath(logoPath);
        if (!existsSync(src)) {
          return { content: [{ type: 'text', text: `ERROR: logo file not found at ${src} (from ${logoPath}). Give a Windows path (D:\\...), a WSL path (/...), a URL, or base64.` }], isError: true };
        }
        const dest = join(assetsDir, `logo${safeExt(src, '.png')}`);
        mkdirSync(assetsDir, { recursive: true });
        cpSync(src, dest);
        logoFile = dest; logoSource = logoPath;
      } else if (logoBase64) {
        try {
          logoFile = join(assetsDir, 'logo.png');
          writeFileSync(logoFile, Buffer.from(logoBase64, 'base64'));
          logoSource = 'base64';
        } catch { logoFile = null; }
      }

      const savedProducts = [];
      const productDir = join(projDir, 'assets', 'products');
      let prodSeq = 0;
      const saveProduct = (dest, srcLabel, extra) => {
        savedProducts.push({ index: ++prodSeq, path: dest, ...extra, source: srcLabel });
      };
      if (Array.isArray(productImages) && productImages.length) {
        mkdirSync(productDir, { recursive: true });
        for (const url of productImages) {
          const dest = join(productDir, `${slug}-${String(prodSeq + 1).padStart(2, '0')}${safeExt(url, '.jpg')}`);
          const dl = await downloadAsset(url, dest, `product image ${prodSeq + 1}`);
          if (dl.ok) saveProduct(dest, `url:${url.slice(0, 80)}`, { bytes: dl.bytes });
          else savedProducts.push({ index: ++prodSeq, url, error: dl.error, source: 'url' });
        }
      }
      if (Array.isArray(productImagePaths) && productImagePaths.length) {
        mkdirSync(productDir, { recursive: true });
        for (const p of productImagePaths) {
          const src = toServerPath(p);
          if (!existsSync(src)) {
            savedProducts.push({ index: ++prodSeq, path: p, error: `not found (server path: ${src})`, source: 'path' });
            continue;
          }
          const dest = join(productDir, `${slug}-${String(prodSeq + 1).padStart(2, '0')}${safeExt(src, '.jpg')}`);
          cpSync(src, dest);
          saveProduct(dest, `path:${p}`, { bytes: statSync(src).size });
        }
      }

      // 1. resolve template source: an existing project (from list_bases) or the canonical base
      let srcDir = BASE_DIR;
      let srcJourneyName = sourceJourney;
      if (sourceProject) {
        const abs = resolve(sourceProject);
        const found = scanProjects().find(p => p.id === sourceProject || resolve(p.path) === abs || p.path === abs);
        if (!found) {
          return { content: [{ type: 'text', text: `ERROR: source project not found: ${sourceProject}. Run list_bases to see available projects.` }], isError: true };
        }
        srcDir = found.path;
        if (!srcJourneyName) srcJourneyName = found.journeys[0];
      }
      if (!existsSync(srcDir)) {
        return { content: [{ type: 'text', text: `ERROR: template source not found at ${srcDir}` }], isError: true };
      }
      const srcJourneyFile = srcJourneyName
        ? [join(srcDir, `journey_${srcJourneyName}.html`), join(srcDir, `${srcJourneyName}.html`)].find(f => existsSync(f))
        : (existsSync(join(srcDir, 'journey_contract.html')) ? join(srcDir, 'journey_contract.html') : null);
      if (!srcJourneyFile || !existsSync(srcJourneyFile)) {
        return { content: [{ type: 'text', text: `ERROR: no journey file found in ${srcDir}${srcJourneyName ? ` (journey_${srcJourneyName}.html)` : ''}. Run list_bases.` }], isError: true };
      }
      // copy the project's index page (index.html, or brand-prefixed variant like awl_index.html)
      const srcIndex = [join(srcDir, 'index.html'), ...readdirSync(srcDir)
        .filter(f => /index\.html$/i.test(f) && !/^index\.html$/i.test(f))
        .map(f => join(srcDir, f))]
        .find(f => existsSync(f));
      if (srcIndex) cpSync(srcIndex, indexPath);
      cpSync(srcJourneyFile, journeyPath);

      // copy the source project's assets + root-level logo files so the cloned
      // HTML's <img src="..."> refs resolve (they were ERR_FILE_NOT_FOUND before)
      const srcAssets = join(srcDir, 'assets');
      if (existsSync(srcAssets)) {
        mkdirSync(join(projDir, 'assets'), { recursive: true });
        cpSync(srcAssets, join(projDir, 'assets'), { recursive: true });
      }
      mkdirSync(assetsDir, { recursive: true });
      for (const f of readdirSync(srcDir)) {
        if (/logo.*\.(png|jpe?g|webp|gif)$/i.test(f) && statSync(join(srcDir, f)).isFile()) {
          cpSync(join(srcDir, f), join(assetsDir, f));
        }
      }

      // logo reference repair: cloned HTML references the SOURCE logo by name.
      // New logo provided -> point every *logo* <img> ref at the new file.
      // No new logo -> prefix refs with assets/brand/ so the copied source logo
      // resolves (avoids broken-image leaks).
      if (logoFile || readdirSync(srcDir).some((f) => /logo.*\.(png|jpe?g|webp|gif)$/i.test(f))) {
        const target = logoFile ? `assets/brand/${basename(logoFile)}` : null;
        const fixRefs = (file) => {
          let html = readFileSync(file, 'utf-8');
          html = html.replace(
            /src="(?!(?:https?:|data:))([^"]*?logo[^"]*\.(?:png|jpe?g|webp|gif))"/gi,
            (m, name) => `src="${target || `assets/brand/${name.split('/').pop()}`}"`
          );
          writeFileSync(file, html, 'utf-8');
        };
        fixRefs(journeyPath);
        fixRefs(indexPath);
      }

      // 2. build brand manifest
      const manifest = {
        brandColor: brandColor || '#2563EB',
        brandDark:   brandColor || '#1E3A8A',
        accent:      accentColor || '#F59E0B',
        avatarInitials: avatarInitials || brandName.slice(0, 2).toUpperCase(),
        title:       brandName,
        journeyLabel: journeyLabel || journeyName,
        indexBrandName: brandName,
        indexCardTitle: journeyLabel || journeyName,
        website:     website || null,
        tagline:     tagline || null,
        industry: {
          id: industryProfile.id,
          label: industryProfile.label,
          partnerLabel: industryProfile.partnerLabel,
          unit: industryProfile.unit,
          unitPlural: industryProfile.unitPlural,
          currency: industryProfile.currency,
          currencySymbol: industryProfile.currencySymbol,
          categoryTabs: industryProfile.categoryTabs || ['All'],
        },
        products: savedProducts,
        logo: logoFile ? { file: basename(logoFile), source: logoSource } : null,
      };

      const manifestPath = join(assetsDir, 'brand.json');
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      // 3. brand swap (dry-run first) — logo embedded via --logo when provided
      const swapArgs = (dry) => [
        '--manifest', manifestPath,
        '--journey', journeyPath,
        '--index', indexPath,
        ...(logoFile ? ['--logo', logoFile] : []),
        ...(dry ? ['--dry-run'] : []),
      ];
      const dry = runPy(BRAND_SWAP, swapArgs(true));
      if (!dry.ok && !dry.stdout.includes('UNCHANGED')) {
        return { content: [{ type: 'text', text: `brand_swap dry-run failed:\n${dry.stderr}` }], isError: true };
      }

      const wet = runPy(BRAND_SWAP, swapArgs(false));
      if (!wet.ok) {
        return { content: [{ type: 'text', text: `brand_swap failed:\n${wet.stderr}` }], isError: true };
      }

      // 4. content rewrite — read the cloned journey, inject step content
      // This is a structural stub; full content rewrite requires per-step HTML authoring
      // which the MCP client drives via the steps array + skill reference
      let journeyHtml = readFileSync(journeyPath, 'utf-8');
      let indexHtml   = readFileSync(indexPath, 'utf-8');

      // Quick structural updates (real content still needs the skill workflow)
      // Replace journey label
      journeyHtml = journeyHtml.replace(
        /class="journey-lbl"[^<]*<[^<]*<[^<]*>/,
        `class="journey-lbl"><span>${journeyLabel || journeyName}</span></div>`
      );
      writeFileSync(journeyPath, journeyHtml, 'utf-8');
      writeFileSync(indexPath, indexHtml, 'utf-8');

      // content-adaptation metadata — consumed by verify_journey (auto leak
      // guard: forbid source display brand + logo names) and finalize_journey
      // (expectedSteps). Written once at build time.
      const stepCount = (readFileSync(journeyPath, 'utf-8').match(/class="step-section/g) || []).length;
      const srcLogoFiles = readdirSync(srcDir)
        .filter((f) => /logo.*\.(png|jpe?g|webp|gif)$/i.test(f) && statSync(join(srcDir, f)).isFile());
      // the source's actual display brand (e.g. "Banas Dairy" — the folder name
      // "Banas_Diary" would NOT catch the text in the HTML). Used as the leak
      // guard token.
      const srcHtml = readFileSync(srcJourneyFile, 'utf-8');
      const contactM = srcHtml.match(/class="wa-contact-name">\s*([^<]+)</);
      const brandM = srcHtml.match(/class="brand-name">\s*([^<]+)</);
      const titleM = srcHtml.match(/<title>([^<]+)</);
      const sourceDisplayName = (contactM && contactM[1].trim())
        || (brandM && brandM[1].trim())
        || (titleM && titleM[1].trim().replace(/\s*[|–—-].*$/, '').trim())
        || projectBrand(srcDir);
      writeFileSync(join(projDir, '.journey-meta.json'), JSON.stringify({
        sourceProject,
        sourceJourney: srcJourneyName,
        sourceName: projectBrand(srcDir),
        sourceDisplayName,
        sourceLogoFiles: srcLogoFiles,
        expectedSteps: stepCount || null,
        builtAt: new Date().toISOString(),
      }, null, 2));

      const previewId = registerPreview(projDir);
      const previewObj = {
        localUrl: `http://localhost:${PORT}/preview/${previewId}/`,
        publicUrl: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/preview/${previewId}/` : null,
      };
      const usedProject = sourceProject === 'base' ? 'base (canonical)' : sourceProject;
      const usedJourney = srcJourneyName || '(contract)';

      return {
        content: [{
          type: 'text',
          text:
            `PREVIEW: ${previewObj.publicUrl || previewObj.localUrl}\n` +
            `SOURCE: ${usedProject} / ${usedJourney}\n` +
            `INDUSTRY: ${industryProfile.label}\n` +
            `ASSETS: ${logoFile ? 'logo ✓' : 'logo —'} | products ${savedProducts.filter((p) => p.path).length}/${(Array.isArray(productImages) ? productImages.length : 0) + (Array.isArray(productImagePaths) ? productImagePaths.length : 0)} | website ${website ? '✓' : '—'}\n\n` +
            JSON.stringify({
              status: 'built',
              source: { project: usedProject, journey: usedJourney },
              brandPack: {
                industry: industryProfile.label,
                website,
                tagline: tagline || null,
                logo: logoFile ? { file: basename(logoFile), source: logoSource } : null,
                products: savedProducts,
              },
              files: {
                index:    indexPath,
                journey:  journeyPath,
                manifest: manifestPath,
              },
              preview: previewObj,
              brandSwapReport: wet.stdout,
              nextSteps: [
                '1. Open the PREVIEW URL above to verify the shell in a browser',
                '2. Run stage_for_edit — returns a Windows-accessible path + the content-adaptation checklist',
                '3. Rewrite ALL content for the new company in the staged files (per the checklist), then call finalize_journey',
                '4. finalize_journey syncs back + auto-runs verify_journey with the source-leak guard and expected steps',
              ],
            }, null, 2),
        }],
      };
    },
  },

  /** Run verify_journey.py on a journey HTML file */
  verify_journey: {
    description: 'Verify a journey HTML: structure, charset, render, compliance + step screenshots. Pass expectedSteps (the journey\'s step count) and per-step probes; screenshotsDir saves step-NN.png for the human visual pass.',
    inputSchema: {
      type: 'object',
      required: ['journeyPath'],
      properties: {
        journeyPath: { type: 'string', description: 'Absolute path to journey_*.html' },
        probes: {
          type: 'object',
          description: 'JSON object of { "stepN": ["text probe", ...] } — content check per step',
        },
        expectedSteps: { type: 'number', description: 'Expected step count — REQUIRED for the B2 step-count check. Auto-filled from .journey-meta.json when built by build_journey. NOT auto-detected from the page: if omitted and no probes are given, the check expects 1 and fails valid multi-step journeys.' },
        screenshotsDir: { type: 'string', description: 'Directory for step screenshots — the human visual pass (optional)' },
        forbid: { type: 'array', items: { type: 'string' }, description: 'Extra strings that must NOT appear in the journey (merged with the automatic source-brand + source-logo leak guard from .journey-meta.json)' },
      },
    },
    handler: async ({ journeyPath, probes, expectedSteps, screenshotsDir, forbid }) => {
      if (!existsSync(journeyPath)) {
        return { content: [{ type: 'text', text: `ERROR: file not found: ${journeyPath}` }], isError: true };
      }

      // probes hardening — agents often pass JS-style single-quoted literals
      // (invalid JSON). Accept: objects, valid JSON strings, and single-quoted
      // literals (lenient quote swap as a last resort).
      let probesObj = null;
      if (probes != null) {
        if (typeof probes === 'object' && !Array.isArray(probes)) {
          probesObj = probes;
        } else if (typeof probes === 'string') {
          try {
            probesObj = JSON.parse(probes);
          } catch {
            try {
              probesObj = JSON.parse(probes.replace(/'/g, '"'));
            } catch {
              return { content: [{ type: 'text', text: `ERROR: probes must be a JSON object like {"1": ["text probe"]} (or an object argument). Got: ${String(probes).slice(0, 160)}` }], isError: true };
            }
          }
        }
      }

      // auto source-leak guard: .journey-meta.json (written by build_journey)
      // carries the source brand name + logo filenames -> forbid list. Also
      // fills expectedSteps when the agent doesn't pass it.
      const metaPath = join(dirname(journeyPath), '.journey-meta.json');
      const forbidList = Array.isArray(forbid) ? [...forbid] : [];
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          if (meta.sourceDisplayName) forbidList.push(meta.sourceDisplayName);
          else if (meta.sourceName) forbidList.push(meta.sourceName);
          if (Array.isArray(meta.sourceLogoFiles)) forbidList.push(...meta.sourceLogoFiles);
          if (!expectedSteps && meta.expectedSteps) expectedSteps = meta.expectedSteps;
        } catch { /* ignore malformed meta */ }
      }
      const forbidUnique = [...new Set(forbidList.filter((s) => typeof s === 'string' && s))];

      const args = ['verify_journey.py', journeyPath];
      if (probesObj)        args.push('--probes', JSON.stringify(probesObj));
      if (expectedSteps)    args.push('--expected-steps', String(expectedSteps));
      if (screenshotsDir)   args.push('--shots', screenshotsDir);
      if (forbidUnique.length) args.push('--forbid', JSON.stringify(forbidUnique));

      const result = runPy(VERIFY, args.slice(1), 120);
      const stdout  = result.stdout;
      const stderr  = result.stderr;
      const lines   = stdout.split('\n').filter(Boolean);
      const passed  = lines.filter(l => l.includes('[PASS]')).length;
      const failed  = lines.filter(l => l.includes('[FAIL]')).length;
      const isOk    = result.ok && failed === 0;

      return {
        content: [{
          type: 'text',
          text: [
            `## Verification Result: ${isOk ? '✅ PASS' : '❌ FAIL'}`,
            '',
            '```',
            stdout,
            '```',
            stderr ? `**Stderr:**\n\`\`\`\n${stderr}\n\`\`\`` : '',
            '',
            `**Summary:** ${passed} passed, ${failed} failed`,
            '',
            screenshotsDir ? `📸 Screenshots: \`${screenshotsDir}/\`` : '',
          ].filter(Boolean).join('\n'),
        }],
        isError: !isOk,
      };
    },
  },

  /** Copy a built project to a Windows-accessible staging dir for content editing */
  stage_for_edit: {
    description: 'Content-adaptation step 1/2: copy the built project to a Windows-accessible staging dir (when EDIT_STAGING_DIR is set) and return the editable path + the full content checklist. Edit the staged files with your file tools, then call finalize_journey. No staging dir configured = edit in place (client file tools reach the workspace).',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory (from build_journey response)' },
        stagingDir: { type: 'string', description: 'Override the staging root (default: EDIT_STAGING_DIR env)' },
      },
    },
    handler: async ({ projectPath, stagingDir }) => {
      const projDir = resolve(projectPath);
      if (!existsSync(projDir)) {
        return { content: [{ type: 'text', text: `ERROR: project dir not found: ${projDir}` }], isError: true };
      }
      const root = stagingDir ? toServerPath(stagingDir) : (STAGING_DIR ? toServerPath(STAGING_DIR) : '');
      if (!root) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              staging: 'in-place',
              note: 'No staging dir configured (EDIT_STAGING_DIR unset) — your file tools can reach this path directly. Edit in place, then call finalize_journey.',
              projectPath: projDir,
              checklist: CONTENT_CHECKLIST,
            }, null, 2),
          }],
        };
      }
      try {
        mkdirSync(root, { recursive: true });
        const dest = join(root, basename(projDir));
        if (existsSync(dest)) execSync(`rm -rf ${JSON.stringify(dest)}`);
        cpSync(projDir, dest, { recursive: true });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              staging: 'copied',
              note: 'Edit the files under windowsPath with your file tools (Windows side). Do NOT rename files. Save UTF-8 WITHOUT BOM (PowerShell Set-Content adds one — breaks the A1 doctype check). When done, call finalize_journey with the SAME projectPath.',
              projectPath: projDir,
              windowsPath: toWindowsPath(dest),
              wslPath: dest,
              checklist: CONTENT_CHECKLIST,
            }, null, 2),
          }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: `ERROR: staging failed: ${e.message}` }], isError: true };
      }
    },
  },

  /** Sync staged edits back + auto-verify with the leak guard */
  finalize_journey: {
    description: 'Content-adaptation step 2/2: copy edited files back from the staging dir (if used), then AUTO-run verify_journey with expectedSteps + source-brand/source-logo leak guard (from .journey-meta.json). Returns sync report, verify summary, and preview URLs. This is the mandatory gate before showing the journey to the user.',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory (same as passed to stage_for_edit)' },
        stagingDir: { type: 'string', description: 'Override the staging root (must match stage_for_edit)' },
        screenshotsDir: { type: 'string', description: 'Optional: directory for the visual-pass screenshots' },
      },
    },
    handler: async ({ projectPath, stagingDir, screenshotsDir }) => {
      const projDir = resolve(projectPath);
      if (!existsSync(projDir)) {
        return { content: [{ type: 'text', text: `ERROR: project dir not found: ${projDir}` }], isError: true };
      }
      const root = stagingDir ? toServerPath(stagingDir) : (STAGING_DIR ? toServerPath(STAGING_DIR) : '');
      const stagedDir = root ? join(root, basename(projDir)) : null;
      let synced = false;
      let syncNote = 'in-place (no staging dir in use)';
      if (stagedDir && existsSync(stagedDir)) {
        try {
          cpSync(stagedDir, projDir, { recursive: true });
          synced = true;
          const jf = readdirSync(projDir).find((f) => /^journey_.*\.html$/.test(f));
          if (jf) {
            const diff = execSync(`diff -q ${JSON.stringify(join(stagedDir, jf))} ${JSON.stringify(join(projDir, jf))}`).toString();
            syncNote = `staged files copied back ✓ (${diff.includes('differ') ? 'WARNING: journey file differs from staged copy' : 'byte-identical ✓'})`;
          } else {
            syncNote = 'staged files copied back ✓ (no journey_*.html found in project)';
          }
        } catch (e) {
          syncNote = `sync error: ${e.message}`;
        }
      }

      // auto-verify with expectedSteps + leak guard from build metadata
      const metaPath = join(projDir, '.journey-meta.json');
      let exp = null;
      const forbid = [];
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          exp = meta.expectedSteps || null;
          if (meta.sourceDisplayName) forbid.push(meta.sourceDisplayName);
          else if (meta.sourceName) forbid.push(meta.sourceName);
          if (Array.isArray(meta.sourceLogoFiles)) forbid.push(...meta.sourceLogoFiles);
        } catch { /* ignore malformed meta */ }
      }
      const journeyFile = readdirSync(projDir)
        .filter((f) => /^journey_.*\.html$/.test(f))
        .map((f) => join(projDir, f))
        .find((f) => existsSync(f));
      if (!journeyFile) {
        return { content: [{ type: 'text', text: `ERROR: no journey_*.html found in ${projDir}` }], isError: true };
      }

      const args = ['verify_journey.py', journeyFile];
      if (exp) args.push('--expected-steps', String(exp));
      if (forbid.length) args.push('--forbid', JSON.stringify(forbid));
      if (screenshotsDir) args.push('--shots', screenshotsDir);
      const result = runPy(VERIFY, args.slice(1), 180);
      const stdout = result.stdout;
      const stderr = result.stderr;
      const lines = stdout.split('\n').filter(Boolean);
      const passed = lines.filter((l) => l.includes('[PASS]')).length;
      const failed = lines.filter((l) => l.includes('[FAIL]')).length;
      const isOk = result.ok && failed === 0;

      const id = registerPreview(projDir);
      const rel = `/preview/${id}/`;
      return {
        content: [{
          type: 'text',
          text:
            `SYNC: ${syncNote}\n` +
            `VERIFY: ${isOk ? '✅ PASS' : '❌ FAIL'} — ${passed} passed, ${failed} failed\n` +
            `PREVIEW: ${PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${rel}` : `http://localhost:${PORT}${rel}`}\n\n` +
            '```\n' + stdout + '\n```' +
            (stderr ? `\n**Stderr:**\n\`\`\`\n${stderr}\n\`\`\`` : '') +
            (screenshotsDir ? `\n📸 Screenshots: \`${screenshotsDir}/\`` : '') +
            (failed ? '\n\nDo NOT present this journey as done — fix the failures (usually leaked source content or structure) and re-run finalize_journey.' : ''),
        }],
        isError: !isOk,
      };
    },
  },

  /** Serve a journey project dir for browser preview (via /preview route, no auth needed) */
  serve_journey: {
    description: 'Serve a journey project directory for browser preview. Returns local + public preview URLs (no auth required to view).',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory' },
      },
    },
    handler: async ({ projectPath }) => {
      const absDir = resolve(projectPath);
      if (!existsSync(absDir)) {
        return { content: [{ type: 'text', text: `ERROR: directory not found: ${absDir}` }], isError: true };
      }

      const id = registerPreview(absDir);
      const rel = `/preview/${id}/`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'serving',
            localUrl: `http://localhost:${PORT}${rel}`,
            publicUrl: PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${rel}` : null,
            projectDir: absDir,
            note: 'Preview requires NO auth — open it in any browser/webview. The public URL works while the Tailscale funnel is up.',
          }, null, 2),
        }],
      };
    },
  },

  /** List available base journey templates / projects in the library */
  list_bases: {
    description: 'List all projects in the template library (workspace + template roots + canonical base), each with its journeys',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const projects = scanProjects();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            note: 'ALWAYS build from an EXISTING project: ask the user which project (id) and which journey they want, then ask for the NEW company\'s brand pack (industry via list_industries; logo + product images as URL, LOCAL FILE PATH like D:\\Sales\\Acme\\logo.png — the user picks the stored location — or base64; website link), then call build_journey with sourceProject + sourceJourney + industry/website/logoUrl|logoPath/productImages|productImagePaths. After the build, run stage_for_edit -> rewrite content in the staged files -> finalize_journey (auto-verify with leak guard). NEVER build without a source — it produces a generic placeholder. sourceProject="base" is only for when no existing project matches.',
            default: existsSync(BASE_DIR) ? BASE_DIR : null,
            available: projects,
          }, null, 2),
        }],
      };
    },
  },

  list_industries: {
    description: 'List industry categories (content profiles) for the NEW company being built — recipient label, units, currency, product categories. Ask the user which industry the new company belongs to, then pass its id to build_journey as industry.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const industries = [];
      if (existsSync(INDUSTRY_DIR)) {
        for (const f of readdirSync(INDUSTRY_DIR).filter((f) => f.endsWith('.json'))) {
          try { industries.push(JSON.parse(readFileSync(join(INDUSTRY_DIR, f), 'utf-8'))); } catch { /* skip malformed */ }
        }
      }
      industries.sort((a, b) =>
        (a.id === 'general' ? 1 : 0) - (b.id === 'general' ? 1 : 0) ||
        a.label.localeCompare(b.label)
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            note: 'Ask the user which industry the NEW company belongs to, then pass its id to build_journey as industry.',
            industries,
          }, null, 2),
        }],
      };
    },
  },
};

// ── MCP server ───────────────────────────────────────────────────────────────

function createMcpServer() {
  const server = new Server(
    { name: 'journey-builder-mcp', version: '1.5.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: Object.entries(tools).map(([name, t]) => ({
      name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool  = tools[name];
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
    const t0 = Date.now();
    try {
      const result = await tool.handler(args || {});
      const ms = Date.now() - t0;
      console.log(`[mcp] ${name} ${result && result.isError ? 'ERR' : 'ok'} ${ms}ms ${safeArgs(args)}`);
      return result;
    } catch (err) {
      console.error(`[mcp] ${name} THREW after ${Date.now() - t0}ms: ${err.message}`);
      return { content: [{ type: 'text', text: `Exception: ${err.message}\n${err.stack}` }], isError: true };
    }
  });

  return server;
}

// ── transport selection ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portArg = args.find(a => a.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 7891;
const workspaceArg = args.find(a => a.startsWith('--workspace='));
const workspaceDir = workspaceArg ? workspaceArg.split('=').slice(1).join('=') : process.cwd();
const AUTH_TOKEN = process.env.JOURNEY_BUILDER_TOKEN || '';
const PUBLIC_BASE_URL = process.env.JOURNEY_BUILDER_PUBLIC_URL || '';
const TEMPLATE_ROOTS = (process.env.JOURNEY_TEMPLATE_ROOTS || '').split(',').map(s => s.trim()).filter(Boolean);

if (httpMode) {
  // HTTP mode — for OpenCode Desktop / remote MCP clients
  const transports = new Map(); // sessionId -> transport

  const httpServer = createServer(async (req, res) => {
    // CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Preview route — static journey files, NO auth (browser/webview previews
    // cannot send Authorization headers). Serves only registered projects.
    if (req.method === 'GET' && req.url.startsWith('/preview/')) {
      servePreviewFile(req, res);
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', tools: Object.keys(tools) }));
      return;
    }

    // Bearer-token auth — enforced ONLY when JOURNEY_BUILDER_TOKEN is set.
    // Local dev stays open; public deployments set the env var.
    // OPTIONS preflight + /health stay unauthenticated.
    if (AUTH_TOKEN && req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', hint: 'Authorization: Bearer <JOURNEY_BUILDER_TOKEN>' }));
      return;
    }

    // Collect request body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsedBody = undefined;
      if (body) {
        try { parsedBody = JSON.parse(body); } catch { /* not JSON */ }
      }

      // Look up or create transport per session
      const sessionId = req.headers['mcp-session-id'];
      let transport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId);
      } else if (req.method === 'POST' && parsedBody?.method === 'initialize') {
        // New session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        const server = createMcpServer();
        await server.connect(transport);
      } else if (!sessionId && req.method === 'POST') {
        // Stateless fallback
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        const server = createMcpServer();
        await server.connect(transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request: missing or invalid session' }));
        return;
      }

      await transport.handleRequest(req, res, parsedBody);
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.error(`journey-builder-mcp HTTP server on http://localhost:${PORT}/mcp`);
    console.error(`Health: http://localhost:${PORT}/health`);
    console.error(`Preview: http://localhost:${PORT}/preview/<project>/ (no auth)`);
    console.error(`Tools: ${Object.keys(tools).join(', ')}`);
    console.error(`Auth: ${AUTH_TOKEN ? 'bearer-token ON' : 'OFF (local only)'}`);
    if (PUBLIC_BASE_URL) console.error(`Public base: ${PUBLIC_BASE_URL}`);
    if (TEMPLATE_ROOTS.length) console.error(`Template roots: ${TEMPLATE_ROOTS.join(', ')}`);
    if (STAGING_DIR) console.error(`Edit staging: ${STAGING_DIR}`);
  });

} else {
  // Stdio mode — for CLI / local subprocess MCP
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch(err => {
    console.error('Failed to connect transport:', err);
    process.exit(1);
  });
}
