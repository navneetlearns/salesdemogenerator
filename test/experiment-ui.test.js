const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('wizard includes mandatory industry selection and adaptation wiring', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'demo-ui.js'), 'utf8');

  assert.match(html, /id="industryInput"/);
  assert.match(html, /SUPABASE_URL/);
  assert.match(html, /supabase\.co/);
  assert.match(html, /industries\?select=name,label/);
  // Adapt Content button removed — adaptation happens automatically during generate
  assert.doesNotMatch(html, /adaptContentBtn/);
  assert.doesNotMatch(html, /contentReviewPanel/);
  // Internal adaptContent function still exists (called automatically by generate)
  assert.match(js, /function adaptContent/);
  assert.match(js, /function generate/);
  assert.match(js, /adaptContent\(\)/);       // generate() calls adaptContent internally
});

test('demo-ui.js defines adaptation groups and wire auto-adapt in generate', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'demo-ui.js'), 'utf8');

  assert.match(js, /GROUP_D_JOURNEYS/);
  assert.match(js, /retailer_activation/);
  assert.match(js, /dt_fulfillment_payment/);
  assert.match(js, /GROUP_B_C_JOURNEYS/);
  assert.match(js, /getJourneyAdaptGroup/);
  // adaptContent is called silently by generate before rendering
  assert.match(js, /adaptContent\(\)/);
  assert.doesNotMatch(js, /adaptContentBtn/);  // no button in the JS anymore
});
