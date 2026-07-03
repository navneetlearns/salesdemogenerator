#!/usr/bin/env python3
"""TDD tests for migration/scripts/extract_content.py.

Validates the HTML->journey-JSON extractor against a known-good fixture
(jkcement/jk_cement_order_to_cash.html — already cross-referenced by
_inspect_structure.py: 11 steps, screen-lbl/screen-desc/phone-frame/msg-body
selectors). Catches selector regressions before scaling to all 84 HTMLs.

Uses stdlib unittest (no pytest dependency — project keeps migration scripts
pure-stdlib for zero-friction runs).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from extract_content import extract_content

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator/migration/projects"
JK_OTC = f"{BASE}/jkcement/jk_cement_order_to_cash.html"
ORIENT_OTC = f"{BASE}/Orient/journey_order_to_cash.html"


class StepShapeTests(unittest.TestCase):
    def test_step_count_matches_known(self):
        """Inspector found 11 step-section divs in jkcement OTC."""
        result = extract_content(JK_OTC)
        self.assertIsInstance(result.get("steps"), list)
        self.assertEqual(
            len(result["steps"]),
            11,
            f"want 11 steps, got {len(result['steps'])}",
        )

    def test_step_shape_matches_demo_generator_schema(self):
        """Each step must expose {num, title, description, screens[]}."""
        result = extract_content(JK_OTC)
        for s in result["steps"]:
            self.assertTrue(
                set(s.keys()) >= {"num", "title", "description", "screens"},
                f"step missing required keys: {s}",
            )
            self.assertIsInstance(s["screens"], list, f"screens not a list: {s}")
            self.assertIsInstance(s["title"], str, f"title not str: {s}")
            self.assertTrue(s["title"].strip(), f"empty title: {s}")
            self.assertIsInstance(s["num"], int, f"num not int: {s}")

    def test_screen_shape_has_type_and_data(self):
        """Each screen must expose {type, data}."""
        result = extract_content(JK_OTC)
        for s in result["steps"]:
            for screen in s["screens"]:
                self.assertIn("type", screen, f"missing screen.type: {screen}")
                self.assertIn("data", screen, f"missing screen.data: {screen}")
                self.assertIsInstance(screen["type"], str, screen)


class MessagesObjectTests(unittest.TestCase):
    def test_messages_object_has_welcome(self):
        result = extract_content(JK_OTC)
        msgs = result.get("messages")
        self.assertIsInstance(msgs, dict, f"messages not a dict: {type(msgs)}")
        self.assertIn("welcome", msgs, "missing welcome message")
        self.assertIsInstance(msgs["welcome"], dict, msgs["welcome"])


class CrossIndustryTests(unittest.TestCase):
    def test_works_on_industrial_brand_orient(self):
        """Cross-industry selector check — Orient Electric uses the same DOM
        convention but different brand context. Catches brittle jkcement-only
        assumptions early."""
        if not os.path.exists(ORIENT_OTC):
            self.skipTest(f"{ORIENT_OTC} not present")
        result = extract_content(ORIENT_OTC)
        self.assertGreaterEqual(len(result["steps"]), 1)
        self.assertIn("messages", result)


if __name__ == "__main__":
    unittest.main(verbosity=2)