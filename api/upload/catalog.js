const Busboy = require('busboy');
const { getSession } = require('../../../runtime/session-manager');
const { processAndStore } = require('../../../runtime/uploads/upload-catalog');

module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  const bb = Busboy({ headers: req.headers });
  const fields = {};
  let fileBuffer = null;
  let fileName = null;
  let mimeType = null;

  bb.on('field', (name, val) => { fields[name] = val; });
  bb.on('file', (name, file, info) => {
    fileName = info.filename;
    mimeType = info.mimeType;
    const chunks = [];
    file.on('data', c => chunks.push(c));
    file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
  });
  bb.on('error', err => { res.statusCode = 500; res.end(String(err)); });
  bb.on('finish', async () => {
    try {
      const sessionId = fields.sessionId || req.query.sessionId;
      if (!sessionId) return res.status(400).end('sessionId required');
      const session = await getSession(sessionId);
      if (!session) return res.status(404).end('Session not found');
      if (!fileBuffer) return res.status(400).end('No file');
      const file = { buffer: fileBuffer, originalname: fileName, mimetype: mimeType, size: fileBuffer.length };
      const out = await processAndStore(session, file);
      session.metadata.uploadedCatalog = out.savedAs;
      await require('fs-extra').writeJson(require('path').join(session.paths.root, 'metadata.json'), session, { spaces: 2 });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ saved: out.savedAs }));
    } catch (e) { res.statusCode = 500; res.end(String(e.message || e)); }
  });
  req.pipe(bb);
};
