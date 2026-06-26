// functions/p/[[catchall]].js
// Handles branded share URLs: /p/{brand}/{slug}/
// Reads from Cloudflare KV and serves share content.

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Route: /p/{brand}/{slug}/ — branded share URL (hub or single)
  const brandMatch = path.match(/^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  if (brandMatch) {
    const brand = brandMatch[1];
    const slug = brandMatch[2];
    const token = brand + '/' + slug;
    const kvKey = 'shares/' + token;

    const share = await env.SHARES.get(kvKey, { type: 'json' });
    if (!share) {
      return new Response(JSON.stringify({
        error: 'Share not found',
        kvKey,
        brand,
        slug,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // v3: multi-blob hub — serve hub HTML that loads journeys dynamically
    if (share.version === 3 && share.journeyBlobs) {
      return new Response(buildHubHtml(share, token, brand), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
      });
    }

    // v1: direct HTML blob
    if (share.html) {
      return new Response(share.html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
      });
    }

    return new Response('Invalid share format', { status: 500 });
  }

  // Route: /p/{brand}/{slug}/{journey} — individual journey sub-request (v3)
  const journeyMatch = path.match(/^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9_-]+)\/?$/);
  if (journeyMatch) {
    const token = journeyMatch[1] + '/' + journeyMatch[2];
    const journeyType = journeyMatch[3];

    const html = await env.SHARES.get('shares/' + token + '_' + journeyType);
    if (!html) {
      return new Response('Journey not found', { status: 404 });
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }

  // Unknown /p/ paths
  return new Response('Not Found', { status: 404 });
}

function buildHubHtml(share, token, brand) {
  var journeyTypes = share.journeyTypes || [];
  var cardsHtml = '';
  for (var i = 0; i < journeyTypes.length; i++) {
    var jt = journeyTypes[i];
    var label = jt.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    cardsHtml += '<div class="card" data-journey="' + jt + '">' +
      '<h3>' + label + '</h3>' +
      '<p>Click to view</p></div>';
  }

  var basePath = '/p/' + brand + '/';

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + brand.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) + ' — Demos</title>' +
    '<style>*{box-sizing:border-box}' +
    'body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f8f9fa;color:#333}' +
    '.hub{max-width:1200px;margin:0 auto;padding:24px}' +
    '.hub h2{margin:0 0 20px;font-size:1.5rem;text-transform:capitalize}' +
    '#hp-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}' +
    '.card{background:#fff;border-radius:12px;padding:20px;cursor:pointer;' +
    'box-shadow:0 1px 3px rgba(0,0,0,.08);transition:all .2s;border:1px solid #eee}' +
    '.card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}' +
    '.card h3{margin:0 0 6px;font-size:1rem}' +
    '.card p{margin:0;color:#999;font-size:.85rem}' +
    '#journey-frame{display:none;width:100%;height:100vh;border:none;position:fixed;top:0;left:0;z-index:100}' +
    '#back-bar{display:none;position:fixed;top:0;left:0;right:0;z-index:101;background:#fff;' +
    'padding:10px 20px;box-shadow:0 1px 3px rgba(0,0,0,.1);cursor:pointer;font-size:14px;color:#666}' +
    '#back-bar:hover{background:#f5f5f5}</style></head>' +
    '<body><div class="hub"><h2>' + brand.replace(/-/g, ' ') + '</h2>' +
    '<div id="hp-cards">' + cardsHtml + '</div></div>' +
    '<div id="back-bar">&larr; Back to Hub</div>' +
    '<iframe id="journey-frame"></iframe>' +
    '<script>var basePath="' + basePath + '";' +
    'document.getElementById("hp-cards").addEventListener("click",function(e){' +
    'var card=e.target.closest("[data-journey]");if(!card)return;' +
    'var jt=card.getAttribute("data-journey");' +
    'fetch(basePath+jt).then(function(r){return r.text()}).then(function(html){' +
    'var blob=new Blob([html],{type:"text/html"});var url=URL.createObjectURL(blob);' +
    'var frame=document.getElementById("journey-frame");frame.src=url;' +
    'frame.style.display="block";document.getElementById("back-bar").style.display="block";' +
    'document.querySelector(".hub").style.display="none";' +
    '});});' +
    'document.getElementById("back-bar").addEventListener("click",function(){' +
    'var frame=document.getElementById("journey-frame");URL.revokeObjectURL(frame.src);' +
    'frame.src="";frame.style.display="none";this.style.display="none";' +
    'document.querySelector(".hub").style.display="block";' +
    '});</script></body></html>';
}
