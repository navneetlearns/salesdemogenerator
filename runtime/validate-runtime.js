const fs = require('fs-extra');
const path = require('path');
const { SESSION_DIR } = require('./session-manager');

async function validateRuntime(options = {}) {
  const verbose = options.verbose !== false;
  let passed = 0, failed = 0, warnings = 0;
  
  function check(condition, label, isWarning) {
    if (condition) {
      if (verbose) console.log('  PASS: ' + label);
      passed++;
    } else {
      if (isWarning) { if (verbose) console.log('  WARN: ' + label); warnings++; }
      else { if (verbose) console.log('  FAIL: ' + label); failed++; }
    }
  }
  
  console.log('\n=== Runtime Validation ===\n');
  
  // 1. Check session manager
  console.log('[1] Session Manager');
  const sm = require('./session-manager');
  check(typeof sm.createSession === 'function', 'createSession() exists');
  check(typeof sm.getSession === 'function', 'getSession() exists');
  check(typeof sm.destroySession === 'function', 'destroySession() exists');
  check(typeof sm.cleanupExpiredSessions === 'function', 'cleanupExpiredSessions() exists');
  check(sm.SESSION_TTL_MS === 1800000, 'SESSION_TTL_MS = 30min');
  
  // 2. Check brand ingestion modules
  console.log('\n[2] Brand Ingestion');
  const bi = require('./brand-ingestion');
  check(typeof bi.ingestBrand === 'function', 'ingestBrand() exists');
  const scrapeSite = require('./brand-ingestion/scrape-site');
  check(typeof scrapeSite.scrapeSite === 'function', 'scrapeSite() exists');
  const extractLogo = require('./brand-ingestion/extract-logo');
  check(typeof extractLogo.extractLogo === 'function', 'extractLogo() exists');
  const extractColors = require('./brand-ingestion/extract-colors');
  check(typeof extractColors.extractColors === 'function', 'extractColors() exists');
  const extractProducts = require('./brand-ingestion/extract-products');
  check(typeof extractProducts.extractProducts === 'function', 'extractProducts() exists');
  
  // 3. Check generation pipeline
  console.log('\n[3] Generation Pipeline');
  const gs = require('./generate-session');
  check(typeof gs.generateSession === 'function', 'generateSession() exists');
  check(typeof gs.createJourneyJsons === 'function', 'createJourneyJsons() exists');
  
  // 4. Check preview server
  console.log('\n[4] Preview Server');
  const ps = require('./preview-server');
  check(typeof ps.createPreviewServer === 'function', 'createPreviewServer() exists');
  
  // 5. Check export engine
  console.log('\n[5] Export Engine');
  const ee = require('./export-engine');
  check(typeof ee.exportSession === 'function', 'exportSession() exists');
  
  // 6. Check cleanup
  console.log('\n[6] Cleanup');
  const cl = require('./cleanup');
  check(typeof cl.cleanup === 'function', 'cleanup() exists');
  check(typeof cl.startupCleanup === 'function', 'startupCleanup() exists');
  
  // 7. Check vercel adapter
  console.log('\n[7] Vercel Adapter');
  const vc = require('./vercel');
  check(typeof vc.init === 'function', 'init() exists');
  check(typeof vc.vercelHandler === 'function', 'vercelHandler() exists');
  check(typeof vc.getCachedTemplate === 'function', 'getCachedTemplate() exists');
  
  // 8. Check session directory write-ability
  console.log('\n[8] Filesystem');
  try {
    await fs.ensureDir(SESSION_DIR);
    const testId = 'test-' + Date.now();
    const testDir = path.join(SESSION_DIR, testId);
    await fs.ensureDir(testDir);
    await fs.writeFile(path.join(testDir, 'test.txt'), 'ok');
    const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf8');
    check(content === 'ok', 'Session directory writable');
    await fs.remove(testDir);
  } catch (e) {
    check(false, 'Session directory writable: ' + e.message);
  }
  
  // 9. Check dependencies
  console.log('\n[9] Dependencies');
  const deps = ['cheerio', 'express', 'got', 'uuid'];
  for (const dep of deps) {
    try { require(dep); check(true, dep + ' installed'); }
    catch (e) { check(false, dep + ' installed'); }
  }
  
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed, ' + warnings + ' warnings ===\n');
  return { passed, failed, warnings };
}

if (require.main === module) {
  validateRuntime({ verbose: true }).then(r => process.exit(r.failed > 0 ? 1 : 0));
}

module.exports = { validateRuntime };
