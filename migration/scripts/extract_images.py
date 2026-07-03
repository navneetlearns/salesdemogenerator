#!/usr/bin/env python3
"""
Image extractor — walks the migration/projects/ tree, extracts every base64-
embedded image to a file on disk, and rewrites each HTML in place to reference
the file by relative URL (so a browser opening the HTML still resolves images,
but the file's stored bytes drop by the size of all embedded images).

Per project, creates:
  migration/projects/<project>/_images/   (extracted image files)
  migration/projects/<project>/<html>    (rewritten HTML in place)

Outputs migration/image-extraction-summary.json with counts and pre/post sizes.
Idempotent: skips HTMLs whose image directory is non-empty AND whose rewritten
HTML contains no base64 image data — re-running does nothing on already-extracted
projects and only touches files that still embed base64.

Run:
  python3 migration/scripts/extract_images.py [--project NAME]
"""

import os, re, json, base64, sys, hashlib
import argparse

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS   = os.path.join(BASE, "projects")
SUMMARY    = os.path.join(BASE, "image-extraction-summary.json")

B64_RE = re.compile(
    r"data:image/(?P<ext>png|jpeg|jpg|webp|svg\+xml|gif);base64,(?P<data>[A-Za-z0-9+/=]+)"
)


def extension_for(ext):
    return {"jpeg": "jpg", "jpg": "jpg", "png": "png",
            "webp": "webp", "svg+xml": "svg", "gif": "gif"}.get(ext, "img")


def fingerprint(data_bytes):
    # First 8 bytes of content hash + length — enough to dedupe within a project
    h = hashlib.sha1(data_bytes).hexdigest()[:10]
    return h


def extract_for_html(html_path, images_dir):
    with open(html_path, "rb") as f:
        raw = f.read()
    html = raw.decode("utf-8", errors="ignore")

    if "data:image/" not in html:
        return {"already_done": True, "extracted": 0, "orig_kb": len(raw)//1024, "new_kb": len(raw)//1024}

    os.makedirs(images_dir, exist_ok=True)
    extracted = 0
    seen_hashes = {}  # content hash -> filename (avoid writing duplicates)

    def replace(match):
        nonlocal extracted
        ext = match.group("ext")
        b64 = match.group("data")
        try:
            data_bytes = base64.b64decode(b64)
        except Exception:
            return match.group(0)  # leave broken data alone
        h = fingerprint(data_bytes)
        if h in seen_hashes:
            fname = seen_hashes[h]
        else:
            fname = f"img_{h}.{extension_for(ext)}"
            fpath = os.path.join(images_dir, fname)
            if not os.path.exists(fpath):
                with open(fpath, "wb") as out:
                    out.write(data_bytes)
            seen_hashes[h] = fname
            extracted += 1
        return f"_images/{fname}"

    new_html = B64_RE.sub(replace, html)
    with open(html_path, "w", encoding="utf-8") as out:
        out.write(new_html)

    return {
        "already_done": False,
        "extracted": extracted,
        "orig_kb": len(raw)//1024,
        "new_kb": len(new_html)//1024,
        "savings_kb": (len(raw)-len(new_html))//1024,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", help="Restrict to a single project folder name")
    args = ap.parse_args()

    summaries = []
    projects = sorted(p for p in os.listdir(PROJECTS)
                      if os.path.isdir(os.path.join(PROJECTS, p)) and not p.startswith("."))
    if args.project:
        projects = [p for p in projects if p == args.project]

    grand_orig = grand_new = 0
    for proj in projects:
        pdir = os.path.join(PROJECTS, proj)
        images_dir = os.path.join(pdir, "_images")
        for fname in sorted(os.listdir(pdir)):
            if not fname.lower().endswith(".html"):
                continue
            hp = os.path.join(pdir, fname)
            s = extract_for_html(hp, images_dir)
            s["project"] = proj
            s["html"] = fname
            summaries.append(s)
            grand_orig += s["orig_kb"]
            grand_new  += s["new_kb"]
            status = "skipped" if s["already_done"] else f"+{s['extracted']} imgs"
            print(f"  {proj:<18} {fname:<45} {status:<14} {s['orig_kb']:>6}->{s['new_kb']:>6} KB")

    json.dump(summaries, open(SUMMARY, "w"), indent=2)
    total_extracted = sum(s.get("extracted", 0) for s in summaries)
    total_imgs = sum(1 for s in summaries if not s.get("already_done"))
    print(f"\nExtracted {total_extracted} unique images across {total_imgs} HTML files.")
    print(f"Total HTML size: {grand_orig:,} KB -> {grand_new:,} KB (saved {grand_orig-grand_new:,} KB, {100*(grand_orig-grand_new)/grand_orig:.1f}%)")
    print(f"Summary: {SUMMARY}")


if __name__ == "__main__":
    main()