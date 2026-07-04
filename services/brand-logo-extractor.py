#!/usr/bin/env python3
"""
Brand logo extractor — robust, multi-source scraper for extracting brand logos
from any company URL. Designed as a reusable service for the demo generator's
long-term vision (user provides URL → auto-generate demo).

Sources (tried in order):
  1. Website meta tags (og:image, twitter:image, JSON-LD logo, schema.org)
  2. Known logo paths (/logo.svg, /images/logo.png, etc.)
  3. Clearbit logo API (free, no key)
  4. Brandfetch CDN
  5. Google favicons
  6. Website root /favicon.ico
  7. Heuristic: largest relevant image on homepage
"""

import os, sys, json, re, time, hashlib, io
import urllib.request, urllib.parse, urllib.error
import ssl
from pathlib import Path
from html.parser import HTMLParser

# ── Config ──────────────────────────────────────────────────────────────
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
]

TIMEOUT = 12
MAX_IMAGE_SIZE = 500 * 1024  # 500KB

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


# ── HTML Parser for extracting meta tags and images ────────────────────
class LogoHTMLParser(HTMLParser):
    """Extract meta tags and img tags relevant to brand logos."""
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.meta_tags = {}
        self.json_ld_blocks = []
        self.img_srcs = []
        self.in_title = False
        self.title_text = ""
        self.in_head = True  # track if we're still in <head>
        
    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        tag_lower = tag.lower()
        
        if tag_lower == 'meta':
            name = attr_dict.get('name', attr_dict.get('property', '')).lower()
            content = attr_dict.get('content', '')
            if name and content:
                self.meta_tags[name] = content
        
        elif tag_lower == 'img':
            src = attr_dict.get('src', '')
            if src:
                # Resolve relative URLs
                full_src = urllib.parse.urljoin(self.base_url, src)
                alt = attr_dict.get('alt', '')
                width = int(attr_dict.get('width', 0))
                height = int(attr_dict.get('height', 0))
                cls = attr_dict.get('class', '')
                _id = attr_dict.get('id', '')
                self.img_srcs.append({
                    'src': full_src, 'alt': alt,
                    'width': width, 'height': height,
                    'class': cls, 'id': _id
                })
        
        elif tag_lower in ('script', 'head'):
            pass  # handled by handle_data/handle_endtag
            
    def handle_endtag(self, tag):
        if tag.lower() == 'head':
            self.in_head = False
    
    def handle_data(self, data):
        data_s = data.strip()
        if data_s.startswith('{') and '"@context"' in data_s:
            try:
                parsed = json.loads(data_s)
                self.json_ld_blocks.append(parsed)
            except json.JSONDecodeError:
                pass
        elif not self.title_text and self.in_head and '</title>' not in data_s:
            # Track title text if we haven't found it
            pass


