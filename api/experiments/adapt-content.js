const fs = require('fs-extra');
const path = require('path');
const { getSession } = require('../../runtime/session-manager');
const { adaptJourneyContent, DEFAULT_LABELS } = require('../../services/content-adapter');

module.exports = async function adaptContentHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, industry, brandName, labels, products } = req.body || {};
    const session = sessionId ? await getSession(sessionId) : null;
    let catalog = Array.isArray(products) ? products : [];

    if (session) {
      const brandId = session.metadata?.brandId || 'brand';
      const catalogPath = path.join(session.paths.root, 'data', 'catalogs', brandId + '_products.json');
      catalog = await fs.pathExists(catalogPath) ? await fs.readJson(catalogPath) : catalog;
    }
    const brandId = session?.metadata?.brandId || 'brand';

    const result = await adaptJourneyContent({
      industry: industry || session?.metadata?.industry || 'general',
      brandName: brandName || session?.metadata?.brandName || brandId,
      journeyType: 'order_to_cash',
      products: catalog.map(p => (typeof p === 'string' ? p : p && p.name)).filter(Boolean),
      labels: labels || DEFAULT_LABELS,
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      provider: result.provider,
      model: result.model,
      acceptedLabels: result.acceptedLabels,
      adaptationDiff: result.adaptationDiff,

    });
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
