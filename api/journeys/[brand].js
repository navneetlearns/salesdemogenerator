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
    const { brand } = req.query || {};
    if (!brand) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing brand parameter. Use /api/journeys?brand=jk_cement' });
    }
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
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
};
