const fs = require('fs-extra');
const path = require('path');

async function parseCsv(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { products: [] };
  const headers = lines[0].split(/,|;|\t/).map(h => h.trim());
  const products = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,|;|\t/).map(c => c.trim());
    if (cols.length === 0) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j] || ('c' + j)] = cols[j] || '';
    products.push(obj);
  }
  return { products };
}

module.exports = parseCsv;
