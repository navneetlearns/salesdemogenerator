#!/usr/bin/env python3
"""
cleanup_nav_js.py — Remove dead JS references left over after navigation changes.

After wire_journey_nav.py is run and then nav logic is later refactored, dead
variable declarations and dead if-statements referencing removed DOM IDs can
be left behind. This script strips them cleanly.

Currently removes:
    - const mobMenuBtn = document.getElementById('mob-menu-btn');
    - if(mobMenuBtn) mobMenuBtn.style.display = ...;
    - const deskMenuBtn = document.getElementById('desk-menu-btn');
    - if(deskMenuBtn) deskMenuBtn.style.display = ...;

Usage:
    python3 scripts/cleanup_nav_js.py --project projects/ClientName
    python3 scripts/cleanup_nav_js.py --file projects/ClientName/journey_foo.html

Arguments:
    --project   Path to client project directory — cleans all journey_*.html files (mutually exclusive with --file)
    --file      Single journey HTML file to clean (mutually exclusive with --project)
    --dry-run   Print changes without writing
    --pattern   Comma-separated list of dead ID names to remove (default: mob-menu-btn,desk-menu-btn)
"""

import argparse
import glob
import os
import sys

DEFAULT_PATTERNS = [
    'mob-menu-btn',
    'desk-menu-btn',
]


def build_dead_lines(dead_id):
    var_name = dead_id.replace('-', '') + 'Btn'
    # e.g. mob-menu-btn → mobmenubtnBtn — use camelCase instead
    parts = dead_id.split('-')
    var_name = parts[0] + ''.join(p.capitalize() for p in parts[1:]) + 'Btn'
    return [
        f"  const {var_name} = document.getElementById('{dead_id}');\n",
        f"  if({var_name}) {var_name}.style.display = isLastSlide ? '' : 'none';\n",
        f"  if({var_name}) {var_name}.style.display = atEnd ? '' : 'none';\n",
    ]


def clean_file(fpath, dead_ids, dry_run=False):
    fname = os.path.basename(fpath)
    with open(fpath) as f:
        html = f.read()

    original_len = len(html)
    removed = []

    for dead_id in dead_ids:
        for line in build_dead_lines(dead_id):
            if line in html:
                html = html.replace(line, '', 1)
                removed.append(line.strip())

    remaining = sum(html.count(f"'{did}'") for did in dead_ids)
    status = f'removed {len(removed)} lines, {remaining} remaining refs'
    print(f'  [{fname}] {status}')
    if removed:
        for r in removed:
            print(f'    - {r}')

    if not dry_run and removed:
        with open(fpath, 'w') as f:
            f.write(html)
        print(f'  [{fname}] saved ({original_len:,} → {len(html):,} bytes)')

    return bool(removed)


def main():
    parser = argparse.ArgumentParser(description='Remove dead nav JS references from journey HTML files')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--project', help='Path to client project directory')
    group.add_argument('--file', help='Single journey HTML file to clean')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without writing')
    parser.add_argument('--pattern', default='',
                        help='Comma-separated dead ID names (default: mob-menu-btn,desk-menu-btn)')
    args = parser.parse_args()

    dead_ids = [p.strip() for p in args.pattern.split(',')] if args.pattern else DEFAULT_PATTERNS

    if args.file:
        files = [args.file]
    else:
        files = sorted(glob.glob(os.path.join(args.project, 'journey_*.html')))
        if not files:
            print(f'No journey_*.html files found in {args.project}')
            sys.exit(1)

    cleaned = 0
    for fpath in files:
        if not os.path.exists(fpath):
            print(f'  SKIP: {fpath} not found')
            continue
        if clean_file(fpath, dead_ids, dry_run=args.dry_run):
            cleaned += 1

    print(f'\nDone — {cleaned}/{len(files)} files modified')


if __name__ == '__main__':
    main()
