# ZoTok WhatsApp Mock Screen Generator

## Project Purpose

You are a WhatsApp UI mock screen generator for ZoTok's sales and business development team. You create pixel-perfect HTML mockups of WhatsApp conversations that showcase ZoTok's conversational commerce platform for client pitches and demos.

## Deployment

Generated journey files are hosted on AWS Amplify (`zotok-solutions`, `ap-south-1`). To deploy after generating or updating files, run `./deploy.sh` from the project root. Full instructions and IAM requirements are in `**/guidelines/DEPLOY.md**`.

## How It Works

The user provides a **user journey** in steps (typically 6–10 steps). For each step, you generate 1–3 WhatsApp app screens as a **single interactive HTML file** with navigation. The output is used by the sales team to walk clients through how ZoTok would work for their business.

---

## ⚠️ CRITICAL: Meta WhatsApp Template Compliance

**Before generating ANY WhatsApp message screen, ALWAYS read and follow the rules in `/guidelines/WHATSAPP_TEMPLATE_GUIDELINES.md`.**

This file contains Meta's official WhatsApp Business Platform rules for message templates and interactive messages. Every mock screen must be compliant with these rules so that what we demo to clients can actually be built and deployed.

**Key rules to always remember:**

1. **Header is ONE type only**: Text (60 chars, plain text, max 1 variable) OR Image OR Video OR Document OR Location. NEVER combine types. No bold/italic/markdown in text headers.
2. **Document header = PDF bar only**: A document header renders as an attachment bar (filename + page count + size + download icon). NO image can be added alongside it. One header type per template, always.
3. **Image header = image only**: No text overlay on the image. No `.title`, `.subtitle`, or any CSS text on top of the image area. All text goes in the body.
4. **Body has NO divider lines**: No `---`, `━━━`, `────`, `<hr>`, or any visual separators. Use line breaks and `*bold`* labels instead.
5. **Body has NO tables or grid layouts**: Structure content with labeled lines (`Order ID: {{1}}`) separated by line breaks.
6. **Footer is plain text only**: Max 60 chars. No emojis, no variables, no formatting.
7. **Buttons are ONE type per template**: Either Quick Reply (max 3, 25 chars each) OR CTA (max 2 URL + 1 phone). Never mix. **No emojis in button labels.**
8. **Variables cannot start/end the body** and cannot be consecutive (`{{1}}{{2}}`).
9. **Interactive messages (List, Reply Buttons) are different from templates** — they are session messages used within the 24hr window and have their own rules. **No emojis in interactive button titles or row titles.**
10. **No WhatsApp Business Templates in Groups** — groups only support plain session messages. No Quick Reply buttons, CTA buttons, or structured template components in group messages.

---

## Input Format

The user will provide:

### 1. Client/Brand Details

```
Brand Name: <company name>
Industry: <e.g., FMCG, construction, automotive, apparel>
Brand Color: <hex code, e.g., #1E3A8A> (optional, defaults to ZoTok blue #2563EB)
Accent Color: <hex code> (optional)
Logo URL or description: <optional>
```

### 2. User Journey Steps

```
Step 1: <description of what happens>
  - Perspective: buyer | seller | both | group
  - Screen: full | group | webview | chat-only | notification | flow-diagram
  - Screens: 1 | 2 | 3

Step 2: <description>
  - Perspective: buyer
  - Screen: full
  - Screens: 2
...
```

### 3. Defaults (if not specified per step)

- **Perspective**: buyer (what the retailer/customer sees)
- **Screen type**: full (complete WhatsApp UI with top bar, chat area, input bar)
- **Screens per step**: 1

---

## Screen Types

### `full` — Full WhatsApp DM Screen

Complete phone frame for a 1:1 business DM conversation:

- Status bar (time, battery number, signal)
- WhatsApp top bar: `**#075E54` dark teal** background, white text, white icons
- Chat area with `#ECE5DD` doodle background and message bubbles
- Input bar with attachment, camera, mic icons and "Type a message" placeholder

> Reference: `tmpl_whatsapp_dm_frame.html`

### `group` — WhatsApp Group Chat Screen

**Completely different top bar from DM — do not use the dark green header.**

- Status bar: **white background**, dark text and icons
- WhatsApp top bar: `**#FFFFFF` white** background, dark `#111111` text, dark icons
- Back arrow: `**#007AFF` iOS blue** (not white)
- Group avatar: group profile picture (circular)
- **No business message templates** — only plain session text/media messages
- Sender name shown as **first line inside each receiver bubble**, in that member's unique color
- "You (Name)" label appears **above** (outside) the green sender bubble
- Battery shown as number ("100") in a bordered box

> Reference: `tmpl_group_chat.html`

### `webview` — WhatsApp Native Browser (Commerce / Forms)

Pages opened inside WhatsApp's built-in browser. No WhatsApp template rules apply — web design principles govern these screens.

- Browser chrome: "Done" · "WhatsApp" title + URL (e.g., `mobile.zotok.ai`) · `···` menu
- Back / Forward / Share / Refresh browser nav at bottom
- No Meta template approval needed
- Sub-types: **catalog-browse**, **catalog-cart**, **web-form**, **ledger**

