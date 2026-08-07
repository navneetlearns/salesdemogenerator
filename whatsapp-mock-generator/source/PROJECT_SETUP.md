# ZoTok WhatsApp Mock Generator — Project Setup Guide

## Quick Start

### 1. Create the project folder structure

```bash
mkdir -p whatsapp-mock-generator/references
mkdir -p whatsapp-mock-generator/project
cd whatsapp-mock-generator
```

### 2. Copy the CLAUDE.md file

Place the `CLAUDE.md` file (provided separately) in the root of the project:

```
whatsapp-mock-generator/
├── CLAUDE.md              ← Claude Code reads this as the project prompt
├── references/            ← Drop your SVG reference screens here
│   ├── whatsapp_dm_frame.svg
│   ├── menu_message.svg
│   ├── rich_card.svg
│   ├── order_template.svg
│   ├── invoice_template.svg
│   └── ... (any screen SVGs from Canva/UX team)
└── projects/               ← Generated outputs go here
    ├── skf/
    │   └── journey_dealer_onboarding.html
    ├── birla_nu/
    │   └── journey_retailer_ordering.html
    └── ...
```

### 3. Add reference SVGs

Export your UX team's Canva template screens as SVGs and place them in `/references/`. The more reference screens you provide, the more accurate the generated mocks will be.

**How to export from Canva:**
1. Open "Copy of Product Demo Presentation Template" in Canva
2. Select individual screen frames/components
3. Right-click → Download → SVG
4. Name them descriptively: `whatsapp_dm_frame.svg`, `menu_message.svg`, etc.

**Recommended reference screens to export:**
- A WhatsApp DM conversation frame (full phone)
- A menu/list message example
- A rich card with image and CTA buttons
- An order confirmation template
- An invoice template
- A payment collection template
- A product catalog view
- A seller hub notification view
- A CTWA (Click-to-WhatsApp Ad) screen
- A group chat frame
- Any additional screen patterns your team uses

### 4. Open the project in Claude Code

```bash
cd whatsapp-mock-generator
claude
```

Claude Code will automatically read `CLAUDE.md` and understand the project context.

---

## How to Use

### Creating a new journey mock

Just describe the journey in natural language. Here are example prompts:

**Simple prompt:**
```
Create WhatsApp mock screens for Lucky Seeds.
Industry: Agriculture/Seeds
Brand color: #2E7D32

Journey: Retailer ordering seeds

Step 1: Retailer receives WhatsApp campaign about new monsoon seed varieties
Step 2: Retailer clicks "Order Now" and sees product catalog
Step 3: Retailer sends handwritten order note, ZoTok converts to structured order
Step 4: Distributor receives and confirms the order
Step 5: Invoice shared on WhatsApp
Step 6: Payment reminder and UPI collection
Step 7: Retailer earns ZoPs loyalty points
```

**Detailed prompt with per-step control:**
```
Create WhatsApp mock screens for SKF Bearings.
Industry: Industrial/Automotive
Brand color: #003D7C
Accent: #FF6F00

Journey: Mechanic product support

Step 1: Mechanic sees Instagram ad for SKF festive scheme
  - Perspective: buyer
  - Screen: full
  - Screens: 1

Step 2: Mechanic lands on WhatsApp, sees welcome menu with options
  - Perspective: buyer
  - Screen: full
  - Screens: 2 (one showing menu collapsed, one expanded)

Step 3: Mechanic asks "how to fit rolling bearings" and gets AI response
  - Perspective: buyer
  - Screen: chat-only
  - Screens: 1

Step 4: Mechanic searches for nearest SKF dealer
  - Perspective: buyer
  - Screen: full
  - Screens: 2

Step 5: Mechanic places order through dealer
  - Perspective: both
  - Screen: full
  - Screens: 2
```

### Modifying an existing journey

```
Open /projects/skf/journey_dealer_onboarding.html and:
1. Add a new Step 4.5 between step 4 and 5 showing the ZoAI chatbot answering a price query
2. Change the brand color to #1B5E20
3. Add a second screen to Step 7 showing the payment confirmation
```

### Quick single-screen generation

```
Create a single WhatsApp screen showing an invoice message from "The Whole Truth Foods" 
to retailer "Aditya Ram Foods" for Order BSPB-59, amount ₹7,950, due 3 Feb 2026.
Save to /projects/twt/invoice_screen.html
```

---

## Tips for Best Results

1. **Be specific about the industry** — Claude generates realistic product names, terminology, and pricing based on the industry context.

2. **Provide perspective per step** — Specifying "buyer" vs "seller" vs "both" gives you the right phone view. "Both" shows two phones side by side.

3. **Reference specific screen types** — Saying "catalog" or "form" triggers specialized layouts rather than generic chat screens.

4. **Add more SVGs to /references/** — The more design references Claude Code can see, the more faithful the output will be to your UX team's vision.

5. **Iterate step by step** — Start with a basic journey, review the output in a browser, then ask Claude Code to refine specific screens.

6. **Use for client pitches** — These mocks are designed to be opened directly in a browser during client meetings. The navigation and phone frames make them presentation-ready.

---

## Troubleshooting

**"Screens look different from our Canva designs"**
→ Add more reference SVGs to `/references/`. The closer the reference matches, the better the output.

**"Navigation doesn't work"**
→ Open the HTML file directly in a browser (not via file manager preview). Chrome, Firefox, and Safari all work.

**"Need to change brand colors after generation"**
→ Tell Claude Code to update the CSS custom properties. All brand colors use `--brand-color` and `--accent-color` variables.

**"Want to add a new message type not listed"**
→ Describe what it looks like and add a reference SVG if possible. Claude Code will create a new component pattern.
