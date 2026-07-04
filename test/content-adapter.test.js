const assert = require('node:assert/strict');
const test = require('node:test');

test('getIndustryProfile fetches cement profile from Supabase', async () => {
  const { getIndustryProfile } = require('../services/content-adapter');
  const profile = await getIndustryProfile('cement');
  assert.ok(profile, 'profile should exist');
  assert.equal(profile.name, 'cement');
  assert.equal(profile.label, 'Cement');
  assert.ok(profile.labels, 'labels should exist');
  assert.ok(Object.keys(profile.labels).length > 10, 'should have many labels');
  assert.equal(profile.unit_plural, 'bags');
});

test('getIndustryProfile falls back to general for unknown industry', async () => {
  const { getIndustryProfile } = require('../services/content-adapter');
  const profile = await getIndustryProfile('nonexistent_industry_xyz');
  assert.ok(profile, 'should fall back to general');
  assert.equal(profile.name, 'general');
});

test('getIndustryProfile handles null gracefully', async () => {
  const { getIndustryProfile } = require('../services/content-adapter');
  const profile = await getIndustryProfile(null);
  assert.ok(profile, 'should return general profile');
  assert.equal(profile.name, 'general');
});

test('listIndustries returns all 6 industries', async () => {
  const { listIndustries } = require('../services/content-adapter');
  const industries = await listIndustries();
  assert.ok(Array.isArray(industries), 'should return array');
  assert.equal(industries.length, 6, 'should have 6 industries');
  const names = industries.map(i => i.name).sort();
  assert.deepEqual(names, ['agri', 'cement', 'fmcg', 'general', 'industrial', 'pharma']);
});

test('applyProfileToJourney substitutes placeholders', () => {
  const { applyProfileToJourney } = require('../services/content-adapter');
  const profile = {
    labels: { browseProducts: 'Browse {{unitPlural}}' },
    messages: {
      welcome: 'Welcome to {{brandName}}, {{dealerStoreName}}!',
    },
    descriptions: { step1: 'Order {{orderTerm}} for {{productName}}' },
    unit_plural: 'bags',
    unit: 'bag',
    terminology: { order_term: 'indent' },
    currency_symbol: '₹',
  };
  const brand = {
    name: 'TestBrand',
    dealer_store_name: 'Main Store',
    products: [{ name: 'Super Product' }],
  };
  const result = applyProfileToJourney(profile, brand);
  assert.equal(result.labels.browseProducts, 'Browse bags');
  assert.equal(result.messages.welcome, 'Welcome to TestBrand, Main Store!');
  assert.equal(result.descriptions.step1, 'Order indent for Super Product');
});

test('applyProfileToJourney handles missing brand gracefully', () => {
  const { applyProfileToJourney } = require('../services/content-adapter');
  const profile = {
    labels: { greet: 'Hello {{brandName}}' },
    messages: {},
    descriptions: {},
  };
  const result = applyProfileToJourney(profile, {});
  assert.equal(result.labels.greet, 'Hello Brand');
});

test('getImageUrl returns correct Storage URL', () => {
  const { getImageUrl } = require('../services/content-adapter');
  const url = getImageUrl('jk_cement/logo/logo.svg');
  assert.ok(url.includes('supabase.co'));
  assert.ok(url.includes('demo-assets'));
  assert.ok(url.endsWith('jk_cement/logo/logo.svg'));
});

test('getImageUrl returns empty string for null path', () => {
  const { getImageUrl } = require('../services/content-adapter');
  assert.equal(getImageUrl(null), '');
  assert.equal(getImageUrl(''), '');
});
