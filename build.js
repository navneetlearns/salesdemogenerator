const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');
const Ajv = require('ajv');

const { getPartialName, validateScreenTypes } = require('./lib/screen-registry');
const { loadIndustry } = require('./lib/industry');
const { normalizeJourney } = require('./lib/journey-normalizer');
const { normalizeCatalog } = require('./lib/catalog-normalizer');
const { runAssetPipeline } = require('./lib/asset-pipeline');
const { packageDist } = require('./lib/dist-packager');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const GENERATED_DIR = path.join(ROOT, 'generated');
const DIST_DIR = path.join(ROOT, 'dist');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');

const BUILD_DIST = process.argv.includes('--dist');
const STRICT_ASSETS = process.argv.includes('--strict');

const ajv = new Ajv();
const brandSchema = fs.readJsonSync(path.join(DATA_DIR, 'schemas', 'brand.schema.json'));
const catalogSchema = fs.readJsonSync(path.join(DATA_DIR, 'schemas', 'catalog.schema.json'));
const journeySchema = fs.readJsonSync(path.join(DATA_DIR, 'schemas', 'journey.schema.json'));

const validateBrand = ajv.compile(brandSchema);
const validateCatalog = ajv.compile(catalogSchema);
const validateJourney = ajv.compile(journeySchema);

const SCRIPT_CORE_FILES = ['journey-core.js', 'navigation.js', 'overlays.js', 'debug-overlay.js'];

function registerPartialsFromDir(dir, prefix = '') {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      registerPartialsFromDir(fullPath, prefix ? `${prefix}/${file}` : file);
      return;
    }
    if (!file.endsWith('.hbs')) return;
    const name = prefix ? `${prefix}/${path.basename(file, '.hbs')}` : path.basename(file, '.hbs');
    Handlebars.registerPartial(name, fs.readFileSync(fullPath, 'utf8'));
    console.log(`- Registered partial: ${name}`);
  });
}

function registerPartials() {
  console.log('Registering partials...');
  registerPartialsFromDir(path.join(TEMPLATES_DIR, 'partials'));
}

function registerScreenBlocks() {
  const blocksDir = path.join(TEMPLATES_DIR, 'screens', 'blocks');
  if (!fs.existsSync(blocksDir)) return;
  console.log('Registering screen blocks...');
  fs.readdirSync(blocksDir)
    .filter(f => f.endsWith('.hbs'))
    .forEach(file => {
      const type = path.basename(file, '.hbs');
      const partialName = getPartialName(type);
      Handlebars.registerPartial(partialName, fs.readFileSync(path.join(blocksDir, file), 'utf8'));
      console.log(`- Registered screen block: ${type} → ${partialName}`);
    });
}

Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('lookupPartial', type => getPartialName(type));

async function loadScripts(navSteps) {
  const parts = [`const steps = ${JSON.stringify(navSteps)};\n\n`];
  for (const file of SCRIPT_CORE_FILES) {
    const filePath = path.join(SCRIPTS_DIR, file);
    if (!await fs.pathExists(filePath)) throw new Error(`Missing script: ${file}`);
    parts.push(await fs.readFile(filePath, 'utf8'));
  }
  return parts.join('\n\n');
}

function validateGeneratedHtml(html, brandId) {
  const errors = [];
  const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  [
    [/\$\{style\}/, 'Unresolved ${style}'],
    [/\$\{sidebar\}/, 'Unresolved ${sidebar}'],
    [/\$\{body\}/, 'Unresolved ${body}'],
    [/\{\{\{sidebar\}\}\}/, 'Sidebar variable injection'],
  ].forEach(([pattern, msg]) => {
    if (pattern.test(htmlWithoutScripts)) errors.push(msg);
  });

  if (!html.includes('class="screens-area"')) errors.push('Missing .screens-area');
  if (!html.includes('function scrollToStep')) errors.push('Missing navigation JS');
  if (html.includes('Add to Cart</button>') && html.includes('class="product-img"')) {
    errors.push('Duplicate product card markup');
  }

  if (errors.length) throw new Error(`Validation failed for ${brandId}:\n  - ${errors.join('\n  - ')}`);
}

function escapeAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loadSharedSapDiagramDataUri() {
  const pngPath = path.join(ROOT, 'assets', 'brands', 'jk_cement', 'sap_architecture.png');
  if (!fs.existsSync(pngPath)) return null;
  const buf = fs.readFileSync(pngPath);
  const mime =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      ? 'image/png'
      : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function handwrittenOrderDataUri(brand, products = []) {
  const store = 'Sharma Cement Stores';
  const lines = products.slice(0, 3).map((p, i) => {
    const qty = i === 0 ? 25 : i === 1 ? 20 : 12;
    return `${p.name} - ${qty}`;
  });
  while (lines.length < 3) lines.push('Please deliver today');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="250" viewBox="0 0 380 250">
  <rect width="380" height="250" rx="18" fill="#fffdf6"/>
  <path d="M44 57h292M44 96h292M44 135h292M44 174h292M44 213h210" stroke="#e7dcc7" stroke-width="3"/>
  <text x="42" y="42" font-family="Caveat, Comic Sans MS, cursive" font-size="28" fill="#4d3a2a">Order for ${store}</text>
  <text x="54" y="86" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">${lines[0]}</text>
  <text x="54" y="125" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">${lines[1]}</text>
  <text x="54" y="164" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">${lines[2]}</text>
  <text x="54" y="203" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">Please deliver today</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function replacePlaceholderInClass(html, className, imageSrc) {
  const pattern = new RegExp(
    `(<div\\s+class="[^"]*\\b${className}\\b[^"]*"[^>]*>\\s*<img\\s+)src="data:image/placeholder"`,
    'g'
  );
  return html.replace(pattern, `$1src="${imageSrc}"`);
}

function applySunderMasalaAssetPatch(html, brand, pipeline) {
  if (!pipeline) return html;

  const logoSrc = pipeline.brandLogo || `assets/brands/${brand.id}/logo.png`;
  const logoAlt = escapeAttribute(brand.name);
  const productImages = pipeline.products
    .map(product => product.image)
    .filter(Boolean);

  let patched = html;
  ['wa-avatar', 'tb-av', 'catalog-logo', 'bs-logo'].forEach(className => {
    patched = replacePlaceholderInClass(patched, className, logoSrc);
  });

  patched = patched.replace(
    /<div class="tb-av"([^>]*)><\/div>/g,
    `<div class="tb-av"$1><img src="${logoSrc}" alt="${logoAlt}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;display:block;"></div>`
  );

  if (productImages.length) {
    let orderItemIndex = 0;
    patched = patched.replace(
      /(<div class="oi-thumb"[^>]*>\s*<img\s+)src="data:image\/placeholder"/g,
      (match, prefix) => `${prefix}src="${productImages[orderItemIndex++ % productImages.length]}"`
    );
    patched = patched.replace(
      /(<div style="width:42px;height:42px;border-radius:7px;overflow:hidden;flex-shrink:0;"><img\s*)src="data:image\/placeholder"/g,
      (match, prefix) => `${prefix}src="${productImages[orderItemIndex++ % productImages.length]}"`
    );
  }

  patched = patched.replace(
    /(<div class="wa-hdr-img">\s*<img\s+)src="data:image\/placeholder"/g,
    `$1src="${logoSrc}"`
  );
  patched = patched.replace(
    /(<div style="width:28px;height:28px;border-radius:50%;[^"]*;flex-shrink:0;">\s*<img\s+)src="data:image\/placeholder"/g,
    `$1src="${logoSrc}"`
  );
  patched = patched.replace(
    /(<img\s+)src="data:image\/placeholder"([^>]*width:190px[^>]*>)/g,
    `$1src="${handwrittenOrderDataUri(brand, pipeline.products)}"$2`
  );

  return patched;
}

function injectSapArchitectureDiagram(html) {
  const sapDiagram = loadSharedSapDiagramDataUri();
  if (!sapDiagram) return html;
  return html.replace(
    /(<img\s+)src="data:image\/placeholder"([^>]*alt="ZoTok[^"]*SAP Integration Architecture"[^>]*>)/g,
    `$1src="${sapDiagram}"$2`
  );
}

async function copyDevAssets(brandId) {
  const genBrandDir = path.join(GENERATED_DIR, brandId);
  const fallbacksSrc = path.join(ROOT, 'assets', 'fallbacks');
  if (await fs.pathExists(fallbacksSrc)) {
    await fs.copy(fallbacksSrc, path.join(genBrandDir, 'assets', 'fallbacks'));
  }
  const brandSrc = path.join(ROOT, 'assets', 'brands', brandId);
  if (await fs.pathExists(brandSrc)) {
    await fs.copy(brandSrc, path.join(genBrandDir, 'assets', 'brands', brandId));
  }
  const productSrc = path.join(ROOT, 'assets', 'products', brandId);
  if (await fs.pathExists(productSrc)) {
    await fs.copy(productSrc, path.join(genBrandDir, 'assets', 'products', brandId));
  }
}

async function clearDir(dir) {
  if (!await fs.pathExists(dir)) {
    await fs.ensureDir(dir);
    return;
  }
  try {
    await fs.emptyDir(dir);
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      await new Promise(r => setTimeout(r, 300));
      await fs.emptyDir(dir);
    } else {
      throw err;
    }
  }
}

