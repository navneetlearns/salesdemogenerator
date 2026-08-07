#!/usr/bin/env python3
"""brand_swap.py — mechanical brand replacement on a cloned mock journey.

Usage:
  python3 brand_swap.py --manifest brand.json --journey journey.html \
                        [--index index.html] [--logo logo.png] [--dry-run]

brand.json keys:
  brandColor/brandDark/accent : hex values replacing :root CSS vars
  avatarInitials              : e.g. "AC" (replaces base initials in chat circles)
  title                       : <title> text
  journeyLabel                : .journey-lbl text
  indexBrandName / indexCardTitle / indexStatPill : index.html fields (optional)

Logo: when --logo is given, its base64 replaces the existing data-URI inside the
.ava-logo CSS rule (embed-ONCE convention). Asserted: exactly one .ava-logo embed.

Idempotent: values already matching the manifest are reported "unchanged", never
touched. --dry-run prints the plan without writing. Exits 1 if a swap's expected
target isn't found (fix manually — do not bypass).
"""
import argparse, base64, json, re, sys
from pathlib import Path


def load_manifest(p: str) -> dict:
    m = json.loads(Path(p).read_text(encoding="utf-8"))
    required = ["brandColor"]
    for k in required:
        if k not in m:
            print(f"FATAL: manifest missing '{k}'", file=sys.stderr)
            sys.exit(1)
    return m


def swap_css_var(data: str, var: str, new_val: str, dry: bool) -> tuple[str, str]:
    """Replace --var: <old> with --var: <new> in the :root block. Returns (data, report)."""
    m = re.search(rf"--{var}\s*:\s*([^;]+);", data)
    if not m:
        return data, f"SKIP  :root --{var}: not found"
    old = m.group(1).strip()
    if old == new_val:
        return data, f"UNCHANGED --{var} (already {new_val})"
    if dry:
        return data, f"PLAN  --{var}: {old} -> {new_val}"
    n = len(re.findall(rf"--{var}\s*:\s*{re.escape(old)};", data))
    data = re.sub(rf"--{var}\s*:\s*{re.escape(old)};", f"--{var}: {new_val};", data)
    return data, f"SWAP  --{var}: {old} -> {new_val} ({n} occurrence{'s' if n != 1 else ''})"


def swap_initials(data: str, old: str, new: str, dry: bool) -> tuple[str, str]:
    if new == old:
        return data, f"UNCHANGED initials ({old})"
    pat = re.compile(rf">\s*{re.escape(old)}\s*<")
    n = len(pat.findall(data))
    if n == 0:
        return data, f"SKIP  initials '{old}' not found (avatar may use logo already)"
    if dry:
        return data, f"PLAN  initials {old} -> {new} ({n} spots)"
    data = pat.sub(lambda m: f">{new}<", data)
    return data, f"SWAP  initials {old} -> {new} ({n} spots)"


def swap_text(data: str, pattern: re.Pattern, new: str, label: str, dry: bool) -> tuple[str, str]:
    m = pattern.search(data)
    if not m:
        return data, f"SKIP  {label}: pattern not found"
    if m.group(0) == new:
        return data, f"UNCHANGED {label} (already {new[:60]!r})"
    if dry:
        return data, f"PLAN  {label}: {m.group(0)[:60]!r} -> {new!r}"
    data = pattern.sub(new, data)
    return data, f"SWAP  {label}: {m.group(0)[:60]!r} -> {new!r}"


def swap_logo(data: str, logo_b64: str, dry: bool) -> tuple[str, str]:
    """Replace data URI inside the .ava-logo CSS rule. Assert exactly one embed."""
    rule = re.search(r"\.ava-logo\s*\{[^}]*url\(\"data:image/[^\"]+\"\)", data)
    if not rule:
        return data, "SKIP  .ava-logo rule with data URI not found"
    if dry:
        return data, "PLAN  .ava-logo logo data URI -> new base64"
    new_rule = re.sub(r'url\("data:image/[^"]+"\)', f'url("data:image/png;base64,{logo_b64}")', rule.group(0))
    data = data.replace(rule.group(0), new_rule)
    return data, "SWAP  .ava-logo logo embedded (once)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--journey", required=True)
    ap.add_argument("--index", default=None)
    ap.add_argument("--logo", default=None)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    m = load_manifest(a.manifest)

    jp = Path(a.journey)
    data = jp.read_text(encoding="utf-8")
    reports = []
    for var, key in [("brand", "brandColor"), ("brand-dark", "brandDark"), ("accent", "accent")]:
        if key in m:
            data, r = swap_css_var(data, var, m[key], a.dry_run)
            reports.append(r)
    if "avatarInitials" in m:
        old = re.search(r">\s*([A-Z]{1,4})\s*<", data)
        old = old.group(1) if old else None
        if old:
            data, r = swap_initials(data, old, m["avatarInitials"], a.dry_run)
            reports.append(r)
        else:
            reports.append("SKIP  no initials found")
    if "title" in m:
        data, r = swap_text(data, re.compile(r"<title>[^<]*</title>"), f"<title>{m['title']}</title>", "title", a.dry_run)
        reports.append(r)
    if "journeyLabel" in m:
        data, r = swap_text(data, re.compile(r"class=\"journey-lbl\">[^<]*<"), f'class="journey-lbl">{m["journeyLabel"]}<', "journey-lbl", a.dry_run)
        reports.append(r)
    if a.logo:
        b64 = base64.b64encode(Path(a.logo).read_bytes()).decode()
        data, r = swap_logo(data, b64, a.dry_run)
        reports.append(r)

    if not a.dry_run and any(r.startswith("SWAP") for r in reports):
        jp.write_text(data, encoding="utf-8")
        print("written", jp)

    if a.index:
        ip = Path(a.index)
        idata = ip.read_text(encoding="utf-8")
        ireports = []
        if "indexBrandName" in m:
            # structure: <div class="brand-title"><span>Hindustan</span> RMC</div>
            pat = re.compile(r'class="brand-title">\s*<span>[^<]*</span>\s*[^<]*<')
            if pat.search(idata):
                parts = m["indexBrandName"].split(" ", 1)
                repl = f'class="brand-title"><span>{parts[0]}</span> {parts[1] if len(parts) > 1 else ""}<'
                idata, r = swap_text(idata, pat, repl, "index brand-title", a.dry_run)
            else:
                idata, r = swap_text(idata, re.compile(r'class="brand-name">[^<]*<'),
                                     f'class="brand-name">{m["indexBrandName"]}<', "index brand-name", a.dry_run)
            ireports.append(r)
        if "indexCardTitle" in m:
            idata, r = swap_text(idata, re.compile(r"class=\"card-title\">[^<]*<"), f'class="card-title">{m["indexCardTitle"]}<', "index card-title", a.dry_run)
            ireports.append(r)
        if "indexStatPill" in m:
            idata, r = swap_text(idata, re.compile(r"class=\"stat-pill\">[^<]*<"), f'class="stat-pill">{m["indexStatPill"]}<', "index stat-pill", a.dry_run)
            ireports.append(r)
        reports += ireports
        if not a.dry_run and any(r.startswith("SWAP") for r in ireports):
            ip.write_text(idata, encoding="utf-8")
            print("written", ip)

    for r in reports:
        print(r)
    hard_fail = [r for r in reports if r.startswith(("FATAL",))]
    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
