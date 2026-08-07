# Meta WhatsApp compliance — condensed (source: guidelines/WHATSAPP_TEMPLATE_GUIDELINES.md)

Every mock screen must be buildable on the real WhatsApp Business Platform.
These are the rules that get violated most; the full doc is the authority.

## Template messages (business-initiated, need Meta approval)

1. **Header = ONE type only**: Text (≤60 chars, plain, max 1 variable) OR Image OR
   Video OR Document OR Location. Never combine. No bold/italic/markdown in text headers.
2. **Document header** = PDF attachment bar (filename + pages + size + icon) ONLY.
   No image alongside. One header type per template.
3. **Image header** = image only. No text overlay, no .title/.subtitle on the image.
4. **Body**: NO divider lines (`---`, `━━━`, `<hr>`), NO tables/grids. Use labeled
   lines (`Order ID: {{1}}`) separated by line breaks. Max 1024 chars.
5. **Footer**: plain text only, ≤60 chars. No emojis, no variables, no formatting.
6. **Buttons**: ONE type per template — Quick Reply (max 3, ≤25 chars each) OR
   CTA (max 2 URL + 1 phone). NEVER mix. No emojis in button labels.
7. **Variables** `{{1}}`: cannot start or end the body; cannot be consecutive
   (`{{1}}{{2}}` is invalid).

## Interactive messages (session-only, within 24h window — no approval)

8. List messages / Reply buttons are session messages, NOT templates.
   No emojis in interactive button titles or list row titles. Row titles ≤24 chars.

## Groups

9. **NO WhatsApp Business Templates in groups** — groups only support plain session
   messages. No Quick Reply/CTA buttons or structured template components in group
   steps. (A group step shows free-text messages and @zoai mentions only.)

## Quick reference — char limits

| Component | Limit |
|---|---|
| Text header | 60 chars, 1 variable |
| Button label (QR) | 25 chars |
| List row title | 24 chars |
| Footer | 60 chars |
| Body | 1024 chars |

## ZoTok footer rule

Every mock phone screen carries the ZoTok footer ("Managed by ZoTok powered by Zono")
in the chat input area — it is part of the product story (channel is managed by ZoTok).
Only exception: screens that are NOT WhatsApp (ERP desktop, admin dashboards).
