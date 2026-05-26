const { createSession } = require('../../runtime/session-manager');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).end(JSON.stringify({ error: 'Method Not Allowed' }));
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    const session = await createSession({ uploadBrandName: data.brandName });
    res.end(JSON.stringify({ sessionId: session.id, expiresAt: session.expiresAt }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: e.message || 'Internal error' }));
  }
};
