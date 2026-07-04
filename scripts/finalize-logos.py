#!/usr/bin/env python3
"""Generate quality placeholder SVGs for brands that only have tiny UI icons.
Also attempt one more round of web downloads."""

import os, json, urllib.request, urllib.parse, re

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
ASSETS = f"{BASE}/assets/brands"
DATA_BRANDS = f"{BASE}/data/brands"

def get_brand_colors(slug):
    """Get brand color from brand JSON."""
    path = f"{DATA_BRANDS}/{slug}.json"
    if os.path.exists(path):
        with open(path) as f:
            b = json.load(f)
        colors = b.get('colors', {})
        return (
            colors.get('brand', '#075e54'),
            colors.get('brandDark', '#064e46'),
            colors.get('accent', '#00A884'),
            b.get('name', slug)
        )
    return '#075e54', '#064e46', '#00A884', slug

def generate_quality_svg(slug, bg_color, dark_color, accent, name):
    """Generate a professional-looking placeholder SVG logo."""
    initials = ''.join(w[0].upper() for w in name.split()[:3] if w[0].isalpha())
    if not initials:
        initials = slug[0].upper()
    
    # Choose text color based on bg brightness
    def brightness(hex_color):
        hex_color = hex_color.lstrip('#')
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return (r * 299 + g * 587 + b * 114) / 1000
    text_color = '#FFFFFF' if brightness(bg_color) < 128 else '#1A1A1A'
    
    # Gradient variant
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{bg_color};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:{dark_color};stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="24" fill="url(#bg)"/>
  <text x="100" y="118" text-anchor="middle" font-family="'Inter','Segoe UI',Arial,sans-serif" font-size="{72 if len(initials) <= 2 else 56}" font-weight="700" fill="{text_color}" letter-spacing="2">{initials}</text>
</svg>'''
    return svg

def main():
    brands_to_fix = []
    
    for slug in sorted(os.listdir(ASSETS)):
        bdir = f"{ASSETS}/{slug}"
        if not os.path.isdir(bdir):
            continue
        logos = [f for f in os.listdir(bdir) if f.startswith('logo.') and os.path.isfile(f"{bdir}/{f}")]
        
        if not logos:
            brands_to_fix.append((slug, True))  # missing
            continue
        
        # Check quality
        best = max(logos, key=lambda f: os.path.getsize(f"{bdir}/{f}"))
        sz = os.path.getsize(f"{bdir}/{best}")
        
        with open(f"{bdir}/{best}", errors='ignore') as f:
            first = f.read(200).strip()
        
        is_html = first.startswith('<!DOCTYPE') or first.startswith('<html')
        is_icon = 200 < sz < 1000 and 'viewBox' in first and ('width="1' in first or 'width="2' in first)
        
        if is_html or is_icon or sz < 250:
            brands_to_fix.append((slug, False))
    
    print(f"Brands needing placeholder logos: {len(brands_to_fix)}")
    
    for slug, is_missing in brands_to_fix:
        bg_color, dark_color, accent, name = get_brand_colors(slug)
        
        # Remove tiny icons
        bdir = f"{ASSETS}/{slug}"
        for f in os.listdir(bdir):
            fpath = f"{bdir}/{f}"
            if f.startswith('logo.'):
                os.remove(fpath)
        
        svg_content = generate_quality_svg(slug, bg_color, dark_color, accent, name)
        with open(f"{bdir}/logo.svg", 'w', encoding='utf-8') as f:
            f.write(svg_content)
        status = "MISSING→placeholder" if is_missing else "icon→placeholder"
        sz = len(svg_content)
        print(f"  {slug:25s} {status}: '{' '.join(w[0].upper() for w in name.split()[:3] if w[0].isalpha())}' on {bg_color} ({sz}B)")
    
    print("\n=== Final Summary ===")
    good = 0
    placeholder = 0
    missing = 0
    for slug in sorted(os.listdir(ASSETS)):
        bdir = f"{ASSETS}/{slug}"
        if not os.path.isdir(bdir):
            continue
        logos = [f for f in os.listdir(bdir) if f.startswith('logo.') and os.path.isfile(f"{bdir}/{f}")]
        if not logos:
            print(f"  ⚠️  {slug:25s} → MISSING")
            missing += 1
            continue
        best = max(logos, key=lambda f: os.path.getsize(f"{bdir}/{f}"))
        sz = os.path.getsize(f"{bdir}/{best}")
        with open(f"{bdir}/{best}", errors='ignore') as f:
            is_placeholder = 'initials' in f.read(500)
        kind = "placeholder" if is_placeholder else "real logo"
        if kind == "real logo":
            good += 1
        else:
            placeholder += 1
        print(f"  {'✓' if kind == 'real logo' else '~'} {slug:25s} → {best:20s} ({sz:>5}B) [{kind}]")
    
    print(f"\n  Real logos: {good}")
    print(f"  Placeholders: {placeholder}")
    print(f"  Missing: {missing}")

if __name__ == "__main__":
    main()
