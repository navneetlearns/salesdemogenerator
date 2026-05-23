Migration plan and steps to create new brand journeys
=====================================================

High-level migration steps
--------------------------
1. Inventory: run a scan of each demo HTML and extract hardcoded brand tokens (colors, logos, fonts), product data, copy strings, and embedded images.
2. Create `data/brands/<brand>.json` with theme tokens and `data/catalog/<brand>_*.json` files for each catalog.
3. Replace the hardcoded markups with template invocations (partials) and parameterize using the new data files.
4. Validate: run the generator to render into `dist/` and visually inspect.
5. Iterate: extract remaining strings and move into data until no brand/product copy remains in templates.

Exact steps to create a new user journey for a new brand (post-migration)
--------------------------------------------------------------------
Follow these exact commands and file edits to add a new brand + journey. Assume repository root is `f:\Sellerhub\Rakesh\JK Cement Vishal`.

1) Create brand file

 - Path: `demo-generator/data/brands/mybrand.json`
 - Content example:

```
{
  "id": "mybrand",
  "name": "My Brand",
  "shortName": "MB",
  "colors": { "brand": "#123456", "brandDark": "#0f2a40", "accent": "#ff9900" },
  "logo": "https://.../logo.png",
  "fonts": ["Inter"]
}
```

2) Create catalog(s)

 - Path: `demo-generator/data/catalog/mybrand_default.json`
 - Add product objects matching `DATA_MODEL.md` schema.

3) Create journey JSON

 - Path: `demo-generator/data/journeys/mybrand_order_to_cash.json`
 - Example content:

```
{
  "id": "order_to_cash",
  "title": "Order to Cash",
  "brandId": "mybrand",
  "screens": [
    { "template": "templates/order_to_cash.njk", "data": { "products": "catalog:mybrand_default" } }
  ]
}
```

4) (Optional) Add brand-specific overrides

 - If the brand needs CSS overrides, add `public/styles/mybrand.css` and reference it from `templates/base.njk` via a conditional when `brand.id == 'mybrand'` or include it during build copy.

5) Build the demo

Run these commands from the generator folder:

```powershell
cd "f:\Sellerhub\Rakesh\JK Cement Vishal\demo-generator"
npm install   # only required once or when deps change
npm run build
```

6) Inspect output

 - Open `demo-generator/dist/<brand>_<journey>.html` (or `order_to_cash.html` depending on your template naming) and `demo-generator/dist/preview.html`.

7) Iterate and fix copy

 - If you find brand strings still present in templates, move them into `data/brands/mybrand.json` or the journey JSON and re-run build.

Automation tips
---------------
- Create a CLI or `scripts/scaffold_brand.js` to scaffold the three files (brand, catalog, journey) and copy sample assets.
- Add a `validate` script that verifies `brandId` references exist and `catalog:` URIs resolve.
