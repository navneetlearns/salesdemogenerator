const crypto = require('crypto');

const SHARE_PREFIX = 'shares/';
const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SHARE_HTML_BYTES = 4 * 1024 * 1024;
const MAX_JOURNEY_BLOB_BYTES = 1.1 * 1024 * 1024; // 1.1 MB per journey

function createError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

function getBlobClient(override) {
  if (override) return override;
  try {
    return require('@vercel/blob');
  } catch (e) {
    throw createError('Vercel Blob SDK is not installed.', 'BLOB_SDK_MISSING', 500);
  }
}

function getNow(options) {
  return options && options.now ? options.now() : Date.now();
}

function assertToken(token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ''))) {
    throw createError('Share link not found.', 'SHARE_NOT_FOUND', 404);
  }
}

function normalizeHtml(html) {
  if (typeof html !== 'string' || !html.trim()) {
    throw createError('Generated HTML is required.', 'SHARE_HTML_REQUIRED', 400);
  }
  const size = Buffer.byteLength(html, 'utf8');
  if (size > MAX_SHARE_HTML_BYTES) {
    throw createError('Generated HTML is too large to share. Please download the HTML or use smaller images.', 'SHARE_HTML_TOO_LARGE', 413);
  }
  return html;
}

function getOrigin(req, options) {
  if (options && options.origin) return options.origin.replace(/\/$/, '');
  if (!req) return '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? proto + '://' + host : '';
}

function sharePath(token) {
  return SHARE_PREFIX + token + '.json';
}

function journeyBlobPath(hubToken, journeyType) {
  var safe = String(journeyType || 'unknown').replace(/[^a-z0-9_-]/g, '_');
  return SHARE_PREFIX + hubToken + '_' + safe + '.html';
}

/* ═══════════════════════════════════════════════════════════
 *  v1/v2: HTML or config-based share (single request)
 * ═══════════════════════════════════════════════════════════ */
async function createShare(input, options = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = getNow(options);
  const expiresAt = createdAt + SHARE_TTL_MS;
  const origin = getOrigin(options.req, options);

  // v2: config-based share (tiny — stores render config, not HTML)
  if (input && input.config && !input.html) {
    const payload = {
      version: 2,
      token,
      createdAt,
      expiresAt,
      brandName: String(input.config.name || input.brandName || 'Demo'),
      journeyType: String(input.config.journeyType || 'order_to_cash'),
      journeyTypes: Array.isArray(input.config.journeyTypes) ? input.config.journeyTypes.slice() : null,
      config: input.config
    };
    const blob = getBlobClient(options.blob);
    await blob.put(sharePath(token), JSON.stringify(payload), {
      access: 'private',
      contentType: 'application/json',
    allowOverwrite: true
    });
    return { token, url: origin ? origin + '/api/share?token=' + token : '/api/share?token=' + token, expiresAt };
  }

  // v1: HTML-based share
  const html = normalizeHtml(input && input.html);
  const payload = {
    version: 1,
    token,
    createdAt,
    expiresAt,
    brandName: String(input.brandName || 'Demo'),
    journeyType: String(input.journeyType || 'order_to_cash'),
    journeyTypes: Array.isArray(input.journeyTypes) ? input.journeyTypes.slice() : null,
    html
  };

  const blob = getBlobClient(options.blob);
  await blob.put(sharePath(token), JSON.stringify(payload), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });

  return {
    token,
    url: origin ? origin + '/api/share?token=' + token : '/api/share?token=' + token,
    expiresAt
  };
}

/* ═══════════════════════════════════════════════════════════
 *  v2: Config-based share (tiny config, re-renders client-side)
 * ═══════════════════════════════════════════════════════════ */
async function createConfigShare(input, options = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = getNow(options);
  const expiresAt = createdAt + SHARE_TTL_MS;
  const origin = getOrigin(options.req, options);

  const payload = {
    version: 2,
    token,
    createdAt,
    expiresAt,
    brandName: String(input.config.name || input.brandName || 'Demo'),
    journeyType: String(input.config.journeyType || 'order_to_cash'),
    journeyTypes: Array.isArray(input.config.journeyTypes) ? input.config.journeysTypes.slice() : null,
    config: input.config
  };
  const blob = getBlobClient(options.blob);
  await blob.put(sharePath(token), JSON.stringify(payload), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });
  return { token, url: origin ? origin + '/api/share?token=' + token : '/api/share?token=' + token, expiresAt };
}

/* ═══════════════════════════════════════════════════════════
 *  v3: Multi-blob hub — two-step upload
 *    Step 1: initHub() creates hub metadata (~2KB, tiny)
 *    Step 2: addJourneyToHub() stores one journey blob (~200KB)
 *    Scales to any number of journeys, no single-request size limit
 * ═══════════════════════════════════════════════════════════ */
async function initHub(input, options = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = getNow(options);
  const expiresAt = createdAt + SHARE_TTL_MS;
  const origin = getOrigin(options.req, options);
  const config = input.config || {};
  const journeyTypes = Array.isArray(input.journeyTypes) ? input.journeyTypes.slice() : [];

  const hubPayload = {
    version: 3,
    token,
    createdAt,
    expiresAt,
    brandName: String(config.name || input.brandName || 'Demo'),
    journeyType: journeyTypes[0] || 'order_to_cash',
    journeyTypes,
    config,
    journeyBlobs: [] // filled incrementally by addJourneyToHub
  };

  const blob = getBlobClient(options.blob);
  await blob.put(sharePath(token), JSON.stringify(hubPayload), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });

  return {
    token,
    url: origin ? origin + '/api/share?token=' + token : '/api/share?token=' + token,
    expiresAt
  };
}

