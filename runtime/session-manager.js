const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_DIR = process.env.SESSION_DIR || '/tmp/sessions';

const activeTimers = new Map();

function sessionDir(sessionId) {
  return path.join(SESSION_DIR, sessionId);
}

function createSessionId() {
  return crypto.randomUUID();
}

async function createSession(metadata = {}) {
  const sessionId = createSessionId();
  const dir = sessionDir(sessionId);
  
  await fs.ensureDir(path.join(dir, 'assets', 'brands'));
  await fs.ensureDir(path.join(dir, 'assets', 'products'));
  await fs.ensureDir(path.join(dir, 'assets', 'fallbacks'));
  await fs.ensureDir(path.join(dir, 'generated'));
  await fs.ensureDir(path.join(dir, 'overrides'));
  
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    metadata,
    paths: {
      root: dir,
      assets: path.join(dir, 'assets'),
      brands: path.join(dir, 'assets', 'brands'),
      products: path.join(dir, 'assets', 'products'),
      fallbacks: path.join(dir, 'assets', 'fallbacks'),
      generated: path.join(dir, 'generated'),
      overrides: path.join(dir, 'overrides'),
    }
  };
  
  await fs.writeJson(path.join(dir, 'metadata.json'), session, { spaces: 2 });
  resetExpiryTimer(sessionId);
  return session;
}

async function getSession(sessionId) {
  const dir = sessionDir(sessionId);
  const metaPath = path.join(dir, 'metadata.json');
  if (!await fs.pathExists(metaPath)) return null;
  
  const session = await fs.readJson(metaPath);
  if (session.expiresAt < Date.now()) {
    await destroySession(sessionId);
    return null;
  }
  
  session.lastAccessedAt = Date.now();
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  await fs.writeJson(metaPath, session, { spaces: 2 });
  resetExpiryTimer(sessionId);
  return session;
}

async function destroySession(sessionId) {
  const dir = sessionDir(sessionId);
  if (await fs.pathExists(dir)) {
    await fs.remove(dir);
  }
  if (activeTimers.has(sessionId)) {
    clearTimeout(activeTimers.get(sessionId));
    activeTimers.delete(sessionId);
  }
}

async function cleanupExpiredSessions() {
  if (!await fs.pathExists(SESSION_DIR)) return;
  const entries = await fs.readdir(SESSION_DIR);
  let cleaned = 0;
  for (const entry of entries) {
    const metaPath = path.join(SESSION_DIR, entry, 'metadata.json');
    if (!await fs.pathExists(metaPath)) continue;
    try {
      const meta = await fs.readJson(metaPath);
      if (meta.expiresAt < Date.now()) {
        await destroySession(entry);
        cleaned++;
      }
    } catch (e) {
      await fs.remove(path.join(SESSION_DIR, entry)).catch(() => {});
      cleaned++;
    }
  }
  return cleaned;
}

function resetExpiryTimer(sessionId) {
  if (activeTimers.has(sessionId)) {
    clearTimeout(activeTimers.get(sessionId));
  }
  const timer = setTimeout(async () => {
    await destroySession(sessionId).catch(() => {});
  }, SESSION_TTL_MS);
  timer.unref();
  activeTimers.set(sessionId, timer);
}

async function touchSession(sessionId) {
  const session = await getSession(sessionId);
  return session;
}

async function listActiveSessions() {
  if (!await fs.pathExists(SESSION_DIR)) return [];
  const entries = await fs.readdir(SESSION_DIR);
  const sessions = [];
  for (const entry of entries) {
    const metaPath = path.join(SESSION_DIR, entry, 'metadata.json');
    if (!await fs.pathExists(metaPath)) continue;
    try {
      const meta = await fs.readJson(metaPath);
      if (meta.expiresAt >= Date.now()) {
        sessions.push(meta);
      }
    } catch (e) {}
  }
  return sessions;
}

let cleanupInterval = null;

function startCleanupDaemon() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(async () => {
    await cleanupExpiredSessions().catch(() => {});
  }, CLEANUP_INTERVAL_MS);
  cleanupInterval.unref();
}

function stopCleanupDaemon() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

module.exports = {
  createSession, getSession, destroySession,
  cleanupExpiredSessions, touchSession, listActiveSessions,
  startCleanupDaemon, stopCleanupDaemon, SESSION_TTL_MS, SESSION_DIR
};
