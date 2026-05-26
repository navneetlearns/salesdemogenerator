const { getSession } = require('../../../runtime/session-manager');
const { exportSession } = require('../../../runtime/export-engine');
const { validateExport } = require('../../../runtime/export-validator');
const path = require('path');
const fs = require('fs-extra');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' }));
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    const mode = data.mode === 'zip' ? 'zip' : 'single';
    const { sessionId } = req.query || {};
    if (!sessionId) return res.status(400).end(JSON.stringify({ error: 'Missing sessionId' }));
    const session = await getSession(sessionId);
    if (!session) return res.status(404).end(JSON.stringify({ error: 'Session not found' }));
    const result = await exportSession(session.id, mode);
    try { await validateExport(session); } catch (ve) {
      await fs.remove(path.join(session.paths.root, 'exports')).catch(()=>{});
      return res.status(500).end(JSON.stringify({ error: 'Export validation failed: ' + ve.message }));
    }
    res.end(JSON.stringify({ status: 'exported', mode, files: result.files }));
  } catch (e) { res.status(500).end(JSON.stringify({ error: e.message || 'Internal error' })); }
};
