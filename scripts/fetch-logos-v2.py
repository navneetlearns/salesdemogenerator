#!/usr/bin/env python3
"""Aggressively find real brand logos from multiple sources."""

import os, sys, json, urllib.request, urllib.parse, time, ssl

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
ASSETS = f"{BASE}/assets/brands"

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# Brands still needing real logos + known domain names + potential paths
BRAND_DOMAINS = {
    "adani_wilmar": {
        "domains": ["adaniwilmar.com", "www.adaniwilmar.com"],
        "name": "Adani Wilmar",
        "paths": ["/logo.svg", "/images/logo.svg", "/themes/custom/aw/logo.svg", "/sites/default/files/logo.png", "/logo.png"],
    },
    "blueocean": {
        "domains": ["blueoceansteels.com", "www.blueoceansteels.com", "blueocean.co.in"],
        "name": "Blue Ocean Steels",
        "paths": ["/logo.svg", "/images/logo.png", "/wp-content/uploads/logo.png"],
    },
    "hindalco": {
        "domains": ["hindalco.com", "www.hindalco.com", "hindalcoindustries.com"],
        "name": "Hindalco",
        "paths": ["/logo.svg", "/themes/hindalco/images/logo.png", "/sites/default/files/Hindalco-Logo.png"],
    },
    "insightzz": {
        "domains": ["insightzz.com", "www.insightzz.com"],
        "name": "Insightzz",
        "paths": ["/logo.svg", "/images/logo.png", "/wp-content/uploads/logo.png"],
    },
    "lucky_seeds": {
        "domains": ["luckyseeds.in", "www.luckyseeds.in"],
        "name": "Lucky Seeds",
        "paths": ["/logo.svg", "/images/logo.png"],
    },
    "orient": {
        "domains": ["orientelectric.com", "www.orientelectric.com"],
        "name": "Orient Electric",
        "paths": ["/logo.svg", "/themes/custom/orientelectric/logo.svg", "/sites/default/files/logo.png"],
    },
    "orientelectric": {
        "domains": ["orientelectric.com", "www.orientelectric.com"],
        "name": "Orient Electric",
        "paths": ["/logo.svg", "/themes/custom/orientelectric/logo.svg", "/sites/default/files/logo.png"],
    },
    "pmcona": {
        "domains": ["pmcona.com", "www.pmcona.com", "pmcona.in"],
        "name": "PM Cona",
        "paths": ["/logo.svg", "/images/logo.png"],
    },
    "recykal": {
        "domains": ["recykal.com", "www.recykal.com"],
        "name": "Recykal",
        "paths": ["/logo.svg", "/wp-content/uploads/2021/08/recykal-logo.svg", "/wp-content/uploads/2021/06/Recykal-Logo.png", "/images/logo.svg"],
    },
    "sakkugroup": {
        "domains": ["sakkugroup.com", "www.sakkugroup.com", "sakkubrand.com"],
        "name": "Sakku Brand",
        "paths": ["/logo.svg", "/wp-content/uploads/logo.png", "/images/logo.png"],
    },
    "sintex": {
        "domains": ["sintex.in", "www.sintex.in", "sintexworld.com"],
        "name": "Sintex",
        "paths": ["/logo.svg", "/images/logo.svg", "/themes/custom/sintex/logo.png", "/wp-content/uploads/logo.png"],
    },
    "sundar_masala": {
        "domains": ["sundermasala.com", "www.sundermasala.com"],
        "name": "Sunder Masala",
        "paths": ["/logo.svg", "/images/logo.png"],
    },
    "vn_fogg": {
        "domains": ["vinicosmetics.com", "www.vinicosmetics.com", "vnfogg.com", "www.vnfogg.com"],
        "name": "Vini Cosmetics",
        "paths": ["/logo.svg", "/images/logo.png", "/wp-content/uploads/logo.png"],
    },
}

