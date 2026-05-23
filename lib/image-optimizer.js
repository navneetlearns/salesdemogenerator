const fs = require('fs-extra');
const path = require('path');
const {
  FALLBACKS_ROOT,
  productImageBasename,
  isValidImageExtension,
} = require('./asset-paths');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const LOGO_MAX = 512;
const PRODUCT_SIZE = 600;
const THUMB_SIZE = 200;

async function ensureFallbackAssets() {
  await fs.ensureDir(FALLBACKS_ROOT);
  const logoPath = path.join(FALLBACKS_ROOT, 'logo.png');
  const productPath = path.join(FALLBACKS_ROOT, 'product.png');

  if (!sharp) {
    await ensureSvgFallbacks();
    return { sharp: false };
  }

  if (!await fs.pathExists(logoPath)) {
    await sharp({
      create: { width: LOGO_MAX, height: LOGO_MAX, channels: 4, background: { r: 230, g: 230, b: 230, alpha: 1 } },
    })
      .png()
      .toFile(logoPath);
  }

  if (!await fs.pathExists(productPath)) {
    await sharp({
      create: { width: PRODUCT_SIZE, height: PRODUCT_SIZE, channels: 4, background: { r: 245, g: 245, b: 245, alpha: 1 } },
    })
      .png()
      .toFile(productPath);
  }

  return { sharp: true, logoPath, productPath };
}

async function ensureSvgFallbacks() {
  const logoSvg = path.join(FALLBACKS_ROOT, 'logo.svg');
  const productSvg = path.join(FALLBACKS_ROOT, 'product.svg');
  if (!await fs.pathExists(logoSvg)) {
    await fs.writeFile(logoSvg, '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect fill="#e6e6e6" width="100%" height="100%"/><text x="50%" y="50%" text-anchor="middle" dy=".35em" font-size="32" fill="#999">Logo</text></svg>');
  }
  if (!await fs.pathExists(productSvg)) {
    await fs.writeFile(productSvg, '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect fill="#f5f5f5" width="100%" height="100%"/><text x="50%" y="50%" text-anchor="middle" dy=".35em" font-size="28" fill="#aaa">Product</text></svg>');
  }
}

async function optimizeImage(inputPath, outputPath, options = {}) {
  const { width, height, format = 'webp', quality = 82 } = options;
  await fs.ensureDir(path.dirname(outputPath));

  if (!sharp) {
    await fs.copy(inputPath, outputPath.replace(/\.webp$/, path.extname(inputPath)));
    return { optimized: false, outputPath };
  }

  let pipeline = sharp(inputPath).resize(width, height, { fit: 'inside', withoutEnlargement: true });

  if (format === 'webp') {
    pipeline = pipeline.webp({ quality });
  } else if (format === 'png') {
    pipeline = pipeline.png();
  }

  await pipeline.toFile(outputPath);
  return { optimized: true, outputPath };
}

async function optimizeBrandAsset(inputPath, distBrandDir, basename) {
  const webpName = `${path.basename(basename, path.extname(basename))}.webp`;
  const outPath = path.join(distBrandDir, webpName);
  const result = await optimizeImage(inputPath, outPath, {
    width: LOGO_MAX,
    height: LOGO_MAX,
    format: 'webp',
  });
  return { ...result, distFilename: webpName, distPath: `./assets/brands/${webpName}` };
}

async function optimizeProductAsset(inputPath, distProductDir, basename) {
  const base = path.basename(basename, path.extname(basename));
  const webpName = `${base}.webp`;
  const thumbName = `${base}_thumb.webp`;
  const outPath = path.join(distProductDir, webpName);
  const thumbPath = path.join(distProductDir, 'thumbs', thumbName);

  const main = await optimizeImage(inputPath, outPath, {
    width: PRODUCT_SIZE,
    height: PRODUCT_SIZE,
    format: 'webp',
  });
  const thumb = await optimizeImage(inputPath, thumbPath, {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    format: 'webp',
  });

  return {
    optimized: main.optimized,
    distPath: `./assets/products/${webpName}`,
    thumbPath: `./assets/products/thumbs/${thumbName}`,
    webpName,
  };
}

function getFallbackPath(type = 'product') {
  const png = path.join(FALLBACKS_ROOT, type === 'logo' ? 'logo.png' : 'product.png');
  const svg = path.join(FALLBACKS_ROOT, type === 'logo' ? 'logo.svg' : 'product.svg');
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(svg)) return svg;
  return null;
}

module.exports = {
  sharpAvailable: () => !!sharp,
  ensureFallbackAssets,
  optimizeBrandAsset,
  optimizeProductAsset,
  optimizeImage,
  getFallbackPath,
  LOGO_MAX,
  PRODUCT_SIZE,
};
