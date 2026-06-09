const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const Handlebars = require('handlebars');

function loadRendererWithPack(pack) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'demo-renderer.js'), 'utf8');
  const sandbox = {
    console,
    Handlebars,
    fetch: async function() {
      return { ok: true, json: async function() { return pack; } };
    }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.DemoRenderer;
}

function makeRetailerOnboardingSteps(count) {
  var steps = [];
  for (var i = 1; i <= count; i++) {
    steps.push({ num: i, title: 'Step ' + i, meta: 'Retailer' });
  }
  return steps;
}

function makeRetailerOnboardingPartials(journeyType, count) {
  var partials = {};
  for (var i = 1; i <= count; i++) {
    partials['step' + i + '-' + journeyType] = '<div id="step-' + i + '" class="step-section" data-step="' + i + '">Step ' + i + ' content for {{brand.name}}<button onclick="scrollToStep(' + i + ')">Nav</button><a href="#step-' + i + '">link</a></div>';
  }
  return partials;
}

function makeJourneyScreen(journeyType, count) {
  var parts = [];
  for (var i = 1; i <= count; i++) {
    parts.push('<div id="step-' + i + '" class="step-section" data-step="' + i + '">Step ' + i + ' content for {{brand.name}}<button onclick="scrollToStep(' + i + ')">Nav</button><a href="#step-' + i + '">link</a></div>');
  }
  return parts.join('\n');
}

function createPack() {
  var PARTIAL_COUNT = 12;
  return {
    partials: makeRetailerOnboardingPartials('retailer_onboarding', PARTIAL_COUNT),
    helpers: {},
    industries: {
      general: {
        id: 'general',
        label: 'General',
        unit: 'piece',
        currency: 'INR',
        currencySymbol: 'Rs'
      }
    },
    defaultBrand: {
      id: 'jk_cement',
      name: 'JK Cement',
      shortName: 'JK',
      industry: 'general',
      colors: { brand: '#075e54', brandDark: '#064e46' },
      theme: { colors: { brand: '#075e54', brandDark: '#064e46' } },
      dealerStoreName: 'Sharma Cement Stores'
    },
    defaultCatalog: [
      { id: 'p1', sku: 'JK001', name: 'JK Super OPC', price: 350, unit: 'bag', image: '/old-product.png' },
      { id: 'p2', sku: 'JK002', name: 'JK PPC', price: 360, unit: 'bag', image: '/old-product-2.png' }
    ],
    defaultJourneyData: {
      order_to_cash: {
        id: 'order_to_cash',
        title: 'JK Cement Order to Cash',
        dealer: { name: 'Sharma Cement Stores' },
        steps: [{ num: 1, title: 'AI Order Capture' }],
        order: { primaryOrderId: 'ORD-1' },
        step3: {
          draftOrder: { totalValue: 100, netValue: 95, skuCount: 2 },
          cartSummary: { totalItems: 2, totalQty: 30, orderValue: 100 },
          cartItems: [
            { name: 'JK Super OPC', unitPrice: 350, lineTotal: 3500, unit: 'bag' },
            { name: 'JK PPC', unitPrice: 360, lineTotal: 3600, unit: 'bag' }
          ]
        },
        productNames: {
          opc53: 'JK Super OPC 53 Grade',
          opc43: 'JK Super OPC 43 Grade',
          ppc: 'JK Protect PPC',
          cementPpc: 'JK Super Cement PPC'
        }
      },
      retailer_onboarding: {
        id: 'retailer_onboarding',
        title: 'Retailer Onboarding',
        dealer: { name: 'Test Store' },
        steps: makeRetailerOnboardingSteps(12),
        step3: {
          draftOrder: { totalValue: 100, netValue: 95, skuCount: 2 },
          cartSummary: { totalItems: 2, totalQty: 30, orderValue: 100 },
          cartItems: [
            { name: 'JK Super OPC', unitPrice: 350, lineTotal: 3500, unit: 'bag' },
            { name: 'JK PPC', unitPrice: 360, lineTotal: 3600, unit: 'bag' }
          ]
        },
        productNames: {
          opc53: 'JK Super OPC 53 Grade',
          opc43: 'JK Super OPC 43 Grade',
          ppc: 'JK Protect PPC',
          cementPpc: 'JK Super Cement PPC'
        }
      }
    },
    journeyScreens: {
      order_to_cash: [
        '<img id="handwritten" src="{{handwrittenOrderImage}}">',
        '<img id="sap" src="{{sapArchitectureImage}}">',
        '<span id="p0">{{journey.productNames.opc53}}</span>',
        '<span id="p1">{{journey.step3.cartItems.0.name}}</span>',
        '<img id="user-product" src="{{catalog.products.0.image}}">'
      ].join(''),
      retailer_onboarding: makeJourneyScreen('retailer_onboarding', 12)
    },
    layoutBase: '<html><body>{{{body}}}</body></html>',
    style: '',
    scripts: {},
    journeyDescriptions: {
      order_to_cash: { title: 'Order to Cash', steps: 11, desc: 'Complete', scaffold: false },
      retailer_onboarding: { title: 'Retailer Onboarding', steps: 12, desc: 'Complete', scaffold: false },
      dealer_engagement: { title: 'Dealer Engagement', steps: 3, desc: 'Partial', scaffold: true }
    },
    fixedAssets: {
      sapArchitectureImage: 'data:image/png;base64,FIXED_SAP'
    }
  };
}

