const Handlebars = require('handlebars');
const path = require('path');
const fs = require('fs-extra');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const SCRIPT_CORE_FILES = ['journey-core.js', 'navigation.js', 'overlays.js', 'debug-overlay.js'];

// Partial registration (singleton, runs once)
let _partialsRegistered = false;
function registerPartialsOnce() {
  if (_partialsRegistered) return;
  _partialsRegistered = true;

  function registerDir(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        registerDir(fullPath, prefix ? prefix + '/' + file : file);
        continue;
      }
      if (!file.endsWith('.hbs')) continue;
      const name = prefix ? prefix + '/' + path.basename(file, '.hbs') : path.basename(file, '.hbs');
      Handlebars.registerPartial(name, fs.readFileSync(fullPath, 'utf8'));
    }
  }
  registerDir(path.join(TEMPLATES_DIR, 'partials'));

  const blocksDir = path.join(TEMPLATES_DIR, 'screens', 'blocks');
  if (fs.existsSync(blocksDir)) {
    for (const file of fs.readdirSync(blocksDir).filter(function(f) { return f.endsWith('.hbs'); })) {
      const type = path.basename(file, '.hbs');
      Handlebars.registerPartial('screen-' + type, fs.readFileSync(path.join(blocksDir, file), 'utf8'));
    }
  }
}

// Handlebars helpers (singleton)
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
  Handlebars.registerHelper('formatCurrency', function(amount) {
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
  });
  Handlebars.registerHelper('multiply', function(a, b) { return Number(a) * Number(b); });
  Handlebars.registerHelper('subtract', function(a, b) { return Number(a) - Number(b); });
  Handlebars.registerHelper('add', function(a, b) { return Number(a) + Number(b); });
  Handlebars.registerHelper('divide', function(a, b) { return Number(a) / Number(b); });
  Handlebars.registerHelper('lookupPartial', function(type) { return 'screen-' + type; });
}

// Load scripts (in-memory)
async function loadScripts(navSteps) {
  var parts = ['const steps = ' + JSON.stringify(navSteps) + ';

'];
  for (var fi = 0; fi < 4; fi++) {
    var file = SCRIPT_CORE_FILES[fi];
    var fp = path.join(SCRIPTS_DIR, file);
    if (await fs.pathExists(fp)) parts.push(await fs.readFile(fp, 'utf8'));
  }
  return parts.join('

');
}

// SAP diagram injection
function loadSapDiagram() {
  var pngPath = path.join(ROOT, 'assets', 'brands', 'jk_cement', 'sap_architecture.png');
  if (!fs.existsSync(pngPath)) return null;
  var buf = fs.readFileSync(pngPath);
  var mime = (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ? 'image/png' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

// Handwritten order SVG
function handwrittenOrderDataUri(store, products) {
  var lines = [];
  var count = (products || []).length;
  for (var i = 0; i < 3 && i < count; i++) {
    var qty = i === 0 ? 25 : i === 1 ? 20 : 12;
    var pname = (products[i] && products[i].name) ? products[i].name : 'Product';
    lines.push(pname + ' - ' + qty);
  }
  while (lines.length < 3) lines.push('Please deliver today');
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="380" height="250" viewBox="0 0 380 250">' +
    '<rect width="380" height="250" rx="18" fill="#fffdf6"/>' +
    '<path d="M44 57h292M44 96h292M44 135h292M44 174h292M44 213h210" stroke="#e7dcc7" stroke-width="3"/>' +
    '<text x="42" y="42" font-family="Caveat, Comic Sans MS, cursive" font-size="28" fill="#4d3a2a">Order for ' + store + '</text>' +
    '<text x="54" y="86" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">' + lines[0] + '</text>' +
    '<text x="54" y="125" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">' + lines[1] + '</text>' +
    '<text x="54" y="164" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">' + lines[2] + '</text>' +
    '<text x="54" y="203" font-family="Caveat, Comic Sans MS, cursive" font-size="25" fill="#263238">Please deliver today</text>' +
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Main render function
async function renderBrandSession(brandData, catalogProducts, journeyDataMap, brandId) {
  registerHelpersOnce();
  registerPartialsOnce();

  var styleContent = await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'style.css'), 'utf8');
  var layoutTemplate = Handlebars.compile(await fs.readFile(path.join(TEMPLATES_DIR, 'layouts', 'base.hbs'), 'utf8'));

  // Compile journey view templates
  var journeyTemplates = {};
  var journeyIds = ['order_to_cash', 'automated_collections', 'dealer_engagement', 'retailer_onboarding', 'retailer_loyalty', 'field_ops_expense'];
  for (var ji = 0; ji < journeyIds.length; ji++) {
    var jid = journeyIds[ji];
    var jpath = path.join(TEMPLATES_DIR, 'screens', jid + '.hbs');
    if (await fs.pathExists(jpath)) {
      journeyTemplates[jid] = Handlebars.compile(await fs.readFile(jpath, 'utf8'));
    }
  }

  var normalizeJourney = require('../lib/journey-normalizer').normalizeJourney;

  var sapDiagram = loadSapDiagram();
  var store = brandData.dealerStoreName || brandData.name || brandId;
  var handwrittenOrderImage = handwrittenOrderDataUri(store, catalogProducts);
  var results = {};

  for (var jid in journeyDataMap) {
    if (!journeyDataMap.hasOwnProperty(jid)) continue;
    var viewTemplate = journeyTemplates[jid];
    if (!viewTemplate) { console.warn('[serverless-builder] Unknown journey:', jid); continue; }

    var journey = normalizeJourney(journeyDataMap[jid], catalogProducts);
    var navSteps = journey.navSteps || (journey.steps || []).map(function(s) { return 'step-' + s.num; });
    var scriptsContent = await loadScripts(navSteps);

    var context = {
      brand: brandData,
      brandLogo: brandData.logo ? (brandData.logo.indexOf('data:') === 0 || brandData.logo.indexOf('/') === 0 || brandData.logo.indexOf('http') === 0 ? brandData.logo : '../../assets/brands/' + brandId + '/' + brandData.logo) : null,
      handwrittenOrderImage: handwrittenOrderImage,
      industry: { tabs: ['All'] },
      catalog: { products: catalogProducts },
      cart: journey.cart || {},
      journey: journey,
      style: styleContent,
      scripts: scriptsContent,
      showComposableMarkers: false,
    };

    var bodyContent = viewTemplate(context);
    var finalHtml = layoutTemplate(Object.assign({}, context, { body: bodyContent }));

    // SAP diagram injection
    if (sapDiagram) {
      finalHtml = finalHtml.replace(
        /<img\s+src="data:image\/placeholder"([^>]*alt="ZoTok[^"]*SAP Integration Architecture"[^>]*>)/g,
        function(match, p1) { return '<img src="' + sapDiagram + '"' + p1; }
      );
    }

    results[jid] = finalHtml;
  }

  return results;
}

module.exports = { renderBrandSession };