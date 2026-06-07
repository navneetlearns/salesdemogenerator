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
