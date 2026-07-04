#!/usr/bin/env python3
"""Fetch brand logos for the 20 legacy brands from Wikimedia Commons / brand websites.
Outputs to assets/brands/{slug}/logo.png and logo.svg where available."""

import json, os, sys, time, urllib.request, urllib.parse, urllib.error
import io, re, hashlib
from pathlib import Path

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
ASSETS = f"{BASE}/assets/brands"
DATA_BRANDS = f"{BASE}/data/brands"

# Brand slug → (search query, fallback brand color)
BRANDS = {
    "adani_wilmar": ("Adani Wilmar", "#003A70"),
    "atharva": ("Atharva Food Products", "#C8102E"),
    "banas_diary": ("Banas Dairy", "#1B5E20"),
    "blueocean": ("Blue Ocean Steels", "#005BAA"),
    "freyr": ("Freyr Solar Connect", "#F7941E"),
    "hindalco": ("Hindalco", "#003D7A"),
    "insightzz": ("Insightzz", "#6A1B9A"),
    "jkcement": ("JK Cement", "#003D7A"),  # same as jk_cement, just copy
    "lucky_seeds": ("Lucky Seeds", "#4CAF50"),
    "mukund": ("Mukund Magnum", "#B8860B"),
    "orient": ("Orient Electric", "#003D7A"),
    "orientelectric": ("Orient Electric", "#003D7A"),  # same as orient
    "pmcona": ("PM Cona", "#2C3E50"),
    "recykal": ("Recykal", "#00A651"),
    "sakkugroup": ("Sakku Brand Fulfilment", "#E30613"),
    "savera": ("Savera Pipes", "#1A237E"),
    "sintex": ("Sintex", "#003D7A"),
    "sundar_masala": ("Sunder Masala", "#D32F2F"),
    "vn_fogg": ("Vini Cosmetics", "#E91E63"),
    "zydus": ("Zydus Wellness", "#004B87"),
}

def wikipedia_logo(brand_name):
    """Try to get logo from Wikipedia infobox."""
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(brand_name + ' logo')}&format=json&srlimit=3"
    try:
        resp = urllib.request.urlopen(search_url, timeout=10)
        data = json.loads(resp.read())
        if data['query']['search']:
            # Get the page
            page_title = data['query']['search'][0]['title']
            page_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(page_title)}&prop=pageimages&format=json&pithumbsize=500"
            resp2 = urllib.request.urlopen(page_url, timeout=10)
            page_data = json.loads(resp2.read())
            pages = page_data['query']['pages']
            for pid, pdata in pages.items():
                if 'thumbnail' in pdata:
                    return pdata['thumbnail']['source']
    except Exception as e:
        print(f"  Wikipedia search failed for '{brand_name}': {e}")
    return None

def wikipedia_logo_direct(brand_name):
    """Direct Wikipedia article logo search."""
    # Use opensearch to find the brand page
    search_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(brand_name)}&limit=3&format=json"
    try:
        resp = urllib.request.urlopen(search_url, timeout=10)
        data = json.loads(resp.read())
        if data[1]:
            page_name = urllib.parse.quote(data[1][0])
            # Get the page with infobox image
            info_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={page_name}&prop=pageimages|images&format=json&pithumbsize=500"
            resp2 = urllib.request.urlopen(info_url, timeout=10)
            page_data = json.loads(resp2.read())
            pages = page_data['query']['pages']
            for pid, pdata in pages.items():
                if 'thumbnail' in pdata:
                    return pdata['thumbnail']['source']
                # Try getting the logo from File namespace
                if 'images' in pdata:
                    for img in pdata['images']:
                        title = img['title']
                        if any(kw in title.lower() for kw in ['logo', 'brand', 'mark']):
                            img_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=imageinfo&iiprop=url&format=json"
                            resp3 = urllib.request.urlopen(img_url, timeout=10)
                            img_data = json.loads(resp3.read())
                            for pid2, pd2 in img_data['query']['pages'].items():
                                if 'imageinfo' in pd2:
                                    return pd2['imageinfo'][0]['url']
    except Exception as e:
        print(f"  Direct Wikipedia search failed for '{brand_name}': {e}")
    return None

def clearbit_logo(brand_name):
    """Try Clearbit logo API (free, no key needed)."""
    domain = brand_name.lower().replace(' ', '') + '.com'
    url = f"https://logo.clearbit.com/{domain}?size=256"
    try:
        resp = urllib.request.urlopen(url, timeout=8)
        if resp.status == 200 and int(resp.headers.get('content-length', 1000)) > 100:
            return url
    except:
        pass
    # Try with hyphens
    domain2 = brand_name.lower().replace(' ', '-') + '.com'
    if domain2 != domain:
        url2 = f"https://logo.clearbit.com/{domain2}?size=256"
        try:
            resp = urllib.request.urlopen(url2, timeout=8)
            if resp.status == 200 and int(resp.headers.get('content-length', 1000)) > 100:
                return url2
        except:
            pass
    return None

def google_favicon(brand_name):
    """Try Google favicon service."""
    domain = brand_name.lower().replace(' ', '') + '.com'
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    return url  # always returns something but may be generic

