const cheerio = require('cheerio');
const DEFAULT = { brand: '#075e54', brandDark: '#054d44', accent: '#128C7E', background: '#ffffff', text: '#1a1a1a' };
async function extractColors(scrapeResult) {
  const $ = cheerio.load(scrapeResult.rawHtml);
  const colors = { ...DEFAULT };
  const inlineColors = new Set();
  $('[style]').each((i, el) => {
    const style = $(el).attr('style');
    const matches = style.match(/(?:color|background|background-color)\s*:\s*#[0-9a-fA-F]{3,8}/g);
    if (matches) matches.forEach(m => inlineColors.add(m.split(':')[1].trim()));
  });
  const themeColor = $('meta[name="theme-color"]').attr('content');
  if (themeColor && /^#[0-9a-fA-F]{3,8}$/.test(themeColor)) {
    colors.brand = themeColor;
    colors.brandDark = darken(themeColor, 0.15);
    colors.accent = lighten(themeColor, 0.1);
  } else if (inlineColors.size > 0) {
    const arr = [...inlineColors];
    const counts = {};
    arr.forEach(c => { counts[c] = (counts[c]||0) + 1; });
    const sorted = arr.sort((a,b) => (counts[b]||0) - (counts[a]||0));
    for (const c of sorted) {
      if (!['#ffffff','#fff','#000000','#000','#ffffffff'].includes(c)) {
        colors.brand = c; colors.brandDark = darken(c, 0.15); colors.accent = lighten(c, 0.1); break;
      }
    }
  }
  return colors;
}
function darken(h, a) { h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const r=Math.round(parseInt(h.substr(0,2),16)*(1-a)); const g=Math.round(parseInt(h.substr(2,2),16)*(1-a)); const b=Math.round(parseInt(h.substr(4,2),16)*(1-a)); return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function lighten(h, a) { h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const r=Math.min(255,Math.round(parseInt(h.substr(0,2),16)+255*a)); const g=Math.min(255,Math.round(parseInt(h.substr(2,2),16)+255*a)); const b=Math.min(255,Math.round(parseInt(h.substr(4,2),16)+255*a)); return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }
module.exports = { extractColors, DEFAULT_COLORS: DEFAULT };
