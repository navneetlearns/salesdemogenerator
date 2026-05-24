const fs = require('fs-extra');
const path = require('path');
const {
  brandAssetDir,
  productAssetDir,
  resolveBrandAssetFile,
  devBrandAssetPath,
  devProductAssetPath,
  distBrandAssetPath,
  distProductAssetPath,
  productImageFilename,
  isExternalUrl,
  FALLBACKS_ROOT,
} = require('./asset-paths');
const { validateBrandAssets } = require('./asset-validator');
const {
  ensureFallbackAssets,
  optimizeBrandAsset,
  optimizeProductAsset,
  getFallbackPath,
} = require('./image-optimizer');

async function runAssetPipeline(brandId, brand, products, options = {}) {
  const {
    mode = 'dev',
    strict = false,
    allowFallbacks = true,
    optimize = false,
    distDir = null,
  } = options;

  await ensureFallbackAssets();

  const validation = validateBrandAssets(brandId, brand, products, {
    strict: strict && !allowFallbacks,
    checkOrphans: mode === 'dist',
  });

  const manifest = { logo: null, logoDark: null, favicon: null, heroBanner: null, products: {} };
  const report = {
    brandId,
    mode,
    totalProducts: products.length,
    optimizedImages: [],
    missingAssets: [],
    warnings: [...validation.warnings, ...validation.orphans.map(o => `Orphan: ${o}`)],
    errors: [...validation.errors],
    duplicates: validation.duplicates,
    usedFallbacks: [],
    totalBuildBytes: 0,
  };

  if (validation.duplicates.length) {
    report.errors.push(...validation.duplicates);
  }

  if (report.errors.length && strict && !allowFallbacks) {
    return { ok: false, validation, manifest, report, products: [], brandLogo: null };
  }

  const enrichedProducts = products.map(p => ({ ...p }));
  const brandDir = brandAssetDir(brandId);
  const productDir = productAssetDir(brandId);

  if (mode === 'dist' && distDir) {
    const distBrandAssets = path.join(distDir, 'assets', 'brands');
    const distProductAssets = path.join(distDir, 'assets', 'products');
    const distFallbacks = path.join(distDir, 'assets', 'fallbacks');
    await fs.ensureDir(distBrandAssets);
    await fs.ensureDir(distProductAssets);
    await fs.ensureDir(path.join(distProductAssets, 'thumbs'));
    await fs.copy(FALLBACKS_ROOT, distFallbacks);

    manifest.logo = await processBrandAssetForDist(
      brand, brandDir, distBrandAssets, 'logo', optimize, allowFallbacks, report
    );

    for (const key of ['logoDark', 'favicon', 'heroBanner']) {
      const file = resolveBrandAssetFile(brand, key);
      const src = path.join(brandDir, file);
      if (await fs.pathExists(src)) {
        const opt = optimize
          ? await optimizeBrandAsset(src, distBrandAssets, file)
          : { distPath: distBrandAssetPath(file) };
        if (optimize) await fs.copy(src, path.join(distBrandAssets, file));
        manifest[key] = opt.distPath;
      }
    }

    for (const product of enrichedProducts) {
      const r = await processProductForDist(
        product, productDir, distProductAssets, optimize, allowFallbacks, report
      );
      product.image = r.distPath;
      product.imageThumb = r.thumbPath;
      manifest.products[product.id] = r.distPath;
    }

    report.totalBuildBytes = await dirSize(distDir);
    return {
      ok: report.errors.length === 0 || allowFallbacks,
      validation,
      manifest,
      report,
      products: enrichedProducts,
      brandLogo: manifest.logo,
    };
  }

  // Dev mode
  const logoFile = resolveBrandAssetFile(brand, 'logo');
  const logoPath = path.join(brandDir, logoFile);
  let brandLogo;
  if (brand.logo && isExternalUrl(brand.logo)) {
    brandLogo = brand.logo;
  } else if (await fs.pathExists(logoPath)) {
    brandLogo = '../../' + devBrandAssetPath(brandId, logoFile);
  } else if (allowFallbacks) {
    brandLogo = '../../assets/fallbacks/logo.png';
    report.usedFallbacks.push('logo');
    report.missingAssets.push(`brand:${logoFile}`);
  } else {
    brandLogo = 'data:image/placeholder';
  }
  manifest.logo = brandLogo;

  for (const product of enrichedProducts) {
    if (isExternalUrl(product.image)) {
      manifest.products[product.id] = product.image;
      continue;
    }
    const filename = product.image || productImageFilename(product.sku, '.png');
    const src = path.join(productDir, filename);
    if (await fs.pathExists(src)) {
      product.image = '../../' + devProductAssetPath(brandId, filename);
    } else if (allowFallbacks) {
      product.image = '../../assets/fallbacks/product.png';
      report.usedFallbacks.push(`product:${product.id}`);
      report.missingAssets.push(`product:${product.id}:${filename}`);
    } else {
      product.image = '../../' + devProductAssetPath(brandId, filename);
    }
    manifest.products[product.id] = product.image;
  }

  return {
    ok: report.errors.length === 0 || allowFallbacks,
    validation,
    manifest,
    report,
    products: enrichedProducts,
    brandLogo,
  };
}

