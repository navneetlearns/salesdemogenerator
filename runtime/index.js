// ZoTok Demo Generator — Runtime Platform
// Ephemeral demo generation system

const { createSession, getSession, destroySession, cleanupExpiredSessions, startCleanupDaemon, stopCleanupDaemon, SESSION_DIR } = require('./session-manager');
const { ingestBrand } = require('./brand-ingestion');
const { generateSession, createJourneyJsons } = require('./generate-session');
const { createPreviewServer } = require('./preview-server');
const { exportSession } = require('./export-engine');
const { cleanup, startupCleanup } = require('./cleanup');
const { validateRuntime } = require('./validate-runtime');

async function startRuntime(options = {}) {
  const port = options.port || process.env.PORT || 3000;
  console.log('=== ZoTok Runtime Platform ===');
  console.log('Session dir:', SESSION_DIR);
  
  // Ensure session directory
  const fs = require('fs-extra');
  await fs.ensureDir(SESSION_DIR);
  
  // Clean up stale sessions on startup
  await startupCleanup();
  
  // Start cleanup daemon
  startCleanupDaemon();
  
  // Start preview server
  const server = createPreviewServer({ port });
  
  return server;
}

module.exports = {
  startRuntime, createSession, getSession, destroySession,
  cleanupExpiredSessions, ingestBrand, generateSession,
  createPreviewServer, exportSession, cleanup, validateRuntime,
  startCleanupDaemon, stopCleanupDaemon, SESSION_DIR,
};