def download_image(url, output_path, max_size=500*1024):
    """Download an image, return True on success."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read()
        if len(data) < 200:
            return False
        if len(data) > max_size:
            data = data[:max_size]
        # Detect content type
        ct = resp.headers.get('Content-Type', '')
        ext = '.png'
        if 'svg' in ct or url.endswith('.svg'):
            ext = '.svg'
        elif 'jpeg' in ct or 'jpg' in ct:
            ext = '.jpg'
        elif 'gif' in ct:
            ext = '.gif'
        elif 'webp' in ct:
            ext = '.webp'
        elif url.endswith('.svg'):
            ext = '.svg'
        
        out_path = output_path.with_suffix(ext)
        with open(out_path, 'wb') as f:
            f.write(data)
        print(f"    ✓ Saved {out_path.name} ({len(data)//1024}KB)")
        return True
    except Exception as e:
        return False

def generate_placeholder_svg(slug, name, color, output_path):
    """Generate a simple SVG logo with brand initials."""
    initials = ''.join(w[0].upper() for w in name.split()[:2] if w[0].isalpha())
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" rx="20" fill="{color}"/>
  <text x="100" y="115" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white">{initials}</text>
</svg>'''
    with open(output_path, 'wb') as f:
        f.write(svg.encode('utf-8'))
    print(f"    ✓ Placeholder SVG generated ({initials} on {color})")

def main():
    os.makedirs(ASSETS, exist_ok=True)
    
    # First, copy JK Cement logo to jkcement slug (same brand)
    src_jk = f"{ASSETS}/jk_cement/logo.png"
    dst_jk = f"{ASSETS}/jkcement/logo.png"
    if os.path.exists(src_jk):
        os.makedirs(f"{ASSETS}/jkcement", exist_ok=True)
        import shutil
        shutil.copy2(src_jk, dst_jk)
        print(f"✓ Copied jk_cement/logo.png → jkcement/logo.png")
    src_jk_svg = f"{ASSETS}/jk_cement/logo.svg"
    dst_jk_svg = f"{ASSETS}/jkcement/logo.svg"
    if os.path.exists(src_jk_svg):
        shutil.copy2(src_jk_svg, dst_jk_svg)
    
    # Copy Orient Electric logo if we find one for orient → orientelectric
    # (they're the same brand)
    
    for slug, (name, color) in BRANDS.items():
        if slug == 'jkcement':
            continue  # already handled above
        if slug == 'orientelectric':
            # Copy from orient if exists
            src_oe = f"{ASSETS}/orient/logo.png"
            if os.path.exists(src_oe):
                os.makedirs(f"{ASSETS}/orientelectric", exist_ok=True)
                import shutil
                shutil.copy2(src_oe, f"{ASSETS}/orientelectric/logo.png")
                print(f"✓ Copied orient/logo.png → orientelectric/logo.png")
                continue
        
        brand_dir = Path(f"{ASSETS}/{slug}")
        brand_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if logo already exists
        existing = list(brand_dir.glob("logo.*"))
        if existing:
            print(f"  {slug}: Already has logo ({existing[0].name})")
            continue
        
        print(f"\n{slug} ({name})...")
        
        # Strategy 1: Wikipedia
        url = wikipedia_logo(name)
        if not url:
            url = wikipedia_logo_direct(name)
        if url:
            print(f"  Found via Wikipedia: {url[:80]}...")
            if download_image(url, brand_dir / "logo"):
                continue
        
        # Strategy 2: Clearbit
        url = clearbit_logo(name)
        if url:
            print(f"  Found via Clearbit: {url[:80]}...")
            if download_image(url, brand_dir / "logo"):
                continue
        
        # Strategy 3: Try brand website directly
        for domain_try in [
            name.lower().replace(' ', '').replace('&', 'and') + '.com',
            name.lower().replace(' ', '-').replace('&', 'and') + '.com',
            name.lower().replace(' ', '').replace('&', '') + '.com',
            name.lower().replace(' ', '').replace('and', '') + '.com',
            slug + '.com',
        ]:
            for path_try in ['/logo.svg', '/logo.png', '/images/logo.svg', '/assets/logo.svg', '/assets/images/logo.png']:
                url = f"https://{domain_try}{path_try}"
                if download_image(url, brand_dir / "logo"):
                    break
            if (brand_dir / "logo.svg").exists() or (brand_dir / "logo.png").exists() or (brand_dir / "logo.jpg").exists():
                break
        
        if not any(brand_dir.glob("logo.*")):
            # Generate placeholder
            generate_placeholder_svg(slug, name, color, brand_dir / "logo.svg")
    
    print("\n=== Summary ===")
    for slug, (name, _) in BRANDS.items():
        brand_dir = Path(f"{ASSETS}/{slug}")
        logos = list(brand_dir.glob("logo.*"))
        if logos:
            print(f"  {slug:25s} → {logos[0].name}")
        else:
            print(f"  {slug:25s} → MISSING")

if __name__ == "__main__":
    main()
