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

## The 6 Journey Types

  Order to Cash          Customer orders via WhatsApp, AI capture, payment    11 steps
  Field Ops & Expense    Sales exec beat plan, visits, check-ins, reports     15 steps
  Automated Collections  Payment reminders, collections dashboard             11 steps
  Dealer Engagement      Dealer interaction and communication                  3 steps
  Retailer Onboarding    New retailer signup and setup                        10 steps
  Retailer Loyalty       Points, tiers, offers, redemptions                    6 steps

For additional journeys, create:
  data/journeys/<brand_id>_<journey_id>.json

Journey IDs: order_to_cash, field_ops_expense, automated_collections,
             dealer_engagement, retailer_onboarding, retailer_loyalty

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
