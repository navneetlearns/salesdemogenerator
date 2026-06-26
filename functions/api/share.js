// functions/api/share.js
// Handles POST (create share) and legacy GET redirect (?token=)
// Uses Cloudflare KV for storage
// Branded URLs: /p/{brand}/{slug}/ — handled by functions/p/[[catchall]].js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method === 'POST') {
    return handlePost(request, url, env);
  }

  if (request.method === 'GET') {
    return handleGet(url, env);
  }

  return new Response('Method Not Allowed', { status: 405 });
}

async function handleGet(url, env) {
  // Route: /api/share?token=... — legacy compat (redirects to branded URL)
  const legacyToken = url.searchParams.get('token');
  if (legacyToken) {
    const share = await env.SHARES.get('shares/' + legacyToken, { type: 'json' });
    if (share && share.brand && share.slug) {
      return Response.redirect(url.origin + '/p/' + share.brand + '/' + share.slug + '/', 301);
    }
    // Fallback: serve directly (no brand/slug stored)
    if (share) {
      if (share.html) {
        return new Response(share.html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
        });
      }
    }
  }

  return new Response('Not Found', { status: 404 });
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
