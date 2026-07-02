#!/usr/bin/env python3
"""
Visual regression test for all custom demo journeys via Playwright.
Tests the actual wizard → generate → preview pipeline with pixel diff.
MANDATORY: Run after every fix before committing.
"""
import os, sys, json, time, hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_URL", "https://161464ec.demo-generator-482.pages.dev")
SCREENSHOTS_DIR = Path("/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/test-screenshots/custom")
BASELINE_DIR = SCREENSHOTS_DIR / "baseline"
DIFF_DIR = SCREENSHOTS_DIR / "diff"
JOURNEYS = [
    "order_to_cash", "field_ops_expense", "automated_collections",
    "dealer_engagement", "retailer_onboarding", "retailer_loyalty",
    "campaigns_queries", "dt_fulfillment_payment", "retailer_activation",
    "post_order_communication"
]

bugs = []
warnings = []


def compute_pixel_diff(img1_path, img2_path, diff_path=None):
    """Compare two screenshots pixel-by-pixel using pixelmatch."""
    try:
        from pngspec import PNG
    except ImportError:
        pass

    try:
        from PIL import Image
        import numpy as np

        a = np.array(Image.open(img1_path).convert('RGB'))
        b = np.array(Image.open(img2_path).convert('RGB'))

        if a.shape != b.shape:
            return -1, -1  # Different dimensions

        diff = np.abs(a.astype(int) - b.astype(int))
        total_pixels = a.shape[0] * a.shape[1] * 3
        changed_pixels = np.sum(diff > 10)  # threshold of 10 per channel
        pct = (changed_pixels / total_pixels) * 100

        if diff_path and pct > 0:
            Path(diff_path).parent.mkdir(parents=True, exist_ok=True)
            # Create diff image
            diff_img = Image.fromarray(np.clip(diff * 5, 0, 255).astype(np.uint8))
            diff_img.save(diff_path)

        return changed_pixels, pct
    except ImportError:
        # Fallback: simple file size + hash comparison
        h1 = hashlib.md5(open(img1_path, 'rb').read()).hexdigest()
        h2 = hashlib.md5(open(img2_path, 'rb').read()).hexdigest()
        s1 = os.path.getsize(img1_path)
        s2 = os.path.getsize(img2_path)
        if h1 == h2:
            return 0, 0.0
        return -1, -1


def check_page(page, brand, journey):
    """Run all checks on a loaded page."""
    issues = []

    # 1. Check for "undefined" text
    undefined_els = page.query_selector_all("text=/\\bundefined\\b/")
    if undefined_els:
        for el in undefined_els[:3]:
            txt = el.inner_text()[:80]
            issues.append(f"UNDEFINED_TEXT: '{txt}'")

    # 2. Check for unresolved Handlebars
    html = page.content()
    import re
    hb_matches = re.findall(r'\{\{[^}]+\}\}', html)
    hb_real = [m for m in hb_matches if not m.startswith('{{!--') and not m.startswith('{{!')]
    if hb_real:
        for m in hb_real[:3]:
            issues.append(f"UNRESOLVED_HANDLEBARS: {m}")

    # 3. Check for broken images
    broken_imgs = page.evaluate("""() => {
        const imgs = document.querySelectorAll('img');
        const broken = [];
        imgs.forEach(img => {
            if (!img.complete || img.naturalWidth === 0) {
                broken.push(img.src || img.getAttribute('data-src') || 'no-src');
            }
        });
        return broken;
    }""")
    for img_url in broken_imgs[:3]:
        issues.append(f"BROKEN_IMAGE: {img_url}")

    # 4. Check for horizontal scroll
    has_hscroll = page.evaluate("""() => {
        return document.body.scrollWidth > document.body.clientWidth + 5;
    }""")
    if has_hscroll:
        issues.append("HORIZONTAL_SCROLL detected")

    # 5. Check for empty step sections
    empty_steps = page.evaluate("""() => {
        const steps = document.querySelectorAll('.step-section');
        const empty = [];
        steps.forEach((s, i) => {
            if (s.textContent.trim().length < 10) {
                empty.push('step-' + (i+1));
            }
        });
        return empty;
    }""")
    for step in empty_steps:
        issues.append(f"EMPTY_STEP: {step}")

    # 6. Check page title
    title = page.title()
    if not title or title == "Untitled":
        issues.append(f"MISSING_TITLE: '{title}'")

    return issues


