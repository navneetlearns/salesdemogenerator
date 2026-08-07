#!/usr/bin/env python3
"""
gen_index.py — Generate an index.html landing page for a client project.

Usage:
    python3 scripts/gen_index.py --project projects/ClientName --config config.json

Config JSON format:
    {
        "brand_name": "Haldiram's India",
        "title": "WhatsApp Commerce OS",
        "description": "A unified WhatsApp operating system...",
        "wa_number": "+91 98110 00001",
        "wa_label": "Haldirams ZoTok",
        "brand_color": "#E8201E",
        "accent_color": "#FFD700",
        "logo_b64_file": "/tmp/logo_b64.txt",
        "journeys": [
            {
                "file": "journey_retailer_activation.html",
                "color": "#C62828",
                "emoji": "🏪",
                "title": "Retailer Activation & Onboarding",
                "steps": "2 Steps",
                "description": "Identify, invite and register new retail partners...",
                "tags": ["Activation", "Onboarding", "Campaigns"]
            }
        ]
    }

Arguments:
    --project   Path to the client project directory (required)
    --config    Path to JSON config file (required)
    --out       Output filename, default: index.html
"""

import argparse
import json
import os
import sys


def build_journey_item(j):
    tags_html = ''.join(f'<span class="j-tag">{t}</span>' for t in j.get('tags', []))
    emoji_escaped = j['emoji'].encode('ascii', 'xmlcharrefreplace').decode()
    return f'''
  <a class="j-item" href="{j['file']}" style="--c:{j['color']}">
    <div class="j-badge">
      <div class="j-num">{j.get('num', '01')}</div>
      <div class="j-emoji">{emoji_escaped}</div>
    </div>
    <div class="j-body">
      <div class="j-top">
        <div class="j-title">{j['title']}</div>
        <div class="j-steps">{j['steps']}</div>
      </div>
      <div class="j-desc">{j['description']}</div>
      <div class="j-tags">{tags_html}</div>
    </div>
  </a>'''


def main():
    parser = argparse.ArgumentParser(description='Generate index.html for a client project')
    parser.add_argument('--project', required=True, help='Path to client project directory')
    parser.add_argument('--config', required=True, help='Path to JSON config file')
    parser.add_argument('--out', default='index.html', help='Output filename (default: index.html)')
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = json.load(f)

    logo_b64 = ''
    if cfg.get('logo_b64_file') and os.path.exists(cfg['logo_b64_file']):
        with open(cfg['logo_b64_file']) as f:
            logo_b64 = f.read().strip()

    brand_color = cfg.get('brand_color', '#E8201E')
    accent_color = cfg.get('accent_color', '#FFD700')
    brand_name = cfg['brand_name']
    title = cfg['title']
    description = cfg.get('description', '')
    wa_number = cfg.get('wa_number', '')
    wa_label = cfg.get('wa_label', '')

    journeys = cfg.get('journeys', [])
    for i, j in enumerate(journeys):
        j.setdefault('num', str(i + 1).zfill(2))

    journey_count = len(journeys)
    items_html = '\n'.join(build_journey_item(j) for j in journeys)

    logo_img = f'<img class="hero-logo" src="data:image/jpeg;base64,{logo_b64}" alt="{brand_name} logo">' if logo_b64 else f'<div class="hero-logo" style="background:{brand_color};display:flex;align-items:center;justify-content:center;font-size:28px;">&#128242;</div>'

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{brand_name} — {title} | ZoTok</title>
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0;}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#eef0f4;min-height:100vh;}}

