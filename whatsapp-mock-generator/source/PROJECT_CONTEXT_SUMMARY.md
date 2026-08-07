# ZoTok WhatsApp Mock Screen Generator — Project Context

*Last updated: 29 March 2026*
*Source: Initial design conversation thread*

---

## 1. Project Overview

**Goal:** Build a Claude Code project that allows ZoTok's sales and BD team to generate WhatsApp mock screens in HTML with minimal inputs. The team provides a user journey in steps, and Claude Code generates a single interactive HTML file with navigable phone-frame WhatsApp mockups.

**Who uses it:** ZoTok's sales and business development team, for client pitches and demos.

**What it produces:** Self-contained HTML files with realistic WhatsApp conversation mockups — complete with phone frames, message bubbles, CTAs, navigation between steps, and brand customization.

---

## 2. Key Design Decisions (Finalized)

These decisions were made through Q&A and should NOT be revisited unless explicitly requested:

| Decision | Choice |
|----------|--------|
| Output format | Single HTML file with navigation between screens |
| Interactivity | Both options — static visual mocks AND clickable CTAs that navigate |
| Message content | Claude Code generates content from journey description (user provides brief, Claude expands) |
| Screen detail level | User specifies per step — full WhatsApp UI, chat-only, notification, catalog, or form |
| WhatsApp message types | Quick reply buttons, List/menu messages, Rich cards with image + header + CTA |
| Branding | Customizable per client/brand (colors, company name) |
| Perspective | User specifies per step — buyer, seller, or both (side-by-side phones) |
| Reference handling | SVGs in `/references/` folder; Claude Code scans and matches style |
| Typical journey length | Medium (6–10 steps) |
| Output location | `/projects/<client_name>/journey_<name>.html` |

---

## 3. Deliverables Created

Three files were created and are ready for the Claude Code project:

### 3a. `CLAUDE.md` (Project prompt — goes in project root)
The main instruction file that Claude Code reads. Contains:
- Input format specification (brand details + journey steps)
- Screen types: `full`, `chat-only`, `notification`, `catalog`, `form`
- All WhatsApp message component patterns (Meta-compliant)
- Visual design specs (phone frame, WhatsApp colors, typography)
- Reference file scanning instructions (`/references/` folder)
- Canva design pattern knowledge (extracted from design ID `DAHFTbdNUe4`)
- Content generation rules (realistic Indian business data, industry matching)
- Step-by-step generation process with compliance validation
- Example usage with SKF Bearings dealer onboarding journey

### 3b. `WHATSAPP_TEMPLATE_GUIDELINES.md` (Goes in `/guidelines/`)
Meta WhatsApp Business Platform compliance document. Created because initial mock screen generation was producing non-compliant designs (divider lines in body, complex formatted headers, etc.). Contains:
- Template message structure rules (Header/Body/Footer/Buttons)
- Header rules: ONE type only (Text 60 chars | Image | Video | Document | Location)
- Body rules: max 1024 chars, NO HR lines, NO tables, NO HTML, basic formatting only (*bold*, _italic_, ~strike~)
- Footer rules: plain text only, 60 chars, no emojis/variables
- Button rules: Quick Reply (max 3, 25 chars) OR CTA (max 2 URL + 1 phone) — never mix
- Interactive message rules (List messages, Reply buttons — session only)
- Character limit reference table for every component
- ZoTok-specific compliant message patterns (order, invoice, payment, campaign, ZoPs, menu)
- Common mistakes table with corrections
- When-to-use-what decision matrix

### 3c. `PROJECT_SETUP.md` (Team-facing setup guide)
Step-by-step instructions for the sales/BD team:
- Folder structure setup
- How to export SVGs from Canva
- Example prompts (simple and detailed)
- Tips for best results
- Troubleshooting guide

---

## 4. Project Folder Structure

```
whatsapp-mock-generator/
├── CLAUDE.md                                      ← Claude Code project prompt
├── guidelines/
│   └── WHATSAPP_TEMPLATE_GUIDELINES.md            ← Meta compliance rules
├── references/                                    ← SVG reference screens from UX team
│   ├── whatsapp_dm_frame.svg
│   ├── menu_message.svg
│   ├── rich_card.svg
│   ├── order_template.svg
│   ├── invoice_template.svg
│   └── ...
└── projects/                                      ← Generated outputs
    ├── skf/
    │   └── journey_dealer_onboarding.html
    ├── birla_nu/
    │   └── journey_retailer_ordering.html
    └── ...
```

---

## 5. Canva Template Reference

The UX team's WhatsApp screen designs live in Canva:
- **Design ID:** `DAHFTbdNUe4`
- **Title:** "Copy of Product Demo Presentation Template"
- **Pages:** 20
- **Content extracted:** Full rich text content was pulled via `Canva:get-design-content` and analyzed

**Screen patterns found in the Canva template:**
- WhatsApp DM frame (with top bar, chat area, input bar, ZoTok footer)
- WhatsApp Group frame
- Menu/List message with categorized options
- Rich cards with image header + CTA buttons (SKF bearings example)
- Order Estimate / Order Confirmed templates
- Invoice template with PDF attachment
- Outstanding/Payment template with QR code
- Payment confirmation template
- Clock-in/Clock-out/Check-in/Check-out operational messages
- Catalog view with categories, product cards, cart, checkout
- Seller Hub notification screen
- CTWA (Click-to-WhatsApp Ad) screens for Facebook/Instagram
- Beat Plan / Sales Team Activity tables
- Form templates (visitor registration, dealer registration)
- ZoPs loyalty points card (screenshot provided — see Section 7)

