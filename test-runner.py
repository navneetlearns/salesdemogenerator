#!/usr/bin/env python3
"""
MANDATORY VISUAL DIFF TEST RUNNER
Run after EVERY fix before committing.
Usage: python3 test-runner.py [--baseline] [--url URL]

Modes:
  (default)  — Run tests + visual diff against saved baselines
  --baseline — Generate/save new baselines (first time or after intentional changes)
"""
import os, sys, subprocess
from pathlib import Path

BASE = Path("/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator")
URL = os.environ.get("TEST_URL", "https://161464ec.demo-generator-482.pages.dev")


def run_test(script, env_extra=None):
    """Run a test script and return (success, output)."""
    env = os.environ.copy()
    env["TEST_URL"] = URL
    if env_extra:
        env.update(env_extra)

    result = subprocess.run(
        [sys.executable, str(BASE / script)],
        env=env,
        capture_output=True,
        text=True,
        timeout=300
    )
    return result.returncode == 0, result.stdout + result.stderr


def main():
    baseline_mode = "--baseline" in sys.argv

    print("=" * 60)
    print("DEMO GENERATOR — VISUAL DIFF TEST SUITE")
    print(f"URL: {URL}")
    print(f"Mode: {'BASELINE GENERATION' if baseline_mode else 'VISUAL DIFF COMPARISON'}")
    print("=" * 60)

    results = []

    # Test 1: Unit tests
    print("\n--- Unit Tests ---")
    ok, output = run_test("test/test_runner.js" if False else None)
    # Use node directly
    r = subprocess.run(
        ["/mnt/c/Program Files/nodejs/node.exe", "--test", "test/*.test.js"],
        cwd=str(BASE),
        capture_output=True, text=True, timeout=120
    )
    unit_ok = r.returncode == 0
    # Count pass/fail from output
    lines = r.stdout.split('\n')
    for line in lines:
        if '# pass' in line or '# fail' in line:
            print(f"  {line.strip()}")
    results.append(("Unit Tests", unit_ok))

    # Test 2: Static page visual tests
    print("\n--- Static Page Visual Tests ---")
    ok, output = run_test("test-visual.py")
    # Print last few lines
    for line in output.strip().split('\n')[-5:]:
        print(f"  {line}")
    results.append(("Static Pages", ok))

    # Test 3: Custom demo visual tests
    print("\n--- Custom Demo Visual Tests ---")
    env = {}
    if baseline_mode:
        env["CREATE_BASELINE"] = "1"
    ok, output = run_test("test-custom-demo.py", env)
    for line in output.strip().split('\n')[-10:]:
        print(f"  {line}")
    results.append(("Custom Demos", ok))

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    all_pass = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        icon = "✅" if passed else "❌"
        print(f"  {icon} {name}: {status}")
        if not passed:
            all_pass = False

    print()
    if all_pass:
        print("ALL TESTS PASSED — safe to commit")
    else:
        print("TESTS FAILED — fix issues before committing")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
