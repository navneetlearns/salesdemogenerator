#!/usr/bin/env node
/**
 * Import catalog from Excel (.xlsx) or CSV into normalized JSON + asset placeholders.
 *
 * Usage:
 *   node tools/import-catalog.js <brand_id> <file.csv|file.xlsx>
 *
 * Example:
 *   npm run import-catalog nike products.xlsx
 */
const fs = require('fs-extra');
const path = require('path');
const { normalizeProduct } = require('../lib/catalog-normalizer');
const { normalizeSku, productImageFilename } = require('../lib/asset-paths');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ASSETS_DIR = path.join(ROOT, 'assets');

async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return parseCsv(await fs.readFile(filePath, 'utf8'));
  if (ext === '.xlsx' || ext === '.xls') {
    let XLSX;
    try {
      XLSX = require('xlsx');
    } catch {
      throw new Error('xlsx package required for Excel import. Run: npm install');
    }
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

function mapRow(row, index) {
  const sku = row.sku || row.SKU || row.code || `SKU-${index + 1}`;
  const normalizedSku = normalizeSku(sku);
  return normalizeProduct({
    id: row.id || row.product_id || `p${index + 1}`,
    sku: normalizedSku,
    name: row.name || row.product_name || row.title || `Product ${index + 1}`,
    category: row.category || row.cat || '',
    price: Number(row.price || row.mrp || 0),
    unit: row.unit || row.uom || '',
    image: row.image || productImageFilename(normalizedSku, '.png'),
    tags: row.tags ? String(row.tags).split('|').map(t => t.trim()) : [],
    meta: {
      weight: row.weight || '',
      variant: row.variant || '',
      size: row.size || '',
    },
  }, index);
}

async function ensureAssetPlaceholders(brandId, products) {
  const productDir = path.join(ASSETS_DIR, 'products', brandId);
  const brandDir = path.join(ASSETS_DIR, 'brands', brandId);
  await fs.ensureDir(productDir);
  await fs.ensureDir(brandDir);

  const readme = path.join(productDir, 'README.md');
  if (!await fs.pathExists(readme)) {
    await fs.writeFile(readme, `# Product assets for ${brandId}\n\nPlace images named:\n\`product_<sku>.png\`\n\nExample:\n\`product_air_zoom.png\`\n`, 'utf8');
  }

  const placeholders = [];
  for (const p of products) {
    if (p.image && !p.image.startsWith('http')) {
      const fp = path.join(productDir, p.image);
      if (!await fs.pathExists(fp)) placeholders.push(fp);
    }
  }
  return placeholders;
}

async function main() {
  const [, , brandId, filePath] = process.argv;
  if (!brandId || !filePath) {
    console.error('Usage: node tools/import-catalog.js <brand_id> <catalog.csv|xlsx>');
    process.exit(1);
  }

  const absFile = path.resolve(filePath);
  if (!await fs.pathExists(absFile)) {
    console.error('File not found:', absFile);
    process.exit(1);
  }

  const rows = await parseFile(absFile);
  const products = rows.map((row, i) => mapRow(row, i));

  const outPath = path.join(DATA_DIR, 'catalogs', `${brandId}_products.json`);
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, products, { spaces: 2 });

  const placeholders = await ensureAssetPlaceholders(brandId, products);

  console.log(`\n✓ Imported ${products.length} products → ${outPath}`);
  console.log(`✓ Asset directory: assets/products/${brandId}/`);
  if (placeholders.length) {
    console.log(`\n⚠ ${placeholders.length} product images still needed:`);
    placeholders.slice(0, 10).forEach(p => console.log(`  - ${path.basename(p)}`));
    if (placeholders.length > 10) console.log(`  ... and ${placeholders.length - 10} more`);
  }
  console.log('\nNext: add logo to assets/brands/' + brandId + '/logo.png');
  console.log('Then: npm run build:dist\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