test('client renderer provides fixed handwritten order and SAP assets for generated brands', async function() {
  const renderer = loadRendererWithPack(createPack());
  const result = await renderer.render({
    name: 'Acme Paints',
    products: [
      { name: 'Acme Primer', price: 200, unit: 'tin', imageDataUrl: 'data:image/png;base64,USER_PRODUCT' }
    ],
    journeyType: 'order_to_cash'
  });

  assert.match(result.html, /id="handwritten" src="data:image\/svg\+xml/);
  assert.match(result.html, /Order%20for%20Sharma%20General%20Store/);
  assert.match(result.html, /Acme%20Primer%20-%2025/);
  assert.match(result.html, /id="sap" src="data:image\/png;base64,FIXED_SAP"/);
});

test('client renderer maps user product data into product names, cart lines, and images', async function() {
  const renderer = loadRendererWithPack(createPack());
  const result = await renderer.render({
    name: 'Acme Paints',
    products: [
      { name: 'Acme Primer', price: 200, unit: 'tin', imageDataUrl: 'data:image/png;base64,USER_PRODUCT' },
      { name: 'Acme Putty', price: 150, unit: 'bag', imageDataUrl: 'data:image/png;base64,USER_PRODUCT_2' }
    ],
    journeyType: 'order_to_cash'
  });

  assert.match(result.html, /id="p0">Acme Primer/);
  assert.match(result.html, /id="p1">Acme Primer/);
  assert.match(result.html, /id="user-product" src="data:image\/png;base64,USER_PRODUCT"/);
  assert.doesNotMatch(result.html, /JK Super OPC/);
});

test('buildDynamicOrchestrator assembles only selected step partials', async function() {
  var pack = createPack();
  pack.partials['step1-retailer_onboarding'] = 'STEP1_CONTENT';
  pack.partials['step3-retailer_onboarding'] = 'STEP3_CONTENT';
  pack.partials['step5-retailer_onboarding'] = 'STEP5_CONTENT';
  const renderer = loadRendererWithPack(pack);
  await renderer.loadPack();
  var template = renderer.buildDynamicOrchestrator('retailer_onboarding', [1, 3, 5]);
  assert.match(template, /STEP1_CONTENT/);
  assert.match(template, /STEP3_CONTENT/);
  assert.match(template, /STEP5_CONTENT/);
  assert.doesNotMatch(template, /step2/);
  assert.doesNotMatch(template, /step4/);
});

test('isCustomDemo flag is true when selectedSteps provided', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: [1, 2, 3]
  });
  assert.equal(result.isCustomDemo, true);
  assert.ok(result.stepMap);
});

test('isCustomDemo flag is false without selectedSteps', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding'
  });
  assert.equal(result.isCustomDemo, false);
  assert.equal(result.stepMap, undefined);
});

