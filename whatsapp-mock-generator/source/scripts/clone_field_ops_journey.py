#!/usr/bin/env python3
"""
clone_field_ops_journey.py
──────────────────────────
Clones the Savera Field Ops journey HTML into a new client's project folder,
substituting brand, people, locations, retailers, and products throughout.

Usage:
    python3 scripts/clone_field_ops_journey.py

Edit the CONFIG section below for each new client, then run.
The output file is self-contained HTML — no external assets needed.
"""

import os
import re
import base64

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — edit this section for each new client
# ══════════════════════════════════════════════════════════════════════════════

SOURCE_FILE = "projects/Savera/journey_field_ops.html"

CLIENT = dict(
    # ── Output ──────────────────────────────────────────────────────────────
    project_folder   = "projects/Atharva",
    output_file      = "journey_field_ops.html",

    # ── Brand ────────────────────────────────────────────────────────────────
    brand_name       = "Atharva Food Products",   # full legal name
    wa_business_name = "Atharva Masale",           # WhatsApp Business display name
    industry         = "Food Products · Masala &amp; Spices",
    logo_initials    = "AF",                       # 2-3 chars shown in logo box
    brand_color      = "#B62127",                  # primary brand hex
    brand_dark       = "#8a0e13",                  # darker shade for gradients
    # accent stays #C8860A (same as Savera) — change here if needed
    # accent_color   = "#C8860A",

    # ── People ───────────────────────────────────────────────────────────────
    se_name          = "Rahul Tapkeer",            # Sales Executive full name
    se_initials      = "RT",                       # 2-char initials
    manager_name     = "Raju Raut",                # ASM / Manager full name
    manager_initials = "RR",

    # ── Group & locations ────────────────────────────────────────────────────
    group_name       = "Chandrapur Sales",
    city             = "Chandrapur",
    office_name      = "Atharva Office",           # used in clock-in location
    lat              = "19.9600",
    lon              = "79.2940",

    # ── Visit plan retailers (shown in @zoai my plan response) ───────────────
    visit_retailer_1       = "Maa Yogishri Kirana",
    visit_retailer_1_area  = "Gandhi Chowk, Chandrapur",
    visit_retailer_1_phone = "9876543210",
    visit_retailer_2       = "Gurunanak Kirana",
    visit_retailer_2_area  = "Main Road, Chandrapur",
    visit_retailer_2_phone = "9123456780",

    # ── Check-in / order capture retailer ────────────────────────────────────
    checkin_retailer       = "Maa Yogishri Kirana",
    checkin_area           = "Chandrapur",

    # ── Beat plan (PWA) retailers ─────────────────────────────────────────────
    beat_r1 = "Maa Yogishri Kirana",   beat_r1_area = "Chandrapur",
    beat_r2 = "Gurunanak Kirana",      beat_r2_area = "Station Road",
    beat_r3 = "Shri Ram Kirana",       beat_r3_area = "Ballarpur Road",
    beat_r4 = "Balaji Kirana",         beat_r4_area = "Bus Stand Area",
    beat_r5 = "Sheetal Provision",     beat_r5_area = "Chandrapur",
    beat_r6 = "Laxmi General Store",   beat_r6_area = "Rajura Road",

    # ── Products (cart / order note) ─────────────────────────────────────────
    product_1      = "Mutton Masala, 200g",   product_1_cat = "Masala",
    product_2      = "Goda Masala, 100g",     product_2_cat = "Spices",
    product_3      = "Turmeric Powder, 50g",  product_3_cat = "Spices",

    # ── Order ────────────────────────────────────────────────────────────────
    order_id_prefix = "ATH",                  # e.g. ATH-1042

    # ── Competitor ───────────────────────────────────────────────────────────
    competitor_brand   = "Everest Masala",
    competitor_product = "Mutton Masala, 200g",

    # ── Postal / geo ─────────────────────────────────────────────────────────
    pin1 = "442401",
    pin2 = "442402",
)

# ── Optional: image replacements (set path to None to skip) ──────────────────
IMAGES = {
    # key = relative src path in source HTML  →  value = local file to embed
    "../../references/graphics/sales_executive_starting_day.png":
        None,   # e.g. "assets/atharva_se_start.png"
    "../../references/graphics/sales_executive_meeets_retailer.png":
        None,
}

# ══════════════════════════════════════════════════════════════════════════════
# REPLACEMENTS — derived from CONFIG (you shouldn't need to edit below here)
# ══════════════════════════════════════════════════════════════════════════════