def try_url(url, timeout=10):
    """Try to download from URL. Returns (data, content_type) or None."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        })
        resp = urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)
        data = resp.read()
        ct = resp.headers.get('Content-Type', '')
        # Reject HTML/text/non-image responses
        if len(data) < 200:
            return None
        if 'text/html' in ct or 'text/plain' in ct:
            return None
        # Check content isn't HTML disguised as something else
        snippet = data[:200].decode('utf-8', errors='ignore').strip()
        if snippet.startswith('<!DOCTYPE') or snippet.startswith('<html'):
            return None
        return (data, ct)
    except Exception:
        return None

def try_clearbit(domain):
    """Try Clearbit logo API."""
    url = f"https://logo.clearbit.com/{domain}?size=256"
    result = try_url(url)
    if result:
        return result, url
    return None

def try_google_favicon(domain):
    """Try Google favicons (gives at least a recognizable icon)."""
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    result = try_url(url)
    if result:
        return result, url
    return None

def try_brandfetch(domain):
    """Try Brandfetch CDN."""
    url = f"https://cdn.brandfetch.io/{domain}/w/400/h/400"
    result = try_url(url)
    if result:
        return result, url
    url2 = f"https://img.brandfetch.io/{domain}?w=400&h=400"
    result = try_url(url2)
    if result:
        return result, url2
    return None

def try_website(domain, paths):
    """Try known logo paths on website."""
    for path in paths:
        url = f"https://{domain}{path}"
        result = try_url(url)
        if result:
            return result, url
    return None

def detect_ext(data, ct, url):
    """Determine file extension from content type and URL."""
    if 'svg' in ct or url.endswith('.svg'):
        return '.svg'
    if 'png' in ct or url.endswith('.png'):
        return '.png'
    if 'jpeg' in ct or 'jpg' in ct or url.endswith('.jpg'):
        return '.jpg'
    if 'webp' in ct or url.endswith('.webp'):
        return '.webp'
    if 'gif' in ct:
        return '.gif'
    # Detect from magic bytes
    if data[:4] == b'\x89PNG':
        return '.png'
    if data[:3] == b'\xff\xd8\xff':
        return '.jpg'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return '.webp'
    if data[:2] == b'GIF':
        return '.gif'
    return '.png'

def main():
    sources_used = {}
    
    for slug, info in BRAND_DOMAINS.items():
        brand_dir = f"{ASSETS}/{slug}"
        os.makedirs(brand_dir, exist_ok=True)
        
        # Skip if already has a real logo (>2KB and not placeholder-style)
        existing = [f for f in os.listdir(brand_dir) if f.startswith('logo.')]
        real_found = False
        for f in existing:
            fpath = f"{brand_dir}/{f}"
            sz = os.path.getsize(fpath)
            with open(fpath, errors='ignore') as fh:
                content = fh.read(500)
            # A real logo is >1KB and doesn't say "initials" (our placeholder pattern)
            if sz > 1000 and 'placeholder' not in content and 'initials' not in content:
                real_found = True
                break
        if real_found:
            print(f"  {slug}: already has real logo ✓")
            continue
        
        print(f"\n{slug} ({info['name']})...")
        
        found = False
        
        # Method 1: Try brand websites directly with known paths
        for domain in info['domains']:
            result = try_website(domain, info['paths'])
            if result:
                (data, ct), url = result
                ext = detect_ext(data, ct, url)
                out = f"{brand_dir}/logo{ext}"
                with open(out, 'wb') as f:
                    f.write(data)
                print(f"  ✓ [{os.path.basename(url)}] ({len(data)//1024}KB)")
                sources_used[slug] = url
                found = True
                break
        if found:
            continue
        
        # Method 2: Clearbit logo API (all domain variations)
        for domain in info['domains']:
            result = try_clearbit(domain)
            if result:
                (data, ct), url = result
                ext = detect_ext(data, ct, url)
                out = f"{brand_dir}/logo{ext}"
                with open(out, 'wb') as f:
                    f.write(data)
                print(f"  ✓ Clearbit ({domain}) ({len(data)//1024}KB)")
                sources_used[slug] = f"clearbit:{domain}"
                found = True
                break
        if found:
            continue
        
        # Method 3: Google favicon (at least recognizable)
        for domain in info['domains']:
            result = try_google_favicon(domain)
            if result:
                (data, ct), url = result
                ext = detect_ext(data, ct, url)
                out = f"{brand_dir}/logo{ext}"
                with open(out, 'wb') as f:
                    f.write(data)
                print(f"  ✓ Google favicon ({domain}) ({len(data)//1024}KB)")
                sources_used[slug] = f"favicon:{domain}"
                found = True
                break
        if found:
            continue
        
        # Method 4: Brandfetch CDN
        for domain in info['domains']:
            result = try_brandfetch(domain)
            if result:
                (data, ct), url = result
                ext = detect_ext(data, ct, url)
                out = f"{brand_dir}/logo{ext}"
                with open(out, 'wb') as f:
                    f.write(data)
                print(f"  ✓ Brandfetch ({domain}) ({len(data)//1024}KB)")
                sources_used[slug] = f"brandfetch:{domain}"
                found = True
                break
        if found:
            continue
        
        print(f"  ✗ No real logo found from any source")
    
    print("\n=== Sources Used ===")
    for slug, src in sorted(sources_used.items()):
        print(f"  {slug:20s} → {src[:60]}")
    
    # Show final state
    print("\n=== Final Inventory ===")
    for slug in sorted(os.listdir(ASSETS)):
        bdir = f"{ASSETS}/{slug}"
        if not os.path.isdir(bdir):
            continue
        logos = [f for f in os.listdir(bdir) if f.startswith('logo.')]
        if not logos:
            print(f"  ⚠️ {slug:25s} → MISSING")
            continue
        best = max(logos, key=lambda f: os.path.getsize(f"{bdir}/{f}"))
        sz = os.path.getsize(f"{bdir}/{best}")
        with open(f"{bdir}/{best}", errors='ignore') as f:
            is_placeholder = 'initials' in f.read(500)
        kind = "PLACEHOLDER" if is_placeholder else "REAL"
        source = sources_used.get(slug, "")
        print(f"  {'~' if is_placeholder else '✓'} {slug:25s} → {best:20s} ({sz:>5}B) [{kind}] {source}")

if __name__ == "__main__":
    main()
