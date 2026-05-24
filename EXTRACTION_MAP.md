# Extraction Map: Hardcoded Content → Data-Driven Targets

> Purpose: Maps every hardcoded value in order_to_cash.hbs to the data field it should come from.
> Branch: `feature/catalog-monolith`

---

## 1. Brand References

| Hardcoded Value | Occurrences | Should Be | Data Source |
|---|---|---|---|
| JK Cement | ~20 | `{{brand.name}}` | `data/brands/{brand}.json → name` |
| JK Super | ~6 | `{{product.name}}` (loop) | `data/catalogs/{brand}_products.json` |
| OPC 43 | ~4 | `{{product.name}}` | catalog |
| OPC 53 | ~3 | `{{product.name}}` | catalog |
| PPC | ~5 | `{{product.name}}` | catalog |
| JK Lakshmi | ~2 | `{{product.name}}` | catalog |
| Sambhar | ~1 | `{{product.name}}` | catalog |
| Cemento | ~1 | `{{product.name}}` | catalog |
| Grey Cement | ~1 | `{{industry.materialTerm}}` | `data/industries/{industry}.json` |
| White Cement | ~1 | `{{industry.materialTerm}}` | industries |
| Portland Cement | ~1 | `{{industry.materialTerm}}` | industries |

**Action:** Brand name already uses `{{brand.name}}` in some places. Make this 100% consistent — every "JK Cement" becomes `{{brand.name}}`. Product names only appear in `{{#each}}` blocks in step 2; all other steps have them hardcoded.

---

## 2. Dealer/Business Names

| Hardcoded Value | Steps | Should Be | Data Source |
|---|---|---|---|
| Sharma Cement Stores | 2,4,5,7,8,9,10,11 | `{{journey.dealer.name}}` | `data/journeys/{brand}_order_to_cash.json → dealer` |
| Om Sai Dairy Store | 4 | `{{journey.dealer.name}}` | journey |
| Kishor Dairy Works | 4 | `{{journey.dealer.name}}` | journey |
| Shree Transport | 10 | `{{journey.dealer.name}}` | journey |
| Rajesh | 1 | `{{journey.dealer.contactName}}` | journey |

**Action:** Add a `dealer` object to journey JSON with `name`, `contactName`, `phone`, `address`.

---

## 3. Prices & Amounts

All 30 unique prices in the template are hardcoded. They need to be computed from:
- Product catalog prices (per-unit)
- Cart quantities (from journey JSON)
- Computed values (subtotals, tax, discounts, totals)

| Price | Steps | Type | Should Be |
|---|---|---|---|
| ₹4,032 | 2 | Unit price | `{{formatCurrency product.price}}` |
| ₹3,830 | 2 | Unit price | `{{formatCurrency product.price}}` |
| ₹15,840 | 3,5 | Line total | `{{formatCurrency (multiply product.price product.qty)}}` |
| ₹7,840 | 3,5,10 | Line total | computed |
| ₹7,448 | 3 | Line total | computed |
| ₹4,800 | 3 | Unit price | `{{formatCurrency product.price}}` |
| ₹3,600 | 3 | Unit price | `{{formatCurrency product.price}}` |
| ₹1,950 | 3 | Line total | computed |
| ₹1,408 | 3 | Line total | computed |
| ₹960 | 3 | Line total | computed |
| ₹7,888 | 3 | Line total | computed |
| ₹352 | 3 | Tax line | computed |
| ₹368 | 3 | Tax line | computed |
| ₹1,46,800 | 5,7,8,9,10 | Order total | `{{formatCurrency cart.summary.orderValue}}` |
| ₹36,800 | 5 | Line total | computed |
| ₹17,600 | 5 | Line total | computed |
| ₹18,400 | 5 | Line total | computed |
| ₹1,971 | 7,8 | Discount/tax | computed |
| ₹76,869 | 8 | Payment amount | `{{formatCurrency payment.amount}}` |
| ₹16,200 | 9 | Division amount | `{{formatCurrency division.amount}}` |
| ₹45,200 | 9 | Division amount | computed |
| ₹28,500 | 9 | Division amount | computed |
| ₹1,00,000 | 9 | Payment total | computed |
| ₹42,18,240.00 | 10 | Ledger balance | computed |
| ₹40,000 | 10 | Credit note amount | computed |
| ₹19,73,160 | 10 | Ledger total | computed |
| ₹18,42,160 | 10 | Ledger subtotal | computed |
| ₹1,12,500 | 11 | Order history amount | computed |
| ₹91,200 | 11 | Order history amount | computed |
| ₹52,300 | 11 | Order history amount | computed |

**Action:** Create a `{{formatCurrency}}` Handlebars helper. Move all amounts to journey JSON as structured financial data. Computed values (line totals, taxes, subtotals) should be pre-computed at build time.

---

## 4. Order & Invoice IDs

| Hardcoded Value | Steps | Should Be |
|---|---|---|
| JKO-48291 | 4,5,7,8,9,10 | `{{journey.order.primaryOrder.id}}` |
| JKO-48287 | 4 | `{{journey.order.secondaryOrders[0].id}}` |
| JKO-48283 | 4 | `{{journey.order.secondaryOrders[1].id}}` |
| JKO-47902 | 3 | `{{journey.order.legacyOrderId}}` |
| JKO-47011 | 11 | `{{journey.order.historyOrderIds[0]}}` |
| JKO-46221 | 11 | `{{journey.order.historyOrderIds[1]}}` |
| INV-7821 | 7,8,10 | `{{journey.invoice.id}}` |

**Action:** Add `order` and `invoice` objects to journey JSON.

---

## 5. Dates

