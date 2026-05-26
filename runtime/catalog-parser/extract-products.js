const path = require('path');
const fs = require('fs-extra');
const parseCsv = require('./parse-csv');
const parseXlsx = require('./parse-xlsx');
const parsePdf = require('./parse-pdf');

async function extractProducts(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    const obj = await fs.readJson(filePath).catch(() => null);
    if (!obj) return { products: [] };
    if (Array.isArray(obj)) return { products: obj };
    if (obj.products) return { products: obj.products };
    return { products: [] };
  }
  if (ext === '.csv' || ext === '.txt') return parseCsv(filePath);
  if (ext === '.xlsx' || ext === '.xls') return parseXlsx(filePath);
  if (ext === '.pdf') return parsePdf(filePath);
  return { products: [] };
}

module.exports = extractProducts;
