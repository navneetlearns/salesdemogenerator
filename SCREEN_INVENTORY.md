# Screen Inventory: order_to_cash.hbs

> Generated: 2025-05-23
> Branch: `feature/catalog-monolith`
> Template: `templates/screens/order_to_cash.hbs` (2,495 lines, 199,295 chars)

---

## Overview

The monolith template contains **11 steps** with **26 sub-screens** total.
Only **42 lines** (1.7%) contain Handlebars expressions. The remaining **2,453 lines** are hardcoded HTML.

### Hardcoded Content Totals

| Category | Count | Notes |
|---|---|---|
| Unique ₹ prices | 30 | Product prices, order totals, tax amounts |
| Order numbers | 6 | JKO-46221, JKO-47011, JKO-47902, JKO-48283, JKO-48287, JKO-48291 |
| Invoice numbers | 1 | INV-7821 |
| Dealer names | 9 | Sharma Cement, Om Sai Dairy, Kishor Dairy, Shree Transport, etc. |
| Product references | 8+ | JK Super, OPC 43, OPC 53, PPC, JK Lakshmi, etc. |
| Inline style attributes | 411 | Average 16 per sub-screen |
| Inline SVGs | 252 | Icons, arrows, UI elements |
| Dates | 4 | 22/04/2026, 25/04/2026, 29/04/2026, 10/05/2026 |

### Layout Types

| Layout | Steps | Description |
|---|---|---|
| single-phone | 1, 2, 3 | WhatsApp chat view with phone frame |
| dual-phone | 4, 5, 7, 8, 9, 10, 11 | Two phones side by side |
| other | 6 | Full-width architecture diagram |

---

## Step-by-Step Breakdown

### Step 1: Self Service Ordering
- **Lines:** 5-474 (470 lines, 25,696 chars)
- **Layout:** single-phone
- **Sub-screens:** 3
  - Screen 1 · Self Service Menu — `Session Interactive Message - Reply Button`
  - Screen 2 · Browse Products — `Interactive List - Bottom Sheet Open`
  - Screen 3 · Product Selection — `Interactive List - Bottom Sheet Open`
- **Handlebars:** `{{brand.name}}`, `{{#with journey.messages.welcome}}`, `{{> whatsapp-message}}`
- **Hardcoded:** JK Cement, OPC 53, PPC
- **Inline styles:** 17 | **SVGs:** 27
- **What needs data:** Welcome message text, menu options, product category list, brand name

### Step 2: Catalog Browse & Order
- **Lines:** 478-784 (307 lines, 18,756 chars)
- **Layout:** single-phone
- **Sub-screens:** 3
  - Screen 1 · Browse Products Catalog — `Commerce WebView - Catalog Browse`
  - Screen 2 · Cart Review — `Commerce WebView - Cart`
  - Screen 3 · Order Received — `Utility Template - Document Header + CTA Buttons`
- **Handlebars:** `{{#each catalog.products}}`, `{{> product-card}}`, `{{cart.items.length}}`, `{{brand.name}}`, `{{brandLogo}}`
- **Hardcoded prices:** 4,032, 3,830
- **Hardcoded names:** JK Cement, PPC, Sharma Cement
- **Inline styles:** 13 | **SVGs:** 31
- **What needs data:** Product list, prices, cart items, order confirmation text, brand logo

### Step 3: AI Order Capture
- **Lines:** 788-1166 (379 lines, 25,524 chars)
- **Layout:** single-phone
- **Sub-screens:** 3
  - Screen 1 · Dealer Sends Order Note — `Session Message - Handwritten Note + AI Acknowledgement`
  - Screen 2 · Draft Order — `Interactive Template - Image Header + CTA Buttons`
  - Screen 3 · Cart & Checkout — `Commerce WebView - Cart Review & Checkout`
- **Handlebars:** `{{brand.name}}` (only 1 unique expression)
- **Hardcoded prices (11!):** 15,840, 7,840, 7,448, 4,800, 3,600, 1,950, 1,408, 960, 7,888, 352, 368
- **Hardcoded names:** JK Cement, JK Super, OPC 43, OPC 53, PPC, Sharma Cement
- **Inline styles:** 97 | **SVGs:** 23
- **What needs data:** AI chat messages, product names/prices in draft order, handwritten note content, item line items

### Step 4: Back Office Order Fulfilment
- **Lines:** 1174-1383 (210 lines, 24,042 chars)
- **Layout:** dual-phone
- **Sub-screens:** 2
  - Screen 1 · Orders to Process — `Admin Portal - Order Dashboard (app.zotok.ai)`
  - Screen 2 · Order Review & Accept — `Admin Portal - Order Detail & Approval (app.zotok.ai)`
- **Handlebars:** NONE (0 expressions)
- **Hardcoded:** JK Cement, JK Super, OPC 43, OPC 53, PPC, Sharma Cement, JKO-48291, JKO-48287, JKO-48283
- **Hardcoded amounts:** 35,080, 14,400, 8,800
- **Inline styles:** 146 | **SVGs:** 17
- **What needs data:** ENTIRELY hardcoded - dealer names, order IDs, amounts, dates, SKU line items, admin portal UI. Most severe step.

### Step 5: Order Confirmed Notification
- **Lines:** 1385-1591 (207 lines, 15,948 chars)
- **Layout:** dual-phone
- **Sub-screens:** 2
  - Screen 1 · Order Confirmed — `Utility Template - Document Header + CTA URL`
  - Screen 2 · Order Details (PWA) — `Commerce WebView - PWA Confirmed Order (Locked)`
- **Handlebars:** `{{#with cart.summary}}`, `{{> order-summary}}`, `{{brand.name}}`
- **Hardcoded:** 1,46,800, 15,840, 17,600, 18,400, 36,800, JK Cement, JK Super, OPC 43, OPC 53, PPC, Sharma Cement
- **Inline styles:** 24 | **SVGs:** 21
- **What needs data:** Order summary details, product line items with prices, confirmation message, order ID

