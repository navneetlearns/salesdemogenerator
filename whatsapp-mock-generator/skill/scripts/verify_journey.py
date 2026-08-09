#!/usr/bin/env python3
"""verify_journey.py — render + structure + compliance gate for mock journeys.

Usage:
  python3 verify_journey.py <journey.html> [--probes '{"1": ["brand name", "CON-..."]}']
                             [--steps N] [--shots DIR] [--expected-steps N]

Checks (ALL must pass; exit 0 only when everything does):
  A. Structure : '<!DOCTYPE' at byte 0 AND '<meta charset' before byte 200
                 (charset/header-order bug — mojibake guard)
  B. Render    : document.characterSet == 'UTF-8'; every step-item clicks without
                 console/page errors; step count matches --expected-steps (or probe max)
  C. Content   : per-step text probes found in that step's innerText
  D. Compliance: source greps — no <hr>, no 4+ divider runs (━━/────/====), no
                 consecutive template variables {{1}}{{2}}, no '&amp;nbsp;' leaks
  E. Screens   : screenshot per step into --shots for the human visual pass
  F. Brand pack: when assets/brand/brand.json sits next to the journey — manifest
                 parses, website + industry set, logo file exists, product images ok

Exit codes: 0 = gate passed, 1 = a check failed (named in stderr), 2 = usage error.
"""
import argparse, json, re, sys
from pathlib import Path


def check_structure(path: Path) -> list:
    data = path.read_text(encoding="utf-8")
    out = []
    out.append(("A1 doctype at byte 0", data.find("<!DOCTYPE") == 0))
    out.append(("A2 charset meta before byte 200", data.find("<meta charset") < 200 and data.find("<meta charset") >= 0))
    out.append(("A3 ends with </html>", data.rstrip().endswith("</html>")))
    return out


def check_compliance(path: Path) -> list:
    data = path.read_text(encoding="utf-8")
    body = re.sub(r"<script.*?</script>", " ", data, flags=re.S)
    out = [
        ("D1 no <hr> tags", "<hr" not in body),
        ("D2 no divider runs (4+)", not re.search(r"[━─=]{4,}|-{4,}", body)),
        ("D3 no consecutive variables {{1}}{{2}}", "{{1}}{{2}}" not in body),
        ("D4 no double-escaped entities (&amp;nbsp;)", "&amp;nbsp;" not in body and "&amp;amp;" not in body),
        ("D5 no unresolved ${} placeholders", not re.search(r"\$\{[A-Za-z_]", body)),
    ]
    return out


def check_brand_assets(path: Path):
    """Brand-pack checks for MCP-built journeys. Returns (results, present):
    present=False means no manifest next to the journey (not a built project)."""
    manifest_path = path.parent / "assets" / "brand" / "brand.json"
    if not manifest_path.exists():
        return [], False
    try:
        m = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return [("F1 brand manifest parses", False)], True
    out = [("F1 brand manifest parses", True)]
    out.append(("F2 website in manifest", bool(m.get("website"))))
    ind = m.get("industry") or {}
    out.append(("F3 industry profile set", bool(ind.get("id"))))
    logo = m.get("logo") or {}
    if logo.get("file"):
        out.append(("F4 logo file exists", (manifest_path.parent / logo["file"]).exists()))
    else:
        out.append(("F4 logo file exists", True))
    prods = m.get("products") or []
    if prods:
        out.append(("F5 product images downloaded", not any(p.get("error") for p in prods)))
    else:
        out.append(("F5 product images downloaded", True))
    return out, True


def run(html: str, probes: dict, expected_steps: int, shots: str | None) -> int:
    from playwright.async_api import async_playwright
    import asyncio

    path = Path(html).resolve()
    if not path.exists():
        print(f"FATAL: {html} not found", file=sys.stderr)
        return 2
    results = check_structure(path) + check_compliance(path)
    asset_checks, has_manifest = check_brand_assets(path)
    if has_manifest:
        results += asset_checks

    async def render_checks():
        errs = []
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("console", lambda m: errs.append(f"console:{m.type}:{m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errs.append(f"pageerror:{e}"))
            await page.goto(path.as_uri(), wait_until="networkidle")
            await page.wait_for_timeout(600)
            results.append(("B1 charset is UTF-8", await page.evaluate("document.characterSet") == "UTF-8"))
            n = await page.evaluate("document.querySelectorAll('.step-item').length")
            results.append((f"B2 step count == {expected_steps}", n == expected_steps))
            # navigate every step
            nav_ok = True
            for i in range(1, n + 1):
                await page.evaluate(
                    "(() => { const el = document.querySelectorAll('.step-item')[" + str(i - 1) + "]; if (el) el.click(); })()"
                )
                await page.wait_for_timeout(250)
                exists = await page.evaluate(
                    "document.getElementById('step-" + str(i) + "') !== null"
                )
                if not exists:
                    nav_ok = False
                    print(f"  step {i}: container missing", file=sys.stderr)
            results.append(("B3 all steps navigate", nav_ok))
            # probes
            for step, texts in probes.items():
                for t in texts:
                    found = await page.evaluate(
                        "document.getElementById('step-" + str(step) + "').innerText.includes("
                        + json.dumps(t) + ")"
                    )
                    results.append((f"C step {step} contains {t!r}", found))
            # screenshots
            if shots:
                outdir = Path(shots)
                outdir.mkdir(parents=True, exist_ok=True)
                for i in range(1, n + 1):
                    await page.evaluate(
                        "(() => { const el = document.querySelectorAll('.step-item')[" + str(i - 1) + "]; if (el) el.click(); })()"
                    )
                    await page.wait_for_timeout(250)
                    await page.screenshot(path=str(outdir / f"step-{i:02d}.png"))
            await browser.close()
        results.append(("B4 zero console/page errors", len(errs) == 0))
        if errs:
            for e in errs[:5]:
                print(f"  error: {e}", file=sys.stderr)

    import asyncio
    asyncio.run(render_checks())

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("FAILED:", ", ".join(failed), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--probes", default="{}", help='JSON: {"stepN": ["text", ...]}')
    ap.add_argument("--expected-steps", type=int, default=None)
    ap.add_argument("--shots", default=None)
    a = ap.parse_args()
    probes = json.loads(a.probes)
    exp = a.expected_steps or max([int(s) for s in probes] + [1])
    sys.exit(run(a.html, probes, exp, a.shots))
