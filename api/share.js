const { createShare, initHub, addJourneyToHub, getShare, readJourneyBlob } = require('../lib/share-store');

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
      const journeyType = req.query && req.query.journey;

      // Serve individual journey blob (v3 sub-request)
      if (journeyType) {
        const html = await readJourneyBlob(token, journeyType);
        res.setHeader('Cache-Control', 'private, no-store');
        return sendHtml(res, 200, html);
      }

      const share = await getShare(token);
      res.setHeader('Cache-Control', 'private, no-store');

      // v3: multi-blob hub — serve hub HTML that loads journeys dynamically
      if (share.version === 3 && share.journeyBlobs) {
        return serveMultiBlobHub(res, share);
      }

      // v2: config-based share — serve re-render page (client-side regeneration)
      if (share.config && !share.html) {
        return serveReRenderPage(res, share);
      }

      // v1: HTML-based share — serve HTML directly
      return sendHtml(res, 200, share.html);
    } catch (e) {
      if (e.code === 'SHARE_EXPIRED') return sendErrorHtml(res, 410, 'This share link has expired.');
      if (e.code === 'SHARE_NOT_FOUND' || e.code === 'SHARE_INVALID') return sendErrorHtml(res, 404, 'Share link not found.');
      if (e.code === 'JOURNEY_NOT_FOUND') return sendErrorHtml(res, 404, 'Journey not found in this share.');
      return sendErrorHtml(res, 500, 'Share link could not be opened.');
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);

      // v3 step 2: upload a single journey to an existing hub
      if (body.hubToken && body.journeyType && body.html) {
        const result = await addJourneyToHub(body.hubToken, body.journeyType, body.html);
        return sendJson(res, 200, result);
      }

      // v3 step 1: init hub (config + journeyTypes only, no HTML)
      if (body.config && body.journeyTypes && !body.html && !body.journeys) {
        const result = await initHub({ config: body.config, journeyTypes: body.journeyTypes, brandName: body.brandName }, { req });
        return sendJson(res, 200, result);
      }

      // v1/v2: HTML or config-based share (single request)
      const result = await createShare({
        html: body.html,
        config: body.config,
        brandName: body.brandName,
        journeyType: body.journeyType,
        journeyTypes: body.journeyTypes
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

function serveMultiBlobHub(res, share) {
  var config = share.config || {};
  var journeys = share.journeyBlobs || [];
  var token = share.token || '';
  var brandName = escAttr(config.name || share.brandName || 'Demo');
  var brandColor = escAttr(config.brandColor || '#075e54');

  var journeyList = journeys.map(function(j) {
    return { type: j.type, path: j.path };
  });

  var html = '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">' +
    '<title>' + brandName + ' — WhatsApp Commerce OS | ZoTok</title>' +
    '<style>' +
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
    'html,body{height:100%}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:#fff;display:flex;flex-direction:column}' +
    '.hp-strip{height:6px;background:' + brandColor + ';flex-shrink:0}' +
    '.hp-wrap{flex:1;display:flex;min-height:0}' +
    '.hp-left{width:42%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;border-right:1px solid #f0f0f0}' +
    '.hp-label{font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:2.5px;margin-bottom:10px}' +
    '.hp-title{font-size:32px;font-weight:800;color:#111;line-height:1.15;margin-bottom:16px;text-align:center}' +
    '.hp-title span{color:' + brandColor + '}' +
    '.hp-desc{font-size:13px;color:#555;line-height:1.65;text-align:center;max-width:320px;margin-bottom:28px}' +
    '.hp-badge{display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:24px;padding:9px 18px;font-size:12.5px;color:#222;font-weight:600}' +
    '.hp-stats{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;justify-content:center}' +
    '.hp-stat-pill{font-size:11px;font-weight:700;color:' + brandColor + ';background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:5px 13px}' +
    '.hp-right{flex:1;background:#f7f7f8;overflow-y:auto;padding:36px 32px 48px;position:relative}' +
    '.hp-section-label{font-size:10.5px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px}' +
    '.hp-card{display:flex;align-items:stretch;text-decoration:none;color:inherit;margin-bottom:10px;background:#fff;border-radius:14px;border:1px solid #e8e8e8;overflow:hidden;transition:box-shadow .15s,transform .15s;cursor:pointer}' +
    '.hp-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.1);transform:translateX(4px)}' +
    '.hp-card.loading{opacity:.6;pointer-events:none}' +
    '.hp-card-badge{background:var(--c);width:68px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:14px 0}' +
    '.hp-card-num{font-size:10.5px;font-weight:900;color:rgba(255,255,255,.45);letter-spacing:.5px}' +
    '.hp-card-emoji{font-size:26px;line-height:1.1}' +
    '.hp-card-body{flex:1;padding:14px 52px 13px 18px;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 50%,calc(100% - 22px) 100%,0 100%);display:flex;flex-direction:column;justify-content:center;gap:5px}' +
    '.hp-card-top{display:flex;align-items:center;gap:10px}' +
    '.hp-card-title{font-size:14.5px;font-weight:700;color:#111;flex:1}' +
    '.hp-card-desc{font-size:12px;color:#666;line-height:1.45;max-width:480px}' +
    '.journey-view{display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:#f7f7f8;z-index:10;flex-direction:column}' +
    '.journey-view.active{display:flex}' +
    '.jv-bar{display:flex;align-items:center;gap:8px;padding:10px 16px;background:#fff;border-bottom:1px solid #eee;flex-shrink:0}' +
    '.jv-back{font-size:12px;font-weight:600;color:' + brandColor + ';cursor:pointer;padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.15);background:rgba(0,0,0,.03);transition:background .15s}' +
    '.jv-back:hover{background:rgba(0,0,0,.07)}' +
    '.jv-title{font-size:14px;font-weight:700;color:#111}' +
    '.jv-frame{flex:1;width:100%;border:none}' +
    '@media(max-width:768px){.hp-wrap{flex-direction:column}.hp-left{width:100%;border-right:none;border-bottom:1px solid #f0f0f0;padding:32px 24px 28px}.hp-title{font-size:26px}.hp-right{padding:24px 16px 40px}.hp-card-badge{width:58px}.hp-card-emoji{font-size:22px}.hp-card-title{font-size:13.5px}.hp-card-desc{display:none}}' +
    '</style></head><body>' +
    '<div class="hp-strip"></div>' +
    '<div class="hp-wrap">' +
    '<div class="hp-left">' +
    '<div class="hp-label">' + brandName + '</div>' +
    '<h1 class="hp-title">WhatsApp<br><span>Commerce OS</span></h1>' +
    '<p class="hp-desc">A unified WhatsApp operating system for ' + brandName + ' retail ecosystem — retailer, field executive, and distributor journeys on a single number. Powered by ZoTok.</p>' +
    '<div class="hp-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#25D366"/><path d="M17.5 14.5c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8.9-1 1.1-.4.2-.7.1a8.5 8.5 0 01-2.6-1.6 9.9 9.9 0 01-1.8-2.2c-.2-.3 0-.5.1-.6l.5-.6.3-.5a.4.4 0 000-.4l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4A4.4 4.4 0 006 9.7a7.6 7.6 0 001.6 4c1.8 2.4 4.1 3.8 7.8 4.3.8.1 1.5-.1 2-.4a4 4 0 001.3-1.7c.1-.4.1-.7 0-.9z" fill="#fff"/></svg>' + brandName + '</div>' +
    '<div class="hp-stats"><div class="hp-stat-pill">● ' + journeys.length + ' Modules</div><div class="hp-stat-pill">● Live Demo</div></div>' +
    '</div>' +
    '<div class="hp-right">' +
    '<div id="hp-cards-container">' +
    '<div class="hp-section-label">Select a Module to Explore</div>' +
    '<div id="hp-cards"></div>' +
    '</div>' +
    '<div class="journey-view" id="jv">' +
    '<div class="jv-bar">' +
    '<div class="jv-back" onclick="backToCards()">← Back to Modules</div>' +
    '<div class="jv-title" id="jv-title"></div>' +
    '</div>' +
    '<iframe class="jv-frame" id="jv-frame" src="about:blank"></iframe>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<script>window._hubJourneys = ' + JSON.stringify(journeyList) + ';</script>' +
    '<script>' +
    '(function(){' +
    'var cache = {};' +
    'var loading = {};' +
    'var currentBlobUrl = null;' +
    'var journeys = window._hubJourneys || [];' +
    'var JOURNEY_META = {' +
    '  order_to_cash:{title:"Order to Cash",emoji:"\\u{1F6D2}",color:"#1565C0",desc:"End-to-end order flow"},' +
    '  field_ops_expense:{title:"Field Ops & Expense",emoji:"\\u{1F454}",color:"#00695C",desc:"Field team management"},' +
    '  automated_collections:{title:"Automated Collections",emoji:"\\u{1F4B0}",color:"#2E7D32",desc:"Payment collection"},' +
    '  dealer_engagement:{title:"Dealer Engagement",emoji:"\\u{1F91D}",color:"#E65100",desc:"Dealer communication"},' +
    '  retailer_onboarding:{title:"Retailer Onboarding",emoji:"\\u{1F3EA}",color:"#C62828",desc:"New retailer setup"},' +
    '  retailer_loyalty:{title:"Retailer Loyalty",emoji:"\\u{1F3C6}",color:"#6A1B9A",desc:"Loyalty programs"},' +
    '  campaigns_queries:{title:"Campaigns & Queries",emoji:"\\u{1F4E2}",color:"#AD1457",desc:"Marketing campaigns"},' +
    '  dt_fulfillment_payment:{title:"DT Fulfillment",emoji:"\\u{1F69A}",color:"#4527A0",desc:"Fulfillment & payment"},' +
    '  retailer_activation:{title:"Retailer Activation",emoji:"\\u{26A1}",color:"#F57F17",desc:"Activation campaigns"}' +
    '};' +
    'var cardsHtml="";' +
    'for(var i=0;i<journeys.length;i++){' +
    '  var jt=journeys[i].type;' +
    '  var m=JOURNEY_META[jt]||{title:jt,emoji:"\\u{1F4F1}",color:"#666",desc:"WhatsApp journey"};' +
    '  cardsHtml+=\'<div class="hp-card" id="card-\'+jt+\'" style="--c:\'+m.color+\'" onclick="loadJourney(\\\'\'+jt+\'\\\')">\' +
    '    \'<div class="hp-card-badge"><div class="hp-card-num">\'+String(i+1).padStart(2,"0")+\'</div><div class="hp-card-emoji">\'+m.emoji+\'</div></div>\' +
    '    \'<div class="hp-card-body"><div class="hp-card-top"><div class="hp-card-title">\'+m.title+\'</div></div>\' +
    '    \'<div class="hp-card-desc">\'+m.desc+\'</div></div></div>\';' +
    '}' +
    'document.getElementById("hp-cards").innerHTML=cardsHtml;' +
    'function fetchJourney(jt){' +
    '  if(cache[jt])return Promise.resolve(cache[jt]);' +
    '  if(loading[jt])return loading[jt];' +
    '  loading[jt]=fetch("/api/share?token=' + token + '&journey="+jt)' +
    '    .then(function(r){if(!r.ok)throw new Error("Failed to load");return r.text();})' +
    '    .then(function(html){cache[jt]=html;loading[jt]=null;return html;})' +
    '    .catch(function(e){loading[jt]=null;throw e;});' +
    '  return loading[jt];' +
    '}' +
    'window.loadJourney=function(jt){' +
    '  var card=document.getElementById("card-"+jt);' +
    '  if(card)card.classList.add("loading");' +
    '  fetchJourney(jt).then(function(html){' +
    '    if(card)card.classList.remove("loading");' +
    '    if(currentBlobUrl)URL.revokeObjectURL(currentBlobUrl);' +
    '    var blob=new Blob([html],{type:"text/html;charset=utf-8"});' +
    '    currentBlobUrl=URL.createObjectURL(blob);' +
    '    document.getElementById("jv-frame").src=currentBlobUrl;' +
    '    var m=JOURNEY_META[jt]||{};' +
    '    document.getElementById("jv-title").textContent=m.title||jt;' +
    '    document.getElementById("hp-cards-container").style.display="none";' +
    '    document.getElementById("jv").classList.add("active");' +
    '  }).catch(function(e){' +
    '    if(card)card.classList.remove("loading");' +
    '    alert("Failed to load: "+(e.message||"Unknown error"));' +
    '  });' +
    '};' +
    'window.backToCards=function(){' +
    '  document.getElementById("jv-frame").src="about:blank";' +
    '  document.getElementById("jv").classList.remove("active");' +
    '  document.getElementById("hp-cards-container").style.display="";' +
    '};' +
    '})();' +
    '</script>' +
    '</body></html>';

  sendHtml(res, 200, html);
}

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
