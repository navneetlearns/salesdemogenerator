/**
 * Legacy resolver API — delegates to asset-paths conventions.
 * Prefer runAssetPipeline() for full resolution + optimization.
 */
const path = require('path');
const fs = require('fs-extra');
const {
  ASSETS_ROOT,
  brandAssetDir,
  productAssetDir,
  devBrandAssetPath,
  devProductAssetPath,
  resolveBrandAssetFile,
  productImageFilename,
  isExternalUrl,
} = require('./asset-paths');
const { getFallbackPath } = require('./image-optimizer');

function resolveBrandLogo(brandId, brand = {}, options = {}) {
  const { allowFallback = true } = options;

  if (brand.logo && isExternalUrl(brand.logo)) return brand.logo;

  const logoFile = resolveBrandAssetFile(brand, 'logo');
  const logoPath = path.join(brandAssetDir(brandId), logoFile);
  if (fs.existsSync(logoPath)) {
    return devBrandAssetPath(brandId, logoFile);
  }

  if (allowFallback) {
    const fb = getFallbackPath('logo');
    if (fb) return './assets/fallbacks/' + path.basename(fb);
  }
  return 'data:image/placeholder';
}

function resolveProductImage(brandId, product, options = {}) {
  const { allowFallback = true } = options;

  if (product.image && isExternalUrl(product.image)) return product.image;

  const filename = product.image || productImageFilename(product.sku, '.png');
  if (!filename) return allowFallback ? './assets/fallbacks/product.svg' : 'data:image/placeholder';

  const absPath = path.join(productAssetDir(brandId), filename);
  if (fs.existsSync(absPath)) {
    return devProductAssetPath(brandId, filename);
  }

  if (allowFallback) {
    const fb = getFallbackPath('product');
    if (fb) return './assets/fallbacks/' + path.basename(fb);
  }

  return product.image?.startsWith('assets/') ? product.image : devProductAssetPath(brandId, filename);
}

function enrichCatalogProducts(brandId, products, options = {}) {
  return products.map(p => ({
    ...p,
    image: resolveProductImage(brandId, p, options),
  }));
}

module.exports = {
  resolveBrandLogo,
  resolveProductImage,
  enrichCatalogProducts,
  ASSETS_ROOT,
};
