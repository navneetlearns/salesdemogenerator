#!/usr/bin/env python3
"""TDD tests for migration/scripts/extract_brand_metadata.py — Phase 4."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from extract_brand_metadata import extract_brand_metadata

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/projects"
JK_OTC = f"{BASE}/jkcement/jk_cement_order_to_cash.html"


class BrandMetadataTests(unittest.TestCase):
    def test_brand_has_required_keys(self):
        r = extract_brand_metadata(JK_OTC, "jkcement")
        for k in ("slug", "name", "industry", "colors", "font", "dealer_store_name", "secondary_dealers", "assets"):
            self.assertIn(k, r, f"missing key {k}")

    def test_colors_is_dict_with_brand(self):
        r = extract_brand_metadata(JK_OTC, "jkcement")
        self.assertIsInstance(r["colors"], dict)
        self.assertTrue(any("brand" in k for k in r["colors"]), f"no brand color: {r['colors']}")

    def test_name_is_cleaned_not_empty(self):
        r = extract_brand_metadata(JK_OTC, "jkcement")
        self.assertIsInstance(r["name"], str)
        self.assertTrue(r["name"].strip(), "name is empty")
        # Should not contain the journey suffix
        self.assertNotIn("Collections", r["name"])

    def test_industry_is_classified(self):
        r = extract_brand_metadata(JK_OTC, "jkcement")
        self.assertEqual(r["industry"], "cement")

    def test_slug_from_project_dir(self):
        r = extract_brand_metadata(JK_OTC, "jkcement")
        self.assertEqual(r["slug"], "jkcement")

    def test_works_on_industrial_brand(self):
        path = f"{BASE}/BlueOcean/journey_sales_to_cash.html"
        if not os.path.exists(path):
            self.skipTest(path)
        r = extract_brand_metadata(path, "BlueOcean")
        self.assertIn(r["industry"], ("industrial", "general"))
        self.assertTrue(r["name"].strip())


if __name__ == "__main__":
    unittest.main(verbosity=2)