const fs = require('fs-extra');
const path = require('path');
const { productImageFilename } = require('../lib/asset-paths');
const { normalizeSku } = require('../lib/asset-paths');

const [,, idArg, ...nameParts] = process.argv;
const id = idArg || 'sample_brand';
const name = nameParts.length
  ? nameParts.join(' ')
  : id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const ROOT = path.resolve(__dirname, '..');
const BRANDS = path.join(ROOT, 'data', 'brands');
const CATALOGS = path.join(ROOT, 'data', 'catalogs');
const JOURNEYS = path.join(ROOT, 'data', 'journeys');
const ASSETS_BRANDS = path.join(ROOT, 'assets', 'brands', id);
const ASSETS_PRODUCTS = path.join(ROOT, 'assets', 'products', id);

async function main() {
  await fs.ensureDir(BRANDS);
  await fs.ensureDir(CATALOGS);
  await fs.ensureDir(JOURNEYS);
  await fs.ensureDir(ASSETS_BRANDS);
  await fs.ensureDir(ASSETS_PRODUCTS);

  const sku1 = normalizeSku(`${id}-001`);
  const sku2 = normalizeSku(`${id}-002`);

  const brand = {
    id,
    name,
    industry: 'general',
    shortName: name.split(' ').map(s => s[0]).join('').toUpperCase(),
    assets: {
      logo: 'logo.png',
      logoDark: 'logo_dark.png',
      favicon: 'favicon.png',
      heroBanner: 'hero_banner.png',
    },
    colors: { brand: '#123456', brandDark: '#0f2a40', accent: '#ff9900' },
    theme: {
      colors: { brand: '#123456', brandDark: '#0f2a40', accent: '#ff9900' },
      fonts: { primary: 'Inter, sans-serif' },
      radius: { card: '8px', button: '6px' },
      spacing: { sm: '8px', md: '16px' },
    },
  };

  const catalog = [
    {
      id: `${id}-p1`,
      sku: sku1,
      name: `${name} Core Product`,
      category: 'General',
      price: 420,
      unit: 'unit',
      image: productImageFilename(sku1, '.png'),
      tags: ['Core'],
    },
    {
      id: `${id}-p2`,
      sku: sku2,
      name: `${name} Premium Product`,
      category: 'Premium',
      price: 520,
      unit: 'unit',
      image: productImageFilename(sku2, '.png'),
      tags: ['Premium'],
    },
  ];

  const journey = {
    id: 'order_to_cash',
    title: 'Order to Cash',
    subtitle: 'Self-service Ordering',
    brandId: id,
    steps: [
      {
        num: 1,
        displayNum: 1,
        title: 'Catalog Browse',
        meta: 'Browse products',
        navTitle: 'Step 1 — Catalog Browse',
        navDesc: '<span class="tag tag-ord">Catalog</span>',
      },
      {
        num: 2,
        displayNum: 2,
        title: 'Cart & Checkout',
        meta: 'Review cart',
        navTitle: 'Step 2 — Cart & Checkout',
        navDesc: '<span class="tag tag-ord">Cart</span>',
      },
    ],
    screens: [{ type: 'catalog' }, { type: 'cart' }],
    cart: {
      items: [{ productId: `${id}-p1`, qty: 2, tag: 'General' }],
      summary: { totalItems: 1, totalQuantity: '2 units', orderValue: '₹840' },
    },
    messages: {
      welcome: {
        title: `Welcome to ${name}! 🎉`,
        body: `Tap <strong>Open Menu</strong> to browse and order.`,
        time: '9:22 AM',
        cta: 'Open Menu',
      },
    },
  };

  await fs.writeJson(path.join(BRANDS, `${id}.json`), brand, { spaces: 2 });
  await fs.writeJson(path.join(CATALOGS, `${id}_products.json`), catalog, { spaces: 2 });
  await fs.writeJson(path.join(JOURNEYS, `${id}_order_to_cash.json`), journey, { spaces: 2 });

  await fs.writeFile(
    path.join(ASSETS_BRANDS, 'README.md'),
    `# Add brand assets here\n\n- logo.png (required)\n- logo_dark.png\n- favicon.png\n- hero_banner.png\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(ASSETS_PRODUCTS, 'README.md'),
    `# Add product images here\n\nNaming: product_<sku>.png\n\n- ${productImageFilename(sku1, '.png')}\n- ${productImageFilename(sku2, '.png')}\n`,
    'utf8'
  );

  console.log('Scaffolded:');
  console.log('  brand:   data/brands/' + id + '.json');
  console.log('  catalog: data/catalogs/' + id + '_products.json');
  console.log('  journey: data/journeys/' + id + '_order_to_cash.json');
  console.log('  assets:  assets/brands/' + id + '/');
  console.log('           assets/products/' + id + '/');
  console.log('\nNext: add logo + product images, then npm run build:dist');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
