#!/usr/bin/env python3
"""Import 21 legacy brands and 76 journey JSONs from migration/ into data/.
Run: python3 scripts/import-legacy-brands.py
Effect: creates data/brands/{slug}.json + data/journeys/{slug}_{journey}.json
"""

import json, os, glob, re, shutil

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
BRAND_META_DIR = f"{BASE}/migration/brand_metadata"
EXTRACTED_DIR = f"{BASE}/migration/extracted"
BRANDS_OUT = f"{BASE}/data/brands"
JOURNEYS_OUT = f"{BASE}/data/journeys"

# Existing brands (don't overwrite)
EXISTING = {"haldirams", "jk_cement", "sundaram_store", "sunder_masala"}

# Color CSS var → clean key mapping
COLOR_KEY_MAP = {
    "--brand": "brand",
    "--brand-l": "brandLight",
    "--brand-dark": "brandDark",
    "--accent": "accent",
    "--wa-top": "waTop",
    "--wa-teal": "waTeal",
    "--wa-green": "waGreen",
    "--chat-bg": "chatBg",
    "--sender": "sender",
    "--receiver": "receiver",
}

def convert_colors(raw_colors):
    """Convert CSS variable keys (--brand) to clean keys (brand)."""
    if not raw_colors:
        return {"brand": "#075e54", "brandDark": "#064e46", "accent": "#00A884"}
    clean = {}
    for k, v in raw_colors.items():
        key = COLOR_KEY_MAP.get(k, k.lstrip("-").replace("-", "_"))
        clean[key] = v
    return clean

def build_brand_json(meta):
    """Convert migration brand metadata to data/brands/ format."""
    slug = meta.get("slug", "unknown")
    name = meta.get("name", slug)
    industry = meta.get("industry", "general")
    
    # Colors
    colors = convert_colors(meta.get("colors", {}))
    
    # Assets
    assets = {
        "logo": "logo.png",
        "logoDark": "logo_dark.png",
        "favicon": "favicon.png",
        "heroBanner": "hero_banner.png",
    }
    
    # Font
    font_raw = meta.get("font", {})
    if isinstance(font_raw, dict):
        fonts = [font_raw.get("primary", "Inter").split(",")[0].strip().strip("'\"")]
    elif isinstance(font_raw, str):
        fonts = [font_raw.split(",")[0].strip().strip("'\"")]
    else:
        fonts = ["Inter"]
    
    brand = {
        "id": slug,
        "name": name,
        "shortName": name.split()[0] if " " in name else name,
        "industry": industry,
        "assets": assets,
        "colors": colors,
        "fonts": fonts,
        "dealerStoreName": meta.get("dealer_store_name", f"{name} Dealer"),
        "secondaryDealers": meta.get("secondary_dealers", []),
    }
    return brand

def process():
    # Load all brand metadata
    meta_files = sorted(glob.glob(f"{BRAND_META_DIR}/*.json"))
    print(f"Found {len(meta_files)} brand metadata files")
    
    brands_created = 0
    journeys_created = 0
    
    for mf in meta_files:
        with open(mf) as f:
            meta = json.load(f)
        
        slug = meta.get("slug", "unknown")
        if slug in EXISTING:
            print(f"  SKIP {slug}: already exists as live brand")
            continue
        
        # Write brand JSON
        brand = build_brand_json(meta)
        out_path = f"{BRANDS_OUT}/{slug}.json"
        with open(out_path, "w") as f:
            json.dump(brand, f, indent=2, ensure_ascii=False)
        brands_created += 1
        print(f"  BRAND {slug}: {meta.get('name', '?')} ({meta.get('industry', '?')})")
        
        # Find matching extracted journeys
        pattern = f"{EXTRACTED_DIR}/{slug}__*.json"
        journey_files = sorted(glob.glob(pattern))
        
        for jf in journey_files:
            with open(jf) as f:
                journey_data = json.load(f)
            
            # Extract journey type from filename: {slug}__{type}.json
            fname = os.path.basename(jf).replace(".json", "")
            parts = fname.split("__", 1)
            if len(parts) != 2:
                continue
            journey_type = parts[1]
            
            # Clean journey type
            # Remove common prefixes
            for prefix in ["journey_", "jk_cement_", "awl_", "vini_"]:
                if journey_type.startswith(prefix):
                    journey_type = journey_type[len(prefix):]
                    break
            
            # Ensure id field
            if "id" not in journey_data:
                journey_data["id"] = journey_type
            
            # Add brands array
            journey_data["brands"] = [slug]
            
            # Write journey JSON
            j_out = f"{JOURNEYS_OUT}/{slug}_{journey_type}.json"
            with open(j_out, "w") as f:
                json.dump(journey_data, f, indent=2, ensure_ascii=False)
            journeys_created += 1
    
    print(f"\nDone: {brands_created} brands, {journeys_created} journeys created")
    print(f"Output: {BRANDS_OUT}/, {JOURNEYS_OUT}/")

if __name__ == "__main__":
    process()