def build_replacements(c):
    """Return ordered list of (old, new) string pairs."""
    se   = c["se_name"]
    mgr  = c["manager_name"]
    city = c["city"]

    return [
        # ── Page title ──────────────────────────────────────────────────────
        ("Savera Pipes — Field Operations (Mobile)",
         f"{c['brand_name']} — Field Operations (Mobile)"),

        # ── CSS brand colors ─────────────────────────────────────────────────
        ("--brand:#1B2A4A;--brand-dark:#0f1d33;",
         f"--brand:{c['brand_color']};--brand-dark:{c['brand_dark']};"),
        ("background:linear-gradient(135deg,var(--brand) 0%,#0f1d33 55%,#1a0a00 100%)",
         f"background:linear-gradient(135deg,var(--brand) 0%,{c['brand_dark']} 55%,#3a0000 100%)"),
        ("#1B2A4A", c["brand_color"]),

        # ── Brand identity ───────────────────────────────────────────────────
        ("Savera Pipes",           c["brand_name"]),
        ("Savera Field Ops",       f"{c['brand_name'].split()[0]} Field Ops"),
        ("Savera Field Operations",f"{c['brand_name'].split()[0]} Field Operations"),
        ("Savera x Manish Nagar",  c["group_name"]),
        ("Savera Office, Nagpur",  f"{c['office_name']}, {city}"),
        ("Savera Office, Manish Nagar, Nagpur", f"{c['office_name']}, {city}"),
        ("Savera",                 c["brand_name"].split()[0]),  # catch remainder

        # ── Industry / logo ──────────────────────────────────────────────────
        ("Pipes &amp; Infrastructure", c["industry"]),
        ('<div class="brand-logo">SP</div>', f'<div class="brand-logo">{c["logo_initials"]}</div>'),
        ('<div class="dm-ava">SP</div>',     f'<div class="dm-ava">{c["logo_initials"]}</div>'),

        # ── SE & Manager names ───────────────────────────────────────────────
        (f'Ravi Singh <span class="s-chip-x">×</span>',
         f'{se} <span class="s-chip-x">×</span>'),
        (f'Deepak Sharma <span class="s-chip-x">×</span>',
         f'{mgr} <span class="s-chip-x">×</span>'),
        ('<div class="s-cname">Ravi Singh</div>',   f'<div class="s-cname">{se}</div>'),
        ('<div class="s-cname">Deepak Sharma</div>', f'<div class="s-cname">{mgr}</div>'),
        ("Ravi Singh, Deepak Sharma, ZoAi",  f"{se}, {mgr}, ZoAi"),
        ("You added Ravi Singh, Deepak Sharma, ZoAi Agent",
         f"You added {se}, {mgr}, ZoAi Agent"),
        ("ZoAi Agent added first, followed by Ravi Singh and Deepak Sharma",
         f"ZoAi Agent added first, followed by {se} and {mgr}"),

        # ── Group name & char count ──────────────────────────────────────────
        ("21/25", f"{len(c['group_name'])}/25"),
        # Group name already covered by "Savera x Manish Nagar" above

        # ── Sender labels ────────────────────────────────────────────────────
        ("You (Ravi Singh)",  f"You ({se})"),
        (">Deepak Sharma<",   f">{mgr}<"),
        (">Ravi Singh<",      f">{se}<"),

        # ── SE / Manager avatar initials ─────────────────────────────────────
        ('background:#E91E63;">RS</div>', f'background:#E91E63;">{c["se_initials"]}</div>'),
        ('background:#C62828;">RS</div>', f'background:#C62828;">{c["se_initials"]}</div>'),
        ('background:#9C27B0;">DS</div>', f'background:#9C27B0;">{c["manager_initials"]}</div>'),

        # ── Locations ────────────────────────────────────────────────────────
        ("Manish Nagar, Nagpur · Live Location", f"{city} · Live Location"),
        ("Manish Nagar, Nagpur",  city),
        ("📍 Manish Nagar",       f"📍 {city}"),
        ("Manish Nagar",          city),

        # ── Clock-in message body ────────────────────────────────────────────
        ("Name:</strong> Ravi Singh (SE)", f"Name:</strong> {se} (SE)"),

        # ── Plan response ────────────────────────────────────────────────────
        ("Hi Ravi 👋", f"Hi {se.split()[0]} 👋"),
        ("Shree Ganesh Traders",        c["visit_retailer_1"]),
        ("Addagar, Nagpur",             c["visit_retailer_1_area"]),
        ("Maa Durga Hardware",          c["visit_retailer_2"]),
        ("Plot 45, Wardha Road, Nagpur",c["visit_retailer_2_area"]),

        # ── Check-in store ───────────────────────────────────────────────────
        (f"Sharma Pipes, {city}", f"{c['checkin_retailer']}, {city}"),
        ("Sharma Pipes",          c["checkin_retailer"]),
        ("SE:</strong> Ravi Singh", f"SE:</strong> {se}"),

        # ── Order body ───────────────────────────────────────────────────────
        ("Team,\n                  Savera Pipes",
         f"Team,\n                  {c['brand_name']}"),
        ("Team,\n                    Savera Pipes",
         f"Team,\n                    {c['brand_name']}"),
        ("Team,<br>Savera Pipes", f"Team,<br>{c['brand_name']}"),
        ("SVR-1042", f"{c['order_id_prefix']}-1042"),
        ("SVR-1038", f"{c['order_id_prefix']}-1038"),

        # ── DM WhatsApp Business name ────────────────────────────────────────
        ('font-size:14px;font-weight:600;color:#fff;line-height:1.2;">'
         f'{c["brand_name"]}</div>',
         'font-size:14px;font-weight:600;color:#fff;line-height:1.2;">'
         f'{c["wa_business_name"]}</div>'),

        # ── PWA cart products ────────────────────────────────────────────────
        ("PVC Pipe 2 inch",   c["product_1"]),
        (">Pipes<",           f">{c['product_1_cat']}<"),
        (">Fittings<",        f">{c['product_2_cat']}<"),
        (">Elbow<",           f">{c['product_2']}<"),
        (">Tee<",             f">{c['product_3']}<"),

        # ── Competitor ───────────────────────────────────────────────────────
        ("Supreme Pipes",     c["competitor_brand"]),
        ("Found a new brand Supreme Pipes at Sharmaji's shop having a product similar to us",
         f"Found {c['competitor_brand']} running a promotional scheme at "
         f"{c['beat_r2']} with price undercutting"),

        # ── Ledger ───────────────────────────────────────────────────────────
        ("@zoai ledger sharma pipes",
         f"@zoai ledger {c['checkin_retailer'].lower()}"),
        ("Ledger_SharmaPipes_Apr2026.pdf",
         f"Ledger_{c['checkin_retailer'].replace(' ','')}_Apr2026.pdf"),
        ("Ledger — Sharma Pipes", f"Ledger — {c['checkin_retailer']}"),
        (f"Ravi, while you're at Sharma Pipes",
         f"{se.split()[0]}, while you're at {c['checkin_retailer']}"),

        # ── Beat plan retailers ──────────────────────────────────────────────
        ("Om Sai Enterprises",     c["beat_r2"]),
        ("Civil Lines",            c["beat_r2_area"]),
        ("Rathi Hardware",         c["beat_r3"]),
        ("Dharampeth",             c["beat_r3_area"]),
        ("Gupta Plumbing Works",   c["beat_r4"]),
        ("Sitabuldi",              c["beat_r4_area"]),
        ("Bharat Trading Co",      c["beat_r5"]),
        ("Patel Pipes &amp; Hardware", c["beat_r6"]),
        ("Gandhibagh",             c["beat_r6_area"]),

        # ── Geo coords & postal codes ────────────────────────────────────────
        ("Lat &amp; Lon: 21.1501, 79.0834", f"Lat &amp; Lon: {c['lat']}, {c['lon']}"),
        ("Lat &amp; Lon: 21.1463, 79.0849", f"Lat &amp; Lon: {c['lat']}, {c['lon']}"),
        ("Lat &amp; Lon: 21.1520, 79.0842", f"Lat &amp; Lon: {c['lat']}, {c['lon']}"),
        ("Lat &amp; Lon: 21.1398, 79.0952", f"Lat &amp; Lon: {c['lat']}, {c['lon']}"),
        ("Lat &amp; Lon: 21.1458, 79.0882", f"Lat &amp; Lon: {c['lat']}, {c['lon']}"),
        ("Lat & Lon: 21.1458, 79.0882",     f"Lat & Lon: {c['lat']}, {c['lon']}"),
        ("Nagpur 440010", f"{city} {c['pin1']}"),
        ("Nagpur 440001", f"{city} {c['pin2']}"),
        ("Nagpur",        city),

        # ── Admin timeline avatar initials ───────────────────────────────────
        ('background:#9C27B0;">SP</div>', 'background:#9C27B0;">MY</div>'),
        ('background:#00897B;">OS</div>', 'background:#00897B;">GK</div>'),

        # ── Report table ─────────────────────────────────────────────────────
        ("Ravi Singh</span>", f"{se}</span>"),
        ("Govind Savera",     f"Govind {c['brand_name'].split()[0]}"),

        # ── Screen 3 label & desc ────────────────────────────────────────────
        ("Screen 3 · Group · Deepak's View", f"Screen 3 · Group · {mgr.split()[0]}'s View"),
        ("Order posted in team group · Deepak Sharma (ASM) reacts 👍",
         f"Order posted in team group · {mgr} (ASM) reacts 👍"),

        # ── Competitor dialogue ──────────────────────────────────────────────
        ("Good catch Ravi 👏",
         f"Good catch {se.split()[0]} 👏"),
        ("Sure Deepak bhai 👍",
         f"Sure {mgr.split()[0]} bhai 👍"),
        ("Deepak spots Ravi's note",
         f"{mgr.split()[0]} spots {se.split()[0]}'s note"),
        ("Deepak types @zoai ledger",
         f"{mgr.split()[0]} types @zoai ledger"),

        # ── Script step descriptions ─────────────────────────────────────────
        ("Admin creates the Savera Field Ops group",
         f"Admin creates the {c['brand_name'].split()[0]} Field Ops group"),
        ("Ravi submits order on mobile browser; ZoAi notifies retailer via DM and posts to group — Deepak reacts 👍",
         f"{se.split()[0]} submits order on mobile browser; ZoAi notifies retailer via DM and posts to group — {mgr.split()[0]} reacts 👍"),
        ("Ravi captures competitor product photo",
         f"{se.split()[0]} captures competitor product photo"),
        ("Deepak Sharma collaborates with Ravi in real-time",
         f"{mgr} collaborates with {se.split()[0]} in real-time"),
        ("provisioned by Savera Pipes admin",
         f"provisioned by {c['brand_name']} admin"),

        # ── Misc captions ────────────────────────────────────────────────────
        ("Ravi shares live location from", f"{se.split()[0]} shares live location from"),
        ("Ravi types @zoai my plan",        f"{se.split()[0]} types @zoai my plan"),
        ("Ravi shares store location pin",  f"{se.split()[0]} shares store location pin"),
        ("Ravi photos the handwritten",     f"{se.split()[0]} photos the handwritten"),
        ("Ravi edits PVC Pipe qty",         f"{se.split()[0]} edits {c['product_1'].split(',')[0]} qty"),
        ("Ravi photos the competitor",      f"{se.split()[0]} photos the competitor"),
        ("Ravi's 6 customers",              f"{se.split()[0]}'s 6 customers"),
        ("Head office tracks Ravi's",       f"Head office tracks {se.split()[0]}'s"),
        ("Sales Executive at Savera Pipes", f"Sales Executive at {c['brand_name']}"),

        # ── Footer ───────────────────────────────────────────────────────────
        ("Savera Field Ops · ZoTok", f"{c['brand_name'].split()[0]} Field Ops · ZoTok"),
    ]


