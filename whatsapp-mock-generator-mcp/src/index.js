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

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { randomUUID } from 'crypto';

// ── paths ───────────────────────────────────────────────────────────────────
// Resolve relative to the package root, not a hardcoded home dir
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, '..');

const BASE_DIR     = join(PACKAGE_ROOT, 'base-journey');
const BRAND_SWAP   = join(PACKAGE_ROOT, 'scripts', 'brand_swap.py');
const VERIFY       = join(PACKAGE_ROOT, 'scripts', 'verify_journey.py');

// ── helpers ──────────────────────────────────────────────────────────────────

function runPy(script, args = [], timeoutSec = 60) {
  const cmd = ['python3', script, ...args];
  try {
    const out = execSync(cmd.join(' '), {
      encoding: 'utf-8',
      timeout: timeoutSec * 1000,
      cwd: process.env.WORKSPACE_DIR || workspaceDir,
    });
    return { ok: true, stdout: out, stderr: '' };
  } catch (e) {
    return { ok: false, stdout: e.stdout || '', stderr: e.stderr || e.message };
  }
}

function servePort(projectDir, port) {
  const srv = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: projectDir,
    detached: true,
    stdio: 'ignore',
  });
  srv.unref();
  return `http://localhost:${port}`;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── tool handlers ─────────────────────────────────────────────────────────────

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
    description: 'Clone base journey + brand-swap + write step content',
    inputSchema: {
      type: 'object',
      required: ['brandName', 'slug', 'journeyName'],
      properties: {
        brandName:       { type: 'string' },
        slug:            { type: 'string' },
        journeyName:     { type: 'string', description: 'Journey type slug (e.g. contract, order_to_cash)' },
        brandColor:      { type: 'string' },
        accentColor:     { type: 'string' },
        logoBase64:      { type: 'string', description: 'Base64 PNG for logo embed (optional)' },
        avatarInitials:  { type: 'string' },
        journeyLabel:    { type: 'string', description: 'Label shown on journey page (e.g. "Rate Contract")' },
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
    }) => {
      const outDir  = resolve(projectDir || join(process.env.WORKSPACE_DIR || workspaceDir, slug));
      const projDir = join(outDir, 'projects', slug);
      const indexPath = join(projDir, 'index.html');
      const journeyPath = join(projDir, `journey_${journeyName}.html`);
      const assetsDir = join(projDir, 'assets', 'brand');
      mkdirSync(assetsDir, { recursive: true });

      // 1. clone base
      if (!existsSync(BASE_DIR)) {
        return { content: [{ type: 'text', text: `ERROR: base-journey not found at ${BASE_DIR}` }], isError: true };
      }
      cpSync(join(BASE_DIR, 'index.html'), indexPath);
      cpSync(join(BASE_DIR, 'journey_contract.html'), journeyPath);

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
      };

      const manifestPath = join(assetsDir, 'brand.json');
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      // 3. brand swap (dry-run first)
      const dry = runPy(BRAND_SWAP, [
        '--manifest', manifestPath,
        '--journey', journeyPath,
        '--index', indexPath,
        '--dry-run',
      ]);
      if (!dry.ok && !dry.stdout.includes('UNCHANGED')) {
        return { content: [{ type: 'text', text: `brand_swap dry-run failed:\n${dry.stderr}` }], isError: true };
      }

      const wet = runPy(BRAND_SWAP, [
        '--manifest', manifestPath,
        '--journey', journeyPath,
        '--index', indexPath,
      ]);
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

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'built',
            files: {
              index:    indexPath,
              journey:  journeyPath,
              manifest: manifestPath,
            },
            brandSwapReport: wet.stdout,
            nextSteps: [
              '1. Review the cloned HTML in ' + journeyPath,
              '2. Rewrite step content using the mock-journey-builder skill (Phase 4)',
              '3. Run verify_journey to check structure + compliance',
              '4. Run serve_journey to preview in browser',
            ],
          }, null, 2),
        }],
      };
    },
  },

  /** Run verify_journey.py on a journey HTML file */
  verify_journey: {
    description: 'Verify a journey HTML: structure, charset, render, compliance',
    inputSchema: {
      type: 'object',
      required: ['journeyPath'],
      properties: {
        journeyPath: { type: 'string', description: 'Absolute path to journey_*.html' },
        probes: {
          type: 'object',
          description: 'JSON object of { "stepN": ["text probe", ...] }',
        },
        expectedSteps: { type: 'number', description: 'Expected step count (auto-detected if omitted)' },
        screenshotsDir: { type: 'string', description: 'Directory for step screenshots (optional)' },
      },
    },
    handler: async ({ journeyPath, probes, expectedSteps, screenshotsDir }) => {
      if (!existsSync(journeyPath)) {
        return { content: [{ type: 'text', text: `ERROR: file not found: ${journeyPath}` }], isError: true };
      }

      const args = ['verify_journey.py', journeyPath];
      if (probes)           args.push('--probes', JSON.stringify(probes));
      if (expectedSteps)    args.push('--expected-steps', String(expectedSteps));
      if (screenshotsDir)   args.push('--shots', screenshotsDir);

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

  /** Serve a journey project dir on a local HTTP port for browser preview */
  serve_journey: {
    description: 'Serve a journey project directory for browser preview',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory' },
        port:        { type: 'number', description: 'HTTP port (default: 7890)' },
      },
    },
    handler: async ({ projectPath, port = 7890 }) => {
      const absDir = resolve(projectPath);
      if (!existsSync(absDir)) {
        return { content: [{ type: 'text', text: `ERROR: directory not found: ${absDir}` }], isError: true };
      }

      const url = servePort(absDir, port);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'serving',
            url,
            projectDir: absDir,
            note: 'Open the URL in your browser to preview. Ctrl+C the terminal to stop.',
          }, null, 2),
        }],
      };
    },
  },

  /** List available base journey templates */
  list_bases: {
    description: 'List available base journey templates',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const bases = [
        {
          id: 'hindustan_rmc',
          name: 'Hindustan RMC — Rate Contract',
          path: BASE_DIR,
          description: '10-step, buyer DM + ops group converging on one ERP voucher',
          steps: 10,
        },
      ];
      const baseExists = existsSync(BASE_DIR);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            default: baseExists ? BASE_DIR : null,
            available: bases,
          }, null, 2),
        }],
      };
    },
  },
};

// ── MCP server ───────────────────────────────────────────────────────────────

function createMcpServer() {
  const server = new Server(
    { name: 'journey-builder-mcp', version: '1.1.0' },
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
    try {
      const result = await tool.handler(args || {});
      return result;
    } catch (err) {
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

if (httpMode) {
  // HTTP mode — for OpenCode Desktop / remote MCP clients
  const transports = new Map(); // sessionId -> transport

  const httpServer = createServer(async (req, res) => {
    // CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', tools: Object.keys(tools) }));
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
    console.error(`Tools: ${Object.keys(tools).join(', ')}`);
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
