// Vercel serverless adapter for the runtime preview server
// Compatible with Vercel's /tmp-only filesystem

const path = require('path');
const fs = require('fs-extra');

// Override session directory to use /tmp (Vercel-compatible)
process.env.SESSION_DIR = process.env.VERCEL ? '/tmp/sessions' : (process.env.SESSION_DIR || '/tmp/sessions');
process.env.PORT = process.env.PORT || '3000';

// Cache template metadata in memory to avoid repeated reads
const templateCache = new Map();

async function getCachedTemplate(filePath) {
  if (templateCache.has(filePath)) {
    const cached = templateCache.get(filePath);
    if (Date.now() - cached.timestamp < 60000) return cached.content;
  }
  const content = await fs.readFile(filePath, 'utf8');
  templateCache.set(filePath, { content, timestamp: Date.now() });
  return content;
}

// Ensure SESSION_DIR exists (required for Vercel's /tmp)
async function ensureSessionDir() {
  await fs.ensureDir(process.env.SESSION_DIR);
}

// Called on cold start
async function init() {
  await ensureSessionDir();
  const { startupCleanup } = require('./cleanup');
  await startupCleanup();
}

// Vercel serverless handler
async function vercelHandler(req, res) {
  await init();
  
  // Import and delegate to express app
  const { createPreviewServer } = require('./preview-server');
  
  // For Vercel, we create the app without starting a listener
  const express = require('express');
  const app = express();
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Re-use the same routes from preview-server
  const FRONTEND_DIR = path.join(__dirname, 'frontend', 'public');
  app.use(express.static(FRONTEND_DIR));
  
  // Import route handlers
  const { createSession, getSession, destroySession, listActiveSessions } = require('./session-manager');
  const { generateSession } = require('./generate-session');
  const { exportSession } = require('./export-engine');
  
  app.post('/api/generate', async (req, res) => {
    try {
      const { url, journeys } = req.body;
      if (!url) return res.status(400).json({ error: 'URL required' });
      const vj = (journeys || ['order_to_cash']).filter(j => ['order_to_cash','field_ops_expense','automated_collections','dealer_engagement','retailer_onboarding','retailer_loyalty'].includes(j));
      if (vj.length === 0) return res.status(400).json({ error: 'No valid journeys' });
      const session = await createSession({ url, requestedJourneys: vj });
      res.json({ sessionId: session.id, status: 'generating', expiresAt: session.expiresAt });
      // Fire and forget generation
      generateSession(session.id, url, { journeys: vj }).catch(err => {
        console.error('[vercel] Generation failed:', err.message);
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.get('/api/session/:sessionId', async (req, res) => {
    try {
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const generatedFiles = [];
      if (await fs.pathExists(session.paths.generated)) {
        for (const f of await fs.readdir(session.paths.generated)) {
          if (f.endsWith('.html')) generatedFiles.push({ file: f });
        }
      }
      res.json({ sessionId: session.id, status: generatedFiles.length > 0 ? 'complete' : (session.metadata?.generationFailed ? 'failed' : 'generating'), createdAt: session.createdAt, expiresAt: session.expiresAt, metadata: session.metadata, generatedFiles });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/preview/:sessionId/:journey', async (req, res) => {
    try {
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const fp = path.join(session.paths.generated, req.params.journey + '.html');
      if (!await fs.pathExists(fp)) return res.status(404).json({ error: 'Journey not found' });
      const html = await fs.readFile(fp, 'utf8');
      res.set('Content-Type', 'text/html').send(html);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.delete('/api/session/:sessionId', async (req, res) => {
    try { await destroySession(req.params.sessionId); res.json({ status: 'deleted' }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.post('/api/export/:sessionId', async (req, res) => {
    try {
      const mode = req.body.mode || 'single';
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const result = await exportSession(session.id, mode);
      res.json({ status: 'exported', mode, files: result.files, totalBytes: result.totalBytes });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/export/:sessionId/:mode', async (req, res) => {
    try {
      const mode = req.params.mode === 'zip' ? 'zip' : 'single';
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const exportDir = path.join(session.paths.root, 'exports');
      const exportFile = mode === 'zip' ? 'demo-package.zip' : (session.metadata?.brandId || 'brand') + '-demo.html';
      const fp = path.join(exportDir, exportFile);
      if (!await fs.pathExists(fp)) await exportSession(session.id, mode);
      res.set('Content-Type', mode === 'zip' ? 'application/zip' : 'text/html');
      res.set('Content-Disposition', 'attachment; filename="' + exportFile + '"');
      res.sendFile(fp);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('/api/admin/sessions', async (req, res) => {
    try { const sessions = await listActiveSessions(); res.json({ activeSessions: sessions.length, sessions }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
  
  return app(req, res);
}

module.exports = { init, vercelHandler, getCachedTemplate, ensureSessionDir };

// For direct module usage (not Vercel)
if (require.main === module) {
  const { createPreviewServer } = require('./preview-server');
  const { startCleanupDaemon } = require('./session-manager');
  ensureSessionDir().then(() => {
    startCleanupDaemon();
    createPreviewServer();
  });
}
