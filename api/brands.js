const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(process.cwd(), 'dist');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    let brands = [];
    if (fs.existsSync(DIST_DIR)) {
      brands = fs.readdirSync(DIST_DIR).filter(function(name) {
        try { return fs.statSync(path.join(DIST_DIR, name)).isDirectory(); } catch(e) { return false; }
      });
    }
    const result = brands.map(function(brandId) {
      var brandDir = path.join(DIST_DIR, brandId);
      var journeys = [];
      try {
        journeys = fs.readdirSync(brandDir)
          .filter(function(f) { return f.endsWith('.html') && f !== 'index.html'; })
          .map(function(f) { return f.replace('.html', ''); });
      } catch(e) {}
      return { id: brandId, journeys: journeys };
    });
    return res.status(200).json({ brands: result });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
};
