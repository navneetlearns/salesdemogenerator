const fs = require('fs-extra');

// Placeholder PDF parser: for now we just return empty products array
// TODO: integrate pdf-parse or similar to extract tables/images
async function parsePdf(filePath) {
  // Not implemented: fall back to empty
  return { products: [] };
}

module.exports = parsePdf;
