const fs = require('fs-extra');
const path = require('path');
const {
  ASSETS_ROOT,
  brandAssetDir,
  productAssetDir,
  resolveBrandAssetFile,
  productImageFilename,
  isExternalUrl,
  isValidImageExtension,
  productImageBasename,
} = require('./asset-paths');

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function listImageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => isValidImageExtension(f));
}

/**
 * Validate brand + product assets for a brand build.
 * @returns {{ errors: string[], warnings: string[], orphans: string[], duplicates: string[] }}
 */
function validateBrandAssets(brandId, brand, products, options = {}) {
  const { strict = false, checkOrphans = true } = options;
  const errors = [];
  const warnings = [];
  const orphans = [];
  const duplicates = [];

  const brandDir = brandAssetDir(brandId);
  const productDir = productAssetDir(brandId);

  // Brand logo (required unless external URL in brand.logo)
  const logoFile = resolveBrandAssetFile(brand, 'logo');
  const logoPath = path.join(brandDir, logoFile);
  const hasLogo = brand.logo && isExternalUrl(brand.logo)
    ? true
    : fileExists(logoPath);

  if (!hasLogo) {
    const msg = `Missing brand logo: ${logoPath}`;
    if (strict) errors.push(msg);
    else warnings.push(msg);
  } else if (fileExists(logoPath) && !isValidImageExtension(logoFile)) {
    errors.push(`Invalid logo extension: ${logoFile}`);
  }

  // Optional brand assets
  ['logoDark', 'favicon', 'heroBanner'].forEach(key => {
    const file = resolveBrandAssetFile(brand, key);
    const fp = path.join(brandDir, file);
    if (file && fileExists(fp) && !isValidImageExtension(file)) {
      errors.push(`Invalid brand asset extension (${key}): ${file}`);
    }
  });

  // Product images
  const expectedProductFiles = new Map();
  const skuToFile = new Map();

  products.forEach((product, i) => {
    if (isExternalUrl(product.image)) return;

    const filename = product.image || productImageFilename(product.sku, '.png');
    if (!filename) {
      errors.push(`Product ${product.id || i} missing image filename and SKU`);
      return;
    }

    if (!isValidImageExtension(filename)) {
      errors.push(`Invalid product image extension: ${filename} (${product.id})`);
    }

    const fp = path.join(productDir, filename);
    const basename = productImageBasename(product.sku);

    if (basename && skuToFile.has(basename)) {
      duplicates.push(`Duplicate SKU image mapping: ${basename} → ${skuToFile.get(basename)} and ${filename}`);
    } else if (basename) {
      skuToFile.set(basename, filename);
    }

    if (!fileExists(fp)) {
      const msg = `Missing product image: ${fp} (product: ${product.id})`;
      if (strict) errors.push(msg);
      else warnings.push(msg);
    }

    expectedProductFiles.set(filename, product.id);
  });

  // Orphan images in product folder
  if (checkOrphans && fs.existsSync(productDir)) {
    listImageFiles(productDir).forEach(file => {
      const isOptimized = file.endsWith('.webp') || file.includes('_thumb');
      if (isOptimized) return;
      if (!expectedProductFiles.has(file)) {
        const msg = `Orphan product image: ${path.join(productDir, file)}`;
        if (strict) errors.push(msg);
        else orphans.push(msg);
      }
    });
  }

  return { errors, warnings, orphans, duplicates };
}

function validateDistOutput(distDir, manifest) {
  const errors = [];
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    errors.push('Dist missing index.html');
  }
  if (!fs.existsSync(path.join(distDir, 'asset-manifest.json'))) {
    errors.push('Dist missing asset-manifest.json');
  }
  if (manifest?.logo && !manifest.logo.startsWith('http')) {
    const logoPath = path.join(distDir, manifest.logo.replace(/^\.\//, ''));
    if (!fs.existsSync(logoPath)) {
      errors.push(`Dist manifest logo not found: ${logoPath}`);
    }
  }
  if (manifest?.products) {
    Object.entries(manifest.products).forEach(([id, pPath]) => {
      if (pPath.startsWith('http')) return;
      const fp = path.join(distDir, pPath.replace(/^\.\//, ''));
      if (!fs.existsSync(fp)) {
        errors.push(`Dist manifest product image not found (${id}): ${fp}`);
      }
    });
  }
  return errors;
}

module.exports = { validateBrandAssets, validateDistOutput, listImageFiles };
