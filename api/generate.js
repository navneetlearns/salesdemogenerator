const { createSession, getSession } = require('../runtime/session-manager');
const { processAndStore: storeLogo } = require('../runtime/uploads/upload-logo');
const { processAndStore: storeCatalog } = require('../runtime/uploads/upload-catalog');
const Busboy = require('busboy');
const fs = require('fs-extra');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  try {
    // Detect content type: multipart = upload flow, JSON = URL flow
    const ct = req.headers['content-type'] || '';
    if (ct.includes('multipart/form-data')) {
      return await handleMultipartGenerate(req, res);
    }
    return await handleJsonGenerate(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message || 'Internal error' }));
  }
};

// JSON-based flow (URL ingestion or sessionId-based upload)
async function handleJsonGenerate(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const data = body ? JSON.parse(body) : {};
  const { url, journeys, sessionId } = data;
  const selected = (journeys && journeys.length) ? journeys : ['order_to_cash'];
  let session;
  if (sessionId) {
    session = await getSession(sessionId);
    if (!session) {
      // Session might be on a different Vercel instance. Create fresh.
      session = await createSession({ originalSessionId: sessionId, fromUploads: true });
    }
  } else {
    session = await createSession({ url, requestedJourneys: selected });
  }
  // Lazy-load generation modules
  try {
    const genSession = require('../runtime/generate-session');
    if (sessionId) await genSession.generateSessionFromUploads(session.id, { journeys: selected });
    else await genSession.generateSession(session.id, url, { journeys: selected });
  } catch (e) {
    console.error('[api/generate] error', e && e.stack || e);
    session.metadata = session.metadata || {};
    session.metadata.generationFailed = true;
    session.metadata.generationError = e.message;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ sessionId: session.id, status: 'failed', error: e.message }));
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ sessionId: session.id, status: 'complete' }));
}

// Multipart flow: logo + catalog + journeys in one request
async function handleMultipartGenerate(req, res) {
  const bb = Busboy({ headers: req.headers });
  const fields = {};
  let logoBuffer = null, logoName = null, logoMime = null;
  let catalogBuffer = null, catalogName = null, catalogMime = null;

  bb.on('field', (name, val) => { fields[name] = val; });
  bb.on('file', (name, file, info) => {
    const chunks = [];
    file.on('data', c => chunks.push(c));
    file.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (name === 'logo') { logoBuffer = buf; logoName = info.filename; logoMime = info.mimeType; }
      else if (name === 'catalog') { catalogBuffer = buf; catalogName = info.filename; catalogMime = info.mimeType; }
    });
  });

  await new Promise((resolve, reject) => {
    bb.on('finish', resolve);
    bb.on('error', reject);
    req.pipe(bb);
  });

  const selected = (fields.journeys) ? JSON.parse(fields.journeys) : ['order_to_cash'];
  const brandName = fields.brandName || 'brand';

  // Create session inline (same instance, no cross-instance issue)
  const session = await createSession({ brandName, uploadBrandName: brandName, fromUploads: true });

  // Store uploaded files
  if (logoBuffer) {
    const logoDir = path.join(session.paths.assets, 'brands');
    await fs.ensureDir(logoDir);
    const ext = path.extname(logoName || 'logo.png') || '.png';
    const logoFile = 'logo' + ext;
    await fs.writeFile(path.join(logoDir, logoFile), logoBuffer);
    // Also store for upload-logo processor
    const uploadsDir = path.join(session.paths.root, 'uploads');
    await fs.ensureDir(uploadsDir);
    await fs.writeFile(path.join(uploadsDir, logoFile), logoBuffer);
    session.metadata.uploadedLogo = logoFile;
  }
  if (catalogBuffer) {
    const uploadsDir = path.join(session.paths.root, 'uploads');
    await fs.ensureDir(uploadsDir);
    const catFile = catalogName || 'catalog.csv';
    await fs.writeFile(path.join(uploadsDir, catFile), catalogBuffer);
    session.metadata.uploadedCatalog = catFile;
  }
  await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });

  // Generate
  try {
    const genSession = require('../runtime/generate-session');
    await genSession.generateSessionFromUploads(session.id, { journeys: selected });
  } catch (e) {
    console.error('[api/generate:uploads] error', e && e.stack || e);
    session.metadata = session.metadata || {};
    session.metadata.generationFailed = true;
    session.metadata.generationError = e.message;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ sessionId: session.id, status: 'failed', error: e.message }));
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ sessionId: session.id, status: 'complete' }));
};
