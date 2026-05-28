#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default;
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = 'F:\\Sellerhub\\whatsapp-mock-generator-main\\whatsapp-mock-generator-main\\projects\\Haldirams';
const REPORT_DIR = path.join(ROOT, '.visual-report', 'haldirams-source-compare');

const JOURNEYS = [
  ['campaigns_queries', 'journey_campaigns_queries.html'],
  ['dt_fulfillment_payment', 'journey_dt_fulfillment_payment.html'],
  ['retailer_activation', 'journey_retailer_activation.html'],
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

async function screenshot(browser, filePath, viewport, outPath) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto('file:///' + filePath.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: outPath, fullPage: false });
  await context.close();
}

function compare(sourcePath, generatedPath, diffPath) {
  const source = PNG.sync.read(fs.readFileSync(sourcePath));
  const generated = PNG.sync.read(fs.readFileSync(generatedPath));
  const width = Math.min(source.width, generated.width);
  const height = Math.min(source.height, generated.height);
  const sourceCrop = new PNG({ width, height });
  const generatedCrop = new PNG({ width, height });
  PNG.bitblt(source, sourceCrop, 0, 0, width, height, 0, 0);
  PNG.bitblt(generated, generatedCrop, 0, 0, width, height, 0, 0);
  const diff = new PNG({ width, height });
  const mismatches = pixelmatch(sourceCrop.data, generatedCrop.data, diff.data, width, height, { threshold: 0.12 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return (mismatches / (width * height)) * 100;
}

async function run() {
  await fs.ensureDir(REPORT_DIR);
  const browser = await chromium.launch({ headless: true });
  const rows = [];

  try {
    for (const [journeyId, sourceFile] of JOURNEYS) {
      const sourceHtml = path.join(SOURCE_ROOT, sourceFile);
      const generatedHtml = path.join(ROOT, 'dist', 'haldirams', journeyId + '.html');
      if (!fs.existsSync(sourceHtml)) throw new Error('Missing source HTML: ' + sourceHtml);
      if (!fs.existsSync(generatedHtml)) throw new Error('Missing generated HTML: ' + generatedHtml);

      for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
        const sourcePng = path.join(REPORT_DIR, journeyId + '-' + viewportName + '-source.png');
        const generatedPng = path.join(REPORT_DIR, journeyId + '-' + viewportName + '-generated.png');
        const diffPng = path.join(REPORT_DIR, journeyId + '-' + viewportName + '-diff.png');
        await screenshot(browser, sourceHtml, viewport, sourcePng);
        await screenshot(browser, generatedHtml, viewport, generatedPng);
        const diffPct = compare(sourcePng, generatedPng, diffPng);
        rows.push({ journeyId, viewportName, diffPct });
      }
    }
  } finally {
    await browser.close();
  }

  console.log('Haldiram source-vs-generated visual comparison');
  for (const row of rows) {
    console.log(row.journeyId + ' [' + row.viewportName + '] diff=' + row.diffPct.toFixed(2) + '%');
  }
  console.log('Report assets: ' + REPORT_DIR);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
