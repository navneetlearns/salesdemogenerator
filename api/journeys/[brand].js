const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(process.cwd(), 'dist');

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
      const journeyId = f.replace('.html', '');
      return {
        id: journeyId,
        name: journeyId.replace(/_/g, ' ').replace(/\\b\\w/g, function(c) { return c.toUpperCase(); }),
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