.hero{{background:linear-gradient(135deg,color-mix(in srgb,{brand_color} 80%,black) 0%,{brand_color} 55%,color-mix(in srgb,{brand_color} 90%,black) 100%);padding:40px 48px 36px;color:#fff;display:flex;align-items:center;gap:26px;}}
.hero-logo{{width:76px;height:76px;border-radius:50%;border:3px solid rgba(255,215,0,.5);flex-shrink:0;object-fit:cover;}}
.hero-text{{flex:1;}}
.hero-brand{{font-size:12px;font-weight:700;color:{accent_color};text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;}}
.hero-title{{font-size:30px;font-weight:800;line-height:1.15;margin-bottom:10px;}}
.hero-desc{{font-size:13.5px;color:rgba(255,255,255,.82);line-height:1.6;max-width:640px;margin-bottom:16px;}}
.hero-meta{{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}}
.hero-wa{{display:inline-flex;align-items:center;gap:7px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:7px 16px;font-size:12.5px;color:rgba(255,255,255,.92);font-weight:600;}}
.hero-stat{{display:inline-flex;align-items:center;gap:6px;background:rgba(255,215,0,.15);border:1px solid rgba(255,215,0,.3);border-radius:20px;padding:7px 14px;font-size:12px;color:{accent_color};font-weight:700;}}

.j-section{{max-width:900px;margin:36px auto 0;padding:0 28px 60px;}}
.section-hdr{{margin-bottom:22px;display:flex;align-items:center;gap:12px;}}
.section-hdr-line{{flex:1;height:1px;background:#ddd;}}
.section-hdr h2{{font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap;}}

.j-item{{display:flex;align-items:stretch;text-decoration:none;color:inherit;margin-bottom:10px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.09));transition:transform .15s ease,filter .15s ease;cursor:pointer;}}
.j-item:hover{{transform:translateX(7px);filter:drop-shadow(0 4px 18px rgba(0,0,0,.18));}}
.j-item:hover .j-body{{background:#f8f8f8;}}
.j-badge{{background:var(--c);width:74px;flex-shrink:0;border-radius:14px 0 0 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:16px 0;}}
.j-num{{font-size:12px;font-weight:900;color:rgba(255,255,255,.4);letter-spacing:.5px;}}
.j-emoji{{font-size:28px;line-height:1.1;}}
.j-body{{flex:1;background:#fff;padding:15px 60px 14px 22px;clip-path:polygon(0 0,calc(100% - 26px) 0,100% 50%,calc(100% - 26px) 100%,0 100%);display:flex;flex-direction:column;justify-content:center;gap:6px;min-height:88px;}}
.j-top{{display:flex;align-items:center;gap:12px;}}
.j-title{{font-size:15px;font-weight:700;color:#111;flex:1;}}
.j-steps{{font-size:10.5px;font-weight:700;color:var(--c);background:rgba(0,0,0,.04);padding:3px 10px;border-radius:10px;white-space:nowrap;flex-shrink:0;}}
.j-desc{{font-size:12.5px;color:#666;line-height:1.45;max-width:520px;}}
.j-tags{{display:flex;gap:5px;flex-wrap:wrap;}}
.j-tag{{font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(0,0,0,.05);color:#555;}}

.footer{{text-align:center;padding:32px 24px;font-size:12px;color:#aaa;}}
.footer strong{{color:#888;}}

@media(max-width:640px){{
  .hero{{padding:24px 20px 22px;gap:16px;flex-wrap:wrap;}}
  .hero-logo{{width:54px;height:54px;}}
  .hero-title{{font-size:22px;}}
  .j-section{{padding:0 14px 40px;}}
  .j-badge{{width:60px;}}
  .j-emoji{{font-size:24px;}}
  .j-title{{font-size:14px;}}
  .j-desc{{display:none;}}
}}
</style>
</head>
<body>

<div class="hero">
  {logo_img}
  <div class="hero-text">
    <div class="hero-brand">{brand_name}</div>
    <h1 class="hero-title">{title}</h1>
    <p class="hero-desc">{description}</p>
    <div class="hero-meta">
      <div class="hero-wa">&#128242; {wa_number} &nbsp;&#183;&nbsp; {wa_label}</div>
      <div class="hero-stat">&#9679; {journey_count} Modules</div>
      <div class="hero-stat">&#9679; Live Journey Demos</div>
    </div>
  </div>
</div>

<div class="j-section">
  <div class="section-hdr">
    <div class="section-hdr-line"></div>
    <h2>Select a Module to Explore</h2>
    <div class="section-hdr-line"></div>
  </div>
{items_html}
</div>

<div class="footer">
  <strong>{brand_name} {title}</strong> &nbsp;&#183;&nbsp; Powered by <strong>ZoTok</strong> &middot; Zono Technologies &nbsp;&#183;&nbsp; Journey Simulations for Internal Demo Use
</div>

</body>
</html>'''

    out_path = os.path.join(args.project, args.out)
    with open(out_path, 'w') as f:
        f.write(html)
    print(f'Written: {out_path} ({len(html):,} bytes)')


if __name__ == '__main__':
    main()