test('remapStepReferences corrects all 4 reference types', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  const { remapStepReferences } = renderer;

  const inputHtml = [
    '<div id="step-3" class="step-section">',
    '  <span data-step="3">content</span>',
    '  <a href="#step-3">link</a>',
    '  <button onclick="scrollToStep(3)">Nav</button>',
    '</div>',
    '<div id="step-5" class="step-section">',
    '  <span data-step="5">content</span>',
    '  <a href="#step-5">link</a>',
    '  <button onclick="scrollToStep(5)">Nav</button>',
    '</div>'
  ].join('\n');

  const result = remapStepReferences(inputHtml, [1,2,3,4,5,6,7,8,9,10,11,12], [3, 5]);

  assert.match(result.html, /id="step-1"/);
  assert.match(result.html, /data-step="1"/);
  assert.match(result.html, /scrollToStep\(1\)/);
  assert.match(result.html, /href="#step-1"/);
  assert.match(result.html, /id="step-2"/);
  assert.match(result.html, /data-step="2"/);
  assert.match(result.html, /scrollToStep\(2\)/);
  assert.match(result.html, /href="#step-2"/);
  assert.doesNotMatch(result.html, /id="step-3"/);
  assert.doesNotMatch(result.html, /id="step-5"/);
  assert.equal(result.stepMap[3], 1);
  assert.equal(result.stepMap[5], 2);
});

test('journey metadata marks incomplete templates as work in progress', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  assert.equal(renderer.journeyDescriptions.dealer_engagement.scaffold, true);
});

/* ═══════════════════════════════════════════════════════════
   Task 3: buildJourney step filtering with originalNum/displayNum
   ═══════════════════════════════════════════════════════════ */

test('buildJourney filters steps and sets originalNum + displayNum', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var brand = renderer.buildBrand({ name: 'Test', products: [] });
  var catalog = renderer.buildCatalog({ name: 'Test', products: [] });
  var journey = renderer.buildJourney('retailer_onboarding', brand, catalog, [1, 3, 5]);

  assert.equal(journey.steps.length, 3);
  assert.equal(journey.steps[0].num, 1);
  assert.equal(journey.steps[0].originalNum, 1);
  assert.equal(journey.steps[0].displayNum, 1);
  assert.equal(journey.steps[1].num, 2);
  assert.equal(journey.steps[1].originalNum, 3);
  assert.equal(journey.steps[1].displayNum, 2);
  assert.equal(journey.steps[2].num, 3);
  assert.equal(journey.steps[2].originalNum, 5);
  assert.equal(journey.steps[2].displayNum, 3);
});

test('buildJourney without selectedSteps keeps all steps unchanged', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var brand = renderer.buildBrand({ name: 'Test', products: [] });
  var catalog = renderer.buildCatalog({ name: 'Test', products: [] });
  var journey = renderer.buildJourney('retailer_onboarding', brand, catalog);

  assert.equal(journey.steps.length, 12);
  assert.equal(journey.steps[0].originalNum, undefined);
  assert.equal(journey.steps[0].displayNum, undefined);
});

/* ═══════════════════════════════════════════════════════════
   Task 4: render with step selection produces sequential IDs
   ═══════════════════════════════════════════════════════════ */

test('render with step selection produces sequential step IDs', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: [1, 3, 5]
  });
  assert.match(result.html, /id="step-1"/);
  assert.match(result.html, /id="step-2"/);
  assert.match(result.html, /id="step-3"/);
  assert.doesNotMatch(result.html, /id="step-4"/);
  assert.doesNotMatch(result.html, /id="step-5"/);
  assert.doesNotMatch(result.html, /id="step-6"/);
  assert.equal(result.isCustomDemo, true);
  assert.ok(result.stepMap);
});

test('render without step selection is unchanged', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding'
  });
  assert.equal(result.isCustomDemo, false);
  assert.equal(result.stepMap, undefined);
});

/* ═══════════════════════════════════════════════════════════
   Task 6: Integration tests — full render + empty selection
   ═══════════════════════════════════════════════════════════ */

test('full render with step selection returns valid HTML with sequential step IDs', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Acme Corp',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: [1, 3, 5]
  });

  assert.ok(result.html);
  assert.ok(result.html.length > 400);
  assert.match(result.html, /id="step-1"/);
  assert.match(result.html, /id="step-2"/);
  assert.match(result.html, /id="step-3"/);
  assert.doesNotMatch(result.html, /id="step-4"/);
  assert.doesNotMatch(result.html, /id="step-5"/);
  assert.equal(result.isCustomDemo, true);
  assert.equal(result.stepMap[1], 1);
  assert.equal(result.stepMap[3], 2);
  assert.equal(result.stepMap[5], 3);
});

