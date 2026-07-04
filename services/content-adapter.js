// services/content-adapter.js — Supabase-backed Industry Profile System
// Replaces the old LLM-at-runtime adapter with deterministic industry profiles
// loaded from Supabase at build time. No runtime LLM dependency.
//
// Keys sent via `apikey` header (Supabase's non-JWT key model as of 2026).

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

// Read .env as fallback when process.env doesn't have the vars (WSL→Windows node.exe)
function readDotEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(ROOT, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith(key + '=')) {
          return trimmed.slice(key.length + 1);
        }
      }
    }
  } catch {}
  return '';
}

const SUPABASE_URL = readDotEnv('SUPABASE_URL');
const PUBLISHABLE_KEY = readDotEnv('SUPABASE_PUBLISHABLE_KEY');

/**
 * Fetch an industry profile from Supabase by name.
 * Falls back to 'general' if the named industry doesn't exist.
 */
async function getIndustryProfile(name) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    console.warn('[content-adapter] SUPABASE_URL or PUBLISHABLE_KEY not set; using empty profile');
    return { name: name || 'general', labels: {}, messages: {}, descriptions: {}, terminology: {} };
  }

  const target = name || 'general';
  const url = `${SUPABASE_URL}/rest/v1/industries?name=eq.${target}&select=*`;
  const res = await fetch(url, {
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    console.warn(`[content-adapter] GET industries/${target} failed: ${res.status}`);
    // Fallback to general
    if (target !== 'general') return getIndustryProfile('general');
    return { name: 'general', labels: {}, messages: {}, descriptions: {}, terminology: {} };
  }

  const data = await res.json();
  if (!data || data.length === 0) {
    if (target !== 'general') return getIndustryProfile('general');
    return { name: 'general', labels: {}, messages: {}, descriptions: {}, terminology: {} };
  }

  return data[0];
}

/**
 * Fetch all industries (for client-side dropdown).
 */
async function listIndustries() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/industries?select=name,label&order=label.asc`;
  const res = await fetch(url, {
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Get a public Storage URL for an image.
 */
function getImageUrl(storagePath) {
  if (!SUPABASE_URL || !storagePath) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/demo-assets/${storagePath}`;
}

/**
 * Apply an industry profile to a journey/brand context.
 * Substitutes {{placeholders}} in messages, labels, descriptions
 * with the brand's actual values.
 *
 * @param {object} profile — { labels, messages, descriptions, ... }
 * @param {object} brand — { name, dealer_store_name, products, ... }
 * @returns {{ labels, messages, descriptions }}
 */
function applyProfileToJourney(profile, brand) {
  const context = {
    brandName: brand?.name || 'Brand',
    dealerStoreName: brand?.dealer_store_name || 'Main Dealer',
    productName: brand?.products?.[0]?.name || brand?.products?.[0] || 'Product',
    unitPlural: profile?.unit_plural || 'units',
    unit: profile?.unit || 'unit',
    orderTerm: profile?.terminology?.order_term || 'order',
    currencySymbol: profile?.currency_symbol || '₹',
  };

  function substitute(text) {
    if (typeof text !== 'string') return text;
    let result = text;
    result = result.replace(/\{\{brandName\}\}/g, context.brandName);
    result = result.replace(/\{\{dealerStoreName\}\}/g, context.dealerStoreName);
    result = result.replace(/\{\{productName\}\}/g, context.productName);
    result = result.replace(/\{\{unitPlural\}\}/g, context.unitPlural);
    result = result.replace(/\{\{unit\}\}/g, context.unit);
    result = result.replace(/\{\{orderTerm\}\}/g, context.orderTerm);
    result = result.replace(/\{\{currencySymbol\}\}/g, context.currencySymbol);
    return result;
  }

  function substituteObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(substituteObject);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = substitute(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = substituteObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return {
    labels: { ...substituteObject(profile?.labels || {}), ...substituteObject(brand?.labelOverrides || {}) },
    messages: substituteObject(profile?.messages || {}),
    descriptions: substituteObject(profile?.descriptions || {}),
  };
}

/**
 * Get labels for a specific journey type from a profile.
 */
function getLabelsForJourneyType(profile, journeyType) {
  if (!profile?.labels) return {};
  return profile.labels;
}

/**
 * Get messages for a specific journey from a profile.
 */
function getMessagesForJourney(profile, journeyType) {
  if (!profile?.messages) return {};
  return profile.messages[journeyType] || profile.messages;
}

// Default export for backward compat
module.exports = {
  getIndustryProfile,
  listIndustries,
  getImageUrl,
  applyProfileToJourney,
  getLabelsForJourneyType,
  getMessagesForJourney,
};
