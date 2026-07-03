#!/usr/bin/env python3
"""extract_brand_metadata — Phase 4: extract brand metadata (name, colors, fonts)
from legacy whatsapp-mock-generator HTML files' :root CSS variables and <title> tags.

Produces per-brand JSON files matching the demo-generator's existing
data/brands/{brand}.json schema (colors object + font + dealer_store_name +
secondary_dealers array + assets object).

One brand metadata file per project directory (deduped by slug even if
multiple journey HTMLs reference the same brand).

Pure stdlib — no external deps.
"""
from __future__ import annotations

import html as _html
import json
import os
import re
import sys
from typing import Any

__all__ = ["extract_brand_metadata", "extract_all_brands"]

_TITLE_RE = re.compile(r'<title>([^<]{2,200})</title>', re.IGNORECASE)
_ROOT_RE = re.compile(r':root\s*\{([^}]+)\}', re.IGNORECASE)
_CSS_VAR_RE = re.compile(r'(--[\w-]+)\s*:\s*([^;]+)\s*;')
_FONT_FAMILY_RE = re.compile(r'font-family\s*:\s*([^;]+)\s*;', re.IGNORECASE)
_MSG_SENDER_RE = re.compile(r'<div\b[^>]*\bclass="[^"]*\bmsg-sender\b[^"]*"[^>]*>([^<]{2,80})</div>', re.IGNORECASE)
_TAG_STRIP_RE = re.compile(r'<[^>]+>')

# Industry classification heuristics based on brand name keywords
_INDUSTRY_KEYWORDS = [
    ("cement", ["cement"]),
    ("fmcg", ["wilmar", "banas", "dairy", "masala", "haldiram", "campa", "atharva", "food", "snack", "fogg", "vini", "cosmetic"]),
    ("industrial", ["steel", "steels", "ocean", "hindalco", "aluminium", "tube", "pipe", "sintex", "plastic", "tank", "recykal", "scrap", "solar", "electric", "orient", "mukund", "magnum"]),
    ("pharma", ["zydus", "wellness", "freyr", "insightzz", "defect", "pharma", "health", "med"]),
    ("agri", ["seed", "lucky", "agri", "farm"]),
]

# Brand-name noise to strip (suffixes after | or — or -)
_TITLE_CLEAN_RE = re.compile(r'\s*[|—–-]\s*.*$')


def _strip_tags(text: str) -> str:
    if not text:
        return ""
    return _TAG_STRIP_RE.sub("", _html.unescape(text)).strip()


def _classify_industry(brand_name: str) -> str:
    s = (brand_name or "").lower()
    for industry, keywords in _INDUSTRY_KEYWORDS:
        if any(kw in s for kw in keywords):
            return industry
    return "general"


def _slug_from_project(proj_dir: str) -> str:
    slug = proj_dir.lower().replace(" ", "_")
    slug = re.sub(r'[\[\]/]', '', slug)
    return slug


def _clean_title(title: str) -> str:
    """Strip journey suffix from <title> — keep just the brand name."""
    # Remove everything after | or — or –
    cleaned = _TITLE_CLEAN_RE.sub("", title).strip()
    if not cleaned:
        cleaned = title.strip()
    return cleaned


def extract_brand_metadata(html_path: str, project_dir: str = "") -> dict[str, Any]:
    """Extract brand metadata from a single legacy HTML file.

    Args:
        html_path: path to the HTML file.
        project_dir: project directory name (for slug generation).

    Returns:
        {slug, name, industry, colors, font, dealer_store_name,
         secondary_dealers, assets}
    """
    with open(html_path, encoding="utf-8", errors="replace") as f:
        html_content = f.read()

    title_m = _TITLE_RE.search(html_content)
    raw_title = title_m.group(1).strip() if title_m else project_dir or "Unknown"
    name = _clean_title(raw_title)

    # :root CSS variables
    colors = {}
    root_m = _ROOT_RE.search(html_content)
    if root_m:
        for var, val in _CSS_VAR_RE.findall(root_m.group(1)):
            colors[var] = val.strip()

    # Font family
    font_m = _FONT_FAMILY_RE.search(html_content)
    font_primary = font_m.group(1).strip().strip('"').strip("'") if font_m else "Inter, sans-serif"
    font = {"primary": font_primary}

    # Dealer store name — first msg-sender text
    sender_m = _MSG_SENDER_RE.search(html_content)
    dealer_store_name = _strip_tags(sender_m.group(1)) if sender_m else "Main Dealer"

    industry = _classify_industry(name)
    slug = _slug_from_project(project_dir or os.path.basename(os.path.dirname(html_path)))

    return {
        "slug": slug,
        "name": name,
        "industry": industry,
        "colors": colors,
        "font": font,
        "dealer_store_name": dealer_store_name,
        "secondary_dealers": [],
        "assets": {"logo_ref": None, "hero_ref": None},
    }


def extract_all_brands(projects_dir: str, output_dir: str) -> list[str]:
    """Extract brand metadata from all project directories.

    Scans ALL HTML files in each project to find the most common brand name
    (first title prefix before | or —). This avoids the case where a single
    HTML file has a different brand name (e.g. Haldirams project has one file
    titled 'Campa').

    Args:
        projects_dir: path to migration/projects/
        output_dir: where to write {slug}.json files

    Returns:
        List of output file paths.
    """
    from collections import Counter
    os.makedirs(output_dir, exist_ok=True)
    results = []

    for proj in sorted(os.listdir(projects_dir)):
        pdir = os.path.join(projects_dir, proj)
        if not os.path.isdir(pdir):
            continue
        htmls = [f for f in os.listdir(pdir) if f.endswith(".html") and f != "index.html" and "_index" not in f]
        if not htmls:
            continue

        # Extract metadata from the first file (colors, font, etc.)
        meta = extract_brand_metadata(os.path.join(pdir, htmls[0]), proj)

        # Scan all titles to find the most common brand name
        title_names = []
        for fn in htmls:
            with open(os.path.join(pdir, fn), encoding="utf-8", errors="replace") as f:
                html_content = f.read()
            tm = _TITLE_RE.search(html_content)
            if tm:
                cleaned = _clean_title(tm.group(1).strip())
                title_names.append(cleaned)

        if title_names:
            most_common_name = Counter(title_names).most_common(1)[0][0]
            meta["name"] = most_common_name
            # Re-classify industry with the corrected name
            meta["industry"] = _classify_industry(most_common_name)

        out_path = os.path.join(output_dir, f"{meta['slug']}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        results.append(out_path)

    return results


if __name__ == "__main__":
    base = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/projects"
    out = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/brand_metadata"
    paths = extract_all_brands(base, out)
    print(f"Extracted {len(paths)} brand metadata files to {out}")