def embed_images(content, image_map):
    """Replace src paths with base64 data URIs for any mapped local files."""
    for src_path, local_file in image_map.items():
        if local_file and os.path.exists(local_file):
            with open(local_file, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            ext = os.path.splitext(local_file)[1].lstrip(".")
            mime = "jpeg" if ext in ("jpg", "jpeg") else ext
            content = content.replace(
                f'src="{src_path}"',
                f'src="data:image/{mime};base64,{b64}"'
            )
            print(f"  Embedded: {local_file}")
        elif local_file:
            print(f"  WARNING: image not found — {local_file}")
    return content


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(script_dir)

    src = os.path.join(root, SOURCE_FILE)
    out_dir = os.path.join(root, CLIENT["project_folder"])
    out = os.path.join(out_dir, CLIENT["output_file"])

    print(f"Source : {src}")
    print(f"Output : {out}")

    with open(src, "r") as f:
        content = f.read()

    replacements = build_replacements(CLIENT)
    changed = 0
    for old, new in replacements:
        if old != new and old in content:
            content = content.replace(old, new)
            changed += 1

    print(f"Applied {changed} of {len(replacements)} replacements")

    # Embed images
    abs_images = {k: (os.path.join(root, v) if v else None) for k, v in IMAGES.items()}
    content = embed_images(content, abs_images)

    os.makedirs(out_dir, exist_ok=True)
    with open(out, "w") as f:
        f.write(content)

    print(f"Written → {out}")

    # Warn about any remaining Savera/Ravi/Deepak in visible text
    leftover = re.findall(r'(?<![<"\w])(Savera|Ravi Singh|Deepak Sharma)(?![^<]*>)', content)
    if leftover:
        print(f"\nWARNING: possible unreplaced terms: {set(leftover)}")
    else:
        print("Clean — no unreplaced source terms detected.")


if __name__ == "__main__":
    main()
