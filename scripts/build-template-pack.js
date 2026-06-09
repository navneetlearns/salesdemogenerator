#!/usr/bin/env node
/**
 * build-template-pack.js
 *
 * Packs all Handlebars templates, journey data, CSS, JS, and helper logic
 * into a single public/template-pack.json manifest for client-side rendering.
 *
 * Usage:  node scripts/build-template-pack.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const DATA_DIR = path.join(ROOT, 'data');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const PUBLIC_DIR = path.join(ROOT, 'public');

const JOURNEY_IDS = [
  'order_to_cash',
  'field_ops_expense',
  'automated_collections',
  'dealer_engagement',
  'retailer_onboarding',
  'retailer_loyalty',
  'campaigns_queries',
  'dt_fulfillment_payment',
  'retailer_activation',
];

// Step 1: Partials
function readPartials() {
  const partialsDir = path.join(TEMPLATES_DIR, 'partials');
  const partials = {};

  function scanDir(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, prefix ? prefix + '/' + entry : entry);
        continue;
      }
      if (!entry.endsWith('.hbs')) continue;
      const name = prefix
        ? prefix + '/' + path.basename(entry, '.hbs')
        : path.basename(entry, '.hbs');
      partials[name] = fs.readFileSync(fullPath, 'utf8');
    }
  }

  scanDir(partialsDir, '');

  // Also include screen blocks as partials (prefixed with "screen-")
  const blocksDir = path.join(TEMPLATES_DIR, 'screens', 'blocks');
  if (fs.existsSync(blocksDir)) {
    const blockEntries = fs.readdirSync(blocksDir).filter(f => f.endsWith('.hbs'));
    for (const file of blockEntries) {
      const type = path.basename(file, '.hbs');
      const partialName = 'screen-' + type;
      partials[partialName] = fs.readFileSync(path.join(blocksDir, file), 'utf8');
    }
  }

  return partials;
}

// Step 2: Journey screen orchestrators
function readJourneyScreens() {
  const screens = {};
  for (const jid of JOURNEY_IDS) {
    const filePath = path.join(TEMPLATES_DIR, 'screens', jid + '.hbs');
    if (fs.existsSync(filePath)) {
      screens[jid] = fs.readFileSync(filePath, 'utf8');
    } else {
      console.warn('[build-template-pack] Missing journey screen template: ' + jid + '.hbs');
    }
  }
  // Also include the orchestrator template
  const orchPath = path.join(TEMPLATES_DIR, 'screens', 'orchestrator.hbs');
  if (fs.existsSync(orchPath)) {
    screens['orchestrator'] = fs.readFileSync(orchPath, 'utf8');
  }
  return screens;
}

// Step 3: Layout base
function readLayoutBase() {
  const filePath = path.join(TEMPLATES_DIR, 'layouts', 'base.hbs');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing layout: ' + filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Step 4: Style
function readStyle() {
  const filePath = path.join(TEMPLATES_DIR, 'layouts', 'style.css');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing style: ' + filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Step 5: Industries
function readIndustries() {
  const industriesDir = path.join(DATA_DIR, 'industries');
  const industries = {};
  if (!fs.existsSync(industriesDir)) return industries;
  const files = fs.readdirSync(industriesDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const key = path.basename(file, '.json');
    industries[key] = JSON.parse(fs.readFileSync(path.join(industriesDir, file), 'utf8'));
  }
  return industries;
}

// Step 6: Default journey data (jk_cement)
function readDefaultJourneyData() {
  const journeys = {};
  for (const jid of JOURNEY_IDS) {
    // Try jk_cement first, fall back to haldirams for exclusive journeys
    let filePath = path.join(DATA_DIR, 'journeys', 'jk_cement_' + jid + '.json');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DATA_DIR, 'journeys', 'haldirams_' + jid + '.json');
    }
    if (fs.existsSync(filePath)) {
      journeys[jid] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      console.warn('[build-template-pack] Missing default journey: ' + jid + '.json');
    }
  }
  return journeys;
}

// Step 7: Default brand
function readDefaultBrand() {
  const filePath = path.join(DATA_DIR, 'brands', 'jk_cement.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing default brand: ' + filePath);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Step 8: Default catalog
function readDefaultCatalog() {
  const filePath = path.join(DATA_DIR, 'catalogs', 'jk_cement_products.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing default catalog: ' + filePath);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readDefaultContentLabels() {
  const filePath = path.join(DATA_DIR, 'content', 'order_to_cash_labels.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing default content labels: ' + filePath);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Step 9: Scripts
function readScripts() {
  const scriptFiles = ['journey-core.js', 'navigation.js', 'overlays.js'];
  const scripts = {};
  for (const file of scriptFiles) {
    const filePath = path.join(SCRIPTS_DIR, file);
    if (fs.existsSync(filePath)) {
      scripts[file.replace('.js', '')] = fs.readFileSync(filePath, 'utf8');
    } else {
      console.warn('[build-template-pack] Missing script: ' + file);
    }
  }
  return scripts;
}

// Step 10: Handlebars helper function source code
// We define actual functions and serialize via .toString() to avoid escaping issues.
function _formatCurrency(amount) {
  if (amount == null) return '';
  var num = Number(amount);
  if (isNaN(num)) return String(amount);
  var parts = num.toFixed(2).split('.');
  var intPart = String(Math.abs(Math.floor(num)));
  var last3 = intPart.slice(-3);
  var rest = intPart.slice(0, -3);
  var formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  var sign = num < 0 ? '-' : '';
  return '₹' + sign + formatted + (parts[1] !== '00' ? '.' + parts[1] : '');
}

function _eq(a, b, options) {
  if (options && typeof options.fn === 'function') {
    return a === b ? options.fn(this) : (options.inverse ? options.inverse(this) : '');
  }
  return a === b;
}

function _multiply(a, b) { return Number(a) * Number(b); }
function _subtract(a, b) { return Number(a) - Number(b); }
function _add(a, b) { return Number(a) + Number(b); }
function _divide(a, b) { return Number(a) / Number(b); }
function _lookupPartial(type) { return 'screen-' + type; }

function buildHelpers() {
  return {
    formatCurrency: _formatCurrency.toString(),
    eq: _eq.toString(),
    multiply: _multiply.toString(),
    subtract: _subtract.toString(),
    add: _add.toString(),
    divide: _divide.toString(),
    lookupPartial: _lookupPartial.toString(),
  };
}

function readFixedAssets() {
  const assets = {};
  const sapPath = path.join(ROOT, 'assets', 'brands', 'jk_cement', 'sap_architecture.png');
  if (fs.existsSync(sapPath)) {
    assets.sapArchitectureImage = 'data:image/png;base64,' + fs.readFileSync(sapPath).toString('base64');
  }
  return assets;
}

// Step 11: Journey descriptions metadata
function buildJourneyDescriptions() {
  return {
    order_to_cash: {
      title: 'Order to Cash',
      steps: 11,
      desc: 'Self-service ordering & AI order capture through WhatsApp Commerce',
      scaffold: false,
    },
    field_ops_expense: {
      title: 'Field Ops & Expense',
      steps: 15,
      desc: 'Field sales expense reporting, approval workflows, and settlement',
      scaffold: false,
    },
    automated_collections: {
      title: 'Automated Collections',
      steps: 11,
      desc: 'AI-driven payment reminders, collection tracking, and reconciliation',
      scaffold: false,
    },
    dealer_engagement: {
      title: 'Dealer Engagement',
      steps: 3,
      desc: 'Campaigns, schemes, AI support and loyalty management for dealers',
      scaffold: false,
    },
    retailer_onboarding: {
      title: 'Retailer Onboarding',
      steps: 12,
      desc: 'Retailer digital onboarding with verification, catalog activation, and order to cash cycle',
      scaffold: false,
    },
    retailer_loyalty: {
      title: 'Retailer Loyalty',
      steps: 6,
      desc: 'Loyalty program for retailers with points, rewards, and tier tracking',
      scaffold: false,
    },
    campaigns_queries: {
      title: 'Campaigns & Queries',
      steps: 3,
      desc: 'Push targeted campaigns to retailers and resolve scheme and pricing queries via AI',
      scaffold: false,
    },
    dt_fulfillment_payment: {
      title: 'DT Fulfillment & Payment',
      steps: 5,
      desc: 'Distributor territory fulfillment with order tracking, delivery confirmation, and payment processing',
      scaffold: false,
    },
    retailer_activation: {
      title: 'Retailer Activation',
      steps: 2,
      desc: 'Activate new retailers with welcome campaigns, scheme enrollment, and first-order incentives',
      scaffold: false,
    },
  };
}

// Main
function main() {
  console.log('=== Building template-pack.json ===');

  const pack = {
    version: '1.0.0',
    builtAt: new Date().toISOString(),
    partials: readPartials(),
    journeyScreens: readJourneyScreens(),
    layoutBase: readLayoutBase(),
    style: readStyle(),
    industries: readIndustries(),
    defaultJourneyData: readDefaultJourneyData(),
    defaultBrand: readDefaultBrand(),
    defaultCatalog: readDefaultCatalog(),
    defaultContentLabels: readDefaultContentLabels(),
    scripts: readScripts(),
    helpers: buildHelpers(),
    fixedAssets: readFixedAssets(),
    journeyDescriptions: buildJourneyDescriptions(),
  };

  // Ensure public/ directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const outPath = path.join(PUBLIC_DIR, 'template-pack.json');
  fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), 'utf8');

  const stats = fs.statSync(outPath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  console.log('Wrote ' + outPath + ' (' + sizeKB + ' KB)');

  // Verify keys
  const expectedKeys = [
    'version', 'builtAt', 'partials', 'journeyScreens', 'layoutBase',
    'style', 'industries', 'defaultJourneyData', 'defaultBrand',
    'defaultCatalog', 'defaultContentLabels', 'scripts', 'helpers', 'fixedAssets', 'journeyDescriptions',
  ];
  const missingKeys = expectedKeys.filter(k => !(k in pack));
  if (missingKeys.length) {
    console.error('Missing keys:', missingKeys);
    process.exit(1);
  }
  console.log('All expected keys present');

  // Summary counts
  console.log('  Partials: ' + Object.keys(pack.partials).length);
  console.log('  Journey screens: ' + Object.keys(pack.journeyScreens).length);
  console.log('  Industries: ' + Object.keys(pack.industries).length);
  console.log('  Default journeys: ' + Object.keys(pack.defaultJourneyData).length);
  console.log('  Scripts: ' + Object.keys(pack.scripts).length);
  console.log('  Helpers: ' + Object.keys(pack.helpers).length);
  console.log('  Fixed assets: ' + Object.keys(pack.fixedAssets).length);
  console.log('  Journey descriptions: ' + Object.keys(pack.journeyDescriptions).length);
}

main();