async function processBrandAssetForDist(brand, brandDir, distBrandAssets, key, optimize, allowFallbacks, report) {
  const file = resolveBrandAssetFile(brand, key);
  if (brand.logo && isExternalUrl(brand.logo) && key === 'logo') return brand.logo;

  const src = path.join(brandDir, file);
  if (await fs.pathExists(src)) {
    if (optimize) {
      const opt = await optimizeBrandAsset(src, distBrandAssets, file);
      report.optimizedImages.push(opt.distPath);
      return opt.distPath;
    }
    await fs.copy(src, path.join(distBrandAssets, file));
    return distBrandAssetPath(file);
  }

  if (allowFallbacks) {
    const fb = getFallbackPath('logo');
    report.usedFallbacks.push(`brand:${key}`);
    report.missingAssets.push(`brand:${file}`);
    if (fb && optimize) {
      const staged = path.join(distBrandAssets, 'logo.png');
      await fs.copy(fb, staged);
      const opt = await optimizeBrandAsset(staged, distBrandAssets, 'logo.png');
      report.optimizedImages.push(opt.distPath);
      return opt.distPath;
    }
    return './assets/fallbacks/logo.png';
  }
  return null;
}

async function processProductForDist(product, productDir, distProductAssets, optimize, allowFallbacks, report) {
  if (isExternalUrl(product.image)) {
    return { distPath: product.image, thumbPath: product.image };
  }

  const filename = product.image || productImageFilename(product.sku, '.png');
  const src = path.join(productDir, filename);

  if (await fs.pathExists(src)) {
    if (optimize) {
      const opt = await optimizeProductAsset(src, distProductAssets, filename);
      report.optimizedImages.push(opt.distPath, opt.thumbPath);
      return { distPath: opt.distPath, thumbPath: opt.thumbPath };
    }
    await fs.copy(src, path.join(distProductAssets, filename));
    const p = distProductAssetPath(filename);
    return { distPath: p, thumbPath: p };
  }

  if (allowFallbacks) {
    report.usedFallbacks.push(`product:${product.id}`);
    report.missingAssets.push(`product:${product.id}:${filename}`);
    const fb = getFallbackPath('product');
    const fallbackTarget = product.image || productImageFilename(product.sku, '.png') || 'product.png';
    if (fb && optimize) {
      const staged = path.join(distProductAssets, fallbackTarget);
      await fs.copy(fb, staged);
      const opt = await optimizeProductAsset(staged, distProductAssets, fallbackTarget);
      return { distPath: opt.distPath, thumbPath: opt.thumbPath };
    }
    return { distPath: './assets/fallbacks/product.png', thumbPath: './assets/fallbacks/product.png' };
  }

  const p = distProductAssetPath(filename);
  return { distPath: p, thumbPath: p };
}

async function dirSize(dir) {
  let total = 0;
  if (!await fs.pathExists(dir)) return 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(fp);
    else total += (await fs.stat(fp)).size;
  }
  return total;
}

module.exports = { runAssetPipeline };