---

## 6. Meta WhatsApp Compliance — Key Issue Found

**Problem identified:** Initial mock screen generation produced messages with:
- Complex formatted headers (structured data with bold text in header area)
- Horizontal rule / divider lines (`━━━`, `────`) in message body
- Table-like structured content that WhatsApp doesn't support
- Mixed button types in same template

**Resolution:** Created `WHATSAPP_TEMPLATE_GUIDELINES.md` based on research of Meta's official documentation and multiple BSP guides. Updated `CLAUDE.md` to:
1. Reference the guidelines file as mandatory reading before generation
2. Add a critical compliance section with 7 key rules
3. Rewrite all message component patterns to be compliant
4. Add compliance validation as a step in the generation process

**Specific example that triggered this:** The ZoPs loyalty points screen (uploaded as image) had dynamic content with complex formatting in the header area — which violates Meta's rule that text headers can only be plain text (max 60 chars, max 1 variable, no bold/italic/markdown).

---

## 7. ZoTok Product Context

From the project files and conversation:

**What ZoTok is:** India's first Network CRM for conversational commerce on WhatsApp. Connects brands, distributors, and retailers via GenAI on WhatsApp for the entire Order-to-Cash cycle.

**Key capabilities:**
- Order collection (voice/handwritten/text → structured data)
- Invoice preparation & dispatch via Tally/ERP integration
- Payment collection (UPI, RTGS, digital) on WhatsApp
- Marketing campaigns with "Order Now" CTAs
- ZoAI chatbot (40+ query types, 8 languages)
- ZoPs loyalty & gratification program
- Field force automation (clock-in/out, check-in/out, beat plans)
- Catalog management on WhatsApp
- Seller Hub for order/conversation management

**Industries served:** FMCG, agriculture/seeds, industrial/automotive, construction, apparel

**Key differentiator:** WhatsApp-native, zero-friction implementation (<7 days), works with non-pareto distributors and rural/Tier II-III retailers who won't use separate DMS apps

**Competitors/adjacent:** BizAnalyst (operational Tally companion), Magenta (strategic BI/analytics layer)

---

## 8. Vishal's Meta Conversations Update (Jul 2025)

A key strategic document was shared — Vishal's analysis of Meta's "Conversations" webinar:

**Key Meta updates relevant to this project:**
- Pricing shift from per-24hr-window to per-message (Marketing messages)
- Utility and Service messages within 24hr window remain free
- Meta enabling "Meta AI" for businesses (content, FAQs, catalog)
- Integrations with Order Management tools beyond Meta Catalogues
- CTWA (Click-to-WhatsApp Ads) positioned as mid-funnel engagement
- Paving way for true Sales and Marketing GenAI Agents on WhatsApp

**ZoTok positioning:** Already ahead on several of these — launched Business AI Agent, published 10k+ SKUs on WhatsApp, training Sales and Marketing Agents for over a year.

---

## 9. Onboarding Flow Context

An SVG of ZoTok's onboarding flow was shared showing:
1. Upper Funnel Ad → 2. Splash Screens → 3. Sign-up → 4. Train & Test Agent → 4A. Payment Nudge (₹5K/₹15K/₹25K/Custom) → 5. Setup Customer Data → 6. Setup Catalog → 7. Setup Campaign → 7A. Payment Nudge → 8. Simulator Experience → 9. SellerHub Notifications → 10. Payment & Go Live

Key design: Two strategic payment nudge points before final payment, with "continue without payment" option at each.

---

## 10. Open Items / Next Steps

- [ ] Export SVG reference screens from Canva template (`DAHFTbdNUe4`) into `/references/` folder
- [ ] Set up the Claude Code project with the three deliverable files
- [ ] Test with a real client journey (e.g., SKF dealer onboarding)
- [ ] Iterate on visual fidelity based on team feedback
- [ ] Potentially add more message types (carousel cards, product list messages) as needed
- [ ] Consider adding ZoPs loyalty card as a custom component (the uploaded screenshot shows a rich card format that needs special handling)

---

## 11. Key Files in This Project (for reference)

| File | Location in Claude Project | Purpose |
|------|---------------------------|---------|
| `ZoTok_for_Revenue_Growth.pdf` | Project Knowledge | Full ZoTok pitch deck with product overview, revenue growth model, product demo flow, impact metrics |
| `You_shouldn_t_have_missed__Conversations__last_week_-_Vishal` | Project Knowledge | Vishal's strategic analysis of Meta's Conversations webinar (Jul 2025) |
| `ZoTok_Onboarding_Flow_with_New_Changes.svg` | Project Knowledge | Onboarding flow diagram with payment nudges |
| `CLAUDE.md` | Claude Code project root | Main project prompt |
| `WHATSAPP_TEMPLATE_GUIDELINES.md` | Claude Code `/guidelines/` | Meta compliance rules |
| `PROJECT_SETUP.md` | Claude Code project root | Team setup guide |
