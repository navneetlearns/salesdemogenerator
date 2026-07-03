#!/usr/bin/env python3
"""
Migration manifest extractor — scans legacy WhatsApp mock-generator project
folders and produces a structured manifest of what adaptation requires per file.

Extracts (without modifying originals):
  - Brand metadata (colors from :root, brand name in title, font)
  - Base64 image count and total embedded image bytes
  - Journey type (matched to demo-generator's 10 canonical types, or flagged)
  - Step / screen counts (step-section, screen-wrap divs)
  - Inline CSS / JS size (to estimate dedup potential)
  - Message content snippets (chat bubbles, msg-body text)

Output:
  migration/manifest.json   — full per-file manifest
  migration/manifest.csv     — flat spreadsheet view (same data, easier to scan)
"""

import os, re, json, csv, base64
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS_DIR = os.path.join(BASE, "projects")
OUT_JSON = os.path.join(BASE, "manifest.json")
OUT_CSV  = os.path.join(BASE, "manifest.csv")

CANONICAL_JOURNEYS = [
    "order_to_cash","automated_collections","dealer_engagement","field_ops_expense",
    "retailer_loyalty","retailer_onboarding","campaigns_queries","dt_fulfillment_payment",
    "retailer_activation","post_order_communication",
]

CSS_ROOT_RE = re.compile(r":root\s*\{([^}]+)\}", re.S)
CSS_VAR_RE  = re.compile(r"--([\w-]+)\s*:\s*([^;]+);")
TITLE_RE    = re.compile(r"<title>([^<]+)</title>", re.I)
B64_RE      = re.compile(r"data:image/(\w+);base64,([A-Za-z0-9+/=]+)")
SCRIPT_BLOCK_RE = re.compile(r"<script[^>]*>(.*?)</script>", re.S)
STYLE_BLOCK_RE  = re.compile(r"<style[^>]*>(.*?)</style>", re.S)


def detect_journey_type(filename):
    fn = os.path.basename(filename).lower().replace("-", "_").replace(" ", "_")
    for j in CANONICAL_JOURNEYS:
        if j in fn:
            return j, "canonical"
    # Heuristic: try keywords commonly mapped to existing journeys
    if any(k in fn for k in ("order","buy","sale")):  return "order_to_cash", "inferred"
    if any(k in fn for k in ("collection","payment")):  return "automated_collections", "inferred"
    if any(k in fn for k in ("engagement","campaign")):  return "dealer_engagement", "inferred"
    if any(k in fn for k in ("field","dsr","expense","claim")):  return "field_ops_expense", "inferred"
    if any(k in fn for k in ("loyalty","reward")):  return "retailer_loyalty", "inferred"
    if any(k in fn for k in ("onboard","registration")):  return "retailer_onboarding", "inferred"
    if any(k in fn for k in ("broad","rate","daily")):  return "campaigns_queries", "inferred"
    if any(k in fn for k in ("fulfilment","fulfillment")):  return "dt_fulfillment_payment", "inferred"
    if any(k in fn for k in ("activation","activate")):  return "retailer_activation", "inferred"
    if "index" in fn:  return None, "hub"  # hub / index file
    return None, "unknown"


def extract_brand_colors(html):
    m = CSS_ROOT_RE.search(html)
    if not m:
        return {}
    colors = {}
    for name, val in CSS_VAR_RE.findall(m.group(1)):
        if "brand" in name.lower() or "accent" in name.lower() or "primary" in name.lower() or "color" in name.lower():
            colors[name] = val.strip()
    return colors


def extract_brand_name_from_title(html):
    m = TITLE_RE.search(html)
    if not m:
        return ""
    title = m.group(1).strip()
    # title is typically "BrandName — Journey | ZoTok Journey"
    parts = re.split(r"—|\|", title)
    if parts:
        return parts[0].strip()
    return title


def extract_message_snippets(html):
    # Sample up to 5 chat-bubble / msg-body snippets to inform content audit
    bubbles = re.findall(r'class="msg-body[^"]*"[^>]*>([^<]{8,160})<', html)
    return bubbles[:5]


