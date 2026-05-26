const { getSession } = require('../../../../../runtime/session-manager');
const path = require('path');
const fs = require('fs-extra');

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.setHeader('Content-Type', 'application/json'); return res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' })); }
  try {
    const { sessionId, mode } = req.query || {};
    if (!sessionId) return res.status(400).end(JSON.stringify({ error: 'Missing sessionId' }));
    const session = await getSession(sessionId);
    if (!session) return res.status(404).end(JSON.stringify({ error: 'Session not found' }));
    const exportDir = path.join(session.paths.root, 'exports');
    const isZip = (mode === 'zip');
    const exportFile = isZip ? 'demo-package.zip' : (session.metadata && session.metadata.brandId ? session.metadata.brandId + '-demo.html' : 'brand-demo.html');
    const filePath = path.join(exportDir, exportFile);
    if (!await fs.pathExists(filePath)) return res.status(404).end(JSON.stringify({ error: 'Export not found' }));
    res.setHeader('Content-Disposition', 'attachment; filename="' + exportFile + '"');
    res.setHeader('Content-Type', isZip ? 'application/zip' : 'text/html');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (e) { res.status(500).end(JSON.stringify({ error: e.message || 'Internal error' })); }
};
