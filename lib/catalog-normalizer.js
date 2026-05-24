const { productImageFilename, isExternalUrl, normalizeSku } = require('./asset-paths');

/**
 * Normalize catalog product entries to canonical schema.
 */
function normalizeProduct(raw, index = 0) {
  const sku = raw.sku || raw.id || `item_${index + 1}`;
  const normalizedSku = normalizeSku(sku);

  let image = raw.image || '';
  if (!isExternalUrl(image) && image) {
    image = pathBasenameOnly(image);
  }
  if (!image || (!isExternalUrl(image) && !image.startsWith('product_'))) {
    image = productImageFilename(normalizedSku, '.png') || image;
  }

  return {
    id: raw.id || `p${index + 1}`,
    sku: normalizedSku || sku,
    name: raw.name || `Product ${index + 1}`,
    category: raw.category || raw.tag || '',
    price: Number(raw.price) || 0,
    unit: raw.unit || raw.uom || '',
    image,
    tags: raw.tags || (raw.tag ? [raw.tag] : []),
    meta: raw.meta || {},
    qty: raw.qty,
    tag: raw.tag || raw.category || '',
  };
}

function pathBasenameOnly(value) {
  const parts = String(value).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

function normalizeCatalog(rawCatalog) {
  const products = Array.isArray(rawCatalog)
    ? rawCatalog
    : (rawCatalog?.products || []);
  return products.map((p, i) => normalizeProduct(p, i));
}

module.exports = { normalizeProduct, normalizeCatalog };
