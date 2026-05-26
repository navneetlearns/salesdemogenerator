const { createSession, getSession } = require('../runtime/session-manager');

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
    // Lazy-load generation modules to avoid function invocation failures
    try {
      const genSession = require('../runtime/generate-session');
      if (sessionId) await genSession.generateSessionFromUploads(session.id, { journeys: selected });
      else await genSession.generateSession(session.id, url, { journeys: selected });
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
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message || 'Internal error' }));
  }
};
