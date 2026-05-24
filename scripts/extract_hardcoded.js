const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'extracted');
const FILES = [
  path.join(path.resolve(ROOT, '..'), 'jk_cement_order_to_cash.html'),
  path.join(path.resolve(ROOT, '..'), 'jk_cement_index.html'),
  path.join(path.resolve(ROOT, '..'), 'jk_cement_field_ops_expense.html')
];

function ensureOut(){
  if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function extractRootVars(html){
  const m = html.match(/:root\s*{([\s\S]*?)}/);
  if(!m) return {};
  const body = m[1];
  const vars = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let r;
  while((r = re.exec(body))){ vars[r[1]] = r[2].trim(); }
  return vars;
}

function extractImages(html){
  const imgs = [];
  const re = /src=\"(data:image[^"]+|https?:\/\/[^"]+)\"/g;
  let m;
  while((m = re.exec(html))){ imgs.push(m[1]); }
  return Array.from(new Set(imgs));
}

function extractProducts(html){
  const products = [];
  const cardRe = /<div[^>]*class=\"[^\"]*product-card[^\"]*\"[^>]*>([\s\S]*?)<\/div>/gi;
  let c;
  while((c = cardRe.exec(html))){
    const block = c[1];
    const nameMatch = block.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) || block.match(/class=\"[^\"]*product-name[^\"]*\"[^>]*>([^<]+)<\/[^>]+>/i);
    const priceMatch = block.match(/₹\s*([\d,]+)/) || block.match(/\b(\d{2,6})\b/);
    const imgMatch = block.match(/src=\"(data:image[^"]+|https?:\/\/[^"]+)\"/i);
    const p = {};
    if(nameMatch) p.name = nameMatch[1].trim();
    if(priceMatch) p.price = Number(String(priceMatch[1]).replace(/,/g,''));
    if(imgMatch) p.image = imgMatch[1];
    if(Object.keys(p).length) products.push(p);
  }
  return products;
}

async function run(){
  ensureOut();
  for(const f of FILES){
    if(!fs.existsSync(f)){
      console.warn('file not found, skipping', f);
      continue;
    }
    const html = fs.readFileSync(f, 'utf8');
    const rootVars = extractRootVars(html);
    const images = extractImages(html);
    const products = extractProducts(html);
    const out = { file: path.basename(f), rootVars, images, products };
    const outPath = path.join(OUT_DIR, path.basename(f, '.html') + '.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log('wrote', outPath);
  }
}

run();
