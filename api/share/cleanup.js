const { cleanupExpiredShares } = require('../../lib/share-store');

module.exports = async function cleanupSharesHandler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const result = await cleanupExpiredShares();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = e.statusCode || 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message || 'Internal error', code: e.code || 'SHARE_CLEANUP_FAILED' }));
  }
};
