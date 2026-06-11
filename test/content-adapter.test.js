const assert = require('node:assert/strict');
const test = require('node:test');

test('content adapter produces a validated diff and preserves untouched labels', async () => {
  const adapter = require('../services/content-adapter');

  const result = await adapter.adaptJourneyContent({
    industry: 'Pharma',
    brandName: 'Sun Pharma',
    journeyType: 'order_to_cash',
    products: ['Paracetamol 500mg', 'Vitamin D3'],
    labels: {
      browseProducts: 'Browse Products',
      placeOrder: 'Place an Order',
      currentSchemes: 'Current Schemes',
      priceList: 'Price List',
    },
    client: async function() {
      return {
        content: {
          browseProducts: 'Browse Medicines',
          placeOrder: 'Create Purchase Order',
          currentSchemes: 'Promotional Offers',
          priceList: 'Product Catalogue',
        },
      };
    },
  });

  assert.equal(result.provider, 'OpenCode');
  assert.equal(result.model, 'deepseek-v4-flash');
  assert.equal(result.acceptedLabels.browseProducts, 'Browse Medicines');
  assert.equal(result.adaptationDiff.browseProducts.original, 'Browse Products');
  assert.equal(result.adaptationDiff.browseProducts.proposed, 'Browse Medicines');
  assert.equal(result.adaptationDiff.browseProducts.changed, true);
});

test('content adapter falls back to original labels when the response is invalid', async () => {
  const adapter = require('../services/content-adapter');

  const result = await adapter.adaptJourneyContent({
    industry: 'Steel',
    brandName: 'SteelCo',
    journeyType: 'order_to_cash',
    products: ['HR Coil'],
    labels: {
      browseProducts: 'Browse Products',
      placeOrder: 'Place an Order',
    },
    client: async function() {
      return {
        content: {
          browseProducts: '<strong>Browse Products</strong>',
          placeOrder: '',
          extra: 'nope',
        },
      };
    },
  });

  assert.equal(result.acceptedLabels.browseProducts, 'Browse Products');
  assert.equal(result.acceptedLabels.placeOrder, 'Place an Order');
  assert.equal(result.adaptationDiff.browseProducts.changed, false);
  assert.equal(result.adaptationDiff.placeOrder.changed, false);
});

test('getLabelsForJourney loads per-journey labels for known journey types', () => {
  const adapter = require('../services/content-adapter');

  const labels = adapter.getLabelsForJourney('retailer_onboarding');
  assert.ok(labels);
  assert.equal(typeof labels, 'object');
  assert.ok(Object.keys(labels).length > 10);
  assert.equal(labels.storeName, 'Store Name');
});

test('getLabelsForJourney returns empty object for Group D journeys', () => {
  const adapter = require('../services/content-adapter');

  const labels = adapter.getLabelsForJourney('retailer_activation');
  assert.deepEqual(labels, {});
});

test('getLabelsForJourney returns empty object for unknown journey types', () => {
  const adapter = require('../services/content-adapter');

  const labels = adapter.getLabelsForJourney('nonexistent_journey');
  assert.deepEqual(labels, {});
});

test('GROUP_D_JOURNEYS lists journeys that skip adaptation', () => {
  const adapter = require('../services/content-adapter');

  assert.ok(adapter.GROUP_D_JOURNEYS.includes('retailer_activation'));
  assert.ok(adapter.GROUP_D_JOURNEYS.includes('dt_fulfillment_payment'));
  assert.equal(adapter.GROUP_D_JOURNEYS.length, 2);
});
