# Journey Content Schema: Target Data Model

> Purpose: Defines the JSON schema that will drive ALL content in the order_to_cash template.
> Goal: A new brand = new JSON files + assets. Zero template changes needed.
> Branch: `feature/catalog-monolith`

---

## Current State vs Target

The journey JSON currently has navigation metadata (`navTitle`, `navDesc`, `meta`) for each step but is **missing**:
- Per-screen content (each step has 1-3 sub-screens)
- Dealer/order/invoice/payment data
- Message content for WhatsApp screens
- Financial data (prices, amounts, taxes)

The brand JSON has basic identity but is **missing**:
- WhatsApp display configuration
- Brand-specific copy/tone

The catalog JSON has products but **prices don't match** the template (template has ₹4,032, catalog has ₹420/bag).

---

## Target Schema: Journey JSON

```json
{
  "id": "order_to_cash",
  "title": "Order to Cash",
  "subtitle": "Self-service Ordering & AI Order Capture",
  "brandId": "jk_cement",

  "dealer": {
    "name": "Sharma Cement Stores",
    "contactName": "Ramesh",
    "phone": "+91 98765 43210",
    "address": "12, Industrial Area, Jaipur, Rajasthan",
    "gstin": "08ABCDE1234F1Z5"
  },

  "order": {
    "primaryOrderId": "JKO-48291",
    "date": "22/04/2026",
    "status": "Confirmed",
    "items": [
      { "productId": "p1", "name": "JK Super Steel OPC 53", "sku": "JK-OPC53-50", "qty": 20, "unit": "bags", "pricePerUnit": 420, "lineTotal": 8400 },
      { "productId": "p2", "name": "JK Cement PPC", "sku": "JK-PPC-50", "qty": 15, "unit": "bags", "pricePerUnit": 380, "lineTotal": 5700 }
    ],
    "summary": {
      "totalItems": 4,
      "totalQuantity": "162 bags",
      "subtotal": 140000,
      "tax": 6800,
      "orderValue": 146800
    },
    "secondaryOrders": [
      { "id": "JKO-48287", "dealer": "Om Sai Dairy Store", "amount": 14400, "status": "To be Billed", "date": "22/04/2026" },
      { "id": "JKO-48283", "dealer": "Kishor Dairy Works", "amount": 8800, "status": "Yet to Accept", "date": "21/04/2026" }
    ],
    "historyOrders": [
      { "id": "JKO-47011", "date": "15/04/2026", "amount": 91200, "status": "Delivered" },
      { "id": "JKO-46221", "date": "08/04/2026", "amount": 52300, "status": "Delivered" }
    ]
  },

  "invoice": {
    "id": "INV-7821",
    "date": "29/04/2026",
    "dueDate": "10/05/2026",
    "cashDiscountDays": 7,
    "cashDiscountPercent": 2,
    "cashDiscountAmount": 2936,
    "items": [
      { "productId": "p1", "name": "JK Super Steel OPC 53", "qty": 20, "unit": "bags", "pricePerUnit": 420, "lineTotal": 8400 }
    ],
    "subtotal": 146800,
    "discount": 1971,
    "tax": 6800,
    "total": 146800
  },

  "payment": {
    "amount": 100000,
    "date": "25/04/2026",
    "method": "NEFT",
    "reference": "NEFT-20260425-001",
    "divisions": [
      { "name": "Cement Division", "amount": 16200, "outstanding": 45000 },
      { "name": "Building Products", "amount": 28500, "outstanding": 72000 }
    ],
    "settlement": {
      "status": "Settled",
      "amount": 146800,
      "date": "25/04/2026"
    }
  },

  "ledger": {
    "openingBalance": 146800,
    "creditNoteId": "CN-2026-7821",
    "creditNoteAmount": 7840,
    "creditReason": "Scheme Incentive",
    "entries": [
      { "date": "01/04/2026", "description": "Opening Balance", "debit": 4218240, "credit": 0, "balance": 4218240 },
      { "date": "15/04/2026", "description": "Payment Received", "debit": 0, "credit": 112500, "balance": 4105740 }
    ]
  },

  "steps": [
    {
      "num": 1,
      "displayNum": 1,
      "title": "Self Service Ordering",
      "meta": "Dealer · Menu-driven ordering",
      "navTitle": "Step 1 — Self Service Ordering",
      "navDesc": "Dealer browses product categories and places orders directly within WhatsApp.",
      "screens": [
        {
          "label": "Self Service Menu",
          "typeLabel": "Session Interactive Message — Reply Button",
          "description": "Dealer selects 'Order Now' from the self-service menu to begin placing an order — entirely within WhatsApp."
        },
        {
          "label": "Browse Products",
          "typeLabel": "Interactive List — Bottom Sheet Open",
          "description": "ZoTok opens the catalog category list for the Dealer to choose the product category they want to order."
        },
        {
          "label": "Product Selection",
          "typeLabel": "Interactive List — Bottom Sheet Open",
          "description": "Dealer browses the product catalog with images, pricing, and quantity selectors."
        }
      ]
    }
  ],

  "messages": {
    "welcome": {
      "title": "Welcome to {{brand.name}} Dealer Program! 🎉",
      "body": "Your store <strong>{{dealer.name}}</strong> is now an active {{brand.name}} Dealer Partner.<br><br>Tap <strong>Open Menu</strong> to browse products, track orders, and manage your account — all on WhatsApp.",
      "time": "9:22 AM",
      "cta": "Open Menu"
    },
    "greeting": {
      "text": "Namaste {{dealer.contactName}}! 🙏",
      "subtext": "How can I help you today?",
      "time": "9:23 AM"
    },
    "aiResponse": {
      "text": "📋 Received your order note! ZoTok AI is reading it now...",
      "time": "10:15 AM"
    },
    "orderNote": {
      "text": "Please process this order 🙏",
      "time": "10:14 AM"
    },
    "confirmation": {
      "title": "Order Confirmed ✅",
      "body": "Your order {{order.primaryOrderId}} for {{order.summary.orderValue}} has been confirmed.",
      "time": "10:30 AM"
    },
    "invoiceNotification": {
      "title": "New Invoice 📄",
      "body": "Invoice {{invoice.id}} for ₹{{invoice.total}} has been generated.",
      "time": "11:00 AM"
    },
    "discountReminder": {
      "title": "Cash Discount Expiring ⏰",
      "body": "{{invoice.cashDiscountPercent}}% cash discount of ₹{{invoice.cashDiscountAmount}} expires in {{invoice.cashDiscountDays}} days.",
      "time": "9:00 AM"
    },
    "paymentReceived": {
      "title": "Payment Received 💰",
      "body": "We received your payment of ₹{{payment.amount}}.",
      "time": "2:46 PM"
    },
    "creditNote": {
      "title": "Credit Note Issued 📝",
      "body": "Credit note {{ledger.creditNoteId}} for ₹{{ledger.creditNoteAmount}} has been issued.",
      "time": "11:00 AM"
    }
  },

  "sapArchitecture": {
    "title": "ZoTok × SAP Integration Architecture",
    "description": "Once the dealer's order is confirmed on WhatsApp and approved in the ZoTok PWA, it is pushed to SAP via ZoTok's integration layer. The JSON payload flows through the API Gateway → Payload Transformation → SAP Adapter, triggering the full order-to-bill cycle in SAP SD/FI.",
    "diagramImage": "assets/brands/{{brandId}}/sap_architecture.png"
  }
}
```

