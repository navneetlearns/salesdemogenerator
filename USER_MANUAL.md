# User Manual - Demo Generator

**For non-technical users who want to create demo websites for new brands**

## What This Tool Does

This tool creates interactive demo websites that simulate WhatsApp-based ordering
and business workflows. Each demo shows a **brand** (e.g., JK Cement) using
ZoTok's system to take orders, manage payments, track deliveries, and more -
all inside a mock phone screen in the browser.

You give it:
- Your brand name, logo, and colours
- A list of products you sell
- Sample order/payment data

It produces:
- A complete HTML demo page with click-through steps
- Branded with your logo and colours
- Works offline - no server needed

---

## Quick Start: Add a New Brand (30 minutes)

### Step 1: Create the Brand Folder

Inside the project folder, create these directories:

  assets/brands/<your_brand_id>/
  assets/products/<your_brand_id>/

Replace <your_brand_id> with a short name like "acme_corp" or "my_store".
Use only lowercase letters, numbers, and underscores.

### Step 2: Add Your Logo

Place your brand logo in:
  assets/brands/<your_brand_id>/logo.png

- Dimensions: At least 200x200 pixels
- Format: PNG with transparent background preferred
- Max size: 500 KB

### Step 3: Add Product Images

For each product, add an image:
  assets/products/<your_brand_id>/product_<sku>.png

Example: If your product SKU is CEM001:
  assets/products/my_store/product_cem001.png

### Step 4: Create the Brand JSON File

Create a file at data/brands/<your_brand_id>.json:

{
  "id": "my_store",
  "name": "My Store Name",
  "industry": "general",
  "assets": { "logo": "logo.png" },
  "colors": {
    "brand": "#E30613",
    "brandDark": "#B30510",
    "accent": "#1C1C1C"
  },
  "dealerStoreName": "My Dealer Store",
  "secondaryDealers": [
    { "name": "Retailer One", "type": "secondary_dealer" }
  ]
}

Fields:
  id               Short ID - must match folder names
  name             Brand name - appears everywhere
  industry         general, building_materials, or food_beverages
  colors.brand     Main brand colour (hex)
  colors.brandDark Darker shade
  colors.accent    Secondary colour

### Step 5: Create the Product Catalog

File: data/catalogs/<your_brand_id>_products.json

[
  {
    "id": "p1",
    "sku": "CEM001",
    "name": "Premium Cement 50kg",
    "category": "Cement",
    "price": 420,
    "unit": "bag",
    "image": "product_cem001.png",
    "tags": ["Cement"]
  }
]

Tips: id is unique, image is just filename, price is per unit.

### Step 6: Create the Journey Data

The main journey is "order_to_cash".
File: data/journeys/<your_brand_id>_order_to_cash.json

Easiest: copy from an existing brand:
  cp data/journeys/jk_cement_order_to_cash.json data/journeys/my_store_order_to_cash.json

Then edit:
  brandId              Your brand id
  dealer.name          Your dealer store name
  dealer.contactName   Contact person name
  order.primaryOrderId Order ID
  order.items          Products with quantities/prices
  order.summary        Total order value
  payment.amount       Payment amount

### Step 7: Run the Build

  npm run build:dist

### Step 8: View Your Demo

  generated/<your_brand_id>/order_to_cash.html

For packaged version (all assets included): dist/<your_brand_id>/index.html

---

## The 10 Journey Types

  Order to Cash          Customer orders via WhatsApp, AI capture, payment    11 steps
  Field Ops & Expense    Sales exec beat plan, visits, check-ins, reports     15 steps
  Automated Collections  Payment reminders, collections dashboard             11 steps
  Dealer Engagement      Dealer interaction and communication                  3 steps
  Retailer Onboarding    New retailer signup and setup                        12 steps
  Retailer Loyalty       Points, tiers, offers, redemptions                    6 steps
  Campaigns & Queries    Brand campaigns and query management (Haldiram)       3 steps
  DT Fulfillment & Pay   Direct-to-retailer fulfillment & payment (Haldiram)   5 steps
  Retailer Activation    Retailer activation workflow (Haldiram)               2 steps
  WhatsApp Commerce OS   Hub landing page with overview of all journeys        1 page

The first 6 are available for all brands. The last 3 are Haldiram-exclusive. "WhatsApp Commerce OS" renders a hub landing page listing all journeys as clickable cards.

For additional journeys, create:
  data/journeys/<brand_id>_<journey_id>.json

---

## Client-Side Wizard (Dynamic Demos)

Visit the deployed site at https://demo-generator-one.vercel.app to use the interactive wizard. No coding required:

1. **Enter your brand name** and pick industry (General, Building Materials, Food & Beverages)
2. **Upload your logo** (PNG, max 500 KB) — generates placeholder if skipped
3. **Add your products** with names, prices, and optional images
4. **Select journeys** — pick one or multiple journey types to demo
5. **Preview** — your branded demo renders instantly in the browser
6. **Download or Share** — save as HTML file or get a secure share link (expires in 24 hours)

**Hub Demos:** Selecting one or more journeys opens a hub page with journey cards. Each card shows the module title, step count, short description, and tags. Clicking a journey collapses the hub and opens that journey inside an iframe; the Back to Modules button returns to the card hub.

**Multi-Journey Demos:** Select 2+ journeys and they render as a combined hub page. Each journey runs in its own iframe to avoid conflicts, and secure share links load each journey on demand.

**Custom Step Selection:** For Order to Cash, you can pick specific steps to include (e.g. just order + payment) and the demo renders only those steps with renumbered navigation.

---

## Industries

  general             General Store         Any retail
  building_materials  Building Materials    Cement, steel, hardware
  food_beverages      Food & Beverages      Spices, snacks, drinks

Industry data: data/industries/<industry_id>.json

---

## Customising Colours

  brand      Main colour - headers, buttons, sidebar
  brandDark  Darker shade - hover states, active items
  accent     Secondary colour - highlights, badges

Use any hex code (like #FF5733).

---

## Troubleshooting

Build failed?
  - Validate JSON at https://jsonlint.com
  - Create assets/brands/<id>/ and assets/products/<id>/
  - Brand ID must match everywhere

Logo not showing?
  - File must be assets/brands/<id>/logo.png (exact name, lowercase)
  - Must be PNG format

Products not showing?
  - Catalog file name: <brand_id>_products.json
  - Product images must exist at the right path
  - Product image field must match filename

Wrong brand name/colours?
  - Edit data/brands/<id>.json, re-run build

---

## File Structure

  data/
    brands/         Brand JSON files (one per brand)
    catalogs/       Product catalog JSON files
    industries/     Industry definitions
    journeys/       Journey/step data files
  assets/
    brands/<id>/    Brand logos
    products/<id>/  Product images
  templates/
    layouts/        Page layout templates
    partials/       Reusable UI components
    screens/        Full-screen templates
  generated/        Build output (per-brand HTML)
  dist/             Packaged output for deployment
  build.js          Main build script
  USER_MANUAL.md    This file
