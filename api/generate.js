const { createSession, getSession } = require('../runtime/session-manager');
const { generateSession, generateSessionFromUploads } = require('../runtime/generate-session');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    const { url, journeys, sessionId } = data;
    const selected = (journeys && journeys.length) ? journeys : ['order_to_cash'];
    let session;
    if (sessionId) {
      session = await getSession(sessionId);
      if (!session) return res.status(404).end('Session not found');
    } else {
      session = await createSession({ url, requestedJourneys: selected });
    }
    // start generation async and return session id
    (async () => {
      try {
        if (sessionId) await generateSessionFromUploads(session.id, { journeys: selected });
        else await generateSession(session.id, url, { journeys: selected });
      } catch (e) { console.error('[api/generate] error', e && e.stack || e); }
    })();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ sessionId: session.id, status: 'generating', expiresAt: session.expiresAt }));
  } catch (e) { res.statusCode = 500; res.end(String(e.message || e)); }
};
