#!/usr/bin/env python3
"""
add_step.py — Insert a new step into a journey HTML file and keep the sidebar,
JS steps array, and step-N IDs consistent.

Usage:
    python3 scripts/add_step.py \\
        --file projects/ClientName/journey_foo.html \\
        --position 3 \\
        --label "Scheme & Loyalty Queries" \\
        --meta "Retailer · 3 screens · AI Chat" \\
        --title "Step 3 — Scheme & Loyalty Queries" \\
        --desc "Retailer queries points wallet..." \\
        --tags "AI Agents,Schemes,SE Escalation" \\
        --html-file /tmp/step3_content.html

The --html-file must contain the inner HTML for the step section (everything
that goes inside <div id="step-N" class="step-section">...</div>).

What this script does:
    1. Shifts all existing step-N / <!-- /step-N --> IDs above --position upward by 1
    2. Inserts the new step section at --position
    3. Inserts a new sidebar item at --position
    4. Inserts a new entry in the JS `const steps = [...]` array at --position
    5. Updates `Math.min(N, n)` totalSteps clamp in JS
    6. Updates "Step X of Y" counter strings
    7. Adds scroll-to-bottom for new step's chat areas (if any s{N}scM-chat IDs exist)

Arguments:
    --file          Journey HTML file to modify (required)
    --position      Step number to insert at, 1-based (required)
    --label         Sidebar step label, e.g. "Scheme & Loyalty Queries" (required)
    --meta          Sidebar step meta, e.g. "Retailer · 3 screens · AI Chat" (required)
    --title         JS steps array title, e.g. "Step 3 — Scheme & Loyalty Queries" (required)
    --desc          JS steps array desc HTML string (required)
    --tags          Comma-separated tag classes, e.g. "tag-ai,tag-sch,tag-act"
    --html-file     File containing the step section inner HTML (required)
    --dry-run       Print changes without writing
"""

import argparse
import re
import os
import sys


def shift_step_ids(html, from_step, direction=1):
    """Rename step IDs >= from_step by adding direction (1 to shift up)."""
    # Collect all step N values present, descending, to avoid double-rename
    found = sorted(
        set(int(m.group(1)) for m in re.finditer(r'id="step-(\d+)"', html)),
        reverse=(direction > 0)
    )
    for n in found:
        if n >= from_step:
            html = re.sub(
                rf'(<div id="step-){n}(")',
                lambda m, new=n + direction: f'{m.group(1)}{new}{m.group(2)}',
                html
            )
            html = html.replace(f'<!-- /step-{n} -->', f'<!-- /step-{n + direction} -->')
    return html


def shift_sidebar_items(html, from_step, direction=1):
    """Update onclick="scrollToStep(N)" and step-num divs for N >= from_step."""
    found = sorted(
        set(int(m.group(1)) for m in re.finditer(r'scrollToStep\((\d+)\)', html)),
        reverse=(direction > 0)
    )
    for n in found:
        if n >= from_step:
            html = html.replace(
                f'onclick="scrollToStep({n})">\n      <div class="step-num">{n}</div>',
                f'onclick="scrollToStep({n + direction})">\n      <div class="step-num">{n + direction}</div>',
            )
    return html


def shift_js_steps_titles(html, from_step, direction=1):
    """Update "Step N — ..." titles in JS steps array for N >= from_step."""
    def replacer(m):
        n = int(m.group(1))
        if n >= from_step:
            return m.group(0).replace(f'Step {n} ', f'Step {n + direction} ', 1)
        return m.group(0)
    return re.sub(r"title:'Step (\d+) ", replacer, html)


def update_total_steps(html, new_total):
    """Update Math.min clamp and any 'Step X of Y' counters."""
    # Math.min(N, n) — find current value and replace
    html = re.sub(
        r'Math\.min\((\d+),\s*n\)',
        f'Math.min({new_total}, n)',
        html
    )
    # "Step X of Y" — update Y
    html = re.sub(
        r'(Step \d+ of )\d+',
        lambda m: m.group(1) + str(new_total),
        html
    )
    return html


def build_sidebar_item(pos, label, meta):
    return (
        f'    <div class="step-item" onclick="scrollToStep({pos})">\n'
        f'      <div class="step-num">{pos}</div>\n'
        f'      <div>\n'
        f'        <div class="step-lbl">{label}</div>\n'
        f'        <div class="step-meta">{meta}</div>\n'
        f'      </div>\n'
        f'    </div>'
    )


def build_js_step_entry(pos, title, desc):
    return f"  {{ title:'{title}', desc:'{desc}' }}"


