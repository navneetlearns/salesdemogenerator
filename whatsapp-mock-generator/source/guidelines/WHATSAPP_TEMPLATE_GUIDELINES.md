# WhatsApp Message Design Guidelines (Meta Compliance)

This document defines the rules for generating WhatsApp mock screens that are compliant with Meta's WhatsApp Business Platform guidelines. All generated screens MUST follow these rules to ensure that what is shown in demos accurately represents what can actually be built and deployed on WhatsApp.

---

## 1. Message Categories

Every business-initiated message on WhatsApp falls into one of three categories. The mock screens should visually reflect the category of each message.

### Marketing
- Promotional content: offers, product launches, upselling, cross-selling
- Campaign messages with CTAs like "Shop Now", "Know More"
- Re-engagement and win-back messages
- NOT for order updates or transactional content

### Utility
- Transactional: order confirmations, shipping updates, payment receipts
- Must be tied to a specific user action or transaction (e.g., "Order #1234 shipped")
- No promotional content, upselling, or discount offers allowed
- Generic feedback surveys ("How did we do?") are now classified as Marketing (July 2025 update)

### Authentication
- OTP / verification codes only
- Uses preset Meta format — no custom body text allowed
- Footer can contain code expiry notice

---

## 2. Template Message Structure

A WhatsApp template message has exactly 4 components. Only the **Body** is required.

### HEADER (Optional)
**Choose ONE format — they are mutually exclusive:**

| Format | Rules |
|--------|-------|
| **Text** | Max 60 characters. Supports ONE variable `{{1}}`. No complex formatting, no bold/italic/markdown. Plain text + one optional variable only. |
| **Image** | Single image. No text overlay. No formatting. Just the image file. |
| **Video** | Single video file. |
| **Document** | Single PDF/document file. Displays as attachment with filename. |
| **Location** | Location pin with name, address, lat/lon. |

**HEADER RULES:**
- ❌ NO bold, italic, strikethrough, or markdown in text headers
- ❌ NO multiple lines or line breaks in text headers
- ❌ NO images AND text combined in the same header
- ❌ NO complex formatted content (tables, HR lines, structured data)
- ✅ A text header is just a single plain-text line, optionally with one `{{1}}` variable

### BODY (Required)
- Max **1024 characters** for Utility and Authentication templates
- Max **1024 characters** for Marketing templates (550-char limit was rolled back)
- Supports: plain text, variables `{{1}}` `{{2}}` etc., emojis, and basic formatting
- **Allowed formatting:**
  - Bold: `*text*`
  - Italic: `_text_`
  - Strikethrough: `~text~`
  - Monospace: `` ```text``` ``
- **NOT allowed in body:**
  - ❌ Horizontal rules / divider lines (`---`, `___`, `<hr>`)
  - ❌ Tables or structured grid layouts
  - ❌ HTML tags of any kind
  - ❌ Headings (`#`, `##`, etc.)
  - ❌ Bullet point characters (use line breaks with text instead)
  - ❌ More than 4 consecutive spaces
  - ❌ Two or more consecutive newline characters
  - ❌ Variables at the very start or very end of the body text
  - ❌ Two consecutive variables without text between them (`{{1}}{{2}}`)
  - ❌ Too many variables relative to message length

**Body content structure for mock screens:**
```
✅ CORRECT:
Hi {{1}}, your order {{2}} has been confirmed.
Total: ₹{{3}}
Delivery by: {{4}}

Team, {{5}}

❌ WRONG (HR lines, complex formatting):
━━━━━━━━━━━━━━━━━━
📋 Order Estimate
━━━━━━━━━━━━━━━━━━
Order ID: BSPB-59
────────────────────
Total SKUs: 14
Total Value: ₹10,798
━━━━━━━━━━━━━━━━━━
```

### FOOTER (Optional)
- Max **60 characters**
- **Plain text ONLY** — no variables, no emojis, no formatting
- Typically used for: disclaimers, brand taglines, "Managed by ZoTok"
- Grey color, smaller font size than body

### BUTTONS (Optional)
Two types of buttons — **you cannot mix types in the same template**:

#### Quick Reply Buttons
- Max **3 buttons** per template
- Button label: max **25 characters** each
- Used for: simple responses ("Yes", "No", "Know More", "Order Now")
- Displayed as rounded pill buttons below the message

#### Call-to-Action (CTA) Buttons
- Max **2 buttons** per template
- Types: Phone Call OR URL
- Only **1 phone call button** allowed
- Max **2 URL buttons** allowed
- Button label: max **25 characters** each
- URL can be static or dynamic (with `{{1}}` suffix)