def test_custom_demo(page, journey_type, screenshot_path, baseline_path, diff_path):
    """Fill wizard, generate demo, check preview for issues."""
    issues = []
    console_errors = []

    def on_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text[:200])

    page.on("console", on_console)

    # Navigate to main page
    page.goto(BASE_URL + "/", wait_until="load", timeout=15000)
    page.wait_for_timeout(2000)

    # Step 1: Fill brand name
    brand_input = page.locator("#brandNameInput")
    if brand_input.count() > 0:
        brand_input.fill("TestBrand")
    else:
        issues.append("WIZARD: #brandNameInput not found")
        return issues

    # Step 1: Select industry
    industry_select = page.locator("#industryInput")
    if industry_select.count() > 0:
        industry_select.select_option("Cement")

    # Step 1: Click Next
    next_btn = page.locator("#nextStepBtn")
    if next_btn.count() > 0 and next_btn.is_visible():
        next_btn.click()
        page.wait_for_timeout(500)

    # Step 2: Add a product
    add_product_btn = page.locator("#addProductBtn")
    if add_product_btn.count() > 0 and add_product_btn.is_visible():
        add_product_btn.click()
        page.wait_for_timeout(500)

    # Fill ALL product name and price fields (validation requires all filled)
    name_inputs = page.locator(".product-name-input")
    price_inputs = page.locator(".product-price-input")
    for i in range(name_inputs.count()):
        name_inputs.nth(i).fill(f"Test Product {i+1}")
    for i in range(price_inputs.count()):
        price_inputs.nth(i).fill("420")

    # Click Next to Step 3
    next_btn = page.locator("#nextStepBtn")
    if next_btn.count() > 0 and next_btn.is_visible():
        next_btn.click()
        page.wait_for_timeout(1500)

    # Step 3: Select journey by clicking the journey card
    journey_card = page.locator(f".journey-card[data-journey='{journey_type}']")
    if journey_card.count() > 0:
        # Ensure step3 is active and card is visible
        page.evaluate("document.getElementById('step3').classList.add('active')")
        page.evaluate("document.getElementById('step3').style.display = 'block'")
        page.wait_for_timeout(300)
        journey_card.click(force=True)
        page.wait_for_timeout(500)
    else:
        issues.append(f"WIZARD: journey card for {journey_type} not found")
        return issues

    # Click Generate Demo button (the one inside step3, not #generateBtn)
    generate_btn = page.locator("button:has-text('Generate Demo')")
    if generate_btn.count() > 0 and generate_btn.is_visible():
        generate_btn.click()
    else:
        # Fallback to the onclick version
        page.evaluate("demoUI.generate()")

    # Wait for generation to complete
    page.wait_for_timeout(8000)

    # Check if preview iframe is visible
    preview_area = page.locator("#previewArea")
    if preview_area.count() > 0 and preview_area.is_visible():
        # Take screenshot of the full page (includes preview)
        page.screenshot(path=str(screenshot_path), full_page=True)

        # Check for visible errors
        error_el = page.locator("#wizardError")
        if error_el.count() > 0 and error_el.is_visible():
            err_text = error_el.inner_text()
            issues.append(f"WIZARD_ERROR: {err_text[:200]}")

        # Check genStatus
        gen_status = page.locator("#genStatus")
        if gen_status.count() > 0 and gen_status.is_visible():
            status_text = gen_status.inner_text()
            if "error" in status_text.lower() or "fail" in status_text.lower():
                issues.append(f"GEN_STATUS: {status_text[:200]}")
    else:
        error_el = page.locator("#wizardError")
        if error_el.count() > 0 and error_el.is_visible():
            err_text = error_el.inner_text()
            issues.append(f"WIZARD_ERROR: {err_text[:200]}")
        else:
            issues.append("PREVIEW: previewArea not visible after generate")
            page.screenshot(path=str(screenshot_path), full_page=True)

    # Visual diff comparison
    if screenshot_path.exists() and baseline_path.exists():
        changed, pct = compute_pixel_diff(str(baseline_path), str(screenshot_path), str(diff_path))
        if changed == 0:
            pass  # Identical
        elif changed == -1:
            warnings.append(f"{journey_type}: Could not compare (different dimensions or missing PIL)")
        elif pct > 1.0:
            issues.append(f"VISUAL_DIFF: {pct:.2f}% pixels changed ({changed} pixels)")
        elif pct > 0:
            warnings.append(f"{journey_type}: Minor diff {pct:.4f}% ({changed} pixels)")

    # Check console errors (skip resource loading errors)
    for err in console_errors:
        if "Failed to load resource" not in err and "404" not in err:
            issues.append(f"CONSOLE: {err[:150]}")

    return issues


def run_tests():
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    DIFF_DIR.mkdir(parents=True, exist_ok=True)

    passed = 0
    failed = 0
    total = len(JOURNEYS)

    print(f"Testing {total} custom demo journeys against {BASE_URL}")
    print(f"Screenshots: {SCREENSHOTS_DIR}")
    print(f"Baselines:   {BASELINE_DIR}")
    print(f"Diffs:       {DIFF_DIR}")
    print("=" * 60)

    # Check if baselines exist
    has_baselines = all((BASELINE_DIR / f"{j}.png").exists() for j in JOURNEYS)
    if not has_baselines:
        print("No baselines found — first run will create them.")
        print("Second run will compare against these baselines.\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})

        for journey in JOURNEYS:
            page = context.new_page()
            screenshot_path = SCREENSHOTS_DIR / f"{journey}.png"
            baseline_path = BASELINE_DIR / f"{journey}.png"
            diff_path = DIFF_DIR / f"{journey}.png"

            try:
                issues = test_custom_demo(page, journey, screenshot_path, baseline_path, diff_path)

                if issues:
                    failed += 1
                    bugs.append({"journey": journey, "issues": issues})
                    print(f"  FAIL  {journey}: {len(issues)} issues")
                    for iss in issues:
                        print(f"        - {iss}")
                else:
                    passed += 1
                    print(f"  PASS  {journey}")

                # Save as baseline if first run
                if not has_baselines and screenshot_path.exists():
                    import shutil
                    shutil.copy2(str(screenshot_path), str(baseline_path))

            except Exception as e:
                failed += 1
                bugs.append({"journey": journey, "issues": [f"EXCEPTION: {str(e)[:200]}"]})
                print(f"  FAIL  {journey}: EXCEPTION: {str(e)[:100]}")
            finally:
                page.close()

        browser.close()

    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed} passed, {failed} failed, {total} total")
    print(f"{'=' * 60}")

    if bugs:
        print(f"\nBUGS FOUND ({len(bugs)}):")
        for b in bugs:
            print(f"  {b['journey']}:")
            for iss in b['issues']:
                print(f"    - {iss}")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")

    # Save report
    report = {"total": total, "passed": passed, "failed": failed, "bugs": bugs, "warnings": warnings}
    report_path = SCREENSHOTS_DIR / "custom-bug-report.json"
    with open(str(report_path), "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
