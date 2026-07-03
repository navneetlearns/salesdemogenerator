#!/usr/bin/env python3
"""extract_content — HTML->journey-JSON extractor for legacy whatsapp-mock-generator
client projects (Phase 3 of the 22-project migration).

Produces demo-generator journey-JSON shape:
  {
    "steps": [
      {"num": int, "title": str, "description": str, "screens": [{"type": str, "data": {...}}]}
    ],
    "messages": {"welcome": {...}, "step1": {...}, ...}
  }

Selector conventions (consistent across 22 projects per _inspect_structure.py audit):
  <div id="step-N" class="step-section ..."> ... </div>
  <div class="step-lbl">Step Title</div>
  <div class="screen-wrap">...<div class="screen-lbl">Screen K · X</div>...</div>
  <div class="screen-type-lbl">WhatsApp message type label</div>
  <div class="phone-frame"> ... <div class="msg-body"> ... </div> ... </div>
  <div class="screen-desc">Description text</div>

screen.type is classified from screen-type-lbl keywords:
  "Interactive List*"      -> interactive-list
  "Utility Template*Document*" -> whatsapp-document
  "*Reply Button*" / "*Interactive Template*" / "*Image Header + CTA*"
                            -> whatsapp-template
  "*Handwritten Note*" / "*Session Message*" (no CTA markers)
                            -> whatsapp-message
  "*Commerce WebView*" / "*Admin Portal*" / "*Embedded WhatsApp Web App*"
                            -> pwa-webview
  "Architecture Diagram*"  -> pwa-webview (image-only)
  fallback                  -> pwa-webview

Messages:
  Each step's first <div class="msg-body"> text feeds messages["stepN"]["body"].
  The first step's first msg-body also seeds messages["welcome"]={title,body,time,cta}
  to satisfy scope (iii) without source text rewriting (placeholder substitutions
  happen at the Phase 6 Supabase seed step, NOT here — per the demo-generator skill
  pitfall about Handlebars expressions in journey JSON).

Pure stdlib (re, html.parser-optional) — no external deps. Idempotent: same input
yields byte-identical JSON output.
"""
from __future__ import annotations

import html as _html
import os
import re
import sys
from typing import Any

__all__ = ["extract_content"]

# Tag patterns — case-insensitive, tolerate attribute ordering variations.
_STEP_SECTION_RE = re.compile(
    r'<div\b[^>]*\bid="step-?(\d+)"[^>]*\bclass="[^"]*step-section[^"]*"[^>]*>(.*?)</div>\s*<!--\s*/step-\1\s*-->',
    re.IGNORECASE | re.DOTALL,
)

# Fallback: step-section with no closing comment — capture until next step-section
_STEP_SECTION_TAIL_RE = re.compile(
    r'<div\b[^>]*\bid="step-?(\d+)"[^>]*\bclass="[^"]*step-section[^"]*"[^>]*>(.*?)(?=<div\b[^>]*\bid="step-?\d+"[^>]*\bclass="[^"]*step-section|$)',
    re.IGNORECASE | re.DOTALL,
)

_STEP_LBL_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*step-lbl[^"]*"[^>]*>([^<]{2,200})</div>',
    re.IGNORECASE,
)

_SCREEN_WRAP_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*screen-wrap[^"]*"[^>]*>(.*?)(?=<div\b[^>]*\bclass="[^"]*screen-wrap"|</div>\s*<!--\s*/step-|$)',
    re.IGNORECASE | re.DOTALL,
)

_SCREEN_LBL_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*screen-lbl[^"]*"[^>]*>([^<]{2,200})</div>',
    re.IGNORECASE,
)

_SCREEN_TYPE_LBL_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*screen-type-lbl[^"]*"[^>]*>([^<]{2,200})</div>',
    re.IGNORECASE,
)

_SCREEN_DESC_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*screen-desc[^"]*"[^>]*>(.*?)</div>',
    re.IGNORECASE | re.DOTALL,
)

_PHONE_FRAME_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*phone-frame[^"]*"[^>]*>(.*?)</div>(?=\s*<div\b[^>]*\bclass="[^"]*screen-wrap|</div>\s*<!--\s*/step-|$)',
    re.IGNORECASE | re.DOTALL,
)

_MSG_BODY_RE = re.compile(
    r'<div\b[^>]*\bclass="[^"]*\bmsg-body\b[^"]*"[^>]*>(.*?)</div>',
    re.IGNORECASE | re.DOTALL,
)

_STATUS_TIME_RE = re.compile(
    r'<span\b[^>]*\bclass="[^"]*status-time[^"]*"[^>]*>([^<]{2,40})</span>',
    re.IGNORECASE,
)

_CTA_HREF_RE = re.compile(
    r'<a\b[^>]*\bhref="([^"]+)"[^>]*>([^<]{2,80})</a>',
    re.IGNORECASE,
)

_TAG_STRIP_RE = re.compile(r"<[^>]+>")


def _strip_tags(text: str) -> str:
    """Strip HTML tags and normalise whitespace; preserve entity-decoded text."""
    if not text:
        return ""
    out = _TAG_STRIP_RE.sub(" ", _html.unescape(text))
    out = re.sub(r"\s+", " ", out).strip()
    return out


def _classify_screen_type(type_lbl: str) -> str:
    """Map the screen-type-lbl text to a demo-generator screen-type id."""
    t = type_lbl.lower()
    if "interactive list" in t or "bottom sheet" in t:
        return "interactive-list"
    if "document header" in t or "utility template" in t and "document" in t:
        return "whatsapp-document"
    if "image header" in t and "cta" in t:
        return "whatsapp-template"
    if "reply button" in t:
        return "whatsapp-template"
    if "handwritten note" in t:
        return "whatsapp-message"
    if "session message" in t and "cta" not in t and "template" not in t:
        # bare session message — single text bubble
        return "whatsapp-message"
    if "interactive template" in t:
        return "whatsapp-template"
    # WebView/PWA / architecture diagram / admin portal / embedded web app
    return "pwa-webview"


