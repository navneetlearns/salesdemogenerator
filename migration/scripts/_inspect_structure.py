#!/usr/bin/env python3
"""One-shot inspection: compare a legacy HTML's structure vs demo-generator
journey JSON for the same brand+journey, so we know what to extract."""
import json, re, os

BASE = "/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator"
html_path = os.path.join(BASE, "migration/projects/jkcement/jk_cement_order_to_cash.html")
json_path = os.path.join(BASE, "data/journeys/jk_cement_order_to_cash.json")

html = open(html_path).read()
j = json.load(open(json_path))

print("=" * 70)
print("DEMO-GENERATOR JSON: shape of one step (steps[0])")
print("=" * 70)
print(json.dumps(j["steps"][0], indent=2, ensure_ascii=False)[:700])

print("\n" + "=" * 70)
print("DEMO-GENERATOR JSON: messages object (sample of welcome + step1)")
print("=" * 70)
msgs = j.get("messages", {})
print("messages keys:", list(msgs.keys()))
if "welcome" in msgs:
    print("welcome keys:", list(msgs["welcome"].keys()) if isinstance(msgs["welcome"], dict) else type(msgs["welcome"]).__name__)
if "step1" in msgs:
    s1 = msgs["step1"]
    print("step1 type:", type(s1).__name__)
    if isinstance(s1, dict):
        print("step1 keys:", list(s1.keys()))

print("\n" + "=" * 70)
print("LEGACY HTML structure analysis")
print("=" * 70)

# 1. Where does step-section begin?
m = re.search(r'<div[^>]*class="[^"]*step-section[^"]*"[^>]*>', html)
if m:
    start = m.start()
    print(f"\nFirst step-section tag at byte {start}")
    print("Context (next 600 chars):")
    print(html[start:start + 600])
    print()

# 2. Try to find step headers — typically <h2>/<h3>/<div class="step-header">
print("\n--- step title patterns (try several selectors) ---")
patterns = [
    (r'<h[23][^>]*>(\d+[^<]{8,120})</h[23]>', "h2/h3 with digit"),
    (r'<div[^>]*class="step-header[^"]*"[^>]*>([^<]{8,120})</div>', "step-header"),
    (r'<div[^>]*class="step-lbl[^"]*"[^>]*>([^<]{8,120})</div>', "step-lbl"),
    (r'<div[^>]*class="step-title[^"]*"[^>]*>([^<]{8,120})</div>', "step-title"),
    (r'<div[^>]*class="[^"]*step-num[^"]*"[^>]*>([^<]{1,12})</div>', "step-num"),
]
for pat, name in patterns:
    hits = re.findall(pat, html)
    print(f"  {name:<30} matches: {len(hits)}  sample: {hits[:3]}")

# 3. screen-lbl content
print("\n--- screen-lbl content (first 5) ---")
for m in list(re.finditer(r'<div[^>]*class="screen-lbl"[^>]*>([^<]{8,160})</div>', html))[:5]:
    print(f"  {m.group(1)[:130]}")

# 4. screen-desc content
print("\n--- screen-desc content (first 5) ---")
for m in list(re.finditer(r'<div[^>]*class="screen-desc"[^>]*>(.{8,400}?)</div>', html, re.S))[:5]:
    # strip nested tags
    text = re.sub(r"<[^>]+>", " ", m.group(1)).strip()
    text = re.sub(r"\s+", " ", text)
    print(f"  {text[:180]}")

# 5. msg-body content
print("\n--- msg-body content (first 5) ---")
for m in list(re.finditer(r'<div[^>]*class="msg-body"[^>]*>([^<]{6,200})</div>', html))[:5]:
    print(f"  {m.group(1)[:160]}")

# 6. Chat area content
print("\n--- chat .text-field content (first 5) ---")
for m in list(re.finditer(r'<div[^>]*class="chat-text"[^>]*>([^<]{8,200})</div>', html))[:5]:
    print(f"  {m.group(1)[:160]}")

# 7. Step count check
step_count = html.count('class="step-section')
phone_count = html.count('class="phone-frame')
print(f"\n--- counts ---")
print(f"  step-section divs: {step_count}")
print(f"  phone-frame divs:  {phone_count}")