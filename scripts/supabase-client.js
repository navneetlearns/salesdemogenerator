// scripts/supabase-client.js — Minimal Supabase read/write client
// Uses publishable key for reads, secret key for admin writes
// Sent via `apikey` header (Supabase's non-JWT key model as of 2026)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function apiUrl(table, query = '') {
  return `${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
}

function headers(key) {
  return {
    'apikey': key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

/**
 * Fetch rows from a Supabase table using the publishable key (read-only).
 * @param {string} table — table name
 * @param {object} opts — { select, order, limit, offset, filters }
 * @returns {Promise<Array>}
 */
async function get(table, opts = {}) {
  const params = new URLSearchParams();
  if (opts.select) params.set('select', opts.select);
  if (opts.order) params.set('order', opts.order);
  if (opts.limit) params.set('limit', opts.limit);
  if (opts.offset) params.set('offset', opts.offset);
  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      params.set(k, v);
    }
  }
  const url = apiUrl(table, params.toString());
  const res = await fetch(url, {
    headers: headers(SUPABASE_PUBLISHABLE_KEY || SUPABASE_SECRET_KEY),
  });
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Fetch a single row by name/value filter.
 */
async function getOne(table, field, value) {
  const rows = await get(table, { filters: { [`${field}=eq.${value}`]: '' } });
  return rows[0] || null;
}

/**
 * Insert rows using the secret key (admin write).
 * @param {string} table
 * @param {object|Array} rows — single object or array of objects
 * @returns {Promise<Array>}
 */
async function insert(table, rows) {
  if (!SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY required for writes');
  const body = Array.isArray(rows) ? rows : [rows];
  const url = apiUrl(table);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers(SUPABASE_SECRET_KEY),
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase INSERT ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Upsert rows using the secret key (admin write).
 * @param {string} table
 * @param {object|Array} rows
 * @param {string} onConflict — column for conflict resolution
 * @returns {Promise<Array>}
 */
async function upsert(table, rows, onConflict = 'id') {
  if (!SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY required for writes');
  const body = Array.isArray(rows) ? rows : [rows];
  const url = apiUrl(table, `on_conflict=${onConflict}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers(SUPABASE_SECRET_KEY),
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase UPSERT ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Delete rows using the secret key.
 */
async function del(table, filters) {
  if (!SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY required for writes');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) params.set(k, v);
  const url = apiUrl(table, params.toString());
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(SUPABASE_SECRET_KEY),
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Industry profile helper
async function getIndustryProfile(name) {
  return getOne('industries', 'name', name);
}

module.exports = { get, getOne, insert, upsert, del, getIndustryProfile, headers, apiUrl };
