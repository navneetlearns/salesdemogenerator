const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

const missingJourneys = [
  ['campaigns_queries', 'Campaigns & Queries'],
  ['dt_fulfillment_payment', 'DT Fulfillment & Payment'],
  ['retailer_activation', 'Retailer Activation'],
];

test('build wires the three extracted Haldiram journeys into static generation', () => {
  const buildJs = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

  for (const [journeyId] of missingJourneys) {
    assert.match(buildJs, new RegExp("screens', '" + journeyId + "\\.hbs"));
    assert.match(buildJs, new RegExp("_" + journeyId + "\\.json"));
    assert.match(buildJs, new RegExp(journeyId + "\\.html"));
  }
  assert.match(buildJs, /PUBLIC_DIST_DIR/);
});

test('brand and journey APIs expose friendly names for extracted Haldiram journeys', () => {
  const brandsApi = fs.readFileSync(path.join(ROOT, 'api', 'brands.js'), 'utf8');
  const journeysApi = fs.readFileSync(path.join(ROOT, 'api', 'journeys.js'), 'utf8');

  for (const [journeyId, label] of missingJourneys) {
    assert.match(brandsApi, new RegExp("'" + journeyId + "': '" + label.replace('&', '\\&') + "'"));
    assert.match(journeysApi, new RegExp("'" + journeyId + "': '" + label.replace('&', '\\&') + "'"));
  }
});
