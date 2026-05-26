const { createSession, getSession } = require('../runtime/session-manager');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' }));
  }
  try {
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
      session = await createSession({ originalSessionId: sessionId, fromUploads: true });
    }
  } else {
    session = await createSession({ url, requestedJourneys: selected });
  }
  try {
    const gen = require('../runtime/generate-session');
    if (sessionId) await gen.generateSessionFromUploads(session.id, { journeys: selected });
    else await gen.generateSession(session.id, url, { journeys: selected });
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

async function handleMultipartGenerate(req, res) {
  const Busboy = require('busboy');
  const fs = require('fs-extra');
  const path = require('path');
  const bb = Busboy({ headers: req.headers });
  const fields = {};
  let logoBuffer = null, logoName = null;
  let catalogBuffer = null, catalogName = null;

  bb.on('field', (name, val) => { fields[name] = val; });
  bb.on('file', (name, file, info) => {
    const chunks = [];
    file.on('data', c => chunks.push(c));
    file.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (name === 'logo') { logoBuffer = buf; logoName = info.filename; }
      else if (name === 'catalog') { catalogBuffer = buf; catalogName = info.filename; }
    });
  });

  await new Promise((resolve, reject) => {
    bb.on('finish', resolve);
    bb.on('error', reject);
    req.pipe(bb);
  });

  const selected = fields.journeys ? JSON.parse(fields.journeys) : ['order_to_cash'];
  const session = await createSession({ fromUploads: true });

  // Write uploaded files directly (avoid sharp - native binding fails on Vercel)
  if (logoBuffer) {
    const uploadsDir = path.join(session.paths.root, 'uploads');
    await fs.ensureDir(uploadsDir);
    const ext = path.extname(logoName || 'logo.png') || '.png';
    await fs.writeFile(path.join(uploadsDir, 'logo' + ext), logoBuffer);
    // Also put in brands dir so buildBrandFromSession finds it
    const brandsDir = path.join(session.paths.assets, 'brands');
    await fs.ensureDir(brandsDir);
    await fs.writeFile(path.join(brandsDir, 'logo' + ext), logoBuffer);
    session.metadata.uploadedLogo = 'logo' + ext;
  }
  if (catalogBuffer) {
    const uploadsDir = path.join(session.paths.root, 'uploads');
    await fs.ensureDir(uploadsDir);
    await fs.writeFile(path.join(uploadsDir, catalogName || 'catalog.csv'), catalogBuffer);
    session.metadata.uploadedCatalog = catalogName || 'catalog.csv';
  }
  await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });

  try {
    const gen = require('../runtime/generate-session');
    await gen.generateSessionFromUploads(session.id, { journeys: selected });
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
