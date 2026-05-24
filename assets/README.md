# Asset conventions

## Brand assets

```
assets/brands/<brand_id>/
  logo.png          (required — max 512×512)
  logo_dark.png     (optional)
  favicon.png       (optional)
  hero_banner.png   (optional)
```

## Product assets

```
assets/products/<brand_id>/
  product_<sku>.png   (canonical naming; sku normalized to lowercase)
```

Examples:

- `assets/brands/nike/logo.png`
- `assets/products/nike/product_air_zoom.png`
- `assets/products/sundaram_store/product_sun001.png` … `product_sun004.png` (catalog SKUs `SUN001`–`SUN004`)

## Fallbacks

```
assets/fallbacks/
  logo.png
  product.png
```

Used automatically when assets are missing (unless `--strict`).

## Dist output

Optimized WebP assets are written to:

```
dist/<brand_id>/assets/brands/*.webp
dist/<brand_id>/assets/products/*.webp
dist/<brand_id>/assets/products/thumbs/*_thumb.webp
```
