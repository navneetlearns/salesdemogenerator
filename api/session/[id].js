const { getSession, destroySession } = require('../../runtime/session-manager');

module.exports = async (req, res) => {
  const { id } = req.query || {};
  if (!id) return res.status(400).end('Missing session id');
  try {
    if (req.method === 'GET') {
      const s = await getSession(id);
      if (!s) return res.status(404).end('Not found');
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(s));
    }
    if (req.method === 'DELETE') {
      await destroySession(id);
      return res.end(JSON.stringify({ status: 'deleted', sessionId: id }));
    }
    res.statusCode = 405; res.end('Method Not Allowed');
  } catch (e) { res.statusCode = 500; res.end(String(e.message || e)); }
};
