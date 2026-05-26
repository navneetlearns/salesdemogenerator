const FileType = require('file-type');

const LOGO_MAX = 5 * 1024 * 1024; // 5MB
const CATALOG_MAX = 20 * 1024 * 1024; // 20MB

const LOGO_ALLOWED = ['image/png','image/jpeg','image/webp','image/svg+xml'];
const CATALOG_ALLOWED = ['application/json','text/csv','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

async function detectMime(buffer, fallbackName) {
  const ft = await FileType.fromBuffer(buffer).catch(()=>null);
  if (ft && ft.mime) return ft.mime;
  // fallback to extension-based guess
  if (fallbackName) {
    const ext = (fallbackName.split('.').pop() || '').toLowerCase();
    if (ext === 'csv') return 'text/csv';
    if (ext === 'json') return 'application/json';
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'xlsx' || ext === 'xls') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
  }
  return 'application/octet-stream';
}

async function validateLogo(file) {
  if (!file || !file.buffer) throw new Error('No file');
  if (file.size > LOGO_MAX) throw new Error('Logo too large');
  const mime = await detectMime(file.buffer, file.originalname);
  if (!LOGO_ALLOWED.includes(mime)) throw new Error('Unsupported logo type: ' + mime);
  // simple executable check: reject files with ELF/MZ signatures
  const sig = file.buffer.slice(0,4).toString('hex').toLowerCase();
  if (sig.startsWith('7f454c46') || sig.startsWith('4d5a9000')) throw new Error('Executable payload rejected');
  return { mime };
}

async function validateCatalog(file) {
  if (!file || !file.buffer) throw new Error('No file');
  if (file.size === 0) throw new Error('Empty catalog');
  if (file.size > CATALOG_MAX) throw new Error('Catalog too large');
  const mime = await detectMime(file.buffer, file.originalname);
  if (!CATALOG_ALLOWED.includes(mime)) throw new Error('Unsupported catalog type: ' + mime);
  // basic zip-bomb avoidance: check for improbable decompressed size (skip heavy decompression)
  // if first bytes indicate zip (PK..), reject — we don't support zip catalogs
  const head = file.buffer.slice(0,4).toString('utf8');
  if (head === 'PK\u0003\u0004' || head.startsWith('PK')) throw new Error('Archive uploads not allowed');
  return { mime };
}

module.exports = { validateLogo, validateCatalog, detectMime };
