const xlsx = require('xlsx');
const fs = require('fs-extra');

async function parseXlsx(filePath) {
  const buffer = await fs.readFile(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return { products: json };
}

module.exports = parseXlsx;
