const Handlebars = require('handlebars');
const path = require('path');
const fs = require('fs-extra');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const SCRIPT_CORE_FILES = ['journey-core.js', 'navigation.js', 'overlays.js', 'debug-overlay.js'];

// ── Partial registration (singleton, runs once) ──
let _partialsRegistered = false;
function registerPartialsOnce() {
  if (_partialsRegistered) return;
  _partialsRegistered = true;

  function registerDir(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        registerDir(fullPath, prefix ?  : file);
        continue;
      }
      if (!file.endsWith('.hbs')) continue;
      const name = prefix ?  : path.basename(file, '.hbs');
      Handlebars.registerPartial(name, fs.readFileSync(fullPath, 'utf8'));
    }
  }
  registerDir(path.join(TEMPLATES_DIR, 'partials'));

  // Screen blocks
  const blocksDir = path.join(TEMPLATES_DIR, 'screens', 'blocks');
  if (fs.existsSync(blocksDir)) {
    for (const file of fs.readdirSync(blocksDir).filter(f => f.endsWith('.hbs'))) {
      const type = path.basename(file, '.hbs');
      Handlebars.registerPartial('screen-' + type, fs.readFileSync(path.join(blocksDir, file), 'utf8'));
    }
  }
}

// ── Handlebars helpers (singleton) ──
let _helpersRegistered = false;
function registerHelpersOnce() {
  if (_helpersRegistered) return;
  _helpersRegistered = true;

  Handlebars.registerHelper('eq', function(a, b, options) {
    if (options && typeof options.fn === 'function') {
      return a === b ? options.fn(this) : (options.inverse ? options.inverse(this) : '');
    }
    return a === b;
  });
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
  Handlebars.registerHelper('lookupPartial', type => 'screen-' + type);
}

// ── Load scripts (in-memory) ──
async function loadScripts(navSteps) {
  const parts = [`const steps = ${JSON.stringify(navSteps)};

`];
  for (const file of SCRIPT_CORE_FILES) {
    const fp = path.join(SCRIPTS_DIR, file);
    if (await fs.pathExists(fp)) parts.push(await fs.readFile(fp, 'utf8'));
  }
  return parts.join('

');
}

// ── SAP diagram injection ──
function loadSapDiagram() {
  const pngPath = path.join(ROOT, 'assets', 'brands', 'jk_cement', 'sap_architecture.png');
  if (!fs.existsSync(pngPath)) return null;
  const buf = fs.readFileSync(pngPath);
  const mime = (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// ── Handwritten order SVG ──
function handwrittenOrderDataUri(store, products) {
  const lines = (products || []).slice(0, 3).map((p, i) => {
    const qty = i === 0 ? 25 : i === 1 ? 20 : 12;
    return `${p.name || 'Product'} - ${qty}`;
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

// ── Main render function ──
async function renderBrandSession(brandData, catalogProducts, journeyDataMap, brandId, options = {}) {
  registerHelpersOnce();
  registerPartialsOnce();

  const styleContent = await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'style.css'), 'utf8');
  const layoutTemplate = Handlebars.compile(
    await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'base.hbs'), 'utf8')
  );

  // Compile journey view templates
  const journeyTemplates = {
    order_to_cash: Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'order_to_cash.hbs'), 'utf8')),
    automated_collections: Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'automated_collections.hbs'), 'utf8')),
    dealer_engagement: Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'dealer_engagement.hbs'), 'utf8')),
    retailer_onboarding: Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'retailer_onboarding.hbs'), 'utf8')),
    retailer_loyalty: Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'retailer_loyalty.hbs'), 'utf8')),
    field_ops_expense: Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'screens', 'field_ops_expense.hbs'), 'utf8')),
  };

  const { normalizeJourney } = require('./lib/journey-normalizer');

  // Asset pipeline simplified: resolve paths without Sharp
  const brandLogo = brandData.logo
    ? (brandData.logo.startsWith('data:') || brandData.logo.startsWith('/') || brandData.logo.startsWith('http')
      ? brandData.logo
      : `../../assets/brands/${brandId}/${brandData.logo}`)
    : null;

  const sapDiagram = loadSapDiagram();
  const store = brandData.dealerStoreName || brandData.name || brandId;
  const handwrittenOrderImage = handwrittenOrderDataUri(store, catalogProducts);
  const results = {};

  for (const [journeyId, journeyData] of Object.entries(journeyDataMap)) {
    const viewTemplate = journeyTemplates[journeyId];
    if (!viewTemplate) { console.warn('[serverless-builder] Unknown journey:', journeyId); continue; }

    const journey = normalizeJourney(journeyData, catalogProducts);

    // Build context (matches build.js)
    const navSteps = journey.navSteps || (journey.steps || []).map(s => 'step-' + s.num);
    const scriptsContent = await loadScripts(navSteps);

    const context = {
      brand: brandData,
      brandLogo,
      handwrittenOrderImage,
      industry: options.industry || { tabs: ['All'] },
      catalog: { products: catalogProducts },
      cart: journey.cart || {},
      journey,
      style: styleContent,
      scripts: scriptsContent,
      showComposableMarkers: false,
    };

    const bodyContent = viewTemplate(context);
    let finalHtml = layoutTemplate({ ...context, body: bodyContent });

    // SAP diagram injection
    if (sapDiagram) {
      finalHtml = finalHtml.replace(
        /(<img\s+)src="data:image\/placeholder"([^>]*alt="ZoTok[^"]*SAP Integration Architecture"[^>]*>)/g,
        `src="${sapDiagram}"`
      );
    }

    results[journeyId] = finalHtml;
  }

  return results;
}

module.exports = { renderBrandSession };
