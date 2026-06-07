const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { createSession, getSession, destroySession, listActiveSessions, startCleanupDaemon } = require('./session-manager');
const { generateSession, generateSessionFromUploads, renderSessionContent } = require('./generate-session');
const { exportSession } = require('./export-engine');
const { cleanupExpiredSessions } = require('./cleanup');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const { processAndStore: processLogo } = require('./uploads/upload-logo');
const { processAndStore: processCatalog } = require('./uploads/upload-catalog');
const { adaptJourneyContent, saveContentOverrides, DEFAULT_LABELS } = require('../services/content-adapter');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(__dirname, 'frontend', 'public');

function createPreviewServer(options = {}) {
  const app = express();
  const port = options.port || process.env.PORT || 3000;
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Serve frontend static files
  app.use(express.static(FRONTEND_DIR));
  // Also serve from root public/ directory (upload-based UI)
  const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
  app.use(express.static(PUBLIC_DIR));
  
  // CORS for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
  
  // POST /api/generate - Create a session and generate journeys
  app.post('/api/generate', async (req, res) => {
    try {
      const { url, journeys, industry } = req.body;
      if (!url) return res.status(400).json({ error: 'Brand URL is required' });
      
      const selectedJourneys = journeys || ['order_to_cash'];
      const validJourneys = selectedJourneys.filter(j => ['order_to_cash','field_ops_expense','automated_collections','dealer_engagement','retailer_onboarding','retailer_loyalty'].includes(j));
      
      if (validJourneys.length === 0) return res.status(400).json({ error: 'No valid journeys selected' });
      
      // Support two flows:
      // - URL-based ingestion (legacy)
      // - Session-based uploads: client supplies `sessionId` and uploads prior to calling generate
      let session;
      if (req.body.sessionId) {
        session = await getSession(req.body.sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (industry) {
          session.metadata = session.metadata || {};
          session.metadata.industry = industry;
          await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });
        }
      } else {
        session = await createSession({ url, requestedJourneys: validJourneys, industry });
      }
      
      // Return immediately with session ID, generation happens async
      res.json({
        sessionId: session.id,
        status: 'generating',
        message: 'Session created, generation started',
        expiresAt: session.expiresAt,
      });
      
      // Generate asynchronously
      (async () => {
        try {
          if (req.body.sessionId) {
            await generateSessionFromUploads(session.id, { journeys: validJourneys });
          } else {
            await generateSession(session.id, url, { journeys: validJourneys });
          }
        } catch (genErr) {
          console.error('[preview] Generation failed:', genErr && genErr.message ? genErr.message : genErr);
          const s = await getSession(session.id);
          if (s) {
            s.metadata.error = genErr.message || String(genErr);
            s.metadata.generationFailed = true;
            await fs.writeJson(path.join(s.paths.root, 'metadata.json'), s, { spaces: 2 });
          }
        }
      })();
    } catch (err) {
      console.error('[preview] Error:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  // POST /api/session/create - Create an ephemeral session
  app.post('/api/session/create', async (req, res) => {
    try {
      const { brandName, industry } = req.body || {};
      const session = await createSession({ uploadBrandName: brandName, industry });
      res.json({ sessionId: session.id, expiresAt: session.expiresAt });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/upload/logo - multipart/form-data; fields: sessionId, file field 'logo'
  app.post('/api/upload/logo', upload.single('logo'), async (req, res) => {
    try {
      const sessionId = req.body.sessionId || req.query.sessionId;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      const session = await getSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found or expired' });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const out = await processLogo(session, req.file);
      // Update metadata
      session.metadata.uploadedLogo = out.savedAs;
      await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });
      res.json({ saved: out.savedAs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/upload/catalog - multipart/form-data; fields: sessionId, file field 'catalog'
  app.post('/api/upload/catalog', upload.single('catalog'), async (req, res) => {
    try {
      const sessionId = req.body.sessionId || req.query.sessionId;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      const session = await getSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found or expired' });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const out = await processCatalog(session, req.file);
      session.metadata.uploadedCatalog = out.savedAs;
      await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });
      res.json({ saved: out.savedAs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // GET /api/session/:sessionId - Get session status
  app.get('/api/session/:sessionId', async (req, res) => {
    try {
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found or expired' });
      
      const generatedFiles = [];
      if (await fs.pathExists(session.paths.generated)) {
        const files = await fs.readdir(session.paths.generated);
        for (const f of files) {
          if (f.endsWith('.html')) {
            const stat = await fs.stat(path.join(session.paths.generated, f));
            generatedFiles.push({ file: f, size: stat.size, modified: stat.mtime });
          }
        }
      }
      
      res.json({
        sessionId: session.id,
        status: generatedFiles.length > 0 ? 'complete' : (session.metadata.generationFailed ? 'failed' : 'generating'),
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        metadata: session.metadata,
        generatedFiles,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // GET /api/preview/:sessionId/:journey - Serve generated HTML
  app.get('/api/preview/:sessionId/:journey', async (req, res) => {
    try {
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found or expired' });
      
      const journeyFile = req.params.journey + '.html';
      const filePath = path.join(session.paths.generated, journeyFile);
      
      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ error: 'Journey not generated: ' + req.params.journey });
      }
      
      const html = await fs.readFile(filePath, 'utf8');
      res.set('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // DELETE /api/session/:sessionId - Destroy a session
  app.delete('/api/session/:sessionId', async (req, res) => {
    try {
      await destroySession(req.params.sessionId);
      res.json({ status: 'deleted', sessionId: req.params.sessionId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // POST /api/export/:sessionId - Export session as self-contained package
  app.post('/api/export/:sessionId', async (req, res) => {
    try {
      const mode = req.body.mode || 'single';
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found or expired' });
      const result = await exportSession(session.id, mode);
      // Validate export integrity (no external resources, all assets present)
      const { validateExport } = require('./export-validator');
      try {
        await validateExport(session);
      } catch (ve) {
        // remove exports on validation failure
        const exportDir = require('path').join(session.paths.root, 'exports');
        await require('fs-extra').remove(exportDir).catch(()=>{});
        return res.status(500).json({ error: 'Export failed validation: ' + ve.message });
      }

      res.json({ status: 'exported', mode, files: result.files, totalBytes: result.totalBytes, exports: result.paths });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/experiments/adapt-content', async (req, res) => {
    try {
      const { sessionId, industry, brandName, labels, products } = req.body || {};
      const session = sessionId ? await getSession(sessionId) : null;
      let catalog = Array.isArray(products) ? products : [];

      if (session) {
        const brandId = session.metadata?.brandId || 'brand';
        const catalogPath = path.join(session.paths.root, 'data', 'catalogs', brandId + '_products.json');
        catalog = await fs.pathExists(catalogPath) ? await fs.readJson(catalogPath) : catalog;
      }
      const brandId = session?.metadata?.brandId || 'brand';
      const result = await adaptJourneyContent({
        industry: industry || session?.metadata?.industry || 'general',
        brandName: brandName || session?.metadata?.brandName || brandId,
        journeyType: 'order_to_cash',
        products: catalog.map(p => (typeof p === 'string' ? p : p && p.name)).filter(Boolean),
        labels: labels || DEFAULT_LABELS,
      });

      res.json({
        provider: result.provider,
        model: result.model,
        acceptedLabels: result.acceptedLabels,
        adaptationDiff: result.adaptationDiff,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/experiments/save-content', async (req, res) => {
    try {
      const { sessionId, industry, acceptedLabels, adaptationDiff } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      const session = await getSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found or expired' });

      const saveResult = await saveContentOverrides(session, {
        industry: industry || session.metadata?.industry || 'general',
        acceptedLabels: acceptedLabels || {},
        adaptationDiff: adaptationDiff || {},
      });

      const journeys = session.metadata?.journeys && session.metadata.journeys.length
        ? session.metadata.journeys
        : ['order_to_cash'];
      await renderSessionContent(session, journeys, { acceptedLabels: acceptedLabels || {} });

      session.metadata = session.metadata || {};
      session.metadata.contentOverridePath = saveResult.savedAs;
      await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });

      res.json({
        status: 'saved',
        savedAs: saveResult.savedAs,
        content: saveResult.record,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // GET /api/export/:sessionId/:mode - Download export
  app.get('/api/export/:sessionId/:mode', async (req, res) => {
    try {
      const mode = req.params.mode === 'zip' ? 'zip' : 'single';
      const session = await getSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      
      const exportDir = path.join(session.paths.root, 'exports');
      const exportFile = mode === 'zip' ? 'demo-package.zip' : session.metadata.brandId + '-demo.html';
      const filePath = path.join(exportDir, exportFile);
      
      if (!await fs.pathExists(filePath)) {
        // Generate on demand
        const { exportSession } = require('./export-engine');
        await exportSession(session.id, mode);
      }
      
      const contentType = mode === 'zip' ? 'application/zip' : 'text/html';
      res.set('Content-Type', contentType);
      res.set('Content-Disposition', 'attachment; filename="' + exportFile + '"');
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // GET /api/admin/sessions - List active sessions
  app.get('/api/admin/sessions', async (req, res) => {
    try {
      const sessions = await listActiveSessions();
      res.json({ activeSessions: sessions.length, sessions: sessions.map(s => ({
        id: s.id, brandName: s.metadata?.brandName, status: s.metadata?.generationFailed ? 'failed' : 'active', createdAt: s.createdAt, expiresAt: s.expiresAt,
      })) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // GET / - Serve frontend
  app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
  
  // Start server
  const server = app.listen(port, () => {
    console.log('[preview] Server running on http://localhost:' + port);
    console.log('[preview] API: POST /api/generate, GET /api/preview/:sid/:journey');
    console.log('[preview] UI:  http://localhost:' + port);
  });
  
  // Cleanup on shutdown
  process.on('SIGINT', async () => {
    console.log('[preview] Shutting down...');
    await cleanupExpiredSessions();
    server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('[preview] Shutting down...');
    await cleanupExpiredSessions();
    server.close();
    process.exit(0);
  });
  
  // Start cleanup daemon
  startCleanupDaemon();
  
  return { app, server };
}

if (require.main === module) {
  createPreviewServer();
}

module.exports = { createPreviewServer };
