# Template Strategy

The current renderer uses vanilla Handlebars layouts, partials, and screen blocks. Templates should remain stable and data-driven.

## Rules

- Do not modify `.hbs` templates for the Sunder Masala execution-compression patch.
- Keep brand colors, logos, and content in JSON or build-time data transformations.
- Keep partials focused on reusable UI structure.
- Use the asset pipeline and generated context rather than hardcoded brand paths where possible.

## Temporary Virtualization

Some JK Cement baseline strings still exist in the view layer. For Sunder Masala, these are virtualized after render through `brand.replacements` in `build.js`.

This is intentionally temporary because string replacement can:

- Replace unintended matches when tokens are too generic.
- Depend on exact punctuation or whitespace.
- Miss text that changes upstream.
- Affect HTML paths as well as visible copy.

The replacement dictionary therefore lists longer phrases before smaller tokens and keeps SAP diagram path preservation explicit.

## CSS Image Normalization

When a brand defines `replacements`, `build.js` injects a small `<style>` block before `</head>` to normalize raw image sizing:

- `img`
- `.product-card img`
- `.logo-img`
- `.cart-item-image`
- `.wa-avatar img`
- `.tb-av img`
- `.catalog-logo img`
- `.bs-logo img`
- `.oi-thumb img`

The injected CSS uses `object-fit: contain`, `max-width: 100%`, and `max-height: 100%`. This reversible build-time fix handles inconsistent incoming logo/product dimensions without changing Handlebars partials.

## Placeholder Asset Filling

Sunder Masala inherits baseline screens that contain literal `data:image/placeholder` image tags. The build-time asset patch fills only known visual slots:

- mobile contact/avatar containers use the packaged brand logo,
- empty `.tb-av` containers receive a logo image,
- hardcoded `.oi-thumb` order rows cycle through packaged Sunder product images,
- the SAP architecture placeholder uses the shared diagram at `assets/brands/jk_cement/sap_architecture.png`, injected after all replacement passes.

This remains a post-render compatibility layer; templates stay untouched until the baseline view layer is intentionally redesigned.
