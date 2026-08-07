#!/usr/bin/env python3
"""
inject_screen_descs.py — Inject .screen-desc cards into journey HTML screens.

Reads a mapping of screen-lbl text → description and inserts a coloured
.screen-desc div at the end of each matching .screen-wrap. On desktop the
card sits below the phone frame; on mobile it fades in as a bottom overlay
after 1.5s.

Usage:
    python3 scripts/inject_screen_descs.py \\
        --file projects/ClientName/journey_foo.html \\
        --config descs.json

Config JSON format:
    {
        "screen_descs": {
            "Screen 1 · Activation Campaign": {
                "bg": "#FFD9B0",
                "title": "Activation Campaign",
                "body": "ZoTok sends a WhatsApp marketing message to prospective retailers..."
            },
            "Screen 2 · Retailer Registration": {
                "bg": "#B0D4F0",
                "title": "Registration Form",
                "body": "Retailer taps 'Register Now' and fills in their business details..."
            }
        }
    }

    Keys must exactly match the text content of <div class="screen-lbl">...</div>.
    Use &amp; etc. for HTML entities.

Arguments:
    --file      Journey HTML file to modify (required)
    --config    Path to JSON config file with screen_descs mapping (required)
    --dry-run   Print changes without writing
"""

import argparse
import json
import re
import os
import sys

DESKTOP_DESC_CSS = """
/* ─── Screen description card ─── */
.screen-desc{width:375px;border-radius:12px;padding:10px 14px 11px;font-size:13px;line-height:1.5;color:#2a2a2a;}
.screen-desc strong{font-size:13.5px;font-weight:700;color:#111;display:block;margin-bottom:3px;}
"""

MOBILE_DESC_CSS = """/* Screen desc — fixed overlay above nav bar */
.screen-desc{
  position:fixed !important;
  left:16px !important; right:16px !important;
  bottom:58px !important;
  width:auto !important; max-width:none !important;
  z-index:200;
  opacity:0;
  pointer-events:none;
  transition:opacity 0.5s ease;
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
  border-radius:14px !important;
  box-shadow:0 8px 28px rgba(0,0,0,0.18) !important;
  font-size:13px !important;
}
.screen-desc.desc-visible{opacity:0.93;pointer-events:auto;}
.screen-desc strong{font-size:13.5px !important;}
"""

DESC_TIMER_JS = """let descTimer = null;
"""

DESC_FADE_JS = """  // Fade in screen desc after 1.5s
  clearTimeout(descTimer);
  document.querySelectorAll('.screen-desc').forEach(el => el.classList.remove('desc-visible'));
  const currentDesc = slide ? slide.querySelector('.screen-desc') : null;
  if(currentDesc){ descTimer = setTimeout(() => currentDesc.classList.add('desc-visible'), 1500); }"""


def find_matching_close(s, start):
    depth = 0
    i = start
    while i < len(s):
        if s[i:i+4] == '<div':
            depth += 1
            i += 4
        elif s[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                return i
            i += 6
        else:
            i += 1
    return -1


def inject_descs(html, descs):
    screen_wrap_re = re.compile(r'<div class="screen-wrap">')
    positions = [(m.start(), m.end()) for m in screen_wrap_re.finditer(html)]
    injected = 0
    warnings = []

    for (sw_start, sw_end) in reversed(positions):
        sw_close = find_matching_close(html, sw_start)
        if sw_close < 0:
            continue
        chunk = html[sw_start:sw_close]

        lbl_match = re.search(r'<div class="screen-lbl">(.*?)</div>', chunk)
        if not lbl_match:
            continue
        lbl_text = lbl_match.group(1)

        if lbl_text not in descs:
            warnings.append(f'  WARNING: no desc configured for screen-lbl: "{lbl_text}"')
            continue

        d = descs[lbl_text]
        bg = d.get('bg', '#f5f5f5')
        title = d['title']
        body = d['body']
        desc_html = (
            f'\n        <div class="screen-desc" style="background:{bg};">\n'
            f'          <strong>{title}</strong>\n'
            f'          {body}\n'
            f'        </div>'
        )
        html = html[:sw_close] + desc_html + '\n      ' + html[sw_close:]
        injected += 1

    for w in warnings:
        print(w)
    print(f'  Injected {injected} screen-desc cards')
    return html


def inject_css(html):
    # Desktop: insert after .screen-type-lbl rule
    anchor_desktop = '.screen-type-lbl{font-size:10px;color:#aaa;margin-top:1px;}'
    if anchor_desktop in html and '.screen-desc{width:' not in html:
        html = html.replace(anchor_desktop, anchor_desktop + DESKTOP_DESC_CSS, 1)
        print('  Desktop screen-desc CSS injected ✓')
    else:
        print('  Desktop CSS anchor not found or already present — skipping')

    # Mobile: insert before end of @media block
    mob_anchor = '} /* end @media'
    if mob_anchor in html and 'desc-visible' not in html:
        html = html.replace(mob_anchor, MOBILE_DESC_CSS + mob_anchor, 1)
        print('  Mobile screen-desc CSS injected ✓')
    else:
        print('  Mobile CSS anchor not found or already present — skipping')

    return html


def inject_js(html):
    # Add descTimer variable
    timer_anchor = 'let curSlide = 0;'
    if timer_anchor in html and 'descTimer' not in html:
        html = html.replace(timer_anchor, DESC_TIMER_JS + timer_anchor, 1)
        print('  descTimer variable injected ✓')

    # Add fade-in logic in updateMobileHeader
    mob_fn_anchor = '  curSlide = slideIdx;\n  curStep  = stepNum;\n}'
    if mob_fn_anchor in html and 'desc-visible' not in html:
        html = html.replace(
            mob_fn_anchor,
            f'  curSlide = slideIdx;\n  curStep  = stepNum;\n{DESC_FADE_JS}\n}}',
            1
        )
        print('  Mobile desc fade-in JS injected ✓')
    else:
        print('  Mobile JS anchor not found or already present — skipping')

    return html


def main():
    parser = argparse.ArgumentParser(description='Inject .screen-desc cards into journey HTML screens')
    parser.add_argument('--file', required=True, help='Journey HTML file path')
    parser.add_argument('--config', required=True, help='Path to JSON config file')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without writing')
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f'ERROR: {args.file} not found')
        sys.exit(1)

    with open(args.config) as f:
        cfg = json.load(f)

    descs = cfg.get('screen_descs', {})
    if not descs:
        print('ERROR: no screen_descs found in config')
        sys.exit(1)

    with open(args.file) as f:
        html = f.read()

    html = inject_css(html)
    html = inject_js(html)
    html = inject_descs(html, descs)

    print(f'\nNew file size: {len(html):,} bytes')

    if not args.dry_run:
        with open(args.file, 'w') as f:
            f.write(html)
        print(f'Written: {args.file}')
    else:
        print('(dry-run — not written)')


if __name__ == '__main__':
    main()
