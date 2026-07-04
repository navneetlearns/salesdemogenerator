#!/usr/bin/env python3
"""Extract inline SVG logos from original legacy project HTML files.
The whatsapp-mock-generator projects embed brand logos as inline SVGs in their
index.html or journey HTML files. This script extracts them."""

import json, os, re, sys

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
ASSETS = f"{BASE}/assets/brands"
PROJECTS = f"{BASE}/migration/projects"

# Brand slug -> (project_dir, filename_with_logo, search_hints)
BRAND_SOURCES = {
    "adani_wilmar": ("Adani Wilmar", None, True),
    "atharva": ("Atharva", None, True),
    "banas_diary": ("Banas_Diary", "index.html", False),  # has banas-dairy-logo.png
    "blueocean": ("BlueOcean", "index.html", True),  # has inline SVGs
    "freyr": ("freyr", None, True),
    "hindalco": ("Hindalco", None, True),
    "insightzz": ("insightzz", None, True),
    "lucky_seeds": ("lucky_seeds", None, True),
    "mukund": ("Mukund", None, True),
    "orient": ("Orient", "index.html", True),
    "orientelectric": ("OrientElectric", None, True),
    "pmcona": ("pmcona", None, True),
    "recykal": ("Recykal", None, True),  # had 96 inline SVGs
    "sakkugroup": ("SakkuGroup", None, True),
    "savera": ("Savera", None, True),
    "sintex": ("Sintex", None, True),  # had 96 inline SVGs
    "sundar_masala": ("sundar_masala", None, True),
    "vn_fogg": ("V[N] Fogg", None, True),
    "zydus": ("zydus", None, True),  # had 107 inline SVGs
}

def extract_inline_svg(html_content, brand_name):
    """Try to find the brand logo SVG in HTML content.
    
    Look for:
    1. SVG with word 'logo' or brand name nearby
    2. First large SVG (likely the main logo)
    3. SVG inside the header/top section
    """
    # Strategy 1: Find SVG that contains brand name text
    svgs = re.findall(r'<svg[^>]*>.*?</svg>', html_content, re.DOTALL | re.IGNORECASE)
    
    candidates = []
    for i, svg in enumerate(svgs):
        score = 0
        size = len(svg)
        # Has viewBox
        if 'viewBox' in svg:
            score += 2
        # Contains brand name
        for word in brand_name.lower().split()[:2]:
            if word in svg.lower():
                score += 5
        # Contains 'logo' text
        if 'logo' in svg.lower():
            score += 10
        # Is in first third of document
        pos_ratio = html_content.find(svg) / max(len(html_content), 1)
        if pos_ratio < 0.3:
            score += 3
        # Size: logos are usually medium-sized SVGs (500-5000 chars)
        if 500 < size < 5000:
            score += 2
        elif 100 < size < 10000:
            score += 1
        # Has typical logo attributes
        if 'class="logo"' in svg.lower() or 'id="logo"' in svg.lower():
            score += 10
        if 'width' in svg and 'height' in svg:
            score += 1
        
        candidates.append((score, size, svg, i))
    
    if candidates:
        candidates.sort(key=lambda x: -x[0])
        best = candidates[0]
        # Only return if score is reasonable
        if best[0] >= 5:
            return best[2]
    
    return None

def extract_svg_from_wrapper(html, brand_name):
    """Strategy 2: Find SVG wrapped in logo/site-header div."""
    patterns = [
        r'class="[^"]*logo[^"]*"[^>]*>(.*?)</(?:div|figure)',
        r'id="[^"]*logo[^"]*"[^>]*>(.*?)</(?:div|figure)',
        r'class="[^"]*brand[^"]*"[^>]*>(.*?)</(?:div|figure)',
        r'<header[^>]*>(.*?)</header>',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.DOTALL | re.IGNORECASE)
        if m:
            content = m.group(1)
            svg_m = re.search(r'<svg[^>]*>.*?</svg>', content, re.DOTALL | re.IGNORECASE)
            if svg_m:
                return svg_m.group(0)
    return None