def main():
    parser = argparse.ArgumentParser(description='Insert a new step into a journey HTML file')
    parser.add_argument('--file', required=True, help='Journey HTML file path')
    parser.add_argument('--position', required=True, type=int, help='Step number to insert at (1-based)')
    parser.add_argument('--label', required=True, help='Sidebar step label')
    parser.add_argument('--meta', required=True, help='Sidebar step meta line')
    parser.add_argument('--title', required=True, help='JS steps array title')
    parser.add_argument('--desc', required=True, help='JS steps array desc HTML')
    parser.add_argument('--tags', default='', help='Comma-separated tag CSS classes')
    parser.add_argument('--html-file', required=True, dest='html_file',
                        help='File containing the step section inner HTML')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without writing')
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f'ERROR: {args.file} not found')
        sys.exit(1)
    if not os.path.exists(args.html_file):
        print(f'ERROR: --html-file {args.html_file} not found')
        sys.exit(1)

    with open(args.file) as f:
        html = f.read()
    with open(args.html_file) as f:
        step_inner = f.read().strip()

    pos = args.position

    # Count current steps
    current_steps = len(re.findall(r'id="step-\d+"', html))
    new_total = current_steps + 1
    print(f'Current steps: {current_steps} → inserting at position {pos} → new total: {new_total}')

    # 1. Shift all step-N IDs >= pos upward
    html = shift_step_ids(html, pos)
    print(f'Step IDs shifted ✓')

    # 2. Shift sidebar items >= pos upward
    html = shift_sidebar_items(html, pos)
    print(f'Sidebar step numbers shifted ✓')

    # 3. Shift JS steps array titles >= pos upward
    html = shift_js_steps_titles(html, pos)
    print(f'JS steps array titles shifted ✓')

    # 4. Insert new step section before the now-shifted step-(pos+1)
    new_section = (
        f'\n    <!-- {"═" * 31} STEP {pos} {"═" * 31} -->\n'
        f'    <div id="step-{pos}" class="step-section">\n'
        f'{step_inner}\n'
        f'    </div><!-- /step-{pos} -->\n'
    )
    anchor = f'    <!-- {"═" * 31} STEP {pos + 1} {"═" * 31} -->'
    if anchor in html:
        html = html.replace(anchor, new_section + anchor, 1)
        print(f'Step section inserted before step-{pos + 1} ✓')
    else:
        # Fallback: insert before /screens-area close
        close_anchor = '\n  </div><!-- /screens-area -->'
        if close_anchor in html:
            html = html.replace(close_anchor, new_section + close_anchor, 1)
            print(f'Step section appended before /screens-area ✓')
        else:
            print('ERROR: could not find insertion point — check HTML structure')
            sys.exit(1)

    # 5. Insert sidebar item after step-(pos-1) item
    if pos > 1:
        prev_anchor = f'scrollToStep({pos - 1})">'
        prev_idx = html.find(prev_anchor)
        if prev_idx >= 0:
            # Find end of that step-item div
            item_close = html.find('    </div>', prev_idx)
            item_close_end = item_close + len('    </div>')
            new_item = '\n' + build_sidebar_item(pos, args.label, args.meta)
            html = html[:item_close_end] + new_item + html[item_close_end:]
            print(f'Sidebar item inserted after step-{pos - 1} ✓')
        else:
            print(f'WARNING: sidebar anchor for step-{pos - 1} not found')
    else:
        # Insert at top of sidebar items
        first_item = html.find('    <div class="step-item"')
        if first_item >= 0:
            new_item = build_sidebar_item(pos, args.label, args.meta) + '\n'
            html = html[:first_item] + new_item + html[first_item:]
            print(f'Sidebar item inserted at top ✓')

    # 6. Insert JS steps array entry
    # Find position pos-1 entry (0-indexed) and insert after it
    steps_entries = list(re.finditer(r"\{ title:'Step \d+ ", html))
    if steps_entries and pos - 2 < len(steps_entries):
        insert_after_idx = pos - 2  # 0-indexed, insert after entry at pos-2
        if insert_after_idx >= 0:
            entry_match = steps_entries[insert_after_idx]
            # Find end of this entry (closing })
            entry_end = html.find('}', entry_match.start()) + 1
            new_js_entry = ',\n' + build_js_step_entry(pos, args.title, args.desc)
            html = html[:entry_end] + new_js_entry + html[entry_end:]
            print(f'JS steps array entry inserted at position {pos} ✓')
        else:
            # Insert at start of array
            array_start = html.find('const steps = [') + len('const steps = [\n')
            new_js_entry = build_js_step_entry(pos, args.title, args.desc) + ',\n'
            html = html[:array_start] + new_js_entry + html[array_start:]
            print(f'JS steps array entry inserted at start ✓')
    else:
        print('WARNING: JS steps array entry could not be inserted — add manually')

    # 7. Update totalSteps clamp and counters
    html = update_total_steps(html, new_total)
    print(f'Total steps updated to {new_total} ✓')

    print(f'\nNew file size: {len(html):,} bytes')

    if not args.dry_run:
        with open(args.file, 'w') as f:
            f.write(html)
        print(f'Written: {args.file}')
    else:
        print('(dry-run — not written)')


if __name__ == '__main__':
    main()