---

## Target Schema: Brand JSON (additions)

Current brand JSON already has: `id`, `name`, `industry`, `assets`, `colors`, `theme`, `font`.

Add these:

```json
{
  "whatsapp": {
    "displayName": "JK Cement",
    "phoneNumber": "+91 98765 43210",
    "statusText": "online",
    "profileImage": "assets/brands/jk_cement/logo.png"
  },
  "copy": {
    "orderNowCta": "Order Now",
    "trackOrderCta": "Track Order",
    "myAccountCta": "My Account",
    "helpCta": "Help",
    "categoryLabel": "Select a category",
    "checkoutLabel": "Place Order",
    "currencySymbol": "₹",
    "currencyCode": "INR"
  }
}
```

---

## Target Schema: Catalog JSON (fixes)

Current catalog has `price: 420` (per bag) but template shows `₹4,032`. This is because the template shows **line totals** (qty × price), not unit prices. The schema needs to clarify:

```json
{
  "products": [
    {
      "id": "p1",
      "sku": "opc_43",
      "name": "JK Cement OPC 43",
      "category": "OPC",
      "pricePerUnit": 420,
      "unit": "bag",
      "displayUnit": "50 kg bag",
      "image": "product_opc_43.png",
      "tags": ["OPC"],
      "description": "Ordinary Portland Cement, 43 Grade"
    }
  ]
}
```

Line totals are computed at build time: `lineTotal = pricePerUnit × qty`.

---

## Migration Strategy

### What changes, what stays

| Component | Change Type | Risk |
|---|---|---|
| `data/brands/*.json` | ADD `whatsapp` and `copy` fields | LOW - additive |
| `data/catalogs/*.json` | ADD `displayUnit`, `description` | LOW - additive |
| `data/journeys/*.json` | ADD `dealer`, `order`, `invoice`, `payment`, `ledger`, `messages.*`, `sapArchitecture`, `steps[].screens[]` | MEDIUM - new structure |
| `templates/screens/order_to_cash.hbs` | REPLACE hardcoded values with `{{}}` expressions | HIGH - must validate each step against baseline |
| `lib/journey-normalizer.js` | EXTEND to normalize new fields | MEDIUM |
| `build.js` | ADD `formatCurrency` helper, pre-compute line totals | LOW |
| `data/schemas/journey.schema.json` | EXTEND with new fields | LOW |

### Per-Step Migration Order

Each step is migrated independently. Build baseline HTML first, then migrate one step, validate diff, commit.

1. **Step 6** (SAP Architecture) — simplest, only 13 lines, 0 HBS expressions
2. **Step 1** (Self Service) — already has some HBS, just needs message data
3. **Step 2** (Catalog) — already has HBS loops, mainly needs price data
4. **Step 7** (Invoice) — simple structure, 2 sub-screens
5. **Step 8** (Cash Discount) — similar to step 7
6. **Step 5** (Order Confirmed) — has HBS partials already
7. **Step 11** (Nav Menu) — simple layout
8. **Step 9** (Payment) — 3 sub-screens, medium complexity
9. **Step 10** (Credit Note) — 3 sub-screens, financial data
10. **Step 3** (AI Capture) — complex, 97 inline styles, many hardcoded prices
11. **Step 4** (Back Office) — HARDEST: 0 HBS, 146 inline styles, entirely hardcoded admin portal UI
