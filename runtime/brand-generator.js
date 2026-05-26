const Vibrant = require('node-vibrant');
const path = require('path');
const fs = require('fs-extra');
const normalizeProducts = require('./catalog-parser/normalize-products');
const extractProducts = require('./catalog-parser/extract-products');
const { generateBrandJson } = require('./brand-ingestion/generate-brand-json');

async function deriveColorsFromLogo(logoPath) {
  try {
    const palette = await Vibrant.from(logoPath).getPalette();
    const brand = (palette.Vibrant && palette.Vibrant.hex) || (palette.Muted && palette.Muted.hex) || '#075e54';
    const accent = (palette.LightVibrant && palette.LightVibrant.hex) || '#128C7E';
    const brandDark = brand;
    return { brand, accent, brandDark };
  } catch (e) {
    return { brand: '#075e54', accent: '#128C7E', brandDark: '#054d44' };
  }
}

async function buildBrandFromSession(session) {
  const uploadsDir = path.join(session.paths.root, 'uploads');
  const brandsDir = session.paths.brands;
  await fs.ensureDir(uploadsDir);
  await fs.ensureDir(brandsDir);

  // find logo in uploads or session assets
  let logoFile = null;
  const upls = await fs.readdir(uploadsDir).catch(()=>[]);
  for (const f of upls) { if (/^catalog/i.test(f)) continue; if (/logo/i.test(f)) { logoFile = path.join(uploadsDir, f); break; } }
  if (!logoFile) {
    const bd = await fs.readdir(brandsDir).catch(()=>[]);
    for (const f of bd) { if (/^logo\./.test(f)) { logoFile = path.join(brandsDir, f); break; } }
  }

  if (logoFile) {
    await fs.copy(logoFile, path.join(brandsDir, path.basename(logoFile)));
  }

  // parse catalog if present
  const cat = (await fs.readdir(uploadsDir).catch(()=>[])).find(x=>/^catalog/i.test(x));
  let products = [];
  if (cat) {
    const parsed = await extractProducts(path.join(uploadsDir, cat));
    const norm = normalizeProducts(parsed);
    products = norm.products.map((p,i)=> Object.assign({ id: 'p'+(i+1) }, p));
    // write normalized catalog into session data
    const catPath = path.join(session.paths.root, 'data', 'catalogs'); await fs.ensureDir(catPath);
    const brandId = (session.metadata && session.metadata.brandId) ? session.metadata.brandId : 'brand';
    await fs.writeJson(path.join(catPath, brandId + '_products.json'), products, { spaces: 2 });
  }

  const colors = logoFile ? await deriveColorsFromLogo(logoFile) : { brand: '#075e54', accent: '#128C7E', brandDark: '#054d44' };
  const brandName = session.metadata.brandName || (session.metadata && session.metadata.uploadBrandName) || 'brand';
  const { brandId, brandJson } = await generateBrandJson(brandName, colors, session);

  return { brandId, brandName: brandName, colors, products, logo: { source: logoFile ? path.basename(logoFile) : null } };
}

module.exports = { buildBrandFromSession, deriveColorsFromLogo };
