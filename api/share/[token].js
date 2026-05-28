const { getShare } = require('../../lib/share-store');

function sendError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><head><title>Share Link</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,sans-serif;max-width:680px;margin:64px auto;padding:0 20px;line-height:1.5"><h1>' + message + '</h1><p>Please ask the sender to generate a fresh demo share link.</p></body></html>');
}

module.exports = async function sharedDemoHandler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  try {
    const token = (req.query && req.query.token) ||
      String(req.url || '').split('?')[0].split('/').filter(Boolean).pop() ||
      '';
    const share = await getShare(token);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end(share.html);
  } catch (e) {
    if (e.code === 'SHARE_EXPIRED') return sendError(res, 410, 'This share link has expired.');
    if (e.code === 'SHARE_NOT_FOUND' || e.code === 'SHARE_INVALID') return sendError(res, 404, 'Share link not found.');
    return sendError(res, 500, 'Share link could not be opened.');
  }
};
