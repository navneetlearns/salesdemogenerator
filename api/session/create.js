const { createSession } = require('../../runtime/session-manager');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    const session = await createSession({ uploadBrandName: data.brandName });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ sessionId: session.id, expiresAt: session.expiresAt }));
  } catch (e) {
    res.statusCode = 500; res.end(String(e.message || e));
  }
};
