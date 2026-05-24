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

Handlebars.registerHelper('eq', function(a, b, options) {
    if (options && typeof options.fn === 'function') {
      // Block helper: {{#eq a b}}content{{/eq}}
      return a === b ? options.fn(this) : (options.inverse ? options.inverse(this) : '');
    }
    // Inline helper: {{eq a b}}
    return a === b;
  });
Handlebars.registerHelper('lookupPartial', type => getPartialName(type));
Handlebars.registerHelper('formatCurrency', (amount) => {
  if (amount == null) return '';
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  const parts = num.toFixed(2).split('.');
  let intPart = String(Math.abs(Math.floor(num)));
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  const sign = num < 0 ? '-' : '';
  return '₹' + sign + formatted + (parts[1] !== '00' ? '.' + parts[1] : '');
});
Handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
Handlebars.registerHelper('subtract', (a, b) => Number(a) - Number(b));
Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));

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

  // Check for unresolved data:image/placeholder — hard error, no placeholders allowed
  if (/data:image\/placeholder/.test(htmlWithoutScripts)) {
    const phCount = (htmlWithoutScripts.match(/data:image\/placeholder/g) || []).length;
    errors.push('Unresolved data:image/placeholder (' + phCount + ' found) — image src attributes must be parameterized');
  }

  if (errors.length) throw new Error(`Validation failed for ${brandId}:\n  - ${errors.join('\n  - ')}`);
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
  // Use brand dealer store name instead of hardcoded cement dealer
  const store = brand.dealerStoreName || 'Sharma Cement Stores';
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
  const acViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'automated_collections.hbs'), 'utf8')
  );
  const deViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'dealer_engagement.hbs'), 'utf8')
  );
  const roViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'retailer_onboarding.hbs'), 'utf8')
  );
  const rlViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'retailer_loyalty.hbs'), 'utf8')
  );
  const foViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'field_ops_expense.hbs'), 'utf8')
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

    // ── Phase 3: Enrich journey data from catalog ──
    const catalogProductMap = Object.fromEntries(pipeline.products.map(p => [p.id, p]));
    if (journey.order?.items) {
      journey.order.items = journey.order.items.map(item => {
        const product = catalogProductMap[item.productId];
        return { ...item, name: product ? product.name : item.name || '',
          pricePerUnit: item.pricePerUnit || (product ? product.price : 0),
          unit: product ? product.unit : 'unit' };
      });
      journey.order.summary = journey.order.summary || {};
      journey.order.summary.totalItems = journey.order.summary.totalItems || journey.order.items.length;
      journey.order.summary.orderValue = journey.order.summary.orderValue || 
        journey.order.items.reduce((s, i) => s + (i.lineTotal || 0), 0);
    }
    if (journey.payment) {
      journey.payment.settlement = journey.payment.settlement || {
        status: 'Settled', amount: (journey.order?.summary?.orderValue) || 0,
        date: journey.payment.date || '' };
    }

    const catalog = { products: pipeline.products };
    const handwrittenOrderImage = handwrittenOrderDataUri(brand, pipeline.products);
    const cart = journey.cart;
    const scriptsContent = await loadScripts(journey.navSteps);

    const context = {
      brand,
      brandLogo: pipeline.brandLogo,
      handwrittenOrderImage,
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

    // ── Render additional journey types ──
    // Helper: build context for a non-OTC journey (normalize, load scripts, include style)
    async function buildJourneyContext(rawJourney) {
      const j = normalizeJourney(rawJourney, pipeline.products);
      const jScripts = await loadScripts(j.navSteps);
      return {
        brand,
        brandLogo: pipeline.brandLogo,
        industry,
        journey: j,
        catalog,
        cart: j.cart,
        style: styleContent,
        scripts: jScripts,
        showComposableMarkers: false,
      };
    }

    // Field Ops & Expense
    const foPath = path.join(DATA_DIR, 'journeys', brandId + '_field_ops_expense.json');
    if (await fs.pathExists(foPath)) {
      let foRaw = { id: 'field_ops_expense', title: 'Field Ops & Expense', screens: [] };
      try { foRaw = await fs.readJson(foPath); } catch (e) {}
      const foCtx = await buildJourneyContext(foRaw);
      const foBody = foViewTemplate(foCtx);
      const foHtml = layoutTemplate({ ...foCtx, body: foBody });
      fs.writeFileSync(path.join(genDir, 'field_ops_expense.html'), foHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/field_ops_expense.html');
    }

    // Dealer Engagement
    const dePath = path.join(DATA_DIR, 'journeys', brandId + '_dealer_engagement.json');
    if (await fs.pathExists(dePath)) {
      let deRaw = { id: 'dealer_engagement', title: 'Dealer Engagement', screens: [] };
      try { deRaw = await fs.readJson(dePath); } catch (e) {}
      const deCtx = await buildJourneyContext(deRaw);
      const deBody = deViewTemplate(deCtx);
      const deHtml = layoutTemplate({ ...deCtx, body: deBody });
      fs.writeFileSync(path.join(genDir, 'dealer_engagement.html'), deHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/dealer_engagement.html');
    }

    // Retailer Onboarding
    const roPath = path.join(DATA_DIR, 'journeys', brandId + '_retailer_onboarding.json');
    if (await fs.pathExists(roPath)) {
      let roRaw = { id: 'retailer_onboarding', title: 'Retailer Onboarding', screens: [] };
      try { roRaw = await fs.readJson(roPath); } catch (e) {}
      const roCtx = await buildJourneyContext(roRaw);
      const roBody = roViewTemplate(roCtx);
      const roHtml = layoutTemplate({ ...roCtx, body: roBody });
      fs.writeFileSync(path.join(genDir, 'retailer_onboarding.html'), roHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/retailer_onboarding.html');
    }

    // Retailer Loyalty
    const rlPath = path.join(DATA_DIR, 'journeys', brandId + '_retailer_loyalty.json');
    if (await fs.pathExists(rlPath)) {
      let rlRaw = { id: 'retailer_loyalty', title: 'Retailer Loyalty', screens: [] };
      try { rlRaw = await fs.readJson(rlPath); } catch (e) {}
      const rlCtx = await buildJourneyContext(rlRaw);
      const rlBody = rlViewTemplate(rlCtx);
      const rlHtml = layoutTemplate({ ...rlCtx, body: rlBody });
      fs.writeFileSync(path.join(genDir, 'retailer_loyalty.html'), rlHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/retailer_loyalty.html');
    }

    // Automated Collections
    const acPath = path.join(DATA_DIR, 'journeys', brandId + '_automated_collections.json');
    if (await fs.pathExists(acPath)) {
      let acRaw = { id: 'automated_collections', title: 'Automated Collections', screens: [] };
      try { acRaw = await fs.readJson(acPath); } catch (e) {}
      const acCtx = await buildJourneyContext(acRaw);
      const acBody = acViewTemplate(acCtx);
      const acHtml = layoutTemplate({ ...acCtx, body: acBody });
      fs.writeFileSync(path.join(genDir, 'automated_collections.html'), acHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/automated_collections.html');
    }
  }

  console.log(`\nBuild complete.${BUILD_DIST ? ' → dist/' : ''}`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
