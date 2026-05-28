const crypto = require('crypto');

const SHARE_PREFIX = 'shares/';
const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SHARE_HTML_BYTES = 4 * 1024 * 1024;

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

async function createShare(input, options = {}) {
  const html = normalizeHtml(input && input.html);
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = getNow(options);
  const expiresAt = createdAt + SHARE_TTL_MS;
  const origin = getOrigin(options.req, options);
  const payload = {
    version: 1,
    token,
    createdAt,
    expiresAt,
    brandName: String(input.brandName || 'Demo'),
    journeyType: String(input.journeyType || 'order_to_cash'),
    html
  };

  const blob = getBlobClient(options.blob);
  await blob.put(sharePath(token), JSON.stringify(payload), {
    access: 'private',
    contentType: 'application/json'
  });

  return {
    token,
    url: origin ? origin + '/share/' + token : '/share/' + token,
    expiresAt
  };
}

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

async function getShare(token, options = {}) {
  const payload = await readSharePayload(token, options);
  if (payload.expiresAt <= getNow(options)) {
    throw createError('This share link has expired.', 'SHARE_EXPIRED', 410);
  }
  if (!payload.html) throw createError('Share link is invalid.', 'SHARE_INVALID', 404);
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
  createShare,
  getShare,
  cleanupExpiredShares
};
