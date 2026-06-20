// functions/api/share.js
// Handles POST (create share) and GET (retrieve share)
// Uses Cloudflare KV for storage
// Branded URLs: /p/{brand}/{slug}/ — hides base URL

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    // Only handle routes this Worker owns: /p/* and /api/share
    const isShareRoute = path.startsWith('/p/') || path === '/api/share' || path.startsWith('/api/share?');
    if (!isShareRoute) {
      return new Response('Not Found', { status: 404 });
    }

    if (request.method === 'GET') {
      return handleGet(url, env);
    }

    if (request.method === 'POST') {
      return handlePost(request, url, env);
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
};

async function handleGet(url, env) {
  const path = url.pathname;

  // Only handle /p/ routes and /api/share — pass everything else through
  if (!path.startsWith('/p/') && !path.startsWith('/api/share')) {
    return null; // Let other Workers handle this
  }

  // Route: /p/{brand}/{slug}/ — branded share URL
  const brandMatch = path.match(/^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  if (brandMatch) {
    const brand = brandMatch[1];
    const slug = brandMatch[2];
    const token = brand + '/' + slug;

    const share = await env.SHARES.get('shares/' + token, { type: 'json' });
    if (!share) {
      return new Response(buildExpiredPage(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
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

  // Route: /api/share?token=... — legacy compat (redirects to branded URL)
  const legacyToken = url.searchParams.get('token');
  if (legacyToken) {
    const share = await env.SHARES.get('shares/' + legacyToken, { type: 'json' });
    if (share && share.brand && share.slug) {
      return Response.redirect(url.origin + '/p/' + share.brand + '/' + share.slug + '/', 301);
    }
    // Fallback: serve directly
    if (share) {
      if (share.version === 3 && share.journeyBlobs) {
        return new Response(buildHubHtml(share, legacyToken, share.brand || 'demo'), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
        });
      }
      if (share.html) {
        return new Response(share.html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
        });
      }
    }
  }

  // Root or unknown paths — return innocuous 404 (hides the site)
  return new Response(buildStealth404(), {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handlePost(request, url, env) {
  const body = await request.json();

  // v3: add journey to existing hub
  if (body.hubToken) {
    const key = 'shares/' + body.hubToken + '_' + body.journeyType;
    await env.SHARES.put(key, body.html, { expirationTtl: 86400 });

    // Update hub metadata
    const hubKey = 'shares/' + body.hubToken;
    const hub = await env.SHARES.get(hubKey, { type: 'json' });
    if (hub) {
      hub.journeyBlobs[body.journeyType] = true;
      await env.SHARES.put(hubKey, JSON.stringify(hub), { expirationTtl: 86400 });
    }

    return jsonResponse({ ok: true });
  }

  // Create new share
  const brand = sanitizeSlug(body.brand || 'demo');
  const slug = sanitizeSlug(body.slug || generateToken().slice(0, 8));
  const token = brand + '/' + slug;

  const shareData = {
    version: body.journeyTypes && body.journeyTypes.length > 1 ? 3 : 1,
    brand: brand,
    slug: slug,
    config: body.config || null,
    journeyTypes: body.journeyTypes || [],
    html: body.html || null,
    journeyBlobs: {},
    createdAt: Date.now(),
  };

  await env.SHARES.put('shares/' + token, JSON.stringify(shareData), { expirationTtl: 86400 });

  const origin = url.origin;
  const shareUrl = origin + '/p/' + brand + '/' + slug + '/';

  return jsonResponse({
    ok: true,
    token: token,
    url: shareUrl,
    brand: brand,
    slug: slug,
  });
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sanitizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'demo';
}

function generateToken() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// Stealth 404 — hides the fact this is a demo generator
function buildStealth404() {
  return '<!DOCTYPE html><html><head><title>Not Found</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;' +
    'align-items:center;min-height:100vh;margin:0;background:#fafafa;color:#666}' +
    '.c{text-align:center}h1{font-size:4rem;margin:0;color:#ddd}p{margin:8px 0 0}</style></head>' +
    '<body><div class="c"><h1>404</h1><p>Page not found</p></div></body></html>';
}

function buildExpiredPage() {
  return '<!DOCTYPE html><html><head><title>Link Expired</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;' +
    'align-items:center;min-height:100vh;margin:0;background:#fafafa;color:#666}' +
    '.c{text-align:center;max-width:400px}h1{margin:0 0 8px}p{margin:0 0 16px;color:#999}</style></head>' +
    '<body><div class="c"><h1>Link Expired</h1>' +
    '<p>This share link has expired after 24 hours.</p>' +
    '<p>Please ask the sender for a fresh link.</p></div></body></html>';
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
