const fs = require('fs-extra');
const path = require('path');
const { getSession } = require('../../runtime/session-manager');
const { saveContentOverrides } = require('../../services/content-adapter');
const { renderSessionContent } = require('../../runtime/generate-session');

module.exports = async function saveContentHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, industry, acceptedLabels, adaptationDiff } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired' });

    const saveResult = await saveContentOverrides(session, {
      industry: industry || session.metadata?.industry || 'general',
      acceptedLabels: acceptedLabels || {},
      adaptationDiff: adaptationDiff || {},
    });

    const journeys = session.metadata?.journeys && session.metadata.journeys.length
      ? session.metadata.journeys
      : ['order_to_cash'];
    await renderSessionContent(session, journeys, { acceptedLabels: acceptedLabels || {} });

    session.metadata = session.metadata || {};
    session.metadata.contentOverridePath = saveResult.savedAs;
    await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      status: 'saved',
      savedAs: saveResult.savedAs,
      content: saveResult.record,
    });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
