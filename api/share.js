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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();

  if (req.method === 'GET') {
    try {
      const token = (req.query && req.query.token) ||
        String(req.url || '').split('?')[0].split('/').filter(Boolean).pop() ||
        '';
      const share = await getShare(token);
      res.setHeader('Cache-Control', 'private, no-store');

      // v2: config-based share — serve re-render page (client-side regeneration)
      if (share.config && !share.html) {
        return serveReRenderPage(res, share);
      }

      // v1: HTML-based share — serve HTML directly
      return sendHtml(res, 200, share.html);
    } catch (e) {
      if (e.code === 'SHARE_EXPIRED') return sendErrorHtml(res, 410, 'This share link has expired.');
      if (e.code === 'SHARE_NOT_FOUND' || e.code === 'SHARE_INVALID') return sendErrorHtml(res, 404, 'Share link not found.');
      return sendErrorHtml(res, 500, 'Share link could not be opened.');
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await createShare({
        html: body.html,
        config: body.config,
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

function serveReRenderPage(res, share) {
  var config = share.config || {};
  var configJson = JSON.stringify(config);
  var html = '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">' +
    '<title>' + escAttr(config.name || 'Demo') + ' - WhatsApp Commerce OS | ZoTok</title>' +
    '<style>' +
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:Arial,sans-serif;background:#111;color:#eee;min-height:100vh}' +
    '.loading{display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px}' +
    '.spinner{width:40px;height:40px;border:4px solid #333;border-top-color:#25D366;border-radius:50%;animation:spin .8s linear infinite}' +
    '@keyframes spin{to{transform:rotate(360deg)}}' +
    '.error{color:#f44;text-align:center;padding:40px}' +
    '#hub-container{width:100%;min-height:100vh}' +
    '</style>' +
    '</head><body>' +
    '<div id="hub-container" class="loading">' +
    '<div class="spinner"></div>' +
    '<div>Loading demo...</div>' +
    '</div>' +
    '<script>window._shareConfig = ' + configJson + ';</script>' +
    '<script src="/js/handlebars.min.js"></script>' +
    '<script src="/js/demo-renderer.js"></script>' +
    '<script>' +
    '(function(){' +
    'var config = window._shareConfig;' +
    'var container = document.getElementById("hub-container");' +
    'if (!window.DemoRenderer) {' +
    '  container.className = "error";' +
    '  container.innerHTML = "<h2>Renderer not loaded</h2><p>Please try refreshing the page.</p>";' +
    '  return;' +
    '}' +
    'DemoRenderer.renderMultiJourney(config).then(function(result) {' +
    '  document.open();' +
    '  document.write(result.html);' +
    '  document.close();' +
    '}).catch(function(err) {' +
    '  container.className = "error";' +
    '  container.innerHTML = "<h2>Failed to render demo</h2><p>" + (err.message || "Unknown error") + "</p>";' +
    '  console.error(err);' +
    '});' +
    '})();' +
    '</script>' +
    '</body></html>';
  sendHtml(res, 200, html);
}

function escAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
