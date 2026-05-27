const fs = require('fs');
const path = require('path');

// On Vercel, static files are in the output directory (public/dist)
const DIST_DIR = path.join(process.cwd(), 'public', 'dist');

const JOURNEY_NAMES = {
  'index': 'Order to Cash',
  'order_to_cash': 'Order to Cash',
  'field_ops_expense': 'Field Ops Expense',
  'dealer_engagement': 'Dealer Engagement',
  'retailer_onboarding': 'Retailer Onboarding',
  'retailer_loyalty': 'Retailer Loyalty',
  'automated_collections': 'Automated Collections'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    // Try query param first: ?brand=haldirams
    // Then try path segment: /api/journeys/haldirams
    const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
    const pathParts = url.pathname.replace(/^\/api\/journeys\/?/, '').split('/').filter(Boolean);
    const brand = (req.query && req.query.brand) || pathParts[0] || '';
    
    if (brand) {
      // Return journeys for specific brand
      const brandDir = path.join(DIST_DIR, brand);
      if (!fs.existsSync(brandDir)) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ error: 'Brand not found: ' + brand });
      }
      const files = fs.readdirSync(brandDir).filter(function(f) { return f.endsWith('.html'); });
      const journeys = files.map(function(f) {
        var journeyId = f.replace('.html', '');
        var displayId = journeyId === 'index' ? 'order_to_cash' : journeyId;
        return {
          id: displayId,
          name: JOURNEY_NAMES[displayId] || displayId.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
          url: '/dist/' + brand + '/' + f
        };
      });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ brand: brand, journeys: journeys });
    }

    // No brand specified - list all brands with journeys
    let brands = [];
    if (fs.existsSync(DIST_DIR)) {
      brands = fs.readdirSync(DIST_DIR).filter(function(name) {
        try { return fs.statSync(path.join(DIST_DIR, name)).isDirectory(); } catch(e) { return false; }
      });
    }
    const result = brands.map(function(brandId) {
      var brandDir = path.join(DIST_DIR, brandId);
      var htmlFiles = [];
      try {
        htmlFiles = fs.readdirSync(brandDir).filter(function(f) { return f.endsWith('.html'); });
      } catch(e) {}
      var journeys = htmlFiles.map(function(f) {
        var journeyId = f.replace('.html', '');
        var displayId = journeyId === 'index' ? 'order_to_cash' : journeyId;
        return {
          id: displayId,
          name: JOURNEY_NAMES[displayId] || displayId.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
          url: '/dist/' + brandId + '/' + f
        };
      });
      return { id: brandId, journeys: journeys };
    });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ brands: result });
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
};
