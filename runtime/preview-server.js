const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { createSession, getSession, destroySession, listActiveSessions, startCleanupDaemon } = require('./session-manager');
const { generateSession } = require('./generate-session');
const { exportSession } = require('./export-engine');
const { cleanupExpiredSessions } = require('./cleanup');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(__dirname, 'frontend', 'public');

function createPreviewServer(options = {}) {
  const app = express();
  const port = options.port || process.env.PORT || 3000;
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Serve frontend static files
  app.use(express.static(FRONTEND_DIR));
  
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
      const { url, journeys } = req.body;
      if (!url) return res.status(400).json({ error: 'Brand URL is required' });
      
      const selectedJourneys = journeys || ['order_to_cash'];
      const validJourneys = selectedJourneys.filter(j => ['order_to_cash','field_ops_expense','automated_collections','dealer_engagement','retailer_onboarding','retailer_loyalty'].includes(j));
      
      if (validJourneys.length === 0) return res.status(400).json({ error: 'No valid journeys selected' });
      
      const session = await createSession({ url, requestedJourneys: validJourneys });
      
      // Return immediately with session ID, generation happens async
      res.json({
        sessionId: session.id,
        status: 'generating',
        message: 'Session created, generation started',
        expiresAt: session.expiresAt,
      });
      
      // Generate asynchronously
      try {
        await generateSession(session.id, url, { journeys: validJourneys });
      } catch (genErr) {
        console.error('[preview] Generation failed:', genErr.message);
        const s = await getSession(session.id);
        if (s) {
          s.metadata.error = genErr.message;
          s.metadata.generationFailed = true;
          await fs.writeJson(path.join(s.paths.root, 'metadata.json'), s, { spaces: 2 });
        }
      }
    } catch (err) {
      console.error('[preview] Error:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
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
      
      res.json({
        status: 'exported',
        mode,
        files: result.files,
        totalBytes: result.totalBytes,
        exports: result.paths,
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
