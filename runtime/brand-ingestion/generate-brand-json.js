const path = require('path'); const fs = require('fs-extra');
async function generateBrandJson(brandName, colors, session) {
  const brandId = brandName.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'brand';
  const bd = session.paths.brands;
  let logoFile = 'logo.svg';
  if(await fs.pathExists(bd)){ for(const f of await fs.readdir(bd)){ if(/^logo\.\w+$/.test(f)){ logoFile=f; break; } } }
  const industry = (session.metadata && session.metadata.industry) || 'general';
  const brandJson = { id:brandId, name:brandName, shortName:brandName.substring(0,3).toUpperCase(), industry:industry, dealerStoreName:brandName+' Store', colors:{ brand:colors.brand||'#075e54', brandDark:colors.brandDark||'#054d44' }, assets:{ logo:logoFile }, secondaryDealers:[{name:brandName+' Retail',type:'Retail'},{name:brandName+' Distributor',type:'Distributor'}] };
  const dd = path.join(session.paths.root, 'data', 'brands'); await fs.ensureDir(dd);
  await fs.writeJson(path.join(dd, brandId+'.json'), brandJson, {spaces:2});
  return { brandId, brandJson };
}
module.exports = { generateBrandJson };