### Step 6: SAP Integration Architecture
- **Lines:** 1592-1604 (13 lines, 1,100 chars)
- **Layout:** other (full-width diagram)
- **Sub-screens:** 1
  - ZoTok x SAP Integration Architecture — `Architecture Diagram`
- **Handlebars:** NONE (0 expressions)
- **What needs data:** Architecture description text, diagram image source (currently placeholder)

### Step 7: Invoice & Dispatch
- **Lines:** 1605-1703 (99 lines, 11,805 chars)
- **Layout:** dual-phone
- **Sub-screens:** 2
  - Screen 1 · New Invoice — `Utility Template - Document Header + Quick Reply`
  - Screen 2 · Dispatch Notification — `Utility Template - Document Header + CTA URL`
- **Handlebars:** `{{brand.name}}`
- **Hardcoded:** INV-7821, 1,46,800, 1,971, dates, Sharma Cement, JK Cement
- **Inline styles:** 5 | **SVGs:** 21
- **What needs data:** Invoice number, amounts, dates, dealer name, brand logo

### Step 8: Cash Discount & Payment Reminder
- **Lines:** 1705-1804 (100 lines, 12,349 chars)
- **Layout:** dual-phone
- **Sub-screens:** 2
  - Screen 1 · Cash Discount Expiring — `Utility Template - Quick Reply (Auto-reminder)`
  - Screen 2 · Payment Due Soon — `Utility Template - Quick Reply (Auto-reminder)`
- **Handlebars:** `{{brand.name}}`
- **Hardcoded:** INV-7821, 76,869, 1,971, 1,46,800, dates, Sharma Cement, JK Cement
- **Inline styles:** 6 | **SVGs:** 22
- **What needs data:** Invoice/due amounts, discount details, dates, dealer name

### Step 9: Payment Received
- **Lines:** 1806-2053 (248 lines, 20,025 chars)
- **Layout:** dual-phone
- **Sub-screens:** 3
  - Screen 1 · Payment Received — `Utility Template - Document Header + Quick Reply`
  - Screen 2 · Division Selection — `Interactive List - Session Message (24-hr window)`
  - Screen 3 · Settlement Confirmation — `Session Message + Utility Template - Image Header + CTA`
- **Handlebars:** `{{brand.name}}`
- **Hardcoded:** 1,00,000, 16,200, 28,500, 45,200, dates, Sharma Cement, JK Cement
- **Inline styles:** 15 | **SVGs:** 30
- **What needs data:** Payment amounts, division names/amounts, settlement details, dates, dealer name

### Step 10: Credit Note & Ledger
- **Lines:** 2053-2269 (217 lines, 24,090 chars)
- **Layout:** dual-phone
- **Sub-screens:** 3
  - Screen 1 · Credit Note Issued — `Utility Template - Document Header + CTA + Quick Reply`
  - Screen 2 · Ledger Statement — `ZoAi Session Message - Document Header + View Ledger Link`
  - Screen 3 · Ledger Page — `Commerce WebView - Dealer Ledger Statement`
- **Handlebars:** `{{brand.name}}`
- **Hardcoded:** 42,18,240.00, 40,000, 19,73,160, 18,42,160, 7,840, 1,46,800, INV-7821, dates, Sharma Cement
- **Inline styles:** 57 | **SVGs:** 34
- **What needs data:** Credit note amounts, ledger entries, GST calculations, dates, dealer name

### Step 11: Self Service Navigation Menu
- **Lines:** 2271-2492 (222 lines, 19,655 chars)
- **Layout:** dual-phone
- **Sub-screens:** 2
  - Screen 1 · Navigation Menu — `Embedded WhatsApp Web App - Self Service Side Drawer`
  - Screen 2 · Order History — `Embedded WhatsApp Web App - Order Dashboard`
- **Handlebars:** `{{brand.name}}`
- **Hardcoded:** 1,46,800, 1,12,500, 91,200, 52,300, Sharma Cement, JK Cement
- **Inline styles:** 28 | **SVGs:** 26
- **What needs data:** Navigation menu items, order history entries, amounts, dealer name

---

## Screen Type Inventory

| Type | Count | Steps |
|---|---|---|
| Utility Template | 8 | 5, 7, 8, 9, 10 |
| Commerce WebView | 5 | 2, 3, 5, 10, 11 |
| Interactive List | 3 | 1, 3, 9 |
| Admin Portal | 2 | 4 |
| Embedded WhatsApp Web App | 2 | 11 |
| Session Interactive Message | 1 | 1 |
| Session Message | 1 | 3 |
| Interactive Template | 1 | 3 |
| Architecture Diagram | 1 | 6 |
| ZoAi Session Message | 1 | 10 |

## Reusable Component Opportunities

The following patterns repeat across multiple steps and should become Handlebars partials:

1. **phone-frame** - Used 16x (wraps every sub-screen in a phone mockup)
2. **whatsapp-message** - Used across steps 1, 3, 7-10 (chat bubbles with different directions)
3. **screen-wrap** - Used 26x (every sub-screen has label + type label + description)
4. **status-bar** - Used 20x (phone status bar with time/battery/icons)
5. **wa-topbar** - Used 16x (WhatsApp header with brand name + back icon)
6. **chat-area** - Used 16x (WhatsApp chat message area)
7. **modal-row** - Used 20x (order detail rows in WhatsApp templates)
8. **date-pill** - Used 17x (date separators in chat)
9. **wa-tmpl** - Used 13x (WhatsApp template message wrapper)
10. **step2-phones** - Used 7x (dual-phone layout container)
