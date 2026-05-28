const { createShare } = require('../lib/share-store');

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

module.exports = async function shareHandler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

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
};
