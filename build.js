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
const { buildJourneyContent } = require('./services/content-adapter');

// New schema-driven renderer (Phase 2)
const screenRenderer = require('./lib/screen-renderer');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const GENERATED_DIR = path.join(ROOT, 'generated');
const DIST_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIST_DIR = path.join(ROOT, 'public', 'dist');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const ASSETS_DIR = path.join(ROOT, 'assets');

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
const HALDIRAM_SOURCE_JOURNEYS = new Set([
  'campaigns_queries',
  'dt_fulfillment_payment',
  'retailer_activation',
]);

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
Handlebars.registerHelper('divide', (a, b) => Number(a) / Number(b));
Handlebars.registerHelper('fieldOpsImage', (filename) => {
  if (!filename) return '';
  return '../../assets/field_ops/' + filename;
});

/**
 * renderSchemaScreen — Render a schema screen by its { type, data } object.
 * Looks up the screen-{type} partial in Handlebars partials registry,
 * compiles it with the screen's data, and renders it.
 * Falls back to a simple description card if the partial is missing.
 */
Handlebars.registerHelper('renderSchemaScreen', function(screen) {
  if (!screen || !screen.type) {
    return '<div class="screen-wrap"><div class="screen-lbl">Unknown screen</div></div>';
  }

  // step-partial: bridge to existing step partials — render with full context
  if (screen.type === 'step-partial') {
    var partialName = screen.data && screen.data.partialName;
    if (partialName && Handlebars.partials[partialName]) {
      var template = Handlebars.compile(Handlebars.partials[partialName]);
      return template(this);
    }
    return '<div class="screen-wrap"><div class="screen-desc" style="background:#ffd9b0;padding:16px;border-radius:8px;"><strong>Step Partial</strong><br>Missing: ' + (partialName || '(no name)') + '</div></div>';
  }

  // Schema screen types: look up screen-{type} partial and render with data
  var screenPartialName = 'screen-' + screen.type;
  var screenPartial = Handlebars.partials[screenPartialName];
  if (screenPartial) {
    var template = Handlebars.compile(screenPartial);
    return template(screen.data || {});
  }
  // Fallback: render description card if available
  if (screen.description) {
    return '<div class="screen-wrap"><div class="screen-desc" style="background:#E8F5E9;padding:16px;border-radius:8px;"><strong>' + screen.type + '</strong><br>' + screen.description + '</div></div>';
  }
  return '<div class="screen-wrap"><div class="screen-lbl" style="color:#999;">' + screen.type + '</div></div>';
});

async function loadScripts(navSteps) {
  const parts = [`const steps = ${JSON.stringify(navSteps)};\n\n`];
  for (const file of SCRIPT_CORE_FILES) {
    const filePath = path.join(SCRIPTS_DIR, file);
    if (!await fs.pathExists(filePath)) throw new Error(`Missing script: ${file}`);
    parts.push(await fs.readFile(filePath, 'utf8'));
  }
  return parts.join('\n\n');
}

