const { getSession, destroySession } = require('../../runtime/session-manager');

module.exports = async (req, res) => {
  const { id } = req.query || {};
  res.setHeader('Content-Type', 'application/json');
  if (!id) return res.status(400).end(JSON.stringify({ error: 'Missing session id' }));
  try {
    if (req.method === 'GET') {
      const s = await getSession(id);
      if (!s) return res.status(404).end(JSON.stringify({ error: 'Session not found' }));
      return res.end(JSON.stringify(s));
    }
    if (req.method === 'DELETE') {
      await destroySession(id);
      return res.end(JSON.stringify({ status: 'deleted', sessionId: id }));
    }
    res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e.message || 'Internal error' }));
  }
};