---

## 3. Interactive Messages (Session Messages)

These are sent WITHIN the 24-hour customer service window and do NOT need template approval. They are different from template messages.

### Reply Buttons
- Max **3 buttons**
- Button title: max **20 characters**
- No emojis or markdown in button titles
- Header can be: text, image, video, or document
- Body text: required
- Footer: optional

### List Messages
- Body text: required
- Header: text only (no media)
- Footer: optional
- Action button label: max **20 characters** (e.g., "Menu", "Choose")
- **Sections:** max 10 sections
- **Rows:** max 10 rows total across ALL sections
  - Row title: max **24 characters**
  - Row description: max **72 characters** (optional)
  - Row ID: max **200 characters**
- Section title: max **24 characters**

### CTA URL Button Messages
- One URL button with display text
- Optional header (text), body, footer

### Location Request Messages
- Body text + "Send Location" button
- No header or footer allowed

---

## 4. Visual Rendering Rules for Mock Screens

When generating HTML mock screens, render each message type with these visual rules:

### Template Messages (Business-initiated)
```
┌─────────────────────────────────┐
│ [HEADER: Image/Video/Doc/Text]  │  ← Only ONE type, or omit
│                                 │
│ Body text with *bold* and       │  ← Plain text + basic formatting
│ {{variables}} filled in         │
│                                 │
│ Footer text in grey             │  ← Small, grey, plain text
│                                 │
│ [Button 1] [Button 2] [Button 3]│  ← Quick Reply OR CTA, not both
└─────────────────────────────────┘
```

### Interactive List Message (Session)
```
┌─────────────────────────────────┐
│ Header Text                     │  ← Text only, no media
│                                 │
│ Body text explaining the menu   │
│                                 │
│ Footer text                     │  ← Grey, small
│                                 │
│        [ Menu Button ]          │  ← Opens list picker modal
└─────────────────────────────────┘

When tapped, shows:
┌─────────────────────────────────┐
│ Section Title 1                 │
│ ┌─────────────────────────────┐ │
│ │ Row Title        ○          │ │  ← Radio-style selection
│ │ Row description             │ │
│ ├─────────────────────────────┤ │
│ │ Row Title        ○          │ │
│ │ Row description             │ │
│ └─────────────────────────────┘ │
│ Section Title 2                 │
│ ┌─────────────────────────────┐ │
│ │ Row Title        ○          │ │
│ │ Row description             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Interactive Reply Buttons (Session)
```
┌─────────────────────────────────┐
│ [HEADER: Image/Video/Doc/Text]  │  ← Media OR text
│                                 │
│ Body text                       │
│                                 │
│ Footer text                     │
│                                 │
│ ┌─────────────┐                 │
│ │  Button 1   │                 │  ← Outlined buttons
│ ├─────────────┤                 │
│ │  Button 2   │                 │
│ ├─────────────┤                 │
│ │  Button 3   │                 │
│ └─────────────┘                 │
└─────────────────────────────────┘
```

---

## 5. ZoTok-Specific Message Patterns

These are the standard message patterns used in ZoTok demos. Each follows Meta's template rules.

### Order Estimate / Order Confirmed
**Category:** Utility
**Header:** Text — "Order Estimate" or "Order Confirmed"
**Body:**
```
Thanks for your confirmation! Here are your order details:

Order ID: {{1}}
Total SKUs: {{2}}
Total Order Value: ₹{{3}}
Net Order Value: ₹{{4}}

Team, {{5}}
```
**Buttons:** [View Order] [Raise an Issue]

### Invoice
**Category:** Utility
**Header:** Document (PDF attachment)
**Body:**
```
Please find the attached invoice. If you have any questions, please contact us.

Invoice No: {{1}}
Invoice Date: {{2}}
Amount: ₹{{3}}
Due Date: {{4}}

Team, {{5}}
```
**Buttons:** [Generate Payment Advice] [Raise an Issue]

### Outstanding / Payment Reminder
**Category:** Utility
**Header:** Image (QR code)
**Body:**
```
Outstanding Details:

Customer Name: {{1}}
Total Outstanding: ₹{{2}}

You can make the payment by:
Scanning the QR code above
UPI ID: {{3}}

For any clarifications, please reach out.

Team, {{4}}
```
**Buttons:** [Pay Now] [Raise an Issue]

### Payment Confirmation
**Category:** Utility
**Header:** None
**Body:**
```
Your payment has been received and confirmed. We will update your ledger shortly.

Payment Details:
Date: {{1}}
Amount Received: ₹{{2}}
Bank Transaction ID: {{3}}
UPI ID: {{4}}

