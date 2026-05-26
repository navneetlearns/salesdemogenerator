const { scrapeSite } = require('./scrape-site');
const { extractLogo } = require('./extract-logo');
const { extractColors } = require('./extract-colors');
const { extractProducts } = require('./extract-products');
const { normalizeAssets } = require('./normalize-assets');
const { generateBrandJson } = require('./generate-brand-json');
const fs = require('fs-extra'); const path = require('path');
async function ingestBrand(url, session) {
  console.log('[ingestion] Scraping:', url);
  const sr = await scrapeSite(url);
  console.log('[ingestion] Brand:', sr.brandName);
  const logo = await extractLogo(sr, session.paths.assets);
  console.log('[ingestion] Logo:', logo.source, '('+logo.bytes+' bytes)');
  const colors = await extractColors(sr);
  console.log('[ingestion] Colors:', colors.brand);
  const products = await extractProducts(sr, session.paths.assets);
  console.log('[ingestion] Products:', products.length);
  const { brandId, brandJson } = await generateBrandJson(sr.brandName, colors, session);
  const catPath = path.join(session.paths.root, 'data', 'catalogs'); await fs.ensureDir(catPath);
  const catalog = products.map((p,i) => ({ id:'p'+(i+1), sku:p.sku||'PRD'+(i+1).toString().padStart(3,'0'), name:p.name||'Product '+(i+1), category:p.category||'General', price:p.price||0, unit:'pcs', image:p.image||null, tag:'Standard' }));
  await fs.writeJson(path.join(catPath, brandId+'_products.json'), catalog, {spaces:2});
  await normalizeAssets(session.paths.assets, sr.brandName);
  return { brandId, brandName:sr.brandName, brandJson, colors, products:catalog, logo };
}
module.exports = { ingestBrand };
