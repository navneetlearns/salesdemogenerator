#!/usr/bin/env python3
"""Test custom demo generation flow via Playwright.
Tests the ACTUAL wizard → generate → preview pipeline."""

import os, sys, json, time, re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_URL", "https://73a9de7a.demo-generator-482.pages.dev")
SCREENSHOTS_DIR = Path("/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/test-screenshots/custom")
JOURNEYS = [
    "order_to_cash", "field_ops_expense", "automated_collections",
    "dealer_engagement", "retailer_onboarding", "retailer_loyalty",
    "campaigns_queries", "dt_fulfillment_payment", "retailer_activation",
    "post_order_communication"
]

bugs = []


def test_custom_demo(page, journey_type, screenshot_path):
    """Fill wizard, generate demo, check preview iframe for issues."""
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
        issues.append("WIZARD: brandNameInput not found")

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

    # Fill product name
    product_name = page.locator(".product-name-input").first
    if product_name.count() > 0:
        product_name.fill("Test Product 53")

    # Fill product price
    product_price = page.locator(".product-price-input").first
    if product_price.count() > 0:
        product_price.fill("420")

    # Click Next to Step 3
    next_btn = page.locator("#nextStepBtn")
    if next_btn.count() > 0 and next_btn.is_visible():
        next_btn.click()
        page.wait_for_timeout(500)

    # Step 3: Select journey type
    journey_checkbox = page.locator(f"input[value='{journey_type}']")
    if journey_checkbox.count() > 0:
        # Uncheck all first
        all_checks = page.locator(".journey-cards-grid input[type='checkbox']")
        for i in range(all_checks.count()):
            cb = all_checks.nth(i)
            if cb.is_checked():
                cb.uncheck()
        # Check only our target journey
        journey_checkbox.check()
    else:
        issues.append(f"WIZARD: journey checkbox for {journey_type} not found")

    # Click Generate
    generate_btn = page.locator("button:has-text('Generate Demo')")
    if generate_btn.count() > 0 and generate_btn.is_visible():
        generate_btn.click()
    else:
        # Try alternative selector
        generate_btn = page.locator("#generateBtn")
        if generate_btn.count() > 0 and generate_btn.is_visible():
            generate_btn.click()
        else:
            issues.append("WIZARD: Generate button not found")
            return issues

    # Wait for generation to complete
    page.wait_for_timeout(8000)

    # Check if preview iframe is visible
    preview_area = page.locator("#previewArea")
    if preview_area.count() > 0 and preview_area.is_visible():
        # Check the iframe content
        iframe = page.locator("#previewIframe")
        if iframe.count() > 0:
            # Get iframe content via src URL
            src = iframe.get_attribute("src")
            if src and src.startswith("blob:"):
                # Can't directly access blob URL content, check via page
                pass

            # Take screenshot of the full page (includes preview)
            page.screenshot(path=str(screenshot_path), full_page=True)

            # Check for visible errors in the page
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
            issues.append("PREVIEW: iframe not found")
    else:
        # Check for error messages
        error_el = page.locator("#wizardError")
        if error_el.count() > 0 and error_el.is_visible():
            err_text = error_el.inner_text()
            issues.append(f"WIZARD_ERROR: {err_text[:200]}")
        else:
            issues.append("PREVIEW: previewArea not visible after generate")
            page.screenshot(path=str(screenshot_path), full_page=True)

    # Check console errors
    for err in console_errors:
        if "Failed to load resource" not in err:  # Skip 404s for assets
            issues.append(f"CONSOLE: {err[:150]}")

    return issues


def test_share_flow(page, screenshot_path):
    """Test the share link creation flow."""
    issues = []

    # After generating, try to create share link
    share_btn = page.locator("#createShareLinkBtn")
    if share_btn.count() > 0 and share_btn.is_visible():
        share_btn.click()
        page.wait_for_timeout(5000)

        # Check share status
        share_status = page.locator("#shareStatus")
        if share_status.count() > 0 and share_status.is_visible():
            status_text = share_status.inner_text()
            if "error" in status_text.lower() or "fail" in status_text.lower():
                issues.append(f"SHARE_ERROR: {status_text[:200]}")
            elif "http" in status_text.lower():
                pass  # Share link created successfully
        else:
            issues.append("SHARE: shareStatus not visible after click")
    else:
        issues.append("SHARE: createShareLinkBtn not found or not visible")

    return issues


