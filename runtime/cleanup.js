const fs = require('fs-extra');
const path = require('path');
const { cleanupExpiredSessions, SESSION_DIR } = require('./session-manager');

async function cleanup(options = {}) {
  const verbose = options.verbose !== false;
  if (verbose) console.log('[cleanup] Starting session cleanup...');
  
  // 1. Clean expired sessions
  const cleaned = await cleanupExpiredSessions();
  if (verbose) console.log('[cleanup] Expired sessions cleaned:', cleaned);
  
  // 2. Remove orphaned data directories from failed builds
  const projectRoot = path.resolve(__dirname, '..');
  const orphans = ['.runtime-data-bak', '.runtime-assets-bak', '.tmpcli-'];
  for (const pattern of orphans) {
    if (pattern.endsWith('-')) {
      // Check for prefixed temp dirs
      const entries = await fs.readdir(projectRoot).catch(() => []);
      for (const entry of entries) {
        if (entry.startsWith(pattern) && entry !== '.tmpcli-') {
          const fullPath = path.join(projectRoot, entry);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              await fs.remove(fullPath);
              if (verbose) console.log('[cleanup] Removed orphan:', entry);
            }
          } catch (e) {}
        }
      }
    } else if (pattern.endsWith('-bak')) {
      const bakPath = path.join(projectRoot, pattern);
      if (await fs.pathExists(bakPath)) {
        await fs.remove(bakPath);
        if (verbose) console.log('[cleanup] Removed backup:', pattern);
      }
    }
  }
  
  // 3. Clean up any leftover temp files in /tmp/sessions
  if (await fs.pathExists(SESSION_DIR)) {
    const entries = await fs.readdir(SESSION_DIR);
    for (const entry of entries) {
      const metaPath = path.join(SESSION_DIR, entry, 'metadata.json');
      if (!await fs.pathExists(metaPath)) {
        // No metadata — orphaned session dir
        await fs.remove(path.join(SESSION_DIR, entry)).catch(() => {});
        if (verbose) console.log('[cleanup] Removed orphaned session:', entry);
      }
    }
  }
  
  // 4. Remove stale generated outputs (older than 1 hour with no active session)
  const generatedDir = path.join(projectRoot, 'generated');
  if (await fs.pathExists(generatedDir)) {
    const entries = await fs.readdir(generatedDir);
    const now = Date.now();
    for (const entry of entries) {
      const fullPath = path.join(generatedDir, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory() && now - stat.mtimeMs > 3600000) {
          // Keep jk_cement as reference but clean others that are too old
          if (entry !== 'jk_cement') {
            await fs.remove(fullPath).catch(() => {});
            if (verbose) console.log('[cleanup] Removed stale generated:', entry);
          }
        }
      } catch (e) {}
    }
  }
  
  if (verbose) console.log('[cleanup] Done.');
  return { cleaned };
}

async function startupCleanup() {
  console.log('[cleanup] Startup cleanup...');
  await cleanup({ verbose: true });
}

module.exports = { cleanup, startupCleanup, cleanupExpiredSessions };