function haldiramSourceLogoDataUri() {
  const sourceLogoPath = path.join(ASSETS_DIR, 'brands', 'haldirams', 'logo.jpg');
  if (!fs.existsSync(sourceLogoPath)) return null;
  return 'data:image/jpeg;base64,' + fs.readFileSync(sourceLogoPath).toString('base64');
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
  const store = brand.dealerStoreName || brand.shortName || brand.name;
  // Use catalog product names (industry-specific) for the handwritten note
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
  // Copy field ops illustration images — needed for both static and Vercel public serving
  const fieldOpsSrc = path.join(ROOT, 'assets', 'field_ops');
  if (await fs.pathExists(fieldOpsSrc)) {
    await fs.copy(fieldOpsSrc, path.join(genBrandDir, 'assets', 'field_ops'));
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
  const cqViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'campaigns_queries.hbs'), 'utf8')
  );
  const dtViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'dt_fulfillment_payment.hbs'), 'utf8')
  );
  const raViewTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'retailer_activation.hbs'), 'utf8')
  );
  const layoutTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'base.hbs'), 'utf8')
  );

  const builtBrandIds = [];
  for (const brandFile of await fs.readdir(path.join(DATA_DIR, 'brands'))) {
    if (!brandFile.endsWith('.json')) continue;
    const brandId = path.basename(brandFile, '.json');
    builtBrandIds.push(brandId);
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
    journey.content = buildJourneyContent({});
    pipeline.report.journeyStepCount = journey.steps?.length || 0;

    // ── Inject brand dealer store name into journey messages ──
    const dealerStoreName = brand.dealerStoreName || brand.shortName || brand.name;
    if (journey.dealer) {
      journey.dealer.name = dealerStoreName;
    }
    if (journey.messages?.welcome?.body) {
      journey.messages.welcome.body = journey.messages.welcome.body
        .replace(/<strong>[^<]*<\/strong>/, '<strong>' + dealerStoreName + '</strong>');
    }

    // ── Derive product categories from catalog for step1 sections ──
    if (journey.messages?.step1 && pipeline.products.length > 0) {
      const productsByCategory = {};
      for (const p of pipeline.products) {
        const cat = p.category || 'Other';
        if (!productsByCategory[cat]) productsByCategory[cat] = [];
        productsByCategory[cat].push(p);
      }
      const categories = Object.keys(productsByCategory);
      const sections = [];

      // Section 1: Main product category (first category, up to 3 items)
      if (categories.length > 0) {
        const mainCat = categories[0];
        sections.push({
          label: mainCat,
          items: productsByCategory[mainCat].slice(0, 3).map(p => ({
            title: p.name,
            desc: p.description || (p.unit ? `${p.category} · ${p.unit}` : p.category)
          }))
        });
      }

      // Section 2: Secondary categories (remaining categories)
      if (categories.length > 1) {
        const secondaryItems = [];
        for (let i = 1; i < categories.length; i++) {
          const cat = categories[i];
          for (const p of productsByCategory[cat]) {
            secondaryItems.push({
              title: p.name,
              desc: p.description || (p.unit ? `${p.category} · ${p.unit}` : p.category)
            });
          }
        }
        if (secondaryItems.length > 0) {
          const label = categories.length === 2 ? categories[1] : `${categories.slice(1).join(' & ')}`;
          sections.push({ label, items: secondaryItems.slice(0, 3) });
        }
      }

      // Section 3: Offers & Trade (always present)
      sections.push({
        label: 'Offers & Solutions',
        items: [
          { title: 'Seasonal Offers', desc: 'Seasonal combos & clearance offers' },
          { title: 'Business Solutions', desc: 'Bulk orders & trade schemes' }
        ]
      });

      journey.messages.step1.sections = sections;
    }

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
    const sapArchitectureImage = loadSharedSapDiagramDataUri() || 'data:image/placeholder';
    const cart = journey.cart;
    const scriptsContent = await loadScripts(journey.navSteps);

    const context = {
      brand,
      brandLogo: pipeline.brandLogo,
      handwrittenOrderImage,
      sapArchitectureImage,
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
      j.content = buildJourneyContent({});
      const jScripts = await loadScripts(j.navSteps);
      const useHaldiramSourceIdentity = brandId === 'haldirams' && HALDIRAM_SOURCE_JOURNEYS.has(j.id);
      return {
        brand,
        brandLogo: useHaldiramSourceIdentity ? (haldiramSourceLogoDataUri() || pipeline.brandLogo) : pipeline.brandLogo,
        industry: useHaldiramSourceIdentity
          ? { ...industry, label: 'FMCG \u2014 Snacks, Sweets & Beverages', partnerLabel: 'Retailer' }
          : industry,
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

    // Campaigns & Queries
    const cqPath = path.join(DATA_DIR, 'journeys', brandId + '_campaigns_queries.json');
    if (await fs.pathExists(cqPath)) {
      let cqRaw = { id: 'campaigns_queries', title: 'Campaigns & Queries', screens: [] };
      try { cqRaw = await fs.readJson(cqPath); } catch (e) {}
      const cqCtx = await buildJourneyContext(cqRaw);
      const cqBody = cqViewTemplate(cqCtx);
      const cqHtml = layoutTemplate({ ...cqCtx, body: cqBody });
      fs.writeFileSync(path.join(genDir, 'campaigns_queries.html'), cqHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/campaigns_queries.html');
    }

    // DT Fulfillment & Payment
    const dtPath = path.join(DATA_DIR, 'journeys', brandId + '_dt_fulfillment_payment.json');
    if (await fs.pathExists(dtPath)) {
      let dtRaw = { id: 'dt_fulfillment_payment', title: 'DT Fulfillment & Payment', screens: [] };
      try { dtRaw = await fs.readJson(dtPath); } catch (e) {}
      const dtCtx = await buildJourneyContext(dtRaw);
      const dtBody = dtViewTemplate(dtCtx);
      const dtHtml = layoutTemplate({ ...dtCtx, body: dtBody });
      fs.writeFileSync(path.join(genDir, 'dt_fulfillment_payment.html'), dtHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/dt_fulfillment_payment.html');
    }

    // Retailer Activation
    const raPath = path.join(DATA_DIR, 'journeys', brandId + '_retailer_activation.json');
    if (await fs.pathExists(raPath)) {
      let raRaw = { id: 'retailer_activation', title: 'Retailer Activation', screens: [] };
      try { raRaw = await fs.readJson(raPath); } catch (e) {}
      const raCtx = await buildJourneyContext(raRaw);
      const raBody = raViewTemplate(raCtx);
      const raHtml = layoutTemplate({ ...raCtx, body: raBody });
      fs.writeFileSync(path.join(genDir, 'retailer_activation.html'), raHtml, 'utf8');
      console.log('  Generated: generated/' + brandId + '/retailer_activation.html');
    }

    // ── Schema-driven journeys (new system) ──
    // Process any journey JSON files that use the new schema (steps[].screens)
    const allJourneyFiles = (await fs.readdir(path.join(DATA_DIR, 'journeys')))
      .filter(f => f.startsWith(brandId + '_') && f.endsWith('.json'));
    
    const knownJourneyTypes = new Set([
      'order_to_cash', 'field_ops_expense', 'dealer_engagement', 
      'retailer_onboarding', 'retailer_loyalty', 'automated_collections',
      'campaigns_queries', 'dt_fulfillment_payment', 'retailer_activation'
    ]);

    for (const journeyFile of allJourneyFiles) {
      const journeyType = journeyFile.replace(brandId + '_', '').replace('.json', '');
      
      // Skip if already processed above
      if (knownJourneyTypes.has(journeyType)) continue;

      const journeyPath = path.join(DATA_DIR, 'journeys', journeyFile);
      try {
        const journeyData = await fs.readJson(journeyPath);
        
        // Check if this journey uses the new schema (has steps[].screens)
        if (!journeyData.steps || !journeyData.steps[0] || !journeyData.steps[0].screens) {
          continue; // Skip old-format journeys
        }

        console.log(`  Processing schema-driven journey: ${journeyType}`);
        
        // Build context for schema-driven journey
        const schemaJourney = normalizeJourney(journeyData, pipeline.products);
        schemaJourney.content = buildJourneyContent({});
        const schemaScripts = await loadScripts(schemaJourney.navSteps);
        
        const schemaContext = {
          brand,
          brandLogo: pipeline.brandLogo,
          industry,
          journey: schemaJourney,
          catalog,
          cart: schemaJourney.cart,
          style: styleContent,
          scripts: schemaScripts,
          showComposableMarkers: false,
        };

        // Render using the new schema-driven renderer
        const journeyHtml = screenRenderer.renderJourney(journeyData, schemaContext);
        
        // Wrap in layout
        const finalSchemaHtml = layoutTemplate({ 
          ...schemaContext, 
          body: journeyHtml 
        });

        const outputPath = path.join(genDir, `${journeyType}.html`);
        fs.writeFileSync(outputPath, finalSchemaHtml, 'utf8');
        console.log(`  Generated: generated/${brandId}/${journeyType}.html (schema-driven)`);

      } catch (err) {
        console.error(`  Error processing ${journeyFile}:`, err.message);
      }
    }
  }

  console.log(`\nBuild complete.${BUILD_DIST ? ' → dist/' : ''}`);

  // Copy additional journey HTML files into dist for static serving
  if (BUILD_DIST) {
    for (const brandId of builtBrandIds) {
      const genDir = path.join(GENERATED_DIR, brandId);
      const distBrandDir = path.join(DIST_DIR, brandId);
      if (!await fs.pathExists(genDir) || !await fs.pathExists(distBrandDir)) continue;
      const htmlFiles = (await fs.readdir(genDir)).filter(f => f.endsWith('.html') && f !== 'order_to_cash.html');
      for (const htmlFile of htmlFiles) {
        const src = path.join(genDir, htmlFile);
        const dest = path.join(distBrandDir, htmlFile);
        if (!await fs.pathExists(dest)) {
          await fs.copy(src, dest);
          console.log('  Copied journey: dist/' + brandId + '/' + htmlFile);
        }
      }

      // ── Generate hub index.html ──
      // Move current index.html (order_to_cash) to order_to_cash.html
      const currentIndex = path.join(distBrandDir, 'index.html');
      const otcTarget = path.join(distBrandDir, 'order_to_cash.html');
      if (await fs.pathExists(currentIndex) && !await fs.pathExists(otcTarget)) {
        await fs.copy(currentIndex, otcTarget);
      }

      // Read journey descriptions from template-pack.json for hub metadata
      const templatePackPath = path.join(ROOT, 'public', 'template-pack.json');
      let templatePack = {};
      try { templatePack = await fs.readJson(templatePackPath); } catch (e) {}
      const journeyDescs = templatePack.journeyDescriptions || {};

      // Load brand data (brand var from rendering loop is out of scope here)
      const brandJsonPath = path.join(DATA_DIR, 'brands', brandId + '.json');
      let brandData = {};
      try { brandData = await fs.readJson(brandJsonPath); } catch (e) {}
      const brandDefaultColor = (brandData.colors && brandData.colors.brand) || '#333';

      // Build hub journey list from available HTML files + journey data
      const hubJourneys = [];
      const journeyFiles = (await fs.readdir(distBrandDir)).filter(f => f.endsWith('.html') && f !== 'index.html');
      for (const jf of journeyFiles) {
        const jKey = jf.replace('.html', '');
        const jDesc = journeyDescs[jKey] || {};
        // Read hubMeta from journey JSON
        const jJsonPath = path.join(DATA_DIR, 'journeys', brandId + '_' + jKey + '.json');
        let hubMeta = {};
        try {
          const jData = await fs.readJson(jJsonPath);
          hubMeta = jData.hubMeta || {};
        } catch (e) {}
        hubJourneys.push({
          key: jKey,
          num: String(hubJourneys.length + 1).padStart(2, '0'),
          title: jDesc.title || jKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          steps: jDesc.steps || '?',
          desc: jDesc.desc || '',
          emoji: hubMeta.emoji || '\u{1F4F1}',
          color: hubMeta.color || brandDefaultColor,
          tags: hubMeta.tags || [],
          url: jf
        });
      }

      // Sort journeys by a defined order
      const journeyOrder = ['order_to_cash', 'field_ops_expense', 'automated_collections', 'dealer_engagement', 'retailer_onboarding', 'retailer_loyalty', 'campaigns_queries', 'dt_fulfillment_payment', 'retailer_activation', 'post_order_communication'];
      hubJourneys.sort((a, b) => {
        const ai = journeyOrder.indexOf(a.key);
        const bi = journeyOrder.indexOf(b.key);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      // Re-number after sort
      hubJourneys.forEach((j, i) => { j.num = String(i + 1).padStart(2, '0'); });

      if (hubJourneys.length > 0) {
        const hubTemplateSrc = await fs.readFile(path.join(TEMPLATES_DIR, 'hub.hbs'), 'utf8');
        const hubTemplate = Handlebars.compile(hubTemplateSrc);

        // Convert hex color to RGB tuple for rgba()
        function hexToRgb(hex) {
          const h = hex.replace('#', '');
          return [
            parseInt(h.substring(0, 2), 16),
            parseInt(h.substring(2, 4), 16),
            parseInt(h.substring(4, 6), 16)
          ].join(', ');
        }

        // Load brand data from JSON (brand var is out of scope here)
        const dealerStoreName = brandData.dealerStoreName || brandData.shortName || brandData.name || brandId;

        // Try to get brand logo from the dist assets
        let brandLogoDataUri = '';
        try {
          const assetManifestPath = path.join(distBrandDir, 'asset-manifest.json');
          const assetManifest = await fs.readJson(assetManifestPath);
          if (assetManifest.brandLogo) {
            const logoPath = path.join(distBrandDir, assetManifest.brandLogo);
            if (await fs.pathExists(logoPath)) {
              const logoBuf = await fs.readFile(logoPath);
              const ext = assetManifest.brandLogo.split('.').pop().toLowerCase();
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/' + ext;
              brandLogoDataUri = 'data:' + mime + ';base64,' + logoBuf.toString('base64');
            }
          }
        } catch (e) {}

        const hubContext = {
          brand: { name: brandData.name || brandId },
          brandColor: brandDefaultColor,
          brandRgb: hexToRgb(brandDefaultColor),
          brandLogo: brandLogoDataUri,
          dealerStoreName: dealerStoreName,
          journeys: hubJourneys
        };

        const hubHtml = hubTemplate(hubContext);
        await fs.writeFile(currentIndex, hubHtml, 'utf8');
        console.log('  Hub: dist/' + brandId + '/index.html (' + hubJourneys.length + ' journeys)');
      }
    }

    await clearDir(PUBLIC_DIST_DIR);
    await fs.copy(DIST_DIR, PUBLIC_DIST_DIR);
    // Copy field_ops illustration images to dist/ and public/ for serving
    const fieldOpsDist = path.join(DIST_DIR, 'assets', 'field_ops');
    const publicFieldOps = path.join(ROOT, 'public', 'assets', 'field_ops');
    const fieldOpsSrc = path.join(ROOT, 'assets', 'field_ops');
    if (await fs.pathExists(fieldOpsSrc)) {
      await fs.ensureDir(fieldOpsDist);
      await fs.copy(fieldOpsSrc, fieldOpsDist);
      await fs.ensureDir(publicFieldOps);
      await fs.copy(fieldOpsSrc, publicFieldOps);
    }
    console.log('  Mirrored dist/ to public/dist/ for static APIs');
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
