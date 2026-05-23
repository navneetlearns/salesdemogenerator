# Data Model And JSON Schemas

Three primary JSON artifacts drive a demo:

- `brand`: brand metadata, colors, asset references, and optional semantic replacements.
- `catalog`: product lists for cards, carts, and receipts.
- `journey`: ordered steps/screens composing a demo.

## Brand Schema

`data/schemas/brand.schema.json` includes the optional property:

```json
"replacements": {
  "type": "object",
  "additionalProperties": {
    "type": "string"
  }
}
```

This allows build-time semantic replacement dictionaries without changing existing required validation rules.

## Brand Replacements

Brand JSON may include:

```json
{
  "replacements": {
    "JK Cement": "Sunder Masala",
    "Order_JKO-": "Order_SM-"
  }
}
```

During build, entries are applied to the final compiled HTML with global `split(...).join(...)` replacement.

Guidelines:

- Keep longer phrases before shorter generic tokens because JSON insertion order is the execution order.
- Add targeted cleanup phrases before generic tokens when cloned baseline copy combines brand and category words, for example `JK Super Cement PPC` before `JK Super` or `PPC`.
- Use this only for temporary execution-compression onboarding.
- Avoid ambiguous tokens where possible. Generic replacements such as `OPC` or `Cement` can affect every matching occurrence in the compiled HTML, including inlined base64 image data if replacements run after asset injection.
- Preserve shared integration paths, such as SAP diagrams, by injecting them after all replacement passes (see `build.js` → `injectSapArchitectureDiagram`).

## Journey Cloning

Run `node scripts/clone-journeys.js` to clone `jk_cement_*` journey and extracted JSON files to `sunder_masala_*`. The script also remaps cloned product image IDs from cement assets to spice assets so cart rendering can resolve images.

## Catalog Loading

The build loads `data/catalogs/<brand>_products.json` first, then `<brand>_default.json`. Brand-specific catalog files should use those names unless the build loader is deliberately extended.

Product `image` values should be basenames such as `product_<normalized_sku>.png` (see `lib/catalog-normalizer.js` and `assets/README.md`). Example: SKU `SUN003` → `product_sun003.png` under `assets/products/sundaram_store/`.
