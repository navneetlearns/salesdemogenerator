# Intake — brand pack + journey spec template

Use this to collect what you need from the user (or derive) before Phase 1.
Copy-paste the spec into the session; fill what the user gives, derive the rest.

## Brand pack

```
Brand Name:            <full legal/display name>
Slug (folder name):    <lowercase, underscores, e.g. acme_cements>
Industry:              <e.g. FMCG, construction, industrial, agriculture>
Brand Color:           <hex, primary>
Accent Color:          <hex, CTA/highlights>
Logo:                  <path or URL — prefer transparent PNG>
Avatar Initials:       <e.g. "AC" — shown in chat circles when no logo>
Positioning / tagline: <e.g. "1-Hour RMC Delivery">
WhatsApp Business Name:<shown under brand in chat header>
Dealer/Store name:     <if a storefront exists in the flow>
Real-world refs:       <screenshots of actual WhatsApp convos, order formats,
                        price lists — the best ground truth for content>
```

## Journey spec (per CLAUDE.md input format)

One block per step. 6–10 steps typical.

```
Journey: <name, e.g. Contract to Indent to Dispatch>

Step N: <what happens>
  - Perspective: buyer | seller | both | admin
  - Screen: full | group | webview | chat-only | notification |
            admin-dashboard | admin-dashboard-flyout | campaign |
            diagram | flow-diagram
  - Screens: 1 | 2 | 3
  <per screen: key message type, menu items, form fields, table columns,
   button labels, key data hints — names, amounts, IDs, locations>
```

## Derivation rules (when the user gives less)

- Colors missing → sample the logo (dominant dark + accent hue)
- Logo missing → ask; never invent a brand mark. Until it arrives, use avatar
  initials (like "HR" in HindustanRMC) — flag that the logo needs to be dropped in
- Steps missing → reuse an existing client's flow (order_to_cash, collections,
  field_ops_expense…) and adapt terminology to this client's industry
- Screen type missing → infer from the step text: "sees menu" → full,
  "fills form" → webview, "team group" → group, "manager approves" → admin-dashboard
- Refs missing → use realistic sample data but mark it as placeholder in BUILD_LOG
  and swap real values when refs arrive (keep-vs-replace table, HindustanRMC pattern)

## Base project selection

- Default: `base-journey/` pair in this package (index + journey_contract,
  Hindustan RMC shell) — our convention: docs + assets + zip + repo mirror
- Single-file journey, stock process: Haldirams journey_retailer_activation.html
- Multi-journey suite: Haldirams pair (index + journey) per CLAUDE.md
- Do NOT use Savera (missing screen-type-lbl + logo embed)