def _chunks(html: str) -> list[tuple[int, str]]:
    """Return [(step_num, step_html), ...] using either the closing-comment or
    tail-up-to-next-step strategy — try the comment-bounded form first, then
    fall back to the tail form if it finds strictly more steps."""
    chunks: list[tuple[int, str]] = []
    seen_nums: set[int] = set()
    for m in _STEP_SECTION_RE.finditer(html):
        n = int(m.group(1))
        if n in seen_nums:
            continue
        seen_nums.add(n)
        chunks.append((n, m.group(2)))
    tail_pairs = _STEP_SECTION_TAIL_RE.findall(html)
    if len(tail_pairs) > len(chunks):
        chunks = [(int(n), body) for n, body in tail_pairs]
    chunks.sort(key=lambda c: c[0])
    return chunks


def _extract_messages_from_chunk(step_html: str) -> list[str]:
    """All msg-body texts in this step, in document order, tag-stripped."""
    return [_strip_tags(m.group(1)) for m in _MSG_BODY_RE.finditer(step_html) if _strip_tags(m.group(1))]


def _build_screen(scr_html: str) -> dict[str, Any]:
    """Build one {type, data} screen block from a screen-wrap chunk."""
    lbl_m = _SCREEN_LBL_RE.search(scr_html)
    type_m = _SCREEN_TYPE_LBL_RE.search(scr_html)
    desc_m = _SCREEN_DESC_RE.search(scr_html)
    label = _strip_tags(lbl_m.group(1)) if lbl_m else ""
    type_lbl = _strip_tags(type_m.group(1)) if type_m else ""
    desc = _strip_tags(desc_m.group(1)) if desc_m else ""
    screen_type = _classify_screen_type(type_lbl) if type_lbl else "pwa-webview"

    # Pull a status-time (10:22 AM) + CTA href if present
    time_m = _STATUS_TIME_RE.search(scr_html)
    body_texts = [_strip_tags(m.group(1)) for m in _MSG_BODY_RE.finditer(scr_html) if _strip_tags(m.group(1))]
    ctas = [{"label": l, "url": u} for u, l in _CTA_HREF_RE.findall(scr_html)]

    data = {
        "label": label,
        "screenTypeLabel": type_lbl,
        "description": desc,
        "messages": body_texts,
        "time": _strip_tags(time_m.group(1)) if time_m else "",
        "cta": ctas,
    }
    return {"type": screen_type, "description": desc, "data": data}


def extract_content(html_path: str) -> dict[str, Any]:
    """Parse a legacy whatsapp-mock-generator journey HTML into demo-generator
    journey-JSON shape. See module docstring for selector conventions.

    Args:
        html_path: filesystem path to the legacy HTML file.

    Returns:
        {id, steps[], messages{}} — schema-compatible shape. Messages include
        a `welcome` entry seeded from the first step's first msg-body, plus one
        entry per step keyed `stepN` containing that step's message bodies.
    """
    if not os.path.isfile(html_path):
        raise FileNotFoundError(html_path)

    with open(html_path, encoding="utf-8", errors="replace") as f:
        html = f.read()

    chunks = _chunks(html)
    steps: list[dict[str, Any]] = []
    welcome_bubble: str | None = None
    messages: dict[str, Any] = {}

    for num, step_html in chunks:
        lbl_m = _STEP_LBL_RE.search(step_html)
        title = _strip_tags(lbl_m.group(1)) if lbl_m else f"Step {num}"

        # description — prefer step-level screen-desc if present; else first
        step_desc_m = _SCREEN_DESC_RE.search(step_html)
        description = _strip_tags(step_desc_m.group(1)) if step_desc_m else ""

        screen_chunks = _SCREEN_WRAP_RE.findall(step_html)
        screens = [_build_screen(scr) for scr in screen_chunks] if screen_chunks else []

        steps.append({
            "num": num,
            "title": title,
            "description": description,
            "tags": [],
            "screens": screens,
        })

        # messages keyed by stepN — collect all bubble texts in this step
        step_body_texts = _extract_messages_from_chunk(step_html)
        if step_body_texts:
            messages[f"step{num}"] = {
                "title": title,
                "bodies": step_body_texts,
            }
        # Seed welcome from the first step's first bubble (legacy journeys open
        # with a welcome message in step 1).
        if welcome_bubble is None and step_body_texts:
            welcome_bubble = step_body_texts[0]

    if welcome_bubble is None:
        # Pure-PWA journey (no WhatsApp bubbles in step 1) — fall back to step 1 title
        welcome_bubble = steps[0]["title"] if steps else ""

    messages["welcome"] = {
        "title": steps[0]["title"] if steps else "Welcome",
        "body": welcome_bubble,
        "time": "",
        "cta": "",
    }

    journey_id = os.path.basename(html_path).replace(".html", "")
    return {
        "id": journey_id,
        "steps": steps,
        "messages": messages,
    }


if __name__ == "__main__":
    # CLI: python3 extract_content.py path/to/journey.html [output.json]
    if len(sys.argv) < 2:
        print("usage: extract_content.py <html_path> [output.json]", file=sys.stderr)
        sys.exit(2)
    result = extract_content(sys.argv[1])
    import json
    out = json.dumps(result, indent=2, ensure_ascii=False)
    if len(sys.argv) > 2:
        open(sys.argv[2], "w", encoding="utf-8").write(out)
    else:
        print(out)