def copy_banas_dairy_logo():
    """Banas Dairy has a real logo PNG."""
    src = f"{PROJECTS}/Banas_Diary/banas-dairy-logo.png"
    dst = f"{ASSETS}/banas_diary/logo.png"
    if os.path.exists(src):
        import shutil
        os.makedirs(f"{ASSETS}/banas_diary", exist_ok=True)
        shutil.copy2(src, dst)
        print(f"  ✓ Copied banas-dairy-logo.png")
        return True
    return False

def main():
    # First handle Banas Dairy
    copy_banas_dairy_logo()
    
    # For each brand, find the SVG in their HTML files
    for slug, (proj_dir, specific_file, has_inline_svg) in BRAND_SOURCES.items():
        if slug == 'banas_diary':
            continue  # handled above
        
        brand_dir = f"{ASSETS}/{slug}"
        os.makedirs(brand_dir, exist_ok=True)
        
        # Skip if already has a non-placeholder logo (>2KB meaning it's real)
        existing_real = False
        for f in os.listdir(brand_dir):
            fpath = os.path.join(brand_dir, f)
            if f.startswith('logo.') and os.path.getsize(fpath) > 2000:
                existing_real = True
                break
        if existing_real:
            print(f"  {slug}: already has real logo")
            continue
        
        pdir = f"{PROJECTS}/{proj_dir}"
        if not os.path.isdir(pdir):
            print(f"  {slug}: project dir {pdir} not found")
            continue
        
        # Read the specific file or the first journey HTML
        htmls_to_check = []
        html_map = {}
        for f in os.listdir(pdir):
            if f.endswith('.html'):
                fpath = os.path.join(pdir, f)
                content = open(fpath, errors='ignore').read()
                html_map[fpath] = content
                if specific_file and f == specific_file:
                    htmls_to_check.insert(0, (fpath, content))
                else:
                    htmls_to_check.append((fpath, content))
        
        found = False
        for fpath, content in htmls_to_check:
            # Try wrapper extraction first
            svg = extract_svg_from_wrapper(content, proj_dir)
            if svg:
                with open(f"{brand_dir}/logo.svg", 'w', encoding='utf-8') as f:
                    f.write(svg.strip())
                print(f"  ✓ {slug}: extracted SVG logo from {os.path.basename(fpath)} (wrapper)")
                found = True
                break
            
            # Try inline SVG extraction
            svg = extract_inline_svg(content, proj_dir)
            if svg:
                with open(f"{brand_dir}/logo.svg", 'w', encoding='utf-8') as f:
                    f.write(svg.strip())
                print(f"  ✓ {slug}: extracted SVG logo from {os.path.basename(fpath)} (inline, score={candidates[0][0] if 'candidates' in dir() else '?'})")
                found = True
                break
            
            # Fallback: if the file has img src to _images, try to find one that looks like a logo
            imgs = re.findall(r'<img[^>]+src="([^"]+)"[^>]*>', content)
            for img_src in imgs:
                # Images in _images/ that are referenced near the top might be logos
                img_path = os.path.join(os.path.dirname(fpath), img_src)
                if os.path.exists(img_path):
                    file_size = os.path.getsize(img_path)
                    pos = content.find(img_src)
                    # If it's one of the first images referenced and reasonable size
                    if pos < len(content) * 0.2 and 2000 < file_size < 200000:
                        import shutil
                        ext = os.path.splitext(img_src)[1] or '.png'
                        shutil.copy2(img_path, f"{brand_dir}/logo{ext}")
                        print(f"  ✓ {slug}: copied image logo from {img_src} ({file_size//1024}KB)")
                        found = True
                        break
        
        if not found:
            print(f"  ✗ {slug}: no logo found in legacy HTMLs")
    
    print("\n=== Final State ===")
    for slug in sorted(os.listdir(ASSETS)):
        bdir = f"{ASSETS}/{slug}"
        if os.path.isdir(bdir):
            logos = [f for f in os.listdir(bdir) if f.startswith('logo.') and not f.startswith('.')]
            if logos:
                sizes = {f: os.path.getsize(f"{bdir}/{f}") for f in logos}
                print(f"  {slug:25s} → {logos[0]:20s} ({sizes[logos[0]]//1024}KB)")
            else:
                print(f"  {slug:25s} → NO LOGO")

if __name__ == "__main__":
    main()