async function addJourneyToHub(hubToken, journeyType, html, options = {}) {
  assertToken(hubToken);

  const jHtml = normalizeHtml(html);
  const jSize = Buffer.byteLength(jHtml, 'utf8');
  if (jSize > MAX_JOURNEY_BLOB_BYTES) {
    throw createError(
      'Journey "' + journeyType + '" is too large (' + (jSize / 1024 / 1024).toFixed(1) + ' MB). Max 1.1 MB.',
      'JOURNEY_TOO_LARGE', 413
    );
  }

  const blob = getBlobClient(options.blob);

  // Store journey HTML blob
  await blob.put(journeyBlobPath(hubToken, journeyType), jHtml, {
    access: 'private',
    contentType: 'text/html; charset=utf-8',
    allowOverwrite: true
  });

  // Update hub metadata — add journey to journeyBlobs list
  const hubText = await fetchBlobText(sharePath(hubToken), blob, options.fetchBlob);
  if (!hubText) throw createError('Hub not found.', 'SHARE_NOT_FOUND', 404);

  let hubPayload;
  try { hubPayload = JSON.parse(hubText); } catch (e) { throw createError('Hub data invalid.', 'SHARE_INVALID', 404); }
  if (hubPayload.version !== 3) throw createError('Not a v3 hub.', 'SHARE_INVALID', 400);

  // Add to journeyBlobs if not already present
  const existing = hubPayload.journeyBlobs.find(function(j) { return j.type === journeyType; });
  if (!existing) {
    hubPayload.journeyBlobs.push({ type: journeyType, path: journeyBlobPath(hubToken, journeyType) });
  }

  await blob.put(sharePath(hubToken), JSON.stringify(hubPayload), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true
  });

  return { ok: true, journeyType, uploaded: hubPayload.journeyBlobs.length };
}

/* ═══════════════════════════════════════════════════════════
 *  Read operations (shared across v1/v2/v3)
 * ═══════════════════════════════════════════════════════════ */
async function fetchBlobText(pathname, blob, fetchBlob) {
  if (blob.get) {
    const result = await blob.get(pathname, { access: 'private' });
    if (!result) return null;
    if (typeof result === 'string') return result;
    if (typeof result.text === 'function') return result.text();
    if (result.body) return String(result.body);
    if (result.stream) return streamToText(result.stream);
  }

  let blobInfo = null;
  if (blob.head) {
    try {
      blobInfo = await blob.head(pathname);
    } catch (e) {
      blobInfo = null;
    }
  }
  if (!blobInfo && blob.list) {
    const listed = await blob.list({ prefix: pathname, limit: 1 });
    const matches = listed && listed.blobs || [];
    blobInfo = matches.find(function(item) { return item.pathname === pathname; }) || null;
  }
  if (!blobInfo) return null;

  const url = blobInfo.downloadUrl || blobInfo.url;
  if (!url) return null;
  const fetcher = fetchBlob || fetch;
  const res = await fetcher(url);
  if (!res || !res.ok) return null;
  return res.text();
}

async function streamToText(stream) {
  if (!stream) return '';
  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(Buffer.from(next.value));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readSharePayload(token, options = {}) {
  assertToken(token);
  const blob = getBlobClient(options.blob);
  const text = await fetchBlobText(sharePath(token), blob, options.fetchBlob);
  if (!text) throw createError('Share link not found.', 'SHARE_NOT_FOUND', 404);

  try {
    return JSON.parse(text);
  } catch (e) {
    throw createError('Share link is invalid.', 'SHARE_INVALID', 404);
  }
}

async function readJourneyBlob(hubToken, journeyType, options = {}) {
  assertToken(hubToken);
  const blob = getBlobClient(options.blob);
  const html = await fetchBlobText(journeyBlobPath(hubToken, journeyType), blob, options.fetchBlob);
  if (!html) throw createError('Journey not found in share.', 'JOURNEY_NOT_FOUND', 404);
  return html;
}

async function getShare(token, options = {}) {
  const payload = await readSharePayload(token, options);
  if (payload.expiresAt <= getNow(options)) {
    throw createError('This share link has expired.', 'SHARE_EXPIRED', 410);
  }
  if (!payload.html && !payload.config && !payload.journeyBlobs) {
    throw createError('Share link is invalid.', 'SHARE_INVALID', 404);
  }
  return payload;
}

async function cleanupExpiredShares(options = {}) {
  const blob = getBlobClient(options.blob);
  const listed = await blob.list({ prefix: SHARE_PREFIX });
  const items = listed && listed.blobs || [];
  let deleted = 0;
  for (const item of items) {
    const text = await fetchBlobText(item.pathname, blob, options.fetchBlob);
    if (!text) continue;
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      payload = null;
    }
    if (!payload || payload.expiresAt <= getNow(options)) {
      await blob.del(item.pathname);
      deleted++;
    }
  }
  return { checked: items.length, deleted };
}

module.exports = {
  SHARE_TTL_MS,
  MAX_SHARE_HTML_BYTES,
  MAX_JOURNEY_BLOB_BYTES,
  createShare,
  createConfigShare,
  initHub,
  addJourneyToHub,
  getShare,
  readJourneyBlob,
  cleanupExpiredShares,
  journeyBlobPath
};
