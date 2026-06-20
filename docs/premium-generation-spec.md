# Premium Generation Spec — Path C

> Reference-quality static HTML demos for client-facing presentations.

## Overview

Path C generates standalone, self-contained HTML files with rich WhatsApp-style
conversations, inline CSS, base64-embedded brand logos, and full keyboard/sidebar
navigation. These coexist with Path A (build.js) and Path B (demo-renderer.js)
outputs at `dist/{brand}/premium/`.

## Brand Specs

### JK Cement

| Property | Value |
|----------|-------|
| Industry | Building Materials — Cement & Allied Products |
| Brand color | `#003D7A` (deep blue) |
| Brand dark | `#002856` |
| Accent | `#C1A56C` (gold) |
| Logo | `assets/brands/logo.webp` → base64 embedded |
| Products | OPC 53 Grade, PPC, PSC, Composite Cement |
| Price range | ₹320–₹420 per bag |

### Haldirams (reference only)

| Property | Value |
|----------|-------|
| Brand color | `#E8201E` (red) |
| Accent | `#FFD700` (gold) |

## Journey Step Specs — JK Cement

### 1. order_to_cash (11 steps)

| Step | Title | Perspective | Screens |
|------|-------|-------------|---------|
| 1 | Self Service Ordering | Buyer | Menu, Order Form |
| 2 | Catalog Browse & Order | Buyer | Product List, Cart, Checkout |
| 3 | AI Order Capture | Buyer | AI Chat, Confirmation |
| 4 | Back Office Order Fulfilment | Seller | Order Mgmt, Inventory |
| 5 | Order Confirmed Notification | Buyer | Confirmation, Tracking |
| 6 | SAP Integration Architecture | Both | System Diagram, Flow |
| 7 | Invoice & Dispatch | Both | Invoice, Shipping |
| 8 | Cash Discount & Payment Reminder | Buyer | Discount, Reminder |
| 9 | Payment Received | Both | Payment, Receipt |
| 10 | Credit Note & Ledger | Buyer | Credit Note, Ledger |
| 11 | Self Service Navigation Menu | Buyer | Menu |

### 2. field_ops_expense (15 steps)

| Step | Title | Perspective | Screens |
|------|-------|-------------|---------|
| 1 | Admin Creates Group | Seller | Group Creation |
| 2 | ZoAi Capability Panel | Buyer | AI Panel |
| 3 | Start Day & Clock-In | Buyer | Clock-In |
| 4 | Request Plan | Buyer | Request |
| 5 | Travel & Check-In | Buyer | Travel, Check-in |
| 6 | Order Capture & Review | Buyer | Capture, Review |
| 7 | Order Submit & Notify | Buyer | Submit, Notify |
| 8 | Competitor Insights | Buyer | Insights |
| 9 | Realtime ASM Communication | Both | Chat |
| 10 | PWA App Installation | Buyer | Install |
| 11 | Field Ops Command Center | Seller | Dashboard |
| 12 | DSR Files Expense Claim | Buyer | Expense Claim |
| 13 | Manager Approval Queue | Seller | Approvals |
| 14 | Manager Reviews & Approves | Seller | Review |
| 15 | DSR Receives Notifications | Buyer | Notifications |

### 3. automated_collections (11 steps)

| Step | Title | Perspective | Screens |
|------|-------|-------------|---------|
| 1 | Automated Payment Reminder | Buyer | Reminder |
| 2 | Retailer Checks Invoices | Buyer | Invoices |
| 3 | AI Initiates PTP + Scheme | Both | PTP |
| 4 | Retailer Declines Initial Date | Buyer | Decline |
| 5 | AI Asks Alternate Date | Both | Alternate |
| 6 | Retailer Selects Friday | Buyer | Selection |
| 7 | Scheme Unlocked for Friday | Both | Scheme |
| 8 | PTP Confirmed | Both | Confirmation |
| 9 | Pre-Due Reminder (Thursday) | Buyer | Reminder |
| 10 | Payment Received ✅ | Both | Receipt |
| 11 | Payment Not Received ❌ | Seller | Escalation |

### 4. dealer_engagement (3 steps)

| Step | Title | Perspective | Screens |
|------|-------|-------------|---------|
| 1 | Campaign & Promotions | Both | Campaigns |
| 2 | Scheme & Product Queries | Buyer | Queries |
| 3 | Loyalty & Credit Queries | Buyer | Loyalty |

### 5. retailer_onboarding (12 steps)

| Step | Title | Perspective | Screens |
|------|-------|-------------|---------|
| 1 | Activation & Registration | Buyer | Registration |
| 2 | Welcome & Self Service | Buyer | Welcome |
| 3 | Campaigns & Queries | Both | Campaigns |
| 4 | Scheme & Product Queries | Buyer | Queries |
| 5 | Self Service Ordering | Buyer | Menu |
| 6 | Catalog Browse & Order | Buyer | Products |
| 7 | AI Order Capture | Buyer | AI Chat |
| 8 | Distributor Confirmation | Seller | Confirmation |
| 9 | Order to Invoice | Both | Invoice |
| 10 | Invoice & Payment | Buyer | Payment |
| 11 | Collect Digital Orders | Buyer | Orders |
| 12 | Collect Payments | Both | Settlement |

### 6. retailer_loyalty (6 steps)

| Step | Title | Perspective | Screens |
|------|-------|-------------|---------|
| 1 | Loyalty Program Overview | Both | Overview |
| 2 | Points & Rewards | Buyer | Points |
| 3 | Tier Progress | Buyer | Progress |
| 4 | Exclusive Offers | Buyer | Offers |
| 5 | Redemption History | Buyer | History |
| 6 | Program Summary | Both | Summary |

## Quality Targets

| Metric | Current (Path A) | Target (Path C) |
|--------|-----------------|-----------------|
| File size (OTC) | 1.1 MB | ≥ 2.5 MB |
| Screens per step | 1-2 | 2-3 |
| Message turns | 1 per screen | 2-4 per screen |
| Business data | Generic | Specific (order IDs, ₹ amounts, IST times) |
| Brand logo | Relative path | Base64 inline |
| Screen descriptions | Brief | Contextual cards |
| Navigation | Scroll | Sidebar + keyboard + buttons |

## File Structure

```
dist/{brand}/premium/
├── journey_order_to_cash.html
├── journey_field_ops_expense.html
├── journey_automated_collections.html
├── journey_dealer_engagement.html
├── journey_retailer_onboarding.html
└── journey_retailer_loyalty.html
```

## HTML Structure

Each premium HTML file follows this structure:

```
<html>
  <head>
    <style>/* All CSS inline — no external deps */</style>
  </head>
  <body>
    <nav class="sidebar">...</nav>         ← Step list + brand info
    <div class="main">
      <div class="main-head">...</div>      ← Current step title
      <div class="step-desc-bar">...</div>  ← Tags
      <div class="screens-area">
        <div id="step-N" class="step-section">
          <div class="screen-wrap">          ← Phone frame
            <div class="phone-frame">
              <div class="chat-area">
                <div class="msg-sender-wrap">...</div>  ← Messages
                <div class="msg-receiver-wrap">...</div>
              </div>
            </div>
            <div class="screen-desc">...</div>  ← Description card
          </div>
          ...                                 ← Additional screens
        </div>
      </div>
      <div class="nav-bar">...</div>          ← Prev/Next buttons
    </div>
    <script>/* Navigation logic */</script>
  </body>
</html>
```
