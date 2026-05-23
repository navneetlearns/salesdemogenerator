const fs = require('fs-extra');
const path = require('path');
const { validateDistOutput } = require('./asset-validator');

/**
 * Rewrite dev asset paths to portable dist-relative paths.
 */
function rewriteAssetPaths(html, brandId) {
  let out = html;

  // Brand assets: assets/brands/<brandId>/file → ./assets/brands/file
  out = out.replace(
    new RegExp(`assets/brands/${brandId}/([^"'\\s]+)`, 'g'),
    './assets/brands/$1'
  );

  // Product assets: assets/products/<brandId>/file → ./assets/products/file
  out = out.replace(
    new RegExp(`assets/products/${brandId}/([^"'\\s]+)`, 'g'),
    './assets/products/$1'
  );

  // Fallback paths
  out = out.replace(/assets\/fallbacks\//g, './assets/fallbacks/');

  return out;
}

/**
 * Extract inline <style> and <script> to external files for dist.
 */
function extractAssetsFromHtml(html) {
  let css = '';
  let js = '';
  let processed = html;

  const styleMatch = processed.match(/<style>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    css = styleMatch[1].trim();
    processed = processed.replace(styleMatch[0], '<link rel="stylesheet" href="./css/style.css">');
  }

  const scriptMatches = processed.match(/<script>([\s\S]*?)<\/script>/gi) || [];
  const scripts = scriptMatches.map(s => {
    const m = s.match(/<script>([\s\S]*?)<\/script>/i);
    return m ? m[1].trim() : '';
  }).filter(Boolean);

  if (scripts.length) {
    js = scripts.join('\n\n');
    processed = processed.replace(/<script>[\s\S]*?<\/script>/gi, '');
    processed = processed.replace('</body>', '  <script src="./js/app.js"></script>\n</body>');
  }

  return { html: processed, css, js };
}

function generateWebManifest(brand, brandId) {
  return {
    name: `${brand.name} — Order to Cash Demo`,
    short_name: brand.shortName || brand.name,
    id: `/${brandId}/`,
    start_url: './index.html',
    display: 'standalone',
    background_color: brand.colors?.brandDark || '#111',
    theme_color: brand.colors?.brand || '#000',
    icons: [],
  };
}

async function getDirSize(dir) {
  let total = 0;
  if (!await fs.pathExists(dir)) return 0;
  const walk = async d => {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const fp = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(fp);
      else total += (await fs.stat(fp)).size;
    }
  };
  await walk(dir);
  return total;
}

async function packageDist({
  brandId,
  brand,
  html,
  assetManifest,
  buildReport,
  distRoot,
}) {
  const distDir = path.join(distRoot, brandId);
  await fs.ensureDir(distDir);

  const cssDir = path.join(distDir, 'css');
  const jsDir = path.join(distDir, 'js');
  await fs.ensureDir(cssDir);
  await fs.ensureDir(jsDir);

  let processedHtml = rewriteAssetPaths(html, brandId);
  const extracted = extractAssetsFromHtml(processedHtml);
  processedHtml = extracted.html;

  await fs.writeFile(path.join(distDir, 'index.html'), processedHtml, 'utf8');
  if (extracted.css) await fs.writeFile(path.join(cssDir, 'style.css'), extracted.css, 'utf8');
  if (extracted.js) await fs.writeFile(path.join(jsDir, 'app.js'), extracted.js, 'utf8');

  await fs.writeJson(path.join(distDir, 'asset-manifest.json'), assetManifest, { spaces: 2 });

  const report = {
    ...buildReport,
    totalBuildBytes: await getDirSize(distDir),
    generatedAt: new Date().toISOString(),
  };
  await fs.writeJson(path.join(distDir, 'build-report.json'), report, { spaces: 2 });
  await fs.writeJson(path.join(distDir, 'manifest.json'), generateWebManifest(brand, brandId), { spaces: 2 });

  const distErrors = validateDistOutput(distDir, assetManifest);
  if (distErrors.length) {
    report.distValidationErrors = distErrors;
    await fs.writeJson(path.join(distDir, 'build-report.json'), report, { spaces: 2 });
  }

  return { distDir, report, distErrors };
}

module.exports = {
  rewriteAssetPaths,
  extractAssetsFromHtml,
  packageDist,
  generateWebManifest,
};