def fetch(url, agent_idx=0):
    """Fetch a URL with timeout and proper headers."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': USER_AGENTS[agent_idx % len(USER_AGENTS)],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/svg+xml,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        resp = urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl_ctx)
        data = resp.read()
        ct = resp.headers.get('Content-Type', '')
        return data, ct, resp.geturl()
    except Exception:
        return None, None, None


def fetch_with_retry(url, max_retries=2):
    """Fetch with retry using different user agents."""
    for i in range(max_retries + 1):
        data, ct, final_url = fetch(url, agent_idx=i)
        if data and len(data) > 100:
            return data, ct, final_url
        time.sleep(0.5)
    return None, None, None


# ── Source 1: Extract from website meta tags ───────────────────────────
def extract_from_meta_tags(html, base_url):
    """Extract logo URL from meta tags (og:image, twitter:image, etc.)"""
    parser = LogoHTMLParser(base_url)
    try:
        parser.feed(html.decode('utf-8', errors='replace'))
    except Exception:
        pass
    
    candidates = []
    
    # Priority order of meta tags
    for key in ['og:image', 'twitter:image', 'og:logo', 'application-image']:
        val = parser.meta_tags.get(key, '') or parser.meta_tags.get(key.replace(':', '_'), '')
        if val:
            full_url = urllib.parse.urljoin(base_url, val)
            candidates.append((100, full_url, f'meta:{key}'))
    
    # Check JSON-LD for logo
    for jd in parser.json_ld_blocks:
        logo = jd.get('logo') or jd.get('publisher', {}).get('logo', {}) or jd.get('organization', {}).get('logo', {})
        if isinstance(logo, str):
            candidates.append((95, urllib.parse.urljoin(base_url, logo), 'jsonld:logo'))
        elif isinstance(logo, dict):
            for field in ['url', 'contentUrl', 'identifier']:
                val = logo.get(field)
                if val:
                    candidates.append((95, urllib.parse.urljoin(base_url, val), 'jsonld:logo'))
                    break
    
    # Check img tags for logos (heuristic)
    for img in parser.img_srcs:
        score = 0
        keywords = ['logo', 'brand', 'site-logo', 'header-logo', 'brand-logo']
        for kw in keywords:
            if kw in img['src'].lower() or kw in img.get('class', '').lower() or kw in img.get('id', '').lower() or kw in img.get('alt', '').lower():
                score += 30
        # Large images that appear early (likely header logo)
        relative_path = urllib.parse.urlparse(img['src']).path.lower()
        if any(ext in relative_path for ext in ['.svg', '.png', '.jpg', '.jpeg', '.webp']):
            score += 10
        if img['width'] > 50 and img['height'] > 50:
            score += 10
        if score > 20:
            candidates.append((score, img['src'], f'img:{os.path.basename(relative_path)[:30]}'))
    
    return candidates


# ── Source 2: Known logo paths on website ──────────────────────────────
LOGO_PATHS = [
    '/logo.svg', '/logo.png', '/logo.jpg',
    '/images/logo.svg', '/images/logo.png',
    '/assets/logo.svg', '/assets/logo.png',
    '/assets/images/logo.svg', '/assets/images/logo.png',
    '/wp-content/uploads/logo.png',
    '/themes/custom/logo.svg',
    '/favicon.ico',
]


def try_known_paths(domain, paths=None):
    """Try known logo file paths on the domain."""
    if paths is None:
        paths = LOGO_PATHS
    candidates = []
    for path in paths:
        for proto in ['https', 'http']:
            url = f'{proto}://{domain}{path}'
            data, ct, _ = fetch(url)
            if data and len(data) > 200:
                # Verify it's an image, not HTML
                snippet = data[:200].decode('utf-8', errors='replace').strip()
                if not snippet.startswith('<!DOCTYPE') and not snippet.startswith('<html'):
                    ext = os.path.splitext(path)[1] or '.ico'
                    candidates.append((80, url, f'path:{path}', data))
                    break
        if candidates:
            break
    return candidates


# ── Source 3: Clearbit Logo API ────────────────────────────────────────
def try_clearbit(domain):
    """Try Clearbit free logo API."""
    url = f'https://logo.clearbit.com/{domain}?size=256'
    data, ct, _ = fetch(url)
    if data and len(data) > 500:
        snippet = data[:200].decode('utf-8', errors='replace').strip()
        if not snippet.startswith('<!DOCTYPE') and not snippet.startswith('<html'):
            return [(75, url, 'clearbit', data)]
    return []


# ── Source 4: Brandfetch CDN ───────────────────────────────────────────
def try_brandfetch(domain):
    """Try Brandfetch CDN."""
    for template in [
        f'https://img.brandfetch.io/{domain}?w=400&h=400',
        f'https://cdn.brandfetch.io/{domain}/w/400/h/400',
    ]:
        data, ct, _ = fetch(template)
        if data and len(data) > 500:
            snippet = data[:200].decode('utf-8', errors='replace').strip()
            if not snippet.startswith('<!DOCTYPE') and not snippet.startswith('<html'):
                return [(70, template, 'brandfetch', data)]
    return []


# ── Source 5: Google favicons ──────────────────────────────────────────
def try_google_favicon(domain):
    """Try Google favicon service at various sizes."""
    sizes = [128, 64, 32]
    candidates = []
    for sz in sizes:
        url = f'https://www.google.com/s2/favicons?domain={domain}&sz={sz}'
        data, ct, _ = fetch(url)
        if data and len(data) > 200:
            snippet = data[:200].decode('utf-8', errors='replace').strip()
            if not snippet.startswith('<!DOCTYPE') and not snippet.startswith('<html'):
                score = 40 + (sz // 32)  # Higher score for larger sizes
                candidates.append((score, url, f'favicon:{sz}px', data))
    return candidates


# ── Source 6: Direct favicon.ico ────────────────────────────────────────
def try_favicon_ico(domain):
    """Try direct /favicon.ico."""
    for proto in ['https', 'http']:
        url = f'{proto}://{domain}/favicon.ico'
        data, ct, _ = fetch(url)
        if data and len(data) > 200:
            snippet = data[:200].decode('utf-8', errors='replace').strip()
            if not snippet.startswith('<!DOCTYPE') and not snippet.startswith('<html'):
                # Check for ICO magic bytes (or fallback ICNS/PNG)
                if data[:4] in [b'\x00\x00\x01\x00', b'\x89PNG']:
                    return [(35, url, 'favicon.ico', data)]
    return []


# ── Main extractor ─────────────────────────────────────────────────────
def extract_brand_logo(domain_or_url):
    """
    Extract brand logo from a domain or URL.
    
    Args:
        domain_or_url: e.g. 'adaniwilmar.com', 'https://www.hindalco.com/'
    
    Returns:
        dict with keys: success, url, data, source, format, size
        or {'success': False} if nothing found
    """
    # Normalize to domain
    parsed = urllib.parse.urlparse(domain_or_url)
    domain = parsed.netloc or domain_or_url.split('/')[0]
    domain = domain.lower().replace('www.', '')
    
    base_url = f'https://{domain}'
    
    candidates = []
    
    # Phase 1: Try fetching the homepage and parse meta tags
    html_data, ct, final_url = fetch_with_retry(base_url)
    if html_data and 'text/html' in (ct or '').lower():
        actual_domain = urllib.parse.urlparse(final_url or base_url).netloc.lower().replace('www.', '')
        candidates.extend(extract_from_meta_tags(html_data, base_url))
    
    # Phase 2: Try known logo paths (on main domain and www subdomain)
    for d in [domain, f'www.{domain}']:
        candidates.extend(try_known_paths(d))
    
    # Phase 3: Clearbit
    candidates.extend(try_clearbit(domain))
    
    # Phase 4: Brandfetch
    candidates.extend(try_brandfetch(domain))
    
    # Phase 5: Google favicons
    candidates.extend(try_google_favicon(domain))
    
    # Phase 6: Direct favicon.ico
    candidates.extend(try_favicon_ico(domain))
    
    if not candidates:
        return {'success': False}
    
    # Sort by score descending
    candidates.sort(key=lambda x: -x[0])
    
    # For candidates that didn't return data (just URLs), try downloading
    best_url = None
    best_data = None
    best_source = None
    
    for c in candidates:
        if len(c) >= 4 and c[3] is not None:
            # Already has data
            best_url = c[1]
            best_data = c[3]
            best_source = c[2]
            break
        elif len(c) >= 3:
            # Try fetching
            data, ct, _ = fetch(c[1])
            if data and len(data) > 500:
                best_url = c[1]
                best_data = data
                best_source = c[2]
                break
    
    if not best_data:
        return {'success': False}
    
    # Detect format
    ext = '.png'
    ct_lower = ''
    try:
        ct_lower = best_url  # we lost content-type, check URL
    except:
        pass
    if '.svg' in best_url:
        ext = '.svg'
    elif '.png' in best_url:
        ext = '.png'
    elif '.jpg' in best_url or '.jpeg' in best_url:
        ext = '.jpg'
    elif '.webp' in best_url:
        ext = '.webp'
    elif '.ico' in best_url:
        ext = '.ico'
    else:
        # Detect from magic bytes
        if best_data[:4] == b'\x89PNG':
            ext = '.png'
        elif best_data[:3] == b'\xff\xd8\xff':
            ext = '.jpg'
    
    return {
        'success': True,
        'domain': domain,
        'url': best_url,
        'source': best_source,
        'format': ext,
        'size_bytes': len(best_data),
        'data': best_data,
    }


def save_logo(result, output_dir):
    """Save extracted logo to a directory. Creates dir if needed."""
    os.makedirs(output_dir, exist_ok=True)
    ext = result.get('format', '.png')
    output_path = os.path.join(output_dir, f'logo{ext}')
    with open(output_path, 'wb') as f:
        f.write(result['data'])
    return output_path


# ── CLI entry point ────────────────────────────────────────────────────
def main():
    """Batch-process brands from data/brands/ and save their logos."""
    BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_BRANDS = os.path.join(BASE, 'data', 'brands')
    ASSETS = os.path.join(BASE, 'assets', 'brands')
    
    print("=" * 60)
    print("BRAND LOGO EXTRACTOR v2 — Multi-source scraper")
    print("=" * 60)
    
    results = {'good': 0, 'small': 0, 'failed': 0}
    
    for fname in sorted(os.listdir(DATA_BRANDS)):
        if not fname.endswith('.json'):
            continue
        slug = fname.replace('.json', '')
        brand_dir = os.path.join(ASSETS, slug)
        os.makedirs(brand_dir, exist_ok=True)
        
        # Skip if already has a good logo (>2KB, not placeholder)
        existing = [f for f in os.listdir(brand_dir) if f.startswith('logo.')]
        has_good = False
        for ef in existing:
            efp = os.path.join(brand_dir, ef)
            sz = os.path.getsize(efp)
            with open(efp, errors='ignore') as efh:
                content = efh.read(500)
            if sz > 2000 and 'initials' not in content and 'placeholder' not in content:
                has_good = True
                break
        if has_good:
            print(f"  ✓ {slug}: already has good logo")
            results['good'] += 1
            continue
        
        # Load brand data for name
        with open(os.path.join(DATA_BRANDS, fname)) as f:
            brand = json.load(f)
        
        name = brand.get('name', slug)
        print(f"\n  → {slug} ({name})")
        
        # Build search domains from brand name
        search_domains = []
        # 1. Brand slug (e.g., "adani_wilmar" → "adaniwilmar.com")
        search_domains.append(slug.replace('_', ''))
        # 2. Brand name (e.g., "Adani Wilmar" → "adaniwilmar.com")
        search_domains.append(name.lower().replace('&', 'and').replace(' ', ''))
        # 3. Brand short name
        short = brand.get('shortName', name.split()[0] if ' ' in name else name)
        if short.lower() not in search_domains:
            search_domains.append(short.lower().replace(' ', ''))
        
        found = False
        for domain in search_domains:
            domain = domain.replace('.com', '') + '.com'
            print(f"    Trying {domain}...")
            result = extract_brand_logo(domain)
            if result['success']:
                output_path = save_logo(result, brand_dir)
                sz = result['size_bytes']
                quality = 'good' if sz > 2000 else 'small'
                print(f"    ✓ from {result['source'][:40]} ({sz}bytes) → {output_path}")
                results[quality] += 1
                found = True
                break
            time.sleep(0.3)  # rate limit
        
        if not found:
            print(f"    ✗ Could not find logo for {name}")
            results['failed'] += 1
    
    print(f"\n{'=' * 60}")
    print(f"Results: {results['good']} good, {results['small']} small, {results['failed']} failed")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
