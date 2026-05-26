// got is ESM-only, use dynamic import
let _g = null;
async function getGot() { if (!_g) { const m = await import('got'); _g = m.default || m; } return _g; }; const path = require('path'); const fs = require('fs-extra');
async function extractProducts(scrapeResult, assetsDir) {
  const $ = require('cheerio').load(scrapeResult.rawHtml);
  const products = []; const pd = path.join(assetsDir, 'products'); await fs.ensureDir(pd);
  const seen = new Set();
  for (const sd of (scrapeResult.structuredData||[])) {
    const items = sd['@type']==='ItemList' ? (sd.itemListElement||[]) : [sd];
    for (const item of items) {
      const p = item['@type']==='ListItem' ? item.item : item;
      if (!p||!p.name) continue;
      const img = p.image?.url || (Array.isArray(p.image)?p.image[0]:p.image) || null;
      products.push({ name:p.name, sku:p.sku||p.productID||'PRD'+(products.length+1).toString().padStart(3,'0'), category:p.category||'General', price:parsePrice(p.offers?.price||p.offers?.highPrice), image:img, description:p.description||'' });
    }
  }
  if (products.length===0) {
    const sels = ['.product','.product-item','.product-card','.item','[data-product]','[data-product-id]'];
    for (const sel of sels) {
      $(sel).each((i,el)=>{ if(products.length>=8) return false;
        const n = $(el).find('.product-title,.product-name,h3,h2,.name,.title').first().text().trim() || $(el).attr('data-name')||$(el).attr('title')||'';
        if(!n||n.length<2) return;
        const img = $(el).find('img').first().attr('src')||$(el).find('img').first().attr('data-src')||'';
        products.push({ name:n.substring(0,60), sku:'PRD'+(i+1).toString().padStart(3,'0'), category:'General', price:0, image:img||null, description:'' });
      });
      if(products.length>0) break;
    }
  }
  if(products.length===0 && scrapeResult.headings.length>0) {
    for(let i=0;i<Math.min(scrapeResult.headings.length,6);i++){ const h=scrapeResult.headings[i]; if(h.length<2||h.length>60)continue; products.push({ name:h, sku:'PRD'+(i+1).toString().padStart(3,'0'), category:'General', price:0, image:null, description:'' }); }
  }
  for (const p of products) { if(p.image && !p.image.startsWith('data:') && !seen.has(p.image)){ seen.add(p.image); p.image = await downloadImage(p.image, p.sku, pd); } }
  return products.slice(0, 8);
}
async function downloadImage(url,sku,dir){ try{ const r=await (await getGot())(url,{responseType:'buffer',timeout:{request:8000},headers:{'User-Agent':'Mozilla/5.0'}}); const ct=r.headers['content-type']||''; const ext=ct.includes('png')?'.png':ct.includes('webp')?'.webp':ct.includes('jpeg')?'.jpg':'.png'; const fn='product_'+sku.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase()+ext; await fs.writeFile(path.join(dir,fn),r.body); return fn; }catch(e){ return null; } }
function parsePrice(t){ if(!t) return 0; const n=parseFloat(String(t).replace(/[^\d.]/g,'')); return isNaN(n)?0:Math.round(n); }
module.exports = { extractProducts };