test('empty selectedSteps array returns handled error', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: []
  });
  assert.ok(result);
  assert.equal(result.html, '');
  assert.equal(result.error, 'No steps selected');
});

/* ═══════════════════════════════════════════════════════════
   Hub wrapping: renderMultiJourney always produces hub HTML
   ═══════════════════════════════════════════════════════════ */

test('renderMultiJourney with single journey wraps output in hub HTML', async function() {
  const renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.renderMultiJourney({
    name: 'Acme Corp',
    products: [
      { name: 'Acme Widget', price: 100, unit: 'piece', imageDataUrl: 'data:img' }
    ],
    industry: 'General',
    journeyTypes: ['order_to_cash']
  });
  assert.ok(result.html);
  // Hub contains sticky nav bar and iframe section
  assert.match(result.html, /mj-bar/);
  assert.match(result.html, /mj-frame/);
  assert.match(result.html, /srcdoc/);
  assert.equal(result.journeyTypes.length, 1);
  assert.equal(result.journeyTypes[0], 'order_to_cash');
});

test('buildHomePage filters cards by selectedTypes', async function() {
  var pack = createPack();
  // Add more journey descriptions to test filtering
  pack.journeyDescriptions['field_ops_expense'] = { title: 'Field Ops', steps: 15, desc: 'Field ops', scaffold: false };
  pack.journeyDescriptions['automated_collections'] = { title: 'Collections', steps: 11, desc: 'Auto', scaffold: false };
  pack.journeyScreens['field_ops_expense'] = '<div>field ops screen</div>';
  pack.journeyScreens['automated_collections'] = '<div>collections screen</div>';
  const renderer = loadRendererWithPack(pack);
  await renderer.loadPack();

  var brand = renderer.buildBrand({ name: 'Test', products: [], industry: 'General' });
  var fullHtml = renderer.buildHomePage(brand, '', pack);
  var filteredHtml = renderer.buildHomePage(brand, '', pack, ['order_to_cash']);

  // Full page should have 3 non-home cards
  assert.match(fullHtml, /Order to Cash/);
  assert.match(fullHtml, /Field Ops/);
  assert.match(fullHtml, /Collections/);

  // Filtered page should have only the selected journey
  assert.match(filteredHtml, /Order to Cash/);
  assert.doesNotMatch(filteredHtml, /Field Ops/);
  assert.doesNotMatch(filteredHtml, /Collections/);
});

test('renderMultiJourney hub shows only selected journeys', async function() {
  var pack = createPack();
  pack.journeyDescriptions['field_ops_expense'] = { title: 'Field Ops', steps: 15, desc: 'Field ops', scaffold: false };
  pack.journeyScreens['field_ops_expense'] = '<div>Field Ops journey screen</div>';
  const renderer = loadRendererWithPack(pack);
  await renderer.loadPack();

  var result = await renderer.renderMultiJourney({
    name: 'Test Brand',
    products: [{ name: 'Test Product', price: 100, unit: 'piece', imageDataUrl: 'data:img' }],
    industry: 'General',
    journeyTypes: ['order_to_cash', 'retailer_onboarding']
  });

  // Selected journeys appear in nav and sections
  assert.match(result.html, /Order to Cash/);
  assert.match(result.html, /Retailer Onboarding/);
  // Unselected journey does NOT appear
  assert.doesNotMatch(result.html, /Field Ops/);
  // No "Coming Soon" badges
  assert.doesNotMatch(result.html, /Coming Soon/);
  assert.equal(result.journeyTypes.length, 2);
});

test('buildHomePage home card is never rendered even in full listing', async function() {
  var pack = createPack();
  const renderer = loadRendererWithPack(pack);
  await renderer.loadPack();

  var brand = renderer.buildBrand({ name: 'Test', products: [] });
  var fullHtml = renderer.buildHomePage(brand, '', pack);
  // "WhatsApp Commerce OS" should NOT appear as a clickable card title
  // (it may appear in the page title or footer which is fine)
  assert.doesNotMatch(fullHtml, /hp-card-title">\s*WhatsApp Commerce OS/);
});
