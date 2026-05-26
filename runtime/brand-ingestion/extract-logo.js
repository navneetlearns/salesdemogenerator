const got = require('got');
const path = require('path');
const fs = require('fs-extra');
const VALID_TYPES = ['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'];
async function extractLogo(scrapeResult, assetsDir) {
  const candidates = [];
  if (scrapeResult.favicon) candidates.push({ url: scrapeResult.favicon, source: 'favicon', score: 60 });
  if (scrapeResult.ogImage) candidates.push({ url: scrapeResult.ogImage, source: 'og:image', score: 50 });
  if (scrapeResult.images) {
    for (const img of scrapeResult.images) {
      const cls = (img.class||'').toLowerCase(); const alt = (img.alt||'').toLowerCase();
      if (cls.includes('logo') || alt.includes('logo')) candidates.push({ url: img.url, source: 'class/alt:logo', score: 90 });
    }
    for (const img of scrapeResult.images.slice(0, 5)) {
      if (!candidates.some(c => c.url === img.url) && img.alt && img.alt.length > 0 && img.alt.length < 50)
        candidates.push({ url: img.url, source: 'header', score: 30 });
    }
  }
  const seen = new Set();
  const unique = candidates.filter(c => { if (seen.has(c.url)) return false; seen.add(c.url); return true; }).sort((a,b) => b.score - a.score);
  const brandDir = path.join(assetsDir, 'brands');
  await fs.ensureDir(brandDir);
  for (const c of unique.slice(0, 3)) {
    try {
      const resp = await got(c.url, { responseType: 'buffer', timeout: { request: 8000 }, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const ct = resp.headers['content-type'] || '';
      const ext = ct.includes('svg') ? '.svg' : ct.includes('webp') ? '.webp' : ct.includes('jpeg') ? '.jpg' : '.png';
      const fp = path.join(brandDir, 'logo' + ext);
      await fs.writeFile(fp, resp.body);
      return { logoPath: fp, logoFilename: 'logo' + ext, logoUrl: c.url, source: c.source, contentType: ct, bytes: resp.body.length };
    } catch(e) { continue; }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><rect width="200" height="80" rx="8" fill="#075e54"/><text x="100" y="48" text-anchor="middle" fill="white" font-size="18" font-weight="bold">' + escapeXml(scrapeResult.brandName) + '</text></svg>';
  const fp = path.join(brandDir, 'logo.svg');
  await fs.writeFile(fp, svg);
  return { logoPath: fp, logoFilename: 'logo.svg', logoUrl: null, source: 'fallback', contentType: 'image/svg+xml', bytes: svg.length, fallback: true };
}
function escapeXml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
module.exports = { extractLogo };