| Hardcoded Value | Steps | Should Be |
|---|---|---|
| 22/04/2026 | 4,9 | `{{journey.order.date}}` |
| 25/04/2026 | 9 | `{{journey.payment.date}}` |
| 29/04/2026 | 7,8 | `{{journey.invoice.date}}` |
| 10/05/2026 | 7,8 | `{{journey.invoice.dueDate}}` |

**Action:** Add `order.date`, `invoice.date`, `invoice.dueDate`, `payment.date` to journey JSON.

---

## 6. WhatsApp Message Content

These are the visible chat messages in WhatsApp-style screens. Each one needs to become a data point:

| Step | Content Type | Current Text | Should Be |
|---|---|---|---|
| 1 | Welcome message | "Welcome to JK Cement Dealer Program..." | `{{journey.messages.welcome}}` (already partially HBS) |
| 1 | Menu options | "Order Now", "Track Order", "Account"... | `{{journey.messages.menuItems}}` |
| 2 | Greeting | "Namaste Ramesh! 🙏 How can I help you today?" | `{{journey.messages.greeting}}` |
| 3 | Chat text | "Please process this order 🙏" | `{{journey.messages.chatMessages}}` |
| 3 | AI response | "📋 Received your order note! ZoTok AI is reading it now..." | `{{journey.messages.aiResponse}}` |
| 4 | Portal text | Various admin dashboard labels | `{{journey.messages.adminPortal.*}}` |
| 5 | Confirmation | Order confirmation message | `{{journey.messages.confirmation}}` |
| 7 | Invoice notification | "New Invoice" message | `{{journey.messages.invoiceNotification}}` |
| 8 | Discount reminder | Cash discount text | `{{journey.messages.discountReminder}}` |
| 9 | Payment messages | Payment received, division selection | `{{journey.messages.paymentReceived}}` |
| 10 | Credit note | Credit note message | `{{journey.messages.creditNote}}` |

**Action:** The `journey.messages` already has a `welcome` object. Extend it with all message variants.

---

## 7. Screen Metadata (Labels, Types, Descriptions)

Every sub-screen has 3 metadata elements that are currently hardcoded:

| Element | Pattern | Should Be |
|---|---|---|
| `screen-lbl` | "Screen 1 · Self Service Menu" | `{{screen.label}}` |
| `screen-type-lbl` | "Session Interactive Message — Reply Button" | `{{screen.typeLabel}}` |
| `screen-desc` | "Dealer selects 'Order Now'..." | `{{screen.description}}` |

**26 occurrences** of each. These are already partially defined in journey JSON (`navTitle`, `navDesc`, `meta`).

**Action:** Align journey JSON step structure with the 3 metadata fields per screen. Currently journey has `navTitle` and `navDesc` per step, but each step can have 1-3 sub-screens.

---

## 8. Structural / Layout Patterns

These aren't content but structural HTML that repeats and should be extracted into partials:

| Pattern | Frequency | Proposed Partial |
|---|---|---|
| Phone frame wrapper | 16 | `phone-frame.hbs` |
| Status bar (time, battery, signal) | 20 | `status-bar.hbs` |
| WhatsApp top bar | 16 | `wa-topbar.hbs` |
| Chat area container | 16 | `chat-area.hbs` |
| Date separator pill | 17 | `date-pill.hbs` |
| WhatsApp template wrapper | 13 | `wa-tmpl.hbs` (enhance existing) |
| Modal row (label + value) | 20 | `modal-row.hbs` |
| Dual-phone layout | 7 | `step2-phones.hbs` |
| Screen wrapper (label + type + desc) | 26 | `screen-wrap.hbs` |
| CTA button | ~14 | `cta-btn.hbs` |

---

## 9. Images & Assets

| Current | Issue | Fix |
|---|---|---|
| SAP architecture diagram | `data:image/placeholder` | Needs actual image at `assets/brands/{brand}/sap_architecture.png` |
| Product images | Hardcoded in step 2 (uses HBS loop) | Already uses `{{product.image}}` - OK |
| Brand logos | Some steps use `{{brandLogo}}`, others hardcode | Make consistent |
| WhatsApp chat icons | Inline SVG (252 total) | Extract SVGs to sprite sheet or partial with `{{icon}}` parameter |

---

## 10. Priority Order for Extraction

Based on impact (how many brands benefit) and difficulty:

| Priority | Task | Impact | Difficulty | Steps Affected |
|---|---|---|---|---|
| P0 | Brand name → `{{brand.name}}` | HIGH (required for any brand) | LOW | All 11 |
| P0 | Dealer name → `{{journey.dealer}}` | HIGH | LOW | 1,2,3,4,5,7,8,9,10,11 |
| P1 | Extract `phone-frame`, `status-bar`, `wa-topbar` partials | HIGH | MEDIUM | All |
| P1 | Extract `screen-wrap` partial | HIGH | LOW | All (26 screens) |
| P2 | Product names/prices → catalog data | HIGH | MEDIUM | 2,3,5 |
| P2 | Order IDs → `{{journey.order.*}}` | MEDIUM | LOW | 3,4,5,7,8,9,10,11 |
| P2 | Invoice IDs → `{{journey.invoice.*}}` | MEDIUM | LOW | 7,8,10 |
| P3 | WhatsApp messages → `{{journey.messages.*}}` | MEDIUM | HIGH | 1,3,7,8,9,10 |
| P3 | Dates → `{{journey.dates.*}}` | MEDIUM | LOW | 4,7,8,9 |
| P4 | Financial calculations → build-time computed | MEDIUM | HIGH | 5,7,8,9,10 |
| P4 | Step 4 (Admin Portal) → full data-driven | HIGH | HIGH | 4 only |
| P5 | Inline SVGs → icon partials | LOW | HIGH | All (252 SVGs) |
| P5 | Inline styles → CSS classes | LOW | HIGH | All (411 styles) |
