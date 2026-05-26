function normalizeProducts(raw) {
  const products = (raw && raw.products) || [];
  return { products: products.map(p => ({
    name: p.name || p.title || p.product || p['Product Name'] || '',
    category: p.category || p.type || p['Category'] || '',
    image: p.image || p.img || '',
    sku: p.sku || p.SKU || '',
    price: p.price || p.Price || '',
    description: p.description || p.desc || p.Description || ''
  })) };
}

module.exports = normalizeProducts;