def run_tests():
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    passed = 0
    failed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})

        # Test each journey type
        for journey in JOURNEYS:
            total += 1
            page = context.new_page()
            screenshot_path = SCREENSHOTS_DIR / f"{journey}.png"

            try:
                issues = test_custom_demo(page, journey, screenshot_path)

                # Also test share flow on first successful journey
                if not issues and journey == "order_to_cash":
                    share_issues = test_share_flow(page, screenshot_path)
                    issues.extend(share_issues)

                if issues:
                    failed += 1
                    bugs.append({"journey": journey, "issues": issues})
                    print(f"  ❌ {journey}: {len(issues)} issues")
                    for iss in issues:
                        print(f"     - {iss}")
                else:
                    passed += 1
                    print(f"  ✅ {journey}: OK")

            except Exception as e:
                failed += 1
                bugs.append({"journey": journey, "issues": [f"EXCEPTION: {str(e)[:200]}"]})
                print(f"  ❌ {journey}: EXCEPTION: {e}")
                try:
                    page.screenshot(path=str(screenshot_path), full_page=True)
                except:
                    pass
            finally:
                page.close()

        # Also test multi-journey generation
        total += 1
        page = context.new_page()
        try:
            page.goto(BASE_URL + "/", wait_until="load", timeout=15000)
            page.wait_for_timeout(2000)

            # Fill wizard
            brand_input = page.locator("#brandNameInput")
            if brand_input.count() > 0:
                brand_input.fill("MultiTest")

            industry_select = page.locator("#industryInput")
            if industry_select.count() > 0:
                industry_select.select_option("Cement")

            # Go to step 1 → 2
            next_btn = page.locator("#nextStepBtn")
            if next_btn.count() > 0 and next_btn.is_visible():
                next_btn.click()
                page.wait_for_timeout(500)

            # Add product
            add_product_btn = page.locator("#addProductBtn")
            if add_product_btn.count() > 0 and add_product_btn.is_visible():
                add_product_btn.click()
                page.wait_for_timeout(500)
                product_name = page.locator(".product-name-input").first
                if product_name.count() > 0:
                    product_name.fill("Cement OPC 53")
                product_price = page.locator(".product-price-input").first
                if product_price.count() > 0:
                    product_price.fill("400")

            # Go to step 2 → 3
            next_btn = page.locator("#nextStepBtn")
            if next_btn.count() > 0 and next_btn.is_visible():
                next_btn.click()
                page.wait_for_timeout(500)

            # Select multiple journeys
            checks = page.locator(".journey-cards-grid input[type='checkbox']")
            for i in range(min(3, checks.count())):
                checks.nth(i).check()

            # Generate
            generate_btn = page.locator("button:has-text('Generate Demo')")
            if generate_btn.count() > 0 and generate_btn.is_visible():
                generate_btn.click()
                page.wait_for_timeout(10000)

            # Check result
            preview_area = page.locator("#previewArea")
            if preview_area.count() > 0 and preview_area.is_visible():
                passed += 1
                page.screenshot(path=str(SCREENSHOTS_DIR / "multi_journey.png"), full_page=True)
                print(f"  ✅ multi-journey (3 journeys): OK")
            else:
                failed += 1
                error_el = page.locator("#wizardError")
                err = error_el.inner_text() if error_el.count() > 0 and error_el.is_visible() else "unknown"
                bugs.append({"journey": "multi-journey", "issues": [f"Preview not visible: {err[:200]}"]})
                print(f"  ❌ multi-journey: Preview not visible")
                page.screenshot(path=str(SCREENSHOTS_DIR / "multi_journey.png"), full_page=True)

        except Exception as e:
            failed += 1
            bugs.append({"journey": "multi-journey", "issues": [f"EXCEPTION: {str(e)[:200]}"]})
            print(f"  ❌ multi-journey: EXCEPTION: {e}")
        finally:
            page.close()

        browser.close()

    print(f"\n{'='*60}")
    print(f"CUSTOM DEMO RESULTS: {passed} passed, {failed} failed, {total} total")
    print(f"{'='*60}")

    if bugs:
        print(f"\nBUGS FOUND ({sum(len(b['issues']) for b in bugs)}):")
        for b in bugs:
            print(f"\n  {b['journey']}:")
            for iss in b["issues"]:
                print(f"    - {iss}")

    report_path = SCREENSHOTS_DIR / "custom-bug-report.json"
    with open(str(report_path), "w") as f:
        json.dump({"total": total, "passed": passed, "failed": failed, "bugs": bugs}, f, indent=2)
    print(f"\nBug report: {report_path}")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