async function build() {
  registerPartials();
  registerScreenBlocks();

  await clearDir(GENERATED_DIR);
  if (BUILD_DIST) await clearDir(DIST_DIR);

  const styleContent = await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'style.css'), 'utf8');
  const viewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'order_to_cash.hbs'), 'utf8')
  );
  const layoutTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'base.hbs'), 'utf8')
  );

  for (const brandFile of await fs.readdir(path.join(DATA_DIR, 'brands'))) {
    if (!brandFile.endsWith('.json')) continue;
    const brandId = path.basename(brandFile, '.json');
    console.log(`\n--- Building for brand: ${brandId} ---`);

    const brand = await fs.readJson(path.join(DATA_DIR, 'brands', brandFile));
    if (!validateBrand(brand)) {
      console.error(`Invalid brand:`, validateBrand.errors);
      process.exit(1);
    }

    const industry = await loadIndustry(brand.industry);
    if (industry.industryAssets?.defaultHero) {
      brand.heroBanner = brand.heroBanner || industry.industryAssets.defaultHero;
    }

    let rawCatalog = [];
    for (const p of [`${brandId}_products.json`, `${brandId}_default.json`]) {
      const cp = path.join(DATA_DIR, 'catalogs', p);
      if (await fs.pathExists(cp)) {
        rawCatalog = await fs.readJson(cp);
        break;
      }
    }

    const catalogProducts = normalizeCatalog(rawCatalog);
    if (catalogProducts.length && !validateCatalog(catalogProducts)) {
      console.error(`Invalid catalog:`, validateCatalog.errors);
      process.exit(1);
    }

    let rawJourney = { id: 'order_to_cash', title: 'Order to Cash', screens: [] };
    const journeyPath = path.join(DATA_DIR, 'journeys', `${brandId}_order_to_cash.json`);
    if (await fs.pathExists(journeyPath)) rawJourney = await fs.readJson(journeyPath);
    if (!validateJourney(rawJourney)) {
      console.error(`Invalid journey:`, validateJourney.errors);
      process.exit(1);
    }

    const distDir = BUILD_DIST ? path.join(DIST_DIR, brandId) : null;

    console.log('Running asset pipeline...');
    const pipeline = await runAssetPipeline(brandId, brand, catalogProducts, {
      mode: BUILD_DIST ? 'dist' : 'dev',
      strict: STRICT_ASSETS,
      allowFallbacks: !STRICT_ASSETS,
      optimize: BUILD_DIST,
      distDir,
    });

    if (!pipeline.ok) {
      console.error('Asset pipeline failed:');
      pipeline.report.errors.forEach(e => console.error(`  ✗ ${e}`));
      process.exit(1);
    }

    if (pipeline.report.warnings.length) {
      pipeline.report.warnings.forEach(w => console.warn(`  ⚠ ${w}`));
    }
    if (pipeline.report.usedFallbacks.length) {
      console.log(`  Fallbacks used: ${pipeline.report.usedFallbacks.join(', ')}`);
    }

    const journey = normalizeJourney(rawJourney, pipeline.products);
    pipeline.report.journeyStepCount = journey.steps?.length || 0;

    const catalog = { products: pipeline.products };
    const cart = journey.cart;
    const scriptsContent = await loadScripts(journey.navSteps);

    const context = {
      brand,
      brandLogo: pipeline.brandLogo,
      industry,
      catalog,
      cart,
      journey,
      style: styleContent,
      scripts: scriptsContent,
      showComposableMarkers: false,
    };

    console.log('Rendering screen template...');
    const bodyContent = viewTemplate(context);
    console.log('Rendering layout template...');
    let finalHtml = layoutTemplate({ ...context, body: bodyContent });

    const brandData = brand;

    // [TEMPORARY EXECUTION COMPRESSION PATCH]
    // Build-time semantic virtualization layer
    if (brandData.replacements) {
      // 1. Text + Path replacements (sorted longest-first to prevent substring corruption)
      // e.g. "JK Cement India" must replace before "JK Cement" to avoid partial matches
      const sortedReplacements = Object.entries(brandData.replacements)
        .sort((a, b) => b[0].length - a[0].length);
      for (const [from, to] of sortedReplacements) {
        // split/join ensures global replacement across all Node versions
        finalHtml = finalHtml.split(from).join(to);
      }

      // 2. CSS injection for raw asset sizing normalization
      const cssFix = `
    <style>
      img,
      .product-card img,
      .logo-img,
      .cart-item-image,
      .wa-avatar img,
      .tb-av img,
      .catalog-logo img,
      .bs-logo img,
      .oi-thumb img {
        object-fit: contain !important;
        max-width: 100% !important;
        max-height: 100% !important;
      }
    </style>
  </head>`;

      if (finalHtml.includes('</head>')) {
        finalHtml = finalHtml.replace('</head>', cssFix);
      }
    }

    finalHtml = applySunderMasalaAssetPatch(finalHtml, brandData, pipeline);

    // Replacements already applied (sorted longest-first) above — no second pass needed

    finalHtml = injectSapArchitectureDiagram(finalHtml);

    validateGeneratedHtml(finalHtml, brandId);

    const genDir = path.join(GENERATED_DIR, brandId);
    await fs.ensureDir(genDir);
    const outputPath = path.join(genDir, 'order_to_cash.html');
    fs.writeFileSync(outputPath, finalHtml, 'utf8');
    await copyDevAssets(brandId);
    if (BUILD_DIST && distDir && await fs.pathExists(path.join(distDir, 'assets'))) {
      await fs.copy(path.join(distDir, 'assets'), path.join(genDir, 'assets'));
    }
    await fs.writeJson(path.join(genDir, 'asset-manifest.json'), pipeline.manifest, { spaces: 2 });
    console.log(`  Generated: generated/${brandId}/order_to_cash.html`);

    if (BUILD_DIST && distDir) {
      console.log('Packaging dist...');
      const { report, distErrors } = await packageDist({
        brandId,
        brand,
        html: finalHtml,
        assetManifest: pipeline.manifest,
        buildReport: pipeline.report,
        distRoot: DIST_DIR,
      });

      if (distErrors?.length) {
        console.warn('  Dist validation warnings:');
        distErrors.forEach(e => console.warn(`    ⚠ ${e}`));
      }
      console.log(`  Dist: dist/${brandId}/ (${(report.totalBuildBytes / 1024).toFixed(1)} KB)`);
      console.log(`  Manifest: dist/${brandId}/asset-manifest.json`);
      console.log(`  Report: dist/${brandId}/build-report.json`);
    }
  }

  console.log(`\nBuild complete.${BUILD_DIST ? ' → dist/' : ''}`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
