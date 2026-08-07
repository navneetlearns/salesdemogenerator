# ZoTok WhatsApp Mock Generator

Generate pixel-perfect WhatsApp conversation mockups for client pitches and demos — powered by Claude Code AI.

---

## What This Does

You describe a client journey in plain English. Claude Code builds a polished, browser-ready HTML file showing WhatsApp screens step by step — ready to present in a client meeting.

---

## One-Time Setup

### Step 1 — Install Claude Code

The recommended way is the **native installer** — no Node.js or npm required.

Open **Terminal** (press `Cmd + Space`, type "Terminal", hit Enter) and run:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Verify the install worked:
```bash
claude --version
```

> **Windows?** Use PowerShell instead:
> ```powershell
> irm https://claude.ai/install.ps1 | iex
> ```
> Git for Windows must be installed first.

> **Prefer Homebrew?** `brew install --cask claude-code` also works on macOS, but won't auto-update.

The native installer handles updates automatically in the background. You never need to manually upgrade.

### Step 2 — Clone This Repo

```bash
git clone https://github.com/nitinmp/whatsapp-mock-generator.git
cd whatsapp-mock-generator
```

### Step 3 — Start Claude Code

```bash
claude
```

That's it. Claude Code reads the project instructions automatically and is ready to generate screens.

> You'll need an Anthropic API key the first time. Claude Code will prompt you to log in — follow the on-screen instructions.

---

## How to Build a Journey

Once Claude Code is running, describe the client and journey in the chat.

For each step, describe **what happens**, **what the user sees**, and **what actions are available**. The AI will write the actual message copy and fill in realistic data — your job is to make sure it knows the right structure and intent.

---

### Example Prompt — Hindalco DSR Expense Claim

```
Brand Name: Hindalco
Industry: Metals & Aluminium — Field Force automation
Brand Color: #1B2A4A
Accent Color: #C8860A (copper)
WhatsApp Business Name: Hindalco Field Force
Save to: /projects/Hindalco/journey_dsr_expense_claim.html

Journey: DSR Expense Claim

---

Step 1: DSR opens field menu, selects Submit New Claim, fills expense form
  - Perspective: buyer (DSR)
  - Screen: full (screens 1–2), webview (screen 3)
  - Screens: 3

  Screen 1 — Interactive list menu (show bottom sheet open)
    Menu section: FIELD ACTIVITIES
    Menu rows: Clock-in, Clock-out, My Plan, Daybook, Submit New Claim
    "Submit New Claim" row should be selected

  Screen 2 — After DSR sends "Submit New Claim"
    ZoTok responds with a CTA message prompting DSR to file the claim
    CTA button: "File your claim" (opens WebView)

  Screen 3 — Expense claim form (WebView, URL: expense.hindalco.zotok.ai)
    Claim type tabs at top: Event | Meeting | Travel (Event active)
    Form fields: Event Date, Place of Event, No. of Persons Attended,
      Expense Amount (₹), Expense Details (textarea), Upload Bills & Proof (file upload)
    Submit button at bottom

---

Step 2: Manager's desktop approval queue
  - Perspective: admin (desktop browser)
  - Screen: admin-dashboard
  - Screens: 1

  Dashboard at claims.hindalco.zotok.ai
  Tabs: Pending for Approval (5 badge) | Waiting for Disbursement | Disbursed | Rejected
  Show "Pending for Approval" tab active with a table of claims
  Table columns: S.No, Claim ID, DSR Name, Claim Type, Amount, Event Date, Status, Actions
  Actions per row: View | Approve | Reject

---

Step 3: Manager opens a claim detail and approves it
  - Perspective: admin (desktop flyout panel)
  - Screen: admin-dashboard-flyout
  - Screens: 1

  Right-side flyout for claim HIN-CL-4821 (Rajesh Kumar, Event Expense, Nagpur, ₹3,400)
  Show uploaded files section (2 files)
  Footer actions: Reject (outline) | Approve (brand color)

---

Step 4: DSR receives WhatsApp notifications at each claim stage
  - Perspective: buyer (DSR's phone)
  - Screen: full
  - Screens: 3

  Screen 1 — Claim submitted confirmation
    Utility template, text header: "Claim Submitted"
    Body: claim ID, type, event date, location, amount, status "Under Review"
    CTA button: "View Claim Status"

  Screen 2 — Claim approved by Area Manager
    Utility template, text header: "Claim Approved"
    Body: claim ID, claimed amount, approved amount (slightly less), approved by, approval date
    CTA button: "View Claim Details"

  Screen 3 — Disbursement credited
    Utility template, no header
    Body: claim ID, disbursed amount, payment mode NEFT, bank reference, disbursement date
    No buttons
```

