module.exports = async (req, res) => {
  const results = {};
  try { results.t0 = 'session-manager: ' + (require('../runtime/session-manager') ? 'OK' : 'FAIL'); } catch(e) { results.t0 = 'session-manager: ' + e.message; }
  try { results.t1 = 'handlebars: ' + (require('handlebars') ? 'OK' : 'FAIL'); } catch(e) { results.t1 = 'handlebars: ' + e.message; }
  try { results.t2 = 'fs-extra: ' + (require('fs-extra') ? 'OK' : 'FAIL'); } catch(e) { results.t2 = 'fs-extra: ' + e.message; }
  try { results.t3 = 'generate-session: ' + (require('../runtime/generate-session') ? 'OK' : 'FAIL'); } catch(e) { results.t3 = 'generate-session: ' + e.message; }
  try { results.t4 = 'brand-generator: ' + (require('../runtime/brand-generator') ? 'OK' : 'FAIL'); } catch(e) { results.t4 = 'brand-generator: ' + e.message; }
  try { results.t5 = 'brand-ingestion: ' + (require('../runtime/brand-ingestion') ? 'OK' : 'FAIL'); } catch(e) { results.t5 = 'brand-ingestion: ' + e.message; }
  try { results.t6 = 'serverless-builder: ' + (require('../runtime/serverless-builder') ? 'OK' : 'FAIL'); } catch(e) { results.t6 = 'serverless-builder: ' + e.message; }
  try { results.t7 = 'journey-normalizer: ' + (require('../lib/journey-normalizer') ? 'OK' : 'FAIL'); } catch(e) { results.t7 = 'journey-normalizer: ' + e.message; }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(results));
};
