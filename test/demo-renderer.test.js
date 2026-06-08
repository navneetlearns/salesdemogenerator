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

function createPack() {
  return {
    partials: {},
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
      }
    },
    journeyScreens: {
      order_to_cash: [
        '<img id="handwritten" src="{{handwrittenOrderImage}}">',
        '<img id="sap" src="{{sapArchitectureImage}}">',
        '<span id="p0">{{journey.productNames.opc53}}</span>',
        '<span id="p1">{{journey.step3.cartItems.0.name}}</span>',
        '<img id="user-product" src="{{catalog.products.0.image}}">'
      ].join('')
    },
    layoutBase: '<html><body>{{{body}}}</body></html>',
    style: '',
    scripts: {},
    journeyDescriptions: {
      order_to_cash: { title: 'Order to Cash', steps: 11, desc: 'Complete', scaffold: false },
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
