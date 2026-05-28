const { createShare, getShare } = require('../lib/share-store');

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function sendErrorHtml(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><head><title>Share Link</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,sans-serif;max-width:680px;margin:64px auto;padding:0 20px;line-height:1.5"><h1>' + message + '</h1><p>Please ask the sender to generate a fresh demo share link.</p></body></html>');
}

module.exports = async function shareHandler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();

  // GET /api/share?token=<hex> — retrieve a shared demo
  if (req.method === 'GET') {
    try {
      const token = (req.query && req.query.token) ||
        String(req.url || '').split('?')[0].split('/').filter(Boolean).pop() ||
        '';
      const share = await getShare(token);
      res.setHeader('Cache-Control', 'private, no-store');
      return sendHtml(res, 200, share.html);
    } catch (e) {
      if (e.code === 'SHARE_EXPIRED') return sendErrorHtml(res, 410, 'This share link has expired.');
      if (e.code === 'SHARE_NOT_FOUND' || e.code === 'SHARE_INVALID') return sendErrorHtml(res, 404, 'Share link not found.');
      return sendErrorHtml(res, 500, 'Share link could not be opened.');
    }
  }

  // POST /api/share — create a new share
  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await createShare({
        html: body.html,
        brandName: body.brandName,
        journeyType: body.journeyType
      }, { req });
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, e.statusCode || 500, {
        error: e.message || 'Internal error',
        code: e.code || 'SHARE_CREATE_FAILED'
      });
    }
  }

  return sendJson(res, 405, { error: 'Method Not Allowed' });
};
