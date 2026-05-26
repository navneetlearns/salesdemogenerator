const fs = require('fs-extra');
const path = require('path');
const { createSession, cleanupExpiredSessions, listActiveSessions } = require('./session-manager');

async function cleanupOrphans() {
  // Remove any session dir missing metadata
  const SESSION_DIR = require('./session-manager').SESSION_DIR;
  if (!await fs.pathExists(SESSION_DIR)) return 0;
  const entries = await fs.readdir(SESSION_DIR);
  let removed = 0;
  for (const e of entries) {
    const meta = path.join(SESSION_DIR, e, 'metadata.json');
    if (!await fs.pathExists(meta)) {
      await fs.remove(path.join(SESSION_DIR, e)).catch(()=>{});
      removed++;
    }
  }
  return removed;
}

async function cleanupFailedGenerations(maxAgeMs = 30*60*1000) {
  const sessions = await listActiveSessions();
  let removed = 0;
  const now = Date.now();
  for (const s of sessions) {
    if (s.metadata && s.metadata.generationFailed && (now - (s.metadata.generatedAt || s.expiresAt)) > maxAgeMs) {
      await fs.remove(s.paths.root).catch(()=>{});
      removed++;
    }
  }
  return removed;
}

async function cleanupPartialUploads(timeoutMs = 10*60*1000) {
  const sessions = await listActiveSessions();
  let removed = 0;
  const now = Date.now();
  for (const s of sessions) {
    // if session has uploads but no generatedAt and older than timeout => remove
    const hasUploads = await fs.pathExists(path.join(s.paths.root,'uploads'));
    if (hasUploads && !s.metadata.generatedAt && (now - s.lastAccessedAt) > timeoutMs) {
      await fs.remove(s.paths.root).catch(()=>{});
      removed++;
    }
  }
  return removed;
}

async function startupCleanup() {
  // Run generic expired cleanup first
  const cleaned = await cleanupExpiredSessions();
  const orphans = await cleanupOrphans();
  return { cleaned, orphans };
}

async function stressTestCleanup() {
  // Create 50 sessions, expire them, run cleanup and verify
  const created = [];
  for (let i=0;i<50;i++) {
    const s = await createSession({ test: true });
    created.push(s);
  }
  // mark them expired
  for (const s of created) {
    try {
      const metaPath = path.join(s.paths.root, 'metadata.json');
      const m = await fs.readJson(metaPath);
      m.expiresAt = Date.now() - 1000;
      await fs.writeJson(metaPath, m, { spaces: 2 });
    } catch (e) {}
  }
  const cleaned = await cleanupExpiredSessions();
  return { created: created.length, cleaned };
}

module.exports = { cleanupOrphans, cleanupFailedGenerations, cleanupPartialUploads, startupCleanup, stressTestCleanup };
