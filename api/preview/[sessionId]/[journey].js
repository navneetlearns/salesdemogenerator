const { getSession } = require('../../../../runtime/session-manager');
const fs = require('fs-extra');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end('Method Not Allowed');
  try {
    const { sessionId, journey } = req.query || {};
    if (!sessionId || !journey) return res.status(400).end('Missing params');
    const session = await getSession(sessionId);
    if (!session) return res.status(404).end('Session not found');
    const filePath = path.join(session.paths.generated, journey + '.html');
    if (!await fs.pathExists(filePath)) return res.status(404).end('Journey not generated');
    const html = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  } catch (e) { res.statusCode = 500; res.end(String(e.message || e)); }
};
