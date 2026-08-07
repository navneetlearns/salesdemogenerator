#!/usr/bin/env python3
"""
wire_journey_nav.py — Wire cross-journey navigation into journey HTML files.

Adds "← Main Menu" and "Next Module →" buttons to the desktop nav bar and
mobile swipe bar of each journey file. Buttons are hidden until the last
step/slide is reached, then animate into view.

Usage:
    python3 scripts/wire_journey_nav.py --project projects/ClientName --config nav.json

Config JSON format:
    {
        "journeys": [
            {
                "file": "journey_retailer_activation.html",
                "next_file": "journey_campaigns_queries.html",
                "next_label": "Module 2: Campaigns & Queries"
            },
            {
                "file": "journey_campaigns_queries.html",
                "next_file": "journey_order_to_cash.html",
                "next_label": "Module 3: Order to Cash"
            },
            {
                "file": "journey_field_ops_expense.html",
                "next_file": null,
                "next_label": null
            }
        ]
    }

    Set next_file/next_label to null for the last journey (only ← Main Menu will appear).

Arguments:
    --project   Path to client project directory (required)
    --config    Path to JSON config file (required)
    --dry-run   Print what would change without writing files
"""

import argparse
import json
import os
import sys

SVG_NEXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def wire_file(fpath, next_file, next_label, dry_run=False):
    fname = os.path.basename(fpath)
    with open(fpath) as f:
        html = f.read()

    has_next = bool(next_file and next_label)
    changed = []

    # ── Desktop nav: wrap the Next button and append end-of-journey buttons ──
    old_desk_next = (
        '    <button class="nav-btn primary" id="desk-next" onclick="desktopNavigate(1)">\n'
        '      Next\n'
        f'      {SVG_NEXT}\n'
        '    </button>\n'
        '  </div>'
    )
    if old_desk_next in html:
        journey_btn_html = (
            f'    <a class="nav-btn primary" id="desk-journey-btn" href="{next_file}" style="display:none;text-decoration:none;">{next_label} {SVG_NEXT}</a>\n'
            if has_next else ''
        )
        new_desk_next = (
            '    <div style="display:flex;gap:8px;align-items:center;">\n'
            '    <button class="nav-btn primary" id="desk-next" onclick="desktopNavigate(1)">\n'
            '      Next\n'
            f'      {SVG_NEXT}\n'
            '    </button>\n'
            '    <a class="nav-btn" id="desk-menu-btn" href="index.html" style="display:none;text-decoration:none;">&#8592; Main Menu</a>\n'
            + journey_btn_html +
            '    </div>\n'
            '  </div>'
        )
        html = html.replace(old_desk_next, new_desk_next, 1)
        changed.append('desktop nav buttons')
    else:
        print(f'  [{fname}] WARNING: desktop nav anchor not found — already wired or template mismatch')

    # ── Mobile nav: append end-of-journey buttons after mob-next ──
    old_mob = '  <button class="mob-next-btn" id="mob-next" onclick="mobNavigate(1)">Next →</button>\n</div>'
    if old_mob in html:
        mob_next_short = next_label.split(':')[0] if next_label else ''
        journey_mob_html = (
            f'  <a class="mob-next-btn" id="mob-journey-btn" href="{next_file}" style="display:none;text-decoration:none;">{mob_next_short} →</a>\n'
            if has_next else ''
        )
        new_mob = (
            '  <button class="mob-next-btn" id="mob-next" onclick="mobNavigate(1)">Next →</button>\n'
            '  <a class="mob-next-btn" id="mob-menu-btn" href="index.html" style="display:none;text-decoration:none;">&#8592; Menu</a>\n'
            + journey_mob_html +
            '</div>'
        )
        html = html.replace(old_mob, new_mob, 1)
        changed.append('mobile nav buttons')
    else:
        print(f'  [{fname}] WARNING: mobile nav anchor not found')

    # ── JS: patch showDesktopStep to toggle end-buttons ──
    old_desk_js = (
        '  if(dp) dp.disabled = n === 1;\n'
        '  if(dn) dn.disabled = n === totalSteps;\n'
        '  if(dc) dc.textContent = `Step ${n} of ${totalSteps}`;'
    )
    if old_desk_js in html:
        journey_js = (
            "  const deskJourneyBtn = document.getElementById('desk-journey-btn');\n"
            "  if(deskJourneyBtn) deskJourneyBtn.style.display = atEnd ? '' : 'none';\n"
            if has_next else ''
        )
        new_desk_js = (
            '  if(dp) dp.disabled = n === 1;\n'
            '  const atEnd = n === totalSteps;\n'
            "  if(dn){ dn.disabled = false; dn.style.display = atEnd ? 'none' : ''; }\n"
            '  if(dc) dc.textContent = `Step ${n} of ${totalSteps}`;\n'
            "  const deskMenuBtn = document.getElementById('desk-menu-btn');\n"
            "  if(deskMenuBtn) deskMenuBtn.style.display = atEnd ? '' : 'none';\n"
            + journey_js
        )
        html = html.replace(old_desk_js, new_desk_js, 1)
        changed.append('showDesktopStep JS')
    else:
        print(f'  [{fname}] WARNING: showDesktopStep JS anchor not found')

    # ── JS: patch updateMobileHeader to toggle end-buttons on last slide ──
    old_mob_js = (
        "  document.getElementById('mob-prev').disabled = slideIdx === 0;\n"
        "  document.getElementById('mob-next').disabled = slideIdx === totalSlides - 1;"
    )
    if old_mob_js in html:
        journey_mob_js = (
            "  const mobJourneyBtn = document.getElementById('mob-journey-btn');\n"
            "  if(mobJourneyBtn) mobJourneyBtn.style.display = isLastSlide ? '' : 'none';\n"
            if has_next else ''
        )
        new_mob_js = (
            "  document.getElementById('mob-prev').disabled = slideIdx === 0;\n"
            "  const isLastSlide = slideIdx === totalSlides - 1;\n"
            "  const mobNext = document.getElementById('mob-next');\n"
            "  if(mobNext){ mobNext.disabled = isLastSlide; mobNext.style.display = isLastSlide ? 'none' : ''; }\n"
            "  const mobMenuBtn = document.getElementById('mob-menu-btn');\n"
            "  if(mobMenuBtn) mobMenuBtn.style.display = isLastSlide ? '' : 'none';\n"
            + journey_mob_js
        )
        html = html.replace(old_mob_js, new_mob_js, 1)
        changed.append('updateMobileHeader JS')
    else:
        print(f'  [{fname}] WARNING: updateMobileHeader JS anchor not found')

    if changed:
        print(f'  [{fname}] patched: {", ".join(changed)}')
    else:
        print(f'  [{fname}] nothing to patch')

    if not dry_run and changed:
        with open(fpath, 'w') as f:
            f.write(html)
        print(f'  [{fname}] saved ({len(html):,} bytes)')

    return bool(changed)


def main():
    parser = argparse.ArgumentParser(description='Wire cross-journey navigation into journey HTML files')
    parser.add_argument('--project', required=True, help='Path to client project directory')
    parser.add_argument('--config', required=True, help='Path to JSON config file')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without writing')
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = json.load(f)

    journeys = cfg['journeys']
    total = len(journeys)
    patched = 0

    for j in journeys:
        fpath = os.path.join(args.project, j['file'])
        if not os.path.exists(fpath):
            print(f'  SKIP: {fpath} not found')
            continue
        result = wire_file(
            fpath,
            next_file=j.get('next_file'),
            next_label=j.get('next_label'),
            dry_run=args.dry_run,
        )
        if result:
            patched += 1

    print(f'\nDone — {patched}/{total} files patched')


if __name__ == '__main__':
    main()
