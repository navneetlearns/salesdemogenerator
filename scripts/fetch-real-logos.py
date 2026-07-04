#!/usr/bin/env python3
"""Fix and enhance brand logos. Clean HTML-page imposters, download real logos."""

import os, re, urllib.request, urllib.parse, json, time

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
ASSETS = f"{BASE}/assets/brands"

# Delete files that are HTML pages, not real logos
def clean_fake_svgs():
    for slug in os.listdir(ASSETS):
        bdir = f"{ASSETS}/{slug}"
        if not os.path.isdir(bdir):
            continue
        for fname in os.listdir(bdir):
            fpath = f"{bdir}/{fname}"
            if not fname.startswith('logo.'):
                continue
            with open(fpath, errors='ignore') as f:
                first = f.read(200)
            if first.strip().startswith('<!DOCTYPE') or first.strip().startswith('<html'):
                os.remove(fpath)
                print(f"  ✗ Deleted HTML-pretending-to-be-SVG: {slug}/{fname}")

# Known brand logo URLs
BRAND_LOGO_URLS = {
    "hindalco": [
        "https://www.hindalco.com/themes/hindalco/images/logo.png",
        "https://www.hindalco.com/themes/custom/hindalco/logo.png",
        "https://upload.wikimedia.org/wikipedia/en/9/91/Hindalco_Logo.png",
    ],
    "zydus": [
        "https://www.zyduswellness.com/images/logo.png",
        "https://www.zyduswellness.com/themes/custom/zydus/logo.png",
        "https://upload.wikimedia.org/wikipedia/en/2/23/Zydus_Wellness_Logo.png",
    ],
    "adani_wilmar": [
        "https://www.adaniwilmar.com/images/logo.svg",
        "https://www.adaniwilmar.com/themes/custom/aw/logo.svg",
        "https://www.adaniwilmar.com/sites/default/files/logo.png",
    ],
    "sintex": [
        "https://www.sintex.in/images/logo.svg",
        "https://www.sintex.in/themes/custom/sintex/logo.png",
    ],
    "recykal": [
        "https://recykal.com/images/logo.svg",
        "https://recykal.com/wp-content/uploads/2021/08/recykal-logo.svg",
        "https://recykal.com/wp-content/uploads/2021/06/Recykal-Logo.png",
    ],
    "orient": [
        "https://www.orientelectric.com/images/logo.svg",
        "https://www.orientelectric.com/themes/custom/orientelectric/logo.svg",
    ],
    "banas_diary": [
        # Already has banas-dairy-logo.png — that's the real logo
    ],
    "sakkugroup": [
        "https://sakkugroup.com/images/logo.svg",
        "https://sakkugroup.com/wp-content/uploads/logo.png",
    ],
    "savera": [
        "https://saverapipes.com/images/logo.svg",
        "https://saverapipes.com/wp-content/themes/savera/images/logo.png",
    ],
}

def try_download(url, output_path, min_size=500, max_size=500*1024):
    """Download a file with proper headers. Returns bytes or None."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read()
        if len(data) < min_size or len(data) > max_size:
            return None
        # Verify it's actually an image/vector, not HTML
        snippet = data[:200].decode('utf-8', errors='ignore').strip()
        if snippet.startswith('<!DOCTYPE') or snippet.startswith('<html'):
            return None
        with open(output_path, 'wb') as f:
            f.write(data)
        return data
    except Exception as e:
        return None

def main():
    print("=== Cleaning fake SVGs (HTML pages) ===")
    clean_fake_svgs()
    
    print("\n=== Downloading real brand logos ===")
    for slug, urls in BRAND_LOGO_URLS.items():
        brand_dir = f"{ASSETS}/{slug}"
        os.makedirs(brand_dir, exist_ok=True)
        
        # Check if we already have a decent logo
        existing = [f for f in os.listdir(brand_dir) if f.startswith('logo.')]
        good_existing = [f for f in existing if os.path.getsize(f"{brand_dir}/{f}") > 1000 and os.path.getsize(f"{brand_dir}/{f}") < 100000]
        if good_existing:
            # Verify it's not HTML
            with open(f"{brand_dir}/{good_existing[0]}", errors='ignore') as f:
                if not f.read(200).strip().startswith('<!DOCTYPE'):
                    print(f"  {slug}: already has good logo ({good_existing[0]}, {os.path.getsize(f'{brand_dir}/{good_existing[0]}')//1024}KB)")
                    continue
        
        for url in urls:
            ext = os.path.splitext(url.split('/')[-1])[1] or '.png'
            if '?' in ext:
                ext = ext.split('?')[0]
            output = f"{brand_dir}/logo{ext}"
            data = try_download(url, output)
            if data:
                print(f"  ✓ {slug}: downloaded from {url[:60]}... ({len(data)//1024}KB)")
                break
            else:
                print(f"  ✗ {slug}: failed {url.split('/')[2]}{url.split(url.split('/')[2])[1][:40]}...")
    
    # For the rest without real logos, keep the placeholders
    print("\n=== Final Logo Inventory ===")
    for slug in sorted(os.listdir(ASSETS)):
        bdir = f"{ASSETS}/{slug}"
        if not os.path.isdir(bdir):
            continue
        logos = [f for f in os.listdir(bdir) if f.startswith('logo.') and os.path.isfile(f"{bdir}/{f}")]
        if not logos:
            print(f"  {slug:25s} → ⚠️ NO LOGO")
            continue
        best = max(logos, key=lambda f: os.path.getsize(f"{bdir}/{f}"))
        sz = os.path.getsize(f"{bdir}/{best}")
        quality = "good" if sz > 2000 and sz < 100000 and not open(f"{bdir}/{best}", errors='ignore').read(200).startswith('<!') else ("fake" if sz > 50000 else "icon")
        print(f"  {slug:25s} → {best:20s} ({sz:>5}B) [{quality}]")

if __name__ == "__main__":
    main()