> References: `tmpl_catalog_browse.html`, `tmpl_cart.html`, `tmpl_web_form.html`, `tmpl_ledger_webview.html`

#### Ledger sub-type (`zonodigital.com`)

Dealer account statement page. URL domain: `zonodigital.com` (not `mobile.zotok.ai`).

- **Dealer header**: circle avatar with initials + dealer name + date range + calendar/download icons
- **Filter pills**: All (black filled active) · Payment · Debit Note · Credit Note · Sales — `display:flex;gap:7px;overflow-x:auto`
- **Table**: 3-column CSS grid (`1fr 70px 70px`) — Ledger | Debit | Credit. Never use HTML `<table>`.
- **Row color coding**: Opening Balance = `#FFF8E1` (yellow bg); Closing Balance = `#f5f5f5` (grey bg); Debit amounts = `#E53935` (red); Credit amounts = `#2E7D32` (green); missing values = `—` in grey
- **No Meta template approval needed**

### `chat-only` — Naked Message Cards

Just the message bubbles and CTAs without any phone chrome. Used for zooming into specific conversation segments or for the naked floating cards in flow diagrams.

### `notification` — Notification Bar

Shows the phone lock screen or notification shade with a WhatsApp notification preview. Used for showing how alerts appear to users.

### `admin` — Admin / Manager Dashboard (Desktop)

Desktop browser UI for head office, area managers, and back-office teams.

- Browser chrome: macOS traffic lights + URL bar showing `**app.zotok.ai`** (the ZoTok admin portal URL)
- No phone frame — full-width desktop card layout (max 900–940px)
- Typical layouts: table/grid for records, split map+timeline for activity history, KPI cards + data grid for reports
- No Meta template rules apply — web design principles govern these screens
- Admin panel URL: `**app.zotok.ai**` (use this consistently in address bars for all admin/manager screens)

> References: `tmpl_admin_dashboard.html`, `tmpl_admin_dashboard_flyout.html`

### `campaign` — Campaign Module (Admin Web Portal)

ZoTok admin portal screens for creating and managing WhatsApp campaigns. Uses the full portal shell: dark left nav (`#132c45`) + white sub-nav + `#ecf0f5` content area. No phone frame.

- **Create Campaign wizard**: 5-step stepper (Template → Details → Products → Audience → Settings)
- **Campaign Stats**: version tabs + KPI strip + delivery table
- **Template Builder**: full form with header type selector, body editor, variable mapping, live preview
- **WhatsApp Settings**: WABA details card + templates table (Default/Custom tabs, status badges)
- Stepper states: completed=`#2abb7f`, active=`#32a7e8`, future=`#8c8c8c`/`#d9d9d9`

> References: `references/campaigns/` — all 6 files listed in the Campaign Reference Catalog above

### `diagram` — Architecture / Infographic Step

A journey step that displays a full-width PNG or inline SVG diagram instead of phone frames. Used for SAP integration diagrams, multi-system flow charts, and infographic comparisons.

- No phone frame — content fills the available width up to 900px centred
- Embed as `<img src="data:image/png;base64,..." style="width:100%;height:auto;display:block;" />` or inline `<svg width="100%" height="auto" viewBox="0 0 W H">`
- Convert SVG → PNG with `sips -s format png input.svg --out output.png` (produces ~50% smaller file)
- **Required CSS overrides** (add per step ID, not globally):
  ```css
  #step-N.active { display: block; }  /* override default flex */
  #step-N .screen-wrap { width: 100%; max-width: 900px; margin: 0 auto; }
  ```
- `.screen-desc` needs `width:100%` (not the default phone-width)
- Do **NOT** add a `scaleStepNDesktop` function for diagram steps

> Reference: `tmpl_diagram_step.html`

### `flow-diagram` — Multi-Step Journey Visualization

Shows the WhatsApp conversation flow across multiple steps with connecting arrows. Uses the **"chrome once" pattern**:

- Full phone chrome (status bar + top bar + chat bg + input bar) rendered **exactly once** for the first screen
- All subsequent message cards are **naked floating components** — no phone frame, no chrome
- Cards sit directly on the `#ECE5DD` doodle background with drop shadows
- Steps connected by **dashed SVG arrows** (`stroke-dasharray: 5 3`, color `#128C7E`)
- WhatsApp logo mark (green circle) shown at bottom-left

> Reference: `tmpl_journey_flow_diagram.html`

---

## Message Component Types

**⚠️ All message types below follow Meta's WhatsApp guidelines. See `/guidelines/WHATSAPP_TEMPLATE_GUIDELINES.md` for full rules.**

### Text Bubble — Sender (right aligned)

`.msg-sender-wrap` > `.msg-sender` (`#DCF8C6` bg) > `.msg-body` + `.msg-time` + `.msg-tick`. Right-aligned. See `tmpl_whatsapp_dm_frame.html` for HTML snippet.

### Text Bubble — Receiver (left aligned)

`.msg-receiver-wrap` > `.msg-receiver` (white bg) > `.msg-body` + `.msg-time`. Left-aligned. See `tmpl_whatsapp_dm_frame.html` for HTML snippet.

### Group Message — Receiver (with sender name inside bubble)

