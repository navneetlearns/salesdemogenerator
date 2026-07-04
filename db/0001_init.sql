-- 0001_init.sql — Supabase schema for Demo Generator
-- Run this in Supabase Studio SQL Editor
-- Region: ap-south-1

-- 1. Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: industries
-- One row per industry (cement, fmcg, industrial, pharma, agri, general)
-- ============================================================
CREATE TABLE IF NOT EXISTS industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,                    -- snake_case key: 'cement', 'fmcg', etc.
  label TEXT NOT NULL,                          -- Display name: 'Cement', 'FMCG'
  partner_label TEXT DEFAULT 'Partner',         -- What we call the brand's customer
  unit TEXT DEFAULT 'unit',                     -- Singular unit: 'bag', 'packet'
  unit_plural TEXT DEFAULT 'units',             -- Plural unit: 'bags', 'packets'
  currency TEXT DEFAULT 'INR',
  currency_symbol TEXT DEFAULT '₹',
  category_tabs JSONB DEFAULT '[]'::jsonb,      -- Product category tabs for wizard
  labels JSONB DEFAULT '{}'::jsonb,            -- Per-journey labels (21+ keys)
  messages JSONB DEFAULT '{}'::jsonb,          -- WhatsApp conversation messages with {{placeholders}}
  descriptions JSONB DEFAULT '{}'::jsonb,       -- Step descriptions deduplicated per industry
  terminology JSONB DEFAULT '{}'::jsonb,        -- Industry-specific business terms
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: brands
-- One row per brand/client (3 live + 22 migrated)
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,                    -- URL-safe: 'jk_cement', 'adani_wilmar'
  name TEXT NOT NULL,                           -- Display name: 'JK Cement', 'Adani Wilmar'
  industry_id UUID REFERENCES industries(id),
  colors JSONB DEFAULT '{}'::jsonb,            -- {brand, brand_dark, accent, ...}
  font JSONB DEFAULT '{"primary":"Space Grotesk"}'::jsonb,
  dealer_store_name TEXT DEFAULT 'Main Dealer',
  secondary_dealers JSONB DEFAULT '[]'::jsonb,
  assets JSONB DEFAULT '{"logo_ref":null,"hero_ref":null}'::jsonb,
  theme JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: journeys
-- Per-brand, per-journey-type messages/labels/descriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  journey_type TEXT NOT NULL,                   -- 'order_to_cash', 'field_ops_expense', etc.
  messages JSONB DEFAULT '{}'::jsonb,          -- Per-step conversation text
  labels JSONB DEFAULT '{}'::jsonb,            -- Journey-specific label overrides
  descriptions JSONB DEFAULT '{}'::jsonb,      -- Step descriptions
  UNIQUE(brand_id, journey_type),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: images_meta
-- Metadata for images stored in demo-assets bucket
-- ============================================================
CREATE TABLE IF NOT EXISTS images_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL,                     -- 'logo', 'product', 'hero', 'field_ops', 'fallback'
  storage_path TEXT NOT NULL,                   -- 'jk_cement/logo/logo.svg'
  alt TEXT DEFAULT '',
  width INT,
  height INT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_industries_updated_at
  BEFORE UPDATE ON industries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_journeys_updated_at
  BEFORE UPDATE ON journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW-LEVEL SECURITY
-- Public read (publishable key works), admin write (secret key only)
-- ============================================================
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE images_meta ENABLE ROW LEVEL SECURITY;

-- Public SELECT policies
CREATE POLICY "public read" ON industries FOR SELECT USING (true);
CREATE POLICY "public read" ON brands FOR SELECT USING (true);
CREATE POLICY "public read" ON journeys FOR SELECT USING (true);
CREATE POLICY "public read" ON images_meta FOR SELECT USING (true);

-- Admin write — allow-all with USING(true) CHECK(true) because Supabase's
-- non-JWT secret key authenticates as service_role when sent as apikey header,
-- bypassing RLS. Hardening is done via REVOKE below.
CREATE POLICY "admin write" ON industries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin write" ON brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin write" ON journeys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin write" ON images_meta FOR ALL USING (true) WITH CHECK (true);

-- REVOKE INSERT/UPDATE/DELETE from anon, authenticated, public
-- Only the secret key (service_role) can write
REVOKE INSERT, UPDATE, DELETE ON industries FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON brands FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON journeys FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE ON images_meta FROM anon, authenticated, public;

-- ============================================================
-- STORAGE BUCKET (create via Dashboard or supabase CLI)
-- Bucket name: demo-assets
-- Public read: true
-- ============================================================
-- To create via Dashboard:
--   1. Go to Storage → New Bucket
--   2. Name: demo-assets
--   3. Public bucket: ON
--
-- To create via CLI:
--   supabase storage create demo-assets --public
-- ============================================================

-- ============================================================
-- CORS CONFIGURATION (configure via Dashboard)
-- Allowed origins:
--   https://demo-generator-482.pages.dev
--   http://localhost:* (for local testing)
-- ============================================================