---

### Per-Step Options

| Option | Values | What it controls |
|--------|--------|-----------------|
| `Perspective` | `buyer` / `seller` / `both` / `admin` | Which view is shown. `both` = two phones side by side. `admin` = desktop browser UI |
| `Screen` | `full` / `webview` / `group` / `admin-dashboard` / `admin-dashboard-flyout` / `flow-diagram` | Screen type |
| `Screens` | `1` / `2` / `3` | Number of screens for this step |

### What to specify per step

- **What happens** — the action or event being shown
- **What the user sees** — screen type, key sections, menu items, form fields, table columns
- **What actions are available** — button labels, CTAs, tab names
- **Key data hints** — names, amounts, IDs, locations (AI fills the rest realistically)

---

## Output

Claude Code saves the file to:
```
projects/<client_name>/journey_<journey_name>.html
```

Open it directly in any browser (Chrome, Safari, Firefox) — no server needed. The file is fully self-contained with navigation, phone frames, and all WhatsApp UI.

---

## Refining a Journey

After reviewing the output, ask Claude Code to make changes:

```
In Step 3, change the product category from "Bearings" to "Seals & O-Rings"
```

```
Add a second screen to Step 5 showing the order confirmation message
```

```
Change the brand color across the whole journey to #1B5E20
```

---

## Deploying for Sharing

To publish the mocks to a live URL for sharing with clients:

```bash
./deploy.sh
```

Files go live at:
```
https://main.d316ym2oexcryf.amplifyapp.com/projects/<client>/<journey>.html
```

> AWS CLI and credentials required. See `guidelines/DEPLOY.md` for setup instructions.

---

## Project Structure

```
whatsapp-mock-generator/
├── README.md                   ← You are here
├── CLAUDE.md                   ← AI instructions (do not edit)
├── deploy.sh                   ← Deploy to AWS Amplify
├── guidelines/
│   ├── WHATSAPP_TEMPLATE_GUIDELINES.md   ← Meta compliance rules
│   └── DEPLOY.md                         ← Deployment setup
├── references/                 ← HTML template reference files (used by AI)
│   ├── tmpl_whatsapp_dm_frame.html
│   ├── tmpl_group_chat.html
│   ├── tmpl_catalog_browse.html
│   └── ...
└── projects/                   ← Generated journey files go here
    ├── Hindalco/
    │   └── journey_dsr_expense_claim.html
    ├── lucky_seeds/
    │   └── journey_retailer_ordering.html
    └── <your_client>/
        └── journey_<name>.html
```

---

## Troubleshooting

**"command not found: claude"**
→ Node.js may not be installed or the install didn't complete. Re-run `npm install -g @anthropic-ai/claude-code`.

**"Navigation doesn't work in the HTML file"**
→ Open the file in a browser directly (drag it into Chrome/Safari). Don't use a file manager preview.

**"I want to change something in an existing journey"**
→ Just tell Claude Code what to change — it will read the file and update it in place.

**"How do I start a fresh session?"**
→ Run `claude` again from the `whatsapp-mock-generator` folder. Claude Code re-reads all project context automatically.