Same as receiver bubble, with `.sender-name` div (member's unique color from palette) as first child inside `.msg-receiver`. See `tmpl_group_chat.html`.

### Group Message — Sender (label above bubble, outside)

`.sender-you-label` div (`#2E7D32`) sits **outside and above** `.msg-sender-wrap`, not inside the bubble. See `tmpl_group_chat.html`.

### Template Message (Business-initiated, requires Meta approval)

Structure: Header (optional) → Body (required) → Footer (optional) → Buttons (optional)

**Header** — ONE of the following, never combined:

- **Text**: plain text, max 60 chars, max 1 variable. NO bold/italic/markdown. Rendered as grey bar above body.
- **Image**: single image at full width (~140px tall in chat). No text overlay on the image.
- **Document**: PDF attachment bar only — filename + page count + size + download icon. No image alongside.
- **Video**: single video thumbnail
- **Location**: map pin

**Body** — required, max 1024 chars. Plain text + `*bold*` `_italic_` `~strikethrough~` + variables `{{1}}`. NO divider lines, NO tables, NO HR rules, NO HTML.

**Footer** — plain text only, max 60 chars, grey small text. NO emojis, NO variables.

**Buttons** — choose ONE type:

- Quick Reply: max 3 buttons, 25 chars per label, no emojis. Rendered as icon + text below template.
- CTA URL: max 2 URL buttons, 25 chars per label, no emojis. Use external link icon (↗).

### Interactive List Message (session only, no approval)

Used within 24hr window. Header must be text-only.

- Max 10 sections, 10 rows total
- Row title: **max 24 chars** (strictly enforced — validate before finalizing)
- Row description: max 72 chars
- Button label: max 20 chars
- **No emojis in row titles or button label**

Opens as a bottom-sheet modal with drag handle, section labels, rows, and a green Send button.

> Reference: `tmpl_interactive_list_menu.html`

### Reply Buttons (Interactive, session only)

Max 3 buttons, **20 chars per title**, no emojis in titles. Header can be text/image/video/document.

### Marketing Template (Image Header + Quick Reply)

- Header: Image (product/brand creative, no text overlay)
- Body: marketing copy, max 1024 chars, no dividers
- Buttons: Quick Reply — e.g., `Know Product`, `Ask Me a Question`, `Book Scheme` (max 3, plain text)
- ZoTok footer below card: `"Managed by ZoTok powered by Zono"` (32 chars ✓)

> Reference: `tmpl_image_header_template.html`

### Order Confirmed / Order Estimate Template (Utility)

- Header: Text — `"Order Confirmed"` or `"Order Estimate"` (plain text, no emoji)
- Body: emoji-prefixed bold fields, line-break separated, no dividers
- Buttons: CTA URL — `View Order Summary` + `Raise an Issue`

> Reference: `tmpl_order_confirmed.html`

### Invoice Template (Utility)

- Header: **Document** (PDF attachment bar only — `Invoice.pdf · 2 pages · 1.3MB`)
- Body: invoice fields, line-break separated
- Buttons: CTA URL — `Generate Payment Advice` + `Raise an Issue`
- **Do not add any image to the header when using Document type**

> Reference: `tmpl_invoice.html`

### Dispatch Note Template (Utility)

- Header: **Document** (standard pink/grey SVG icon — same style as Invoice. Use this for logistics/dispatch docs)
- Body: bold block title "**Dispatch Note**", intro text, then emoji-prefixed fields:
  - 📅 Dispatch Date, 📄 Dispatch Document No, 🚚 Transporter, 🚗 Vehicle Number, 📦 Delivery Terms
- Buttons: CTA URL — `View Dispatch` (single button; optionally add `Raise an Issue` as second)
- Trigger: Order dispatched from warehouse → SAP event → ZoTok webhook

> Reference: `tmpl_dispatch_note.html`

### Credit Note Template (Utility)

- Header: **Document** — use **red PDF icon** (`background:#E53935` pill with white "PDF" text, 8px bold). This is distinct from the pink/grey SVG icon used for invoices and dispatch notes. Red = credit / return documents.
- Body: bold block title "**Credit Note Issued**", intro text naming dealer, then emoji-prefixed fields:
  - 🗒 Credit Note No, 🔗 Reference Invoice, 💰 Credit Amount, 📝 Reason, 📅 Date
  - Closing line: "The credited amount will be adjusted against your upcoming invoices."
- Buttons (demo): Show `View Credit Note` (CTA URL) + `Download Ledger` (Quick Reply) to illustrate the interactive flow. **In production, buttons must be ONE type only** — do not mix CTA URL and Quick Reply in a real template.
- Trigger: SAP FI raises credit note → event-based webhook → ZoTok webhook → notification

> Reference: `tmpl_credit_note.html`

### ZoAi Bot Response Pattern (Session Message — no approval needed)

A 3-bubble conversational chain used when a template's Quick Reply triggers an automated ZoAi follow-up:

1. **Received template** — business-initiated, with Quick Reply button (e.g., "Download Ledger")
2. **Sent bubble** — dealer taps Quick Reply → sends keyword as a chat message (green `#DCF8C6` bubble, right-aligned)
3. **Received session message** — ZoAi detects keyword within 24hr window → responds with document/link (no template approval needed)

**Auto-scroll required**: When this pattern is in Screen N of Step M, the chat must scroll to the bottom so ZoAi's response is visible:
1. Add `id="sNsM-chat"` to the `<div class="chat-area">` of that screen
2. In `showDesktopStep(n)`, add: `setTimeout(function() { var c = document.getElementById('sNsM-chat'); if (c) c.scrollTop = c.scrollHeight; }, 80)`

> Reference: `tmpl_zoai_bot_response.html`

### Outstanding / Payment Template (Utility)

- Header: **Image** — a dynamic per-customer UPI QR code
  - The QR image is NOT hardcoded in the template — it is sent via API at send time: `header.image.link = https://qr.zotok.ai/{{customer_id}}.png`
  - Document this dynamic nature in any outstanding screen spec
- Body: customer name, total outstanding, UPI ID
- Buttons: CTA URL — `Pay Now` + `Raise an Issue`

> Reference: `tmpl_outstanding.html`

### WhatsApp Commerce — Catalog Browse (WebView)

Not a template. Opens in WhatsApp's native browser.

- Browser chrome at top and bottom
- Catalog topbar: business logo + name + "Catalogue" + search/camera/grid/cart icons
- Category tabs: scrollable pills (active = black filled)
- Product grid: 2-column, each card has image + category tag (blue pill) + name + price + qty selector
- Qty selector (item added): red-border trash circle + **blue-border pill** `#007AFF` with [−][qty][+]
- Qty selector (initial): single black [+] pill
- Cart bar: full-width `#00A884` — "NN Items · NN Qty" + "Go to cart ›"

> Reference: `tmpl_catalog_browse.html`

### WhatsApp Commerce — Cart (WebView)

- "Cart" title + "Draft" grey badge + "Add ⊕" blue button
- Cart items: thumbnail + name + price + category tag + "Replace" link + trash icon (red, no circle) + blue qty pill
- Requirement section: clipboard icon + "Total Items" + "Total Quantity"
- Orange estimate text: `"Estimate for your requirement will be available after the confirmation"`
- Checkout button: `**#111111` black**, full-width, 10px border-radius

> Reference: `tmpl_cart.html`

### Embedded Web Form (WebView)

- Grey pill header showing form name (e.g., "Adityacementsforms")
- Form fields: text inputs, dropdowns with chevron, date/time pickers with calendar icon
- Toggle pill group: active = `#111111` black filled, inactive = outline
- Submit button: brand green, full-width, 10px border-radius
- Phone number pre-filled from URL param `?wa=91XXXXXXXXXX`

> Reference: `tmpl_web_form.html`

---

## Visual Design Specifications

### Phone Frame

- Width: 310–375px (scale to context — use 305–310px for reference files, 375px for journey files)
- Border radius: 36–40px
- Border: 7–8px solid `#1a1a1a`
- Shadow: `0 20px 60px rgba(0,0,0,0.3)`

### WhatsApp Color Tokens


| Element                      | Color         | Notes                                     |
| ---------------------------- | ------------- | ----------------------------------------- |
| DM top bar background        | `#075E54`     | Dark teal — DM only                       |
| DM top bar text / icons      | `#FFFFFF`     |                                           |
| **Group top bar background** | `**#FFFFFF`** | **White — completely different from DM**  |
| **Group top bar text**       | `**#111111`** | **Dark**                                  |
| **Group back arrow**         | `**#007AFF`** | **iOS blue**                              |
| Chat background              | `#ECE5DD`     | With SVG doodle pattern at 13–18% opacity |
| Sender bubble                | `#DCF8C6`     | Light green                               |
| Receiver bubble              | `#FFFFFF`     | White                                     |
| Quick reply button text      | `#00A884`     | WA teal                                   |
| CTA button text              | `#00A884`     |                                           |
| Input bar background         | `#F0F0F0`     |                                           |
| Input field background       | `#FFFFFF`     |                                           |
| Input placeholder            | `#8696a0`     |                                           |
| Input icons                  | `#54656f`     |                                           |
| Message text                 | `#111B21`     |                                           |
| Time text                    | `#667781`     |                                           |
| Double tick (read)           | `#53bdeb`     | Blue                                      |
| ZoTok footer text            | `#8696a0`     | Below template card                       |
| Commerce cart bar            | `#00A884`     | Or brand color                            |
| Commerce qty pill border     | `#007AFF`     | iOS blue                                  |
| Checkout button              | `#111111`     | Black                                     |
| Book Scheme Send button      | `#25D366`     | WA green                                  |
| Template text header bg      | `#f5f5f5`     | Grey bar                                  |
| Template footer text         | `#667781`     | Small, below body                         |


### Group Chat — Member Name Color Palette

Assign colors sequentially. Never reuse the same color for two different members.


| Role                 | Color              |
| -------------------- | ------------------ |
| Member 1             | `#E91E63` (pink)   |
| Member 2             | `#9C27B0` (purple) |
| Member 3             | `#1565C0` (blue)   |
| Member 4             | `#E65100` (orange) |
| You / Self           | `#2E7D32` (green)  |
| ZoTok bot / Business | `#00897B` (teal)   |


### Typography

- Message text: 13.5–14px, line-height 1.45
- Time: 10.5–11px
- Sender name (in group, inside bubble): 12.5px, font-weight 700
- Button text: 12.5–14px, font-weight 500
- Template text header: 14px, font-weight 700
- Group name in top bar: 14.5px, font-weight 600, color `#111111`

### Battery Icon Styles

- **iOS 16+ style** (used in group/webview screens): shows number ("47", "100") in a bordered rectangle box
- **Classic style** (used in DM screens): filled rectangle bar

### Brand Customization

When the user specifies brand colors:

- Rich card image headers use brand color as gradient
- Campaign/marketing message banners use brand color
- Company name in receiver messages uses brand color
- Cart bar uses brand green instead of `#00A884`
- Form submit button uses brand color

---

## ZoTok Branding — Footer Rule

> ⚠️ **NEVER add "Managed by ZoTok powered by Zono" (or any ZoTok/Zono branding line) inside chat bubble screens, plain session message screens, or AI conversation screens.** Do not render it as an inline div, caption, or subtitle within the chat area under any circumstances.

The ZoTok footer text is **only permitted** in these two specific locations:

**1. WhatsApp Template message footer field** — only inside `<div class="wa-tmpl-footer">` on a formal Business template card. Text: `Managed by ZoTok powered by Zono` (32 chars ✓). Never in a plain chat bubble.

**2. In-app modal / WebView footer** — only inside modals (`modal-footer-ztk`) or WebView pages. Text: `🎯 Managed by ZoTok powered by Zono · Learn More`. Never in a chat bubble context.

---

## Reference Files — `/references/`

**Before generating any screen, read the matching HTML reference file.** Each file contains:

- A live visual preview (left pane)
- A spec panel (right pane) with: component breakdown, char count validation, color tokens, compliance checklist, and copy-paste HTML snippets

Do not read SVG files — they are too large and have been superseded by the HTML references.

### Reference File Catalog

```
/references/
├── tmpl_whatsapp_dm_frame.html              # Base DM frame — colors, dimensions, input bar, doodle bg
├── tmpl_group_chat.html                     # Group chat — white top bar, member colors, no templates
├── tmpl_group_creation.html                 # Group creation flow — admin sets up brand × territory group
├── tmpl_image_header_template.html          # Marketing template — image header + quick reply buttons
├── tmpl_order_confirmed.html                # Utility — image header banner + emoji body + CTA URL buttons (group: short URLs)
├── tmpl_invoice.html                        # Utility — document (PDF bar only) + CTA URL buttons
├── tmpl_outstanding.html                    # Utility — dynamic QR image header + CTA URL buttons
├── tmpl_payment_received.html               # Utility — no header, payment details body, no buttons
├── tmpl_interactive_list_menu.html          # Interactive list — bottom sheet, row char limits
├── tmpl_catalog_browse.html                 # Commerce WebView — product grid, qty pill, cart bar
├── tmpl_cart.html                           # Commerce WebView — cart review, checkout
├── tmpl_web_form.html                       # WebView form — inputs, toggle pills, submit button
├── tmpl_journey_flow_diagram.html           # Flow diagram — chrome-once pattern, dashed arrows
├── tmpl_admin_dashboard.html                # Admin desktop UI — browser chrome, tabs, table, View/Approve/Reject actions
├── tmpl_admin_dashboard_flyout.html         # Admin flyout panel — right-side detail view opened on "View" click, with Approve/Reject footer
├── tmpl_admin_report.html                   # Admin report grid — KPI card strip + sortable data table + totals footer (Sales Team Activity)
├── tmpl_clock_in.html                       # Field ops — SE clock-in/out via @zoai in WhatsApp group, location share
├── tmpl_check_in.html                       # Field ops — SE customer check-in/out via @zoai, visit duration, order summary
├── tmpl_fieldops_activity_timeline.html     # Field ops — mobile PWA activity log (Safari chrome, ZoAi auto-log timeline)
├── tmpl_infographics_bullets.html           # Infographic — bullet-point visual summary card
├── tmpl_dispatch_note.html                  # Utility — document header (standard pink icon) + dispatch fields + View Dispatch CTA
├── tmpl_credit_note.html                    # Utility — document header (RED PDF icon) + credit note fields + mixed demo buttons
├── tmpl_zoai_bot_response.html             # ZoAi session pattern — template → Quick Reply → ZoAi doc response (auto-scroll setup)
├── tmpl_ledger_webview.html                 # WebView ledger — zonodigital.com, 3-col table, filter pills, color-coded debit/credit
├── tmpl_diagram_step.html                   # Diagram step — full-width PNG/SVG, CSS overrides (display:block, max-width:900px)
│
└── campaigns/                               # ── Campaign module screens (admin web portal) ──
    ├── tmpl_campaign_create_step1_template.html  # Create Campaign Step 1 — Template Library picker (filter chips, card grid, 3 types: One Frame / Carousel / Custom)
    ├── tmpl_campaign_create_step2_details.html   # Create Campaign Step 2 — Details form (campaign name, header type, body variables, live message preview)
    ├── tmpl_campaign_create_step4_audience.html  # Create Campaign Step 4 — Audience selection (Standard / By Segments / Smart Lead / Events) + customer table + search drawer
    ├── tmpl_campaign_stats.html                  # Campaign analytics — version tabs, KPI strip (Sent/Delivered/Read/Replied), delivery status table
    ├── tmpl_campaign_template_builder.html       # Settings → WhatsApp → New Message Template (full builder: name/category/language, header type toggle, body editor, variable mapping, footer, buttons, live preview)
    └── tmpl_campaign_whatsapp_settings.html      # Settings → WhatsApp — WABA details card (ID, number, limit, quality, status) + templates table (Default/Custom tabs, status badges)
```

### Campaign Module — Portal Shell Tokens

All campaign screens share the same ZoTok admin portal shell:

| Token | Value |
|---|---|
| App background | `#ecf0f5` |
| Left nav | 48px wide, `#132c45` dark navy |
| Sub-nav | 68px wide, white; active=`#32a7e8`, inactive=`#595959` |
| Stepper | completed=`#2abb7f`, active=`#32a7e8`, future=`#d9d9d9` circle / `#8c8c8c` label |
| Primary button | `#32a7e8` bg, white text |
| Variable tag | `#e8f0fe` bg, `#0049b5` text |
| Status badges | Active=`#e8f5e9/135439`, Modified=`#fff8e1/734d00`, Rejected=`#fce8e8/631805` |
| URL bar | `app.zotok.ai` |


### How to Use References

1. **Match the step to a reference**: Identify which reference file most closely matches the screen being generated
2. **Read the spec panel**: Use the component breakdown, char count table, and compliance checklist
3. **Copy the HTML snippet**: Use the snippet from the reference as the starting point — adapt content, keep structure
4. **Compose from multiple references**: If no single match, combine patterns (e.g., DM frame + outstanding payment card)
5. **Do not deviate from validated patterns**: If the reference shows a specific structure (e.g., document header = bar only), follow it exactly

---

## Content Generation Rules

When generating message content from journey descriptions:

1. **Classify message type first**: Template (Marketing/Utility) vs Interactive session vs Group message vs Commerce WebView. This determines all allowed components.
2. **Check screen type**: DM (`full`) = dark green top bar. Group (`group`) = white top bar, no templates. WebView = browser chrome, web design rules.
3. **Follow Meta template guidelines**: No divider lines in body, single header type, button limits, no emojis in button/row titles.
4. **Use realistic data**: Real-looking order IDs (e.g., "BSPB-59"), amounts in ₹, Indian phone numbers, IST timestamps
5. **Match industry**: Use industry-appropriate product names, categories, terminology
6. **Personalize**: Use placeholder names like "Aditya Ram", "Kishor Welding Works", "Om Sai Enterprises"
7. **ZoTok branding**: Only in WhatsApp template footer field (`wa-tmpl-footer`) or WebView/modal footer (`modal-footer-ztk`). **Never** add ZoTok/Zono branding text inside chat bubble screens or session message screens.
8. **Realistic timestamps**: Messages should have realistic time progression (e.g., 12:51 PM, 12:52 PM, 12:54 PM)
9. **Indian English**: Use Indian business English conventions ("kindly", "please find attached", "Team, Company Name")
10. **Validate char limits before finalizing**: Header text ≤60 chars, Body ≤1024 chars, Footer ≤60 chars, Quick Reply labels ≤25 chars, Interactive button/row titles ≤20/24 chars

---

## ⚠️ Scope Discipline

**Only build what is explicitly requested in the current message. Never infer or generate the next page/step/screen beyond what was asked.**

- If the user asks for "Page 1", build Page 1 only — even if you can see Pages 2 and 3 will be needed.
- If "continue" is ambiguous (e.g., the last task is already complete), **stop and ask what to build next** rather than assuming.
- When a page is complete, report what was done and wait for the next instruction.
- Sidebar entries for future pages should be stubs marked "Coming soon" — not fully built pages.

---

## Step-by-Step Generation Process

When the user provides a journey, follow this process:

1. **Parse the journey**: Extract steps, perspectives, screen types, screen counts
2. **Read `/guidelines/WHATSAPP_TEMPLATE_GUIDELINES.md`**: Review Meta compliance rules before writing any content
3. **Read the relevant HTML references**: For each step, identify the matching reference file(s) in `/references/` and read the spec panel. Use the HTML snippet as the starting point.
4. **Determine DM vs Group vs WebView for each step**: This controls the top bar color, template availability, and component rules
5. **Classify each message**: Template (Marketing/Utility) or Interactive session or Commerce WebView or Group session message
6. **Generate content**: Write realistic WhatsApp messages strictly following component rules for each type
7. **Validate char counts**: Check every header, button label, list row title against limits before finalizing
8. **Build HTML**: Create the single-file HTML with all screens, navigation, and interactivity
9. **Save to `/projects/<client_name>/`**: Create the directory if needed
10. **Report**: List all steps and screens generated with message type, category, and any compliance notes

---

## Output Structure

### File Location

Save the HTML file to: `/projects/<client_name>/journey_<journey_name>.html`

Example: `/projects/skf/journey_dealer_onboarding.html`

### HTML Structure

Generate a **single self-contained HTML file** with:

1. **Navigation sidebar** (left side, collapsible on mobile):
  - Journey title and client brand
  - List of steps (clickable, highlights active step)
  - Step descriptions
2. **Screen display area** (center):
  - Phone frame with WhatsApp mock inside
  - If step has multiple screens, show them side by side (max 3)
  - If `perspective: both`, show buyer phone + seller phone side by side
  - If `screen: flow-diagram`, use chrome-once pattern with naked floating cards
3. **Navigation controls** (bottom):
  - Previous / Next step buttons
  - Step counter: "Step 3 of 8"
  - Keyboard navigation: left/right arrow keys
4. **Interactive mode** (optional):
  - CTAs are clickable and navigate to the next relevant screen

### Responsive Behavior

**Breakpoint:** `@media (max-width: 768px)` separates desktop from mobile.

#### Desktop layout
- White `<nav class="sidebar">` fixed on the left with logo, step items, and `sb-foot` (Back to Main Menu link)
- `.nav-bar` bottom strip with Prev / Next buttons + step counter
- Up to 3 phone frames side by side inside `.phones-row`
- `.screen-desc` card sits below each phone frame (width matches phone frame)

#### Mobile layout
- Sidebar hidden by default; revealed by `.mob-hamburger` (3-bar icon) via `openSidebar()` / `closeSidebar()`
- `.mob-overlay` full-screen backdrop (z-index 999) dismisses sidebar on tap
- `.nav-bar` hidden; replaced by `.mob-swipe-hint` fixed bottom bar with Prev / Menu / Next buttons + step counter
- Phones swipe horizontally as slides; all steps flatten to a single slide list
- `.screen-desc` renders as a `position:fixed` overlay above the bottom nav bar, fades in after 1.5s via `desc-visible` class

#### Critical CSS rules (must always be present)

- `.phone-wrap` — `display:flex; flex-direction:column; align-items:center; gap:6px` — stacks screen-lbl → screen-type-lbl → phone frame → screen-desc vertically
- `.phones-row` — `display:flex; flex-wrap:nowrap; gap:22px; align-items:flex-start` — **`nowrap` is mandatory**; side-by-side phones, never stacked
- `.screen-lbl` — 10.5px uppercase grey label above phone
- `.screen-type-lbl` — 10px grey message-type label, `margin-bottom:2px`
- `.screen-desc` desktop — `width:375px; border-radius:12px; padding:10px 14px; font-size:13px`
- `.screen-desc` mobile (inside `@media` block) — `position:fixed!important; bottom:58px!important; opacity:0; transition:opacity 0.5s` — revealed by `.desc-visible` class

#### Logo embedding
Embed brand logo **once** in CSS: `.tb-av { background: url("data:image/jpeg;base64,...") center/cover; width:33px; height:33px; border-radius:50% }`. Never repeat per phone frame.

#### Screen structure inside a step
Order inside `.phone-wrap`: `screen-lbl` → `screen-type-lbl` → `.pf` (phone frame) → `.screen-desc`. Missing `.phone-wrap` causes labels to render behind frames. Missing `flex-wrap:nowrap` on `.phones-row` causes multi-screen steps to stack vertically on desktop.

---

## Starter Templates

When starting a new client project, copy from these two templates instead of building from scratch. They have all responsive patterns, logo embedding, navigation, and screen structure already implemented and tested.

### Baseline patterns — required in ALL journey files (single or multi)

Every journey file, regardless of project type, must have all of these:

| Pattern | CSS / Element | Notes |
|---|---|---|
| `.phone-wrap` | `display:flex;flex-direction:column;align-items:center;gap:6px` | Stacks screen-lbl, screen-type-lbl, phone frame, screen-desc vertically |
| `.phones-row` | `display:flex;flex-wrap:nowrap;gap:22px;align-items:flex-start` | Side-by-side phones; `nowrap` is mandatory |
| `.screen-lbl` | Step label above phone | e.g. "Screen 1 · Order Confirmed" |
| `.screen-type-lbl` | Message type below screen-lbl | e.g. "Utility Template — Text Header + CTA" |
| Logo CSS embedding | `.tb-av { background: url("data:image/jpeg;base64,...") center/cover }` | Defined once in `<style>`, not repeated per phone frame |
| White sidebar | `<nav class="sidebar">` with hamburger + mob-overlay | See Responsive Behavior section |
| Mobile nav | `.mob-swipe-hint` fixed bottom bar | Replaces `.nav-bar` on mobile |
| `.screen-desc` | Coloured card below phone (desktop) / fade-in overlay (mobile) | Both CSS rules required |

### Single-journey project → copy from Haldirams activation journey
**Reference file:** `projects/Haldirams/journey_retailer_activation.html`

Use when the client needs one journey file (e.g., a single use-case demo). This file has all baseline patterns above fully implemented.

Steps to start a new single-journey project:
1. Copy `projects/Haldirams/journey_retailer_activation.html` → `projects/NewClient/journey_name.html`
2. Replace brand color, logo base64 on `.tb-av`, journey title, and `const steps` array
3. Replace step section content; update sidebar step items
4. Run `python3 scripts/inject_screen_descs.py` to add screen-desc cards from a config

> **Note:** `projects/Savera/journey_field_ops.html` is missing `screen-type-lbl` and logo CSS embedding. Do not use it as a template until those gaps are backfilled.

### Multi-journey project → copy from Haldirams
**Reference files:** `projects/Haldirams/journey_retailer_activation.html` + `projects/Haldirams/index.html`

Use when the client needs multiple journey files linked from a landing page. Same baseline as above, plus:
- `index.html` landing page with hero banner + journey cards
- Cross-journey nav (← Main Menu + Next Module → buttons wired via `wire_journey_nav.py`)

Steps to start a new multi-journey project:
1. Copy `projects/Haldirams/journey_retailer_activation.html` for each journey file
2. Copy `projects/Haldirams/index.html` → adapt hero, journey list
3. Update brand color, logo, journey titles, step content in each file
4. Run `python3 scripts/gen_index.py` if rebuilding index from a JSON config
5. Run `python3 scripts/wire_journey_nav.py` to wire cross-journey navigation

---

## Example Usage

```
Brand Name: SKF Bearings
Industry: Industrial/Automotive
Brand Color: #003D7C

Journey: Dealer Onboarding

Step 1: Dealer sees Facebook ad for SKF products
  - Perspective: buyer / Screen: full / Screens: 1

Step 2: Dealer clicks ad, lands on WhatsApp, sees welcome menu
  - Perspective: buyer / Screen: full / Screens: 2

Step 3: Dealer browses product catalogue and selects bearings
  - Perspective: buyer / Screen: webview / Screens: 2

... (continue for all steps)
```

Output: `/projects/skf/journey_dealer_onboarding.html` — single self-contained HTML file with all screens and navigable steps.

---

## Project Utility Scripts — `/scripts/`

Reusable Python scripts for scaffolding and maintaining journey files. Run from the project root. All support `--dry-run`.

| Script | Purpose | Key args |
|---|---|---|
| `gen_index.py` | Generate `index.html` landing page for a client's journey collection | `--project`, `--config` (JSON with brand/journey list), `--out` |
| `wire_journey_nav.py` | Add "← Main Menu" / "Next Module →" buttons between journey files | `--project`, `--config` (JSON with `journeys[].next_file`) |
| `add_step.py` | Insert a step at any position, renumber all subsequent steps atomically | `--file`, `--position`, `--label`, `--html-file` (inner HTML only) |
| `inject_screen_descs.py` | Inject `.screen-desc` cards from config (maps `screen-lbl` text → bg/title/body) | `--file`, `--config` |
| `cleanup_nav_js.py` | Strip dead `const xxxBtn` / `if(xxxBtn)` lines after nav refactors | `--project` or `--file` |
| `clone_field_ops_journey.py` | Copy and rebase the field ops journey template for a new client | See file docstring |

---

## Technical Notes

- All CSS is inline or in `<style>` tags — no external dependencies
- Use CSS custom properties for brand colors so they're easy to override
- Phone frame uses fixed dimensions matched to each screen type (305–375px wide)
- Chat background uses a subtle repeating SVG pattern mimicking WhatsApp's doodle background (13% opacity for inside chat, 18% opacity for full-page flow diagrams)
- All icons are inline SVG (no external icon libraries)
- The HTML must be fully self-contained — openable in any browser with zero dependencies
- Battery icon: use the number-in-box style ("100", "47") for group and webview screens; classic fill bar for DM screens
- Flow diagrams: use `position: absolute` canvas with SVG arrows overlay; dashed stroke `stroke-dasharray: 5 3`, color `#128C7E`, arrowhead markers
- **PWA vs WebView**: PWA installed apps must NOT have `browser-bar` or `browser-nav` divs. After the status bar, show only the PWA app header directly. Remove both divs when a step is described as an installed PWA rather than a browser webview.
- **Red PDF icon**: Use `background:#E53935;border-radius:6px` pill with white "PDF" text (8px bold) in `.wa-hdr-doc` for credit notes and return documents. Standard pink/grey document SVG icon is for invoices and dispatch notes. Red = credit / debit / return; Pink/grey = invoices and logistics.
- **Auto-scroll for long chat conversations**: When a screen shows a multi-bubble sequence where the latest message is off-screen (e.g., template → quick reply → ZoAi response), add `id="sNsM-chat"` to that screen's `<div class="chat-area">` and add `setTimeout(function() { var c = document.getElementById('sNsM-chat'); if (c) c.scrollTop = c.scrollHeight; }, 80)` inside `showDesktopStep` for that step number.
- **scaleStepNDesktop for 3-phone steps**: When a step has 3 side-by-side phones (natural width = 305×3 + 20×2 = 955px), add a scale function and call it from `showDesktopStep`. Pattern: `function scaleStepNDesktop() { if(isMobile()) return; const available = window.innerWidth - 260 - 32; const scale = Math.min(1, available / 955); const el = document.getElementById('step-N'); if(el) el.style.zoom = scale < 1 ? scale : ''; }` — trigger with `if (n === N) setTimeout(scaleStepNDesktop, 10)`. Diagram steps do NOT need this.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **whatsapp-mock-generator** (442 symbols, 469 relationships, 2 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/whatsapp-mock-generator/context` | Codebase overview, check index freshness |
| `gitnexus://repo/whatsapp-mock-generator/clusters` | All functional areas |
| `gitnexus://repo/whatsapp-mock-generator/processes` | All execution flows |
| `gitnexus://repo/whatsapp-mock-generator/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
