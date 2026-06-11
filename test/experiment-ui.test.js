const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('wizard includes mandatory industry selection and adaptation actions', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'demo-ui.js'), 'utf8');

  assert.match(html, /id="industryInput"/);
  assert.match(html, /FMCG/);
  assert.match(html, /Adapt Content/);
  assert.match(js, /adaptContent/);
  assert.match(js, /saveContent/);
  assert.match(js, /Accept/);
  assert.match(js, /Reset/);
});

test('demo-ui.js defines GROUP_D_JOURNEYS and hides adapt button for them', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'demo-ui.js'), 'utf8');

  assert.match(js, /GROUP_D_JOURNEYS/);
  assert.match(js, /retailer_activation/);
  assert.match(js, /dt_fulfillment_payment/);
  assert.match(js, /updateAdaptButtonVisibility/);
  assert.match(js, /GROUP_B_C_JOURNEYS/);
  assert.match(js, /getJourneyAdaptGroup/);
});
