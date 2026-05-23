const path = require('path');

const ASSETS_ROOT = path.join(__dirname, '..', 'assets');
const FALLBACKS_ROOT = path.join(ASSETS_ROOT, 'fallbacks');

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

const BRAND_ASSET_KEYS = {
  logo: 'logo.png',
  logoDark: 'logo_dark.png',
  favicon: 'favicon.png',
  heroBanner: 'hero_banner.png',
};

const DEFAULT_BRAND_ASSETS = {
  logo: 'logo.png',
  logoDark: 'logo_dark.png',
  favicon: 'favicon.png',
  heroBanner: 'hero_banner.png',
};

function normalizeSku(sku) {
  return String(sku || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function productImageBasename(sku) {
  const normalized = normalizeSku(sku);
  if (!normalized) return null;
  return `product_${normalized}`;
}

function productImageFilename(sku, ext = '.png') {
  const base = productImageBasename(sku);
  return base ? `${base}${ext}` : null;
}

function isExternalUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isValidImageExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_IMAGE_EXTENSIONS.has(ext);
}

function brandAssetDir(brandId) {
  return path.join(ASSETS_ROOT, 'brands', brandId);
}

function productAssetDir(brandId) {
  return path.join(ASSETS_ROOT, 'products', brandId);
}

function resolveBrandAssetFile(brand, key) {
  const assets = brand.assets || {};
  const file = assets[key] || DEFAULT_BRAND_ASSETS[key] || BRAND_ASSET_KEYS[key];
  return path.basename(String(file).replace(/\\/g, '/'));
}

/** Dev-mode web path (serves from repo assets/) */
function devBrandAssetPath(brandId, filename) {
  return `assets/brands/${brandId}/${filename}`;
}

function devProductAssetPath(brandId, filename) {
  return `assets/products/${brandId}/${filename}`;
}

/** Dist-mode relative path (flat, portable) */
function distBrandAssetPath(filename) {
  return `./assets/brands/${filename}`;
}

function distProductAssetPath(filename) {
  return `./assets/products/${filename}`;
}

function distProductThumbPath(filename) {
  const base = path.basename(filename, path.extname(filename));
  return `./assets/products/thumbs/${base}_thumb.webp`;
}

module.exports = {
  ASSETS_ROOT,
  FALLBACKS_ROOT,
  VALID_IMAGE_EXTENSIONS,
  BRAND_ASSET_KEYS,
  DEFAULT_BRAND_ASSETS,
  normalizeSku,
  productImageBasename,
  productImageFilename,
  isExternalUrl,
  isValidImageExtension,
  brandAssetDir,
  productAssetDir,
  resolveBrandAssetFile,
  devBrandAssetPath,
  devProductAssetPath,
  distBrandAssetPath,
  distProductAssetPath,
  distProductThumbPath,
};
