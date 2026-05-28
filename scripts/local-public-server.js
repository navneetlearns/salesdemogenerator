#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2] || process.env.PORT || 4173);
const root = path.resolve(__dirname, '..', 'public');
const distRoot = path.resolve(__dirname, '..', 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
};

const JOURNEY_NAMES = {
  campaigns_queries: 'Campaigns & Queries',
  dt_fulfillment_payment: 'DT Fulfillment & Payment',
  retailer_activation: 'Retailer Activation',
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function resolveFile(urlPath) {
  const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
  const requested = pathname === '/' ? '/index.html' : pathname;
  if (requested.startsWith('/dist/')) {
    const distPath = path.resolve(distRoot, '.' + requested.slice('/dist'.length));
    if (!distPath.startsWith(distRoot)) return null;
    return distPath;
  }
  const filePath = path.resolve(root, '.' + requested);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function titleFromId(id) {
  if (JOURNEY_NAMES[id]) return JOURNEY_NAMES[id];
  return String(id || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function listBrands() {
  if (!fs.existsSync(distRoot)) return [];
  return fs.readdirSync(distRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const brandId = entry.name;
      const brandDir = path.join(distRoot, brandId);
      const journeys = fs.readdirSync(brandDir)
        .filter(file => file.endsWith('.html') && file !== 'index.html')
        .sort()
        .map(file => ({
          id: file.replace(/\.html$/, ''),
          name: titleFromId(file.replace(/\.html$/, '')),
          url: '/dist/' + brandId + '/' + file,
        }));
      return { id: brandId, journeys };
    });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ mode: 'static' }), 'application/json; charset=utf-8');
  }

  if (url.pathname === '/api/brands') {
    return send(res, 200, JSON.stringify({ brands: listBrands() }), 'application/json; charset=utf-8');
  }

  if (url.pathname === '/api/journeys') {
    const brandId = url.searchParams.get('brand');
    const brand = listBrands().find(item => item.id === brandId);
    return send(res, brand ? 200 : 404, JSON.stringify(brand || { error: 'Brand not found' }), 'application/json; charset=utf-8');
  }

  if (url.pathname.startsWith('/api/')) {
    return send(res, 404, JSON.stringify({ error: 'Not found' }), 'application/json; charset=utf-8');
  }

  const filePath = resolveFile(url.pathname);
  if (!filePath) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, types[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log('Local demo server running at http://127.0.0.1:' + port + '/index.html');
});
