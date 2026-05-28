const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

test('wizard explains image size guidelines and placeholder behavior', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

  assert.match(html, /Logo guidance/i);
  assert.match(html, /under 1 MB/i);
  assert.match(html, /brand placeholder/i);
  assert.match(html, /Product image guidance/i);
  assert.match(html, /product placeholder/i);
});

test('wizard restores the last generated preview after refresh', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'demo-ui.js'), 'utf8');

  assert.match(js, /LAST_PREVIEW_KEY/);
  assert.match(js, /restoreLastPreview/);
  assert.match(js, /saveLastPreview/);
});

test('journey selection UI shows explicit selected checkmarks', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');
  const uiJs = fs.readFileSync(path.join(ROOT, 'public', 'js', 'demo-ui.js'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');

  assert.match(uiJs, /journey-selected-mark/);
  assert.match(uiJs, /_selectedJourneys/);
  assert.match(uiJs, /role', 'checkbox'/);
  assert.match(uiJs, /\}\)\(key, card\);/);
  assert.match(uiJs, /cardEl\.classList\.add\('selected'\)/);
  assert.match(css, /\.journey-card\.selected\s+\.journey-selected-mark/);
  assert.match(html, /class="runtime-journey-option selected"/);
  assert.match(appJs, /setupRuntimeJourneySelection/);
  assert.match(appJs, /setupRuntimeJourneySelection\(\);\n\n  if \(window\.DemoRenderer\)/);
  assert.match(appJs, /brand-details/);
  assert.match(appJs, /brand-summary/);
  assert.match(css, /\.runtime-journey-option\.selected/);
  assert.match(css, /\.brand-details\[open\] \.brand-summary::before/);
});
