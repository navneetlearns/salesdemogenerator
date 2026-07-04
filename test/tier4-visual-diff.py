#!/usr/bin/env python3
"""Visual pixel-diff test for all 30 journey pages.
Tier 4 of the test-runner suite.

Compares full-page screenshots against baselines using PIL.
First run creates baselines. Subsequent runs flag pixel diffs >1%.

Usage:
  python3 test/tier4-visual-diff.py                      # against production
  TEST_URL=http://localhost:8080 python3 test/tier4-visual-diff.py  # against local
  python3 test/tier4-visual-diff.py --update-baseline     # refresh all baselines
"""

import os, sys, json, time, shutil
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_URL", "https://demo-generator-482.pages.dev")
PROJECT_DIR = Path("/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator")
SCREENSHOTS_DIR = PROJECT_DIR / "test-screenshots"
BASELINE_DIR = SCREENSHOTS_DIR / "tier4-baseline"
DIFF_DIR = SCREENSHOTS_DIR / "tier4-diff"
PIXEL_THRESHOLD = 0.01  # 1% max difference

UPDATE_BASELINE = "--update-baseline" in sys.argv

BRANDS = ["haldirams", "jk_cement", "sundaram_store"]
JOURNEYS = [
    "order_to_cash", "field_ops_expense", "automated_collections",
    "dealer_engagement", "retailer_onboarding", "retailer_loyalty",
    "campaigns_queries", "dt_fulfillment_payment", "retailer_activation",
    "post_order_communication",
]

results = {"pass": 0, "fail": 0, "new": 0, "skipped": 0, "details": []}

def pixel_diff_pct(img1, img2):
    """Compute percentage of different pixels between two images."""
    if img1.size != img2.size:
        return 100.0  # Different dimensions = complete mismatch
    
    diff = ImageChops.difference(img1, img2)
    stat = ImageStat.Stat(diff)
    # RMS of all channels averaged
    rms = sum(stat.rms) / len(stat.rms)
    # Convert 0-255 RMS to percentage
    pct = (rms / 255.0) * 100
    return pct

def save_diff_image(img1, img2, diff_path):
    """Create and save a visual diff image highlighting differences."""
    diff = ImageChops.difference(img1, img2)
    # Enhance contrast so differences are visible
    from PIL import ImageEnhance
    diff = ImageEnhance.Contrast(diff).enhance(3.0)
    diff.save(diff_path)
    return diff

def run():
    if UPDATE_BASELINE:
        print("=== Visual Diff: UPDATING BASELINES ===\n")
    else:
        print(f"=== Visual Diff: comparing against {BASELINE_DIR} ===\n")
    
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    DIFF_DIR.mkdir(parents=True, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})  # iPhone 14 size
        
        for brand in BRANDS:
            for journey in JOURNEYS:
                url = f"{BASE_URL}/{brand}/{journey}.html"
                baseline_path = BASELINE_DIR / f"{brand}_{journey}.png"
                screenshot_path = SCREENSHOTS_DIR / f"tier4_{brand}_{journey}.png"
                diff_path = DIFF_DIR / f"{brand}_{journey}_diff.png"
                
                page = context.new_page()
                try:
                    page.goto(url, wait_until="networkidle", timeout=15000)
                    time.sleep(1)  # Let fonts/render settle
                    page.screenshot(path=str(screenshot_path), full_page=True)
                    
                    if not baseline_path.exists():
                        # First run — create baseline
                        shutil.copy(screenshot_path, baseline_path)
                        results["new"] += 1
                        status = "NEW baseline"
                    else:
                        # Compare
                        captured = Image.open(screenshot_path)
                        baseline = Image.open(baseline_path)
                        pct = pixel_diff_pct(captured, baseline)
                        
                        if pct > PIXEL_THRESHOLD * 100:
                            save_diff_image(captured, baseline, diff_path)
                            results["fail"] += 1
                            status = f"FAIL ({pct:.2f}% diff)"
                            results["details"].append({
                                "brand": brand, "journey": journey,
                                "diff_pct": round(pct, 2), "diff_image": str(diff_path)
                            })
                        else:
                            results["pass"] += 1
                            status = f"PASS ({pct:.2f}% diff)"
                    
                    print(f"  {brand}/{journey}: {status}")
                    
                except Exception as e:
                    results["fail"] += 1
                    results["details"].append({
                        "brand": brand, "journey": journey,
                        "error": str(e)[:100]
                    })
                    print(f"  {brand}/{journey}: ERROR — {e}")
                finally:
                    page.close()
        
        browser.close()
    
    # Summary
    print(f"\n=== Results ===")
    print(f"  Pass: {results['pass']}  Fail: {results['fail']}  New: {results['new']}  Total: {results['pass'] + results['fail'] + results['new']}")
    
    if results["fail"] > 0:
        print(f"\n  Failures:")
        for d in results["details"]:
            if "error" in d:
                print(f"    {d['brand']}/{d['journey']}: {d['error']}")
            else:
                print(f"    {d['brand']}/{d['journey']}: {d['diff_pct']}% diff → {d['diff_image']}")
    
    return results["fail"] == 0

if __name__ == "__main__":
    success = run()
    sys.exit(0 if success else 1)