def extract_step_screen_labels(html):
    # Screen labels like <div class="screen-lbl">Step 1 · Self Service</div>
    labels = re.findall(r'class="(?:screen-lbl|step-lbl)"[^>]*>([^<]+)</div>', html)
    return labels  # may be empty for some formats


def analyze_one(html_path):
    try:
        with open(html_path, "rb") as f:
            raw = f.read()
        html = raw.decode("utf-8", errors="ignore")
    except Exception as e:
        return {"error": str(e), "path": html_path}

    size_bytes = len(raw)
    base64_images = B64_RE.findall(html)
    b64_total_kb = sum(len(b) for _, b in base64_images) // 1024

    style_blocks = STYLE_BLOCK_RE.findall(html)
    css_kb = sum(len(s) for s in style_blocks) // 1024
    script_blocks = SCRIPT_BLOCK_RE.findall(html)
    js_kb = sum(len(s) for s in script_blocks) // 1024

    journey_type, kind = detect_journey_type(html_path)
    brand_name = extract_brand_name_from_title(html)
    colors = extract_brand_colors(html)
    msg_samples = extract_message_snippets(html)
    step_labels = extract_step_screen_labels(html)

    return {
        "project": os.path.basename(os.path.dirname(html_path)),
        "filename": os.path.basename(html_path),
        "size_kb": size_bytes // 1024,
        "journey_type": journey_type,
        "journey_kind": kind,
        "brand_name": brand_name,
        "colors": colors,
        "base64_image_count": len(base64_images),
        "base64_kb": b64_total_kb,
        "css_kb": css_kb,
        "js_kb": js_kb,
        "step_count": html.count('class="step-section'),
        "screen_count": html.count('class="screen-wrap'),
        "phone_frame_count": html.count('class="phone-frame'),
        "message_samples": msg_samples,
        "step_labels": step_labels,
    }


def main():
    rows = []
    for project in sorted(os.listdir(PROJECTS_DIR)):
        pdir = os.path.join(PROJECTS_DIR, project)
        if not os.path.isdir(pdir):
            continue
        for fname in sorted(os.listdir(pdir)):
            if not fname.lower().endswith(".html"):
                continue
            p = os.path.join(pdir, fname)
            info = analyze_one(p)
            info["path"] = p
            rows.append(info)

    json.dump(rows, open(OUT_JSON, "w"), indent=2, ensure_ascii=False)

    cols = ["project","filename","journey_type","journey_kind","brand_name",
            "size_kb","base64_image_count","base64_kb","css_kb","js_kb",
            "step_count","screen_count","colors","step_labels","message_samples"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([
                r.get("project"), r.get("filename"),
                r.get("journey_type") or "", r.get("journey_kind") or "",
                r.get("brand_name") or "",
                r.get("size_kb"), r.get("base64_image_count"),
                r.get("base64_kb"), r.get("css_kb"), r.get("js_kb"),
                r.get("step_count"), r.get("screen_count"),
                json.dumps(r.get("colors") or {}, ensure_ascii=False),
                " | ".join(r.get("step_labels", [])),
                " || ".join(r.get("message_samples", [])),
            ])

    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_CSV}")
    print(f"\nManifested {len(rows)} HTML files across {len(set(r['project'] for r in rows))} projects")
    print("\nSummary by journey_kind / journey_type:")
    c = Counter((r.get("journey_kind"), r.get("journey_type")) for r in rows)
    for (k, t), n in sorted(c.items(), key=lambda x: (-x[1])):
        print(f"  {k or '-':<10} {t or '-':<30} {n}")
    print(f"\nTotal inline CSS: {sum(r.get('css_kb',0) for r in rows):,} KB (dedup potential)")
    print(f"Total inline JS : {sum(r.get('js_kb',0)  for r in rows):,} KB (dedup potential)")
    print(f"Total base64 img: {sum(r.get('base64_kb',0) for r in rows):,} KB ({sum(r.get('base64_image_count',0) for r in rows)} images to extract to files)")


if __name__ == "__main__":
    main()