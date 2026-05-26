const got = require('got');
const cheerio = require('cheerio');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TIMEOUT = 15000;
async function scrapeSite(url) {
  if (!url) throw new Error('URL is required');
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  const response = await got(url, { timeout: { request: TIMEOUT }, headers: { 'User-Agent': USER_AGENT }, followRedirect: true, maxRedirects: 5, retry: { limit: 2 } });
  const html = response.body;
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';
  const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href') || '/favicon.ico';
  const faviconUrl = favicon.startsWith('http') ? favicon : new URL(favicon, baseUrl.origin).href;
  const brandName = ogSiteName || ogTitle || title || baseUrl.hostname.replace(/^www./, '').split('.')[0];
  const headings = [];
  $('h1, h2, h3, .product-title, .product-name, .item-name').each((i, el) => { const txt = $(el).text().trim(); if (txt && txt.length < 100) headings.push(txt); });
  const images = [];
  $('img[src]').each((i, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) return;
    const alt = $(el).attr('alt') || ''; const cls = $(el).attr('class') || '';
    images.push({ url: src.startsWith('http') ? src : new URL(src, baseUrl.origin).href, alt: alt.trim(), class: cls });
  });
  const ldJson = [];
  $('script[type="application/ld+json"]').each((i, el) => { try { ldJson.push(JSON.parse($(el).html())); } catch(e) {} });
  return { url, hostname: baseUrl.hostname, brandName, title, description: ogDescription || description, favicon: faviconUrl, ogImage, headings: [...new Set(headings)].slice(0, 20), images: images.slice(0, 30), structuredData: ldJson, rawHtml: html };
}
module.exports = { scrapeSite };
