const fs = require('fs-extra'); const path = require('path');
async function normalizeAssets(assetsDir, brandId) {
  const bd = path.join(assetsDir, 'brands'); const pd = path.join(assetsDir, 'products');
  const errors = [];
  await fs.ensureDir(bd);
  const logos = []; if(await fs.pathExists(bd)){ for(const f of await fs.readdir(bd)){ if(/^logo\.(png|jpg|jpeg|webp|svg)$/i.test(f)) logos.push(f); } }
  if(logos.length===0){ const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><rect width="200" height="80" rx="8" fill="#075e54"/><text x="100" y="48" text-anchor="middle" fill="white" font-size="18" font-weight="bold">'+brandId+'</text></svg>'; await fs.writeFile(path.join(bd,'logo.svg'),svg); errors.push('Generated placeholder logo'); }
  const prodFiles = []; if(await fs.pathExists(pd)){ for(const f of await fs.readdir(pd)){ if(/\.(png|jpg|jpeg|webp|svg)$/i.test(f)) prodFiles.push(f); } }
  return { brandLogo: logos[0]||'logo.svg', productImages: prodFiles, errors, ok: true };
}
module.exports = { normalizeAssets };
