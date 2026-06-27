#!/usr/bin/env python3
"""Visual regression test for all demo-generator journeys.
Captures screenshots, checks for undefined text, broken images,
unresolved Handlebars, and layout issues."""

import os, sys, json, time, hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_URL", "https://8e788329.demo-generator-482.pages.dev")
SCREENSHOTS_DIR = Path("/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/test-screenshots")
BRANDS = ["haldirams", "jk_cement", "sundaram_store"]
JOURNEYS_PER_BRAND = {
    "haldirams": [
        "order_to_cash", "field_ops_expense", "automated_collections",
        "dealer_engagement", "retailer_onboarding", "retailer_loyalty",
        "campaigns_queries", "dt_fulfillment_payment", "retailer_activation",
        "post_order_communication"
    ],
    "jk_cement": [
        "order_to_cash", "field_ops_expense", "automated_collections",
        "dealer_engagement", "retailer_onboarding", "retailer_loyalty",
        "campaigns_queries", "dt_fulfillment_payment", "retailer_activation",
        "post_order_communication"
    ],
    "sundaram_store": [
        "order_to_cash", "field_ops_expense", "automated_collections",
        "dealer_engagement", "retailer_onboarding", "retailer_loyalty",
        "campaigns_queries", "dt_fulfillment_payment", "retailer_activation",
        "post_order_communication"
    ],
}

bugs = []
warnings = []


def check_page(page, brand, journey, screenshot_path):
    """Run all checks on a loaded page."""
    issues = []

    # 1. Check for "undefined" text
    undefined_els = page.query_selector_all("text=/\\bundefined\\b/")
    if undefined_els:
        for el in undefined_els[:3]:
            txt = el.inner_text()[:80]
            issues.append(f"UNDEFINED_TEXT: '{txt}'")
            bugs.append({"brand": brand, "journey": journey, "type": "undefined_text", "detail": txt})

    # 2. Check for unresolved Handlebars expressions {{...}}
    html = page.content()
    import re
    hb_matches = re.findall(r'\{\{[^}]+\}\}', html)
    # Filter out known-safe patterns
    hb_real = [m for m in hb_matches if not m.startswith('{{!--') and not m.startswith('{{!')]
    if hb_real:
        for m in hb_real[:3]:
            issues.append(f"UNRESOLVED_HANDLEBARS: {m}")
            bugs.append({"brand": brand, "journey": journey, "type": "handlebars", "detail": m})

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
        bugs.append({"brand": brand, "journey": journey, "type": "broken_image", "detail": img_url})

    # 4. Check for horizontal scroll (layout issue)
    has_hscroll = page.evaluate("""() => {
        return document.body.scrollWidth > document.body.clientWidth + 5;
    }""")
    if has_hscroll:
        issues.append("HORIZONTAL_SCROLL detected")
        bugs.append({"brand": brand, "journey": journey, "type": "horizontal_scroll"})

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
        bugs.append({"brand": brand, "journey": journey, "type": "empty_step", "detail": step})

    # 6. Check page title
    title = page.title()
    if not title or title == "Untitled":
        issues.append(f"MISSING_TITLE: '{title}'")
        bugs.append({"brand": brand, "journey": journey, "type": "missing_title"})

    # 7. Check for console errors
    # (captured via page.on('console') in main loop)

    return issues


def run_tests():
    SCREENSHOTS_DIR.mkdir(exist_ok=True)
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})

        total = sum(len(v) for v in JOURNEYS_PER_BRAND.values())
        done = 0
        passed = 0
        failed = 0

        for brand in BRANDS:
            journeys = JOURNEYS_PER_BRAND[brand]
            brand_dir = SCREENSHOTS_DIR / brand
            brand_dir.mkdir(exist_ok=True)

            # Test brand hub page
            page = context.new_page()
            console_errors.clear()
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

            hub_url = f"{BASE_URL}/{brand}/"
            try:
                page.goto(hub_url, wait_until="load", timeout=15000)
                page.wait_for_timeout(2000)
                page.screenshot(path=str(brand_dir / "_hub.png"), full_page=True)
                done += 1

                # Check hub for issues
                hub_issues = check_page(page, brand, "hub", brand_dir / "_hub.png")
                if console_errors:
                    for err in console_errors[:3]:
                        hub_issues.append(f"CONSOLE_ERROR: {err[:100]}")
                        bugs.append({"brand": brand, "journey": "hub", "type": "console_error", "detail": err[:100]})

                if hub_issues:
                    failed += 1
                    print(f"  ❌ {brand}/hub: {len(hub_issues)} issues")
                    for iss in hub_issues:
                        print(f"     - {iss}")
                else:
                    passed += 1
                    print(f"  ✅ {brand}/hub: OK")
            except Exception as e:
                failed += 1
                bugs.append({"brand": brand, "journey": "hub", "type": "load_error", "detail": str(e)[:100]})
                print(f"  ❌ {brand}/hub: LOAD ERROR: {e}")
            finally:
                page.close()

            # Test each journey page
            for journey in journeys:
                page = context.new_page()
                console_errors.clear()
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

                journey_url = f"{BASE_URL}/{brand}/{journey}.html"
                done += 1
                try:
                    page.goto(journey_url, wait_until="load", timeout=15000)
                    page.wait_for_timeout(3000)  # Wait for rendering

                    screenshot_path = brand_dir / f"{journey}.png"
                    page.screenshot(path=str(screenshot_path), full_page=True)

                    issues = check_page(page, brand, journey, screenshot_path)

                    # Check for console errors
                    if console_errors:
                        for err in console_errors[:3]:
                            issues.append(f"CONSOLE_ERROR: {err[:100]}")
                            bugs.append({"brand": brand, "journey": journey, "type": "console_error", "detail": err[:100]})

                    if issues:
                        failed += 1
                        print(f"  ❌ {brand}/{journey}: {len(issues)} issues")
                        for iss in issues:
                            print(f"     - {iss}")
                    else:
                        passed += 1
                        print(f"  ✅ {brand}/{journey}: OK")

                except Exception as e:
                    failed += 1
                    bugs.append({"brand": brand, "journey": journey, "type": "load_error", "detail": str(e)[:100]})
                    print(f"  ❌ {brand}/{journey}: LOAD ERROR: {e}")
                finally:
                    page.close()

        browser.close()

    print(f"\n{'='*60}")
    print(f"RESULTS: {passed} passed, {failed} failed, {total + len(BRANDS)} total")
    print(f"{'='*60}")

    if bugs:
        print(f"\nBUGS FOUND ({len(bugs)}):")
        for b in bugs:
            print(f"  [{b['type']}] {b['brand']}/{b['journey']}: {b.get('detail', '')}")

    # Save bug report
    report_path = SCREENSHOTS_DIR / "bug-report.json"
    with open(str(report_path), "w") as f:
        json.dump({"total": total + len(BRANDS), "passed": passed, "failed": failed, "bugs": bugs}, f, indent=2)
    print(f"\nBug report saved to: {report_path}")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