Team, {{5}}
```
**Buttons:** None or [View Ledger]

### Marketing Campaign
**Category:** Marketing
**Header:** Image (product/brand creative)
**Body:**
```
Hi {{1}}, we are launching exciting new products this season! Check out our latest range and unlock special offers.

Team, {{2}}
```
**Buttons:** [Know Product] [Ask Me a Question] [Book Scheme]

### ZoPs Loyalty Points
**Category:** Utility
**Header:** Text — "ZoPs Points Earned!"
**Body:**
```
Hi {{1}},

You've earned *+{{2}} ZoPs* on this order!

This Order: +{{2}} ZoPs
Total Balance: {{3}} ZoPs
ZoPs Value: ₹{{4}} credit
Tier: {{5}}

Keep ordering to unlock more rewards!

Team, {{6}}
```
**Buttons:** [View Rewards] [Place Order]

### Welcome / Hi Menu
**Type:** Interactive List Message (session, not template)
**Header:** Text — "Welcome to {{Brand}}!"
**Body:** "We're here to help you quickly find what you need. Please choose an option:"
**Button:** "Menu"
**Sections & Rows:**
```
Section: Services
- View Catalogue | Browse products
- Get Estimate | Share quantity for quote
- Place an Order | Order products now
- Request Support | Ask questions
- Product Knowledge | Get instant answers
```

### Clock-in / Clock-out / Check-in / Check-out
**Category:** Utility
**Header:** None
**Body:**
```
You have clocked in on {{1}} - {{2}}
Lat & Lon: {{3}}, {{4}}
```
**Buttons:** None

---

## 6. Common Mistakes to Avoid in Mock Screens

| Mistake | Why It's Wrong | Correct Approach |
|---------|----------------|------------------|
| Complex formatted header with structured data | Header only supports plain text (60 chars), image, video, doc, or location — not formatted content | Use plain text header OR image header. Put structured data in body. |
| HR lines / dividers in body | WhatsApp body doesn't support `---`, `━━━`, or any divider lines | Use line breaks and *bold* labels to separate sections |
| Mixing quick reply and CTA buttons | Meta doesn't allow both types in the same template | Choose one type per template |
| More than 3 quick reply buttons | Max is 3 | Limit to 3 or use a List Message instead |
| Emojis in footer | Footer is plain text only, no emojis | Move emojis to body text |
| Variables at start/end of body | `{{1}}, your order is ready` — starts with variable | Add prefix: `Hi {{1}}, your order is ready` |
| Image + text combined in header | Header is ONE type only | Choose image OR text, not both |
| Table-like structured content in body | No tables in WhatsApp messages | Use labeled lines: `Order ID: {{1}}` on separate lines |
| Bullet points using • character | Not reliably supported | Use line breaks with emoji prefixes or numbered text |
| Button labels > 25 chars | Will be rejected by Meta | Keep labels short and actionable |

---

## 7. Character Limit Quick Reference

| Component | Limit |
|-----------|-------|
| Header (text) | 60 characters |
| Body (Marketing) | 1024 characters |
| Body (Utility) | 1024 characters |
| Footer | 60 characters |
| Quick Reply button label | 25 characters |
| CTA button label | 25 characters |
| Template name | 512 characters (lowercase, underscore, numbers only) |
| List message button | 20 characters |
| List row title | 24 characters |
| List row description | 72 characters |
| List section title | 24 characters |
| Reply button title | 20 characters |

---

## 8. When to Use What

| Scenario | Message Type | Requires Approval? |
|----------|-------------|-------------------|
| First contact / proactive outreach | Template (Marketing) | Yes |
| Order confirmation after customer places order | Template (Utility) | Yes |
| Invoice after order processing | Template (Utility) | Yes |
| Payment reminder | Template (Utility) | Yes |
| Responding to customer query within 24hrs | Interactive / Free-form | No |
| Showing a menu of options during conversation | Interactive List Message | No |
| Giving 2-3 quick response options | Interactive Reply Buttons | No |
| Sending OTP | Template (Authentication) | Yes |
| Campaign / promotion blast | Template (Marketing) | Yes |

---

## 9. Formatting Reference for Body Text

```
*bold text*           → bold text
_italic text_         → italic text
~strikethrough~       → s̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶
```monospace```        → monospace

Line breaks are done with actual newlines (not \n in display).
No HTML, no markdown headers, no tables, no horizontal rules.
```

---

*This document should be placed at `/guidelines/WHATSAPP_TEMPLATE_GUIDELINES.md` in the project root and referenced by CLAUDE.md.*
