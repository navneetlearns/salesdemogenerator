// scripts/seed-industries.js — Insert 6 industry profiles into Supabase
// Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/seed-industries.js

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY required');
  process.exit(1);
}

function apiUrl(table) {
  return `${SUPABASE_URL}/rest/v1/${table}`;
}

async function request(method, table, body) {
  const url = apiUrl(table);
  const headers = {
    'apikey': SUPABASE_SECRET_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const seedPath = path.resolve(__dirname, '..', 'migration', 'industries_seed.json');
  const industries = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  
  console.log(`Seeding ${industries.length} industries...\n`);
  
  for (const ind of industries) {
    try {
      // Check if already exists
      const existing = await request('GET', `industries?name=eq.${ind.name}&select=id,name`);
      if (existing.length > 0) {
        console.log(`  ${ind.name}: already exists (id=${existing[0].id}), skipping`);
        continue;
      }
      
      const result = await request('POST', 'industries', ind);
      const id = Array.isArray(result) ? result[0]?.id : result.id;
      console.log(`  ${ind.name}: inserted (id=${id})`);
    } catch (err) {
      console.error(`  ${ind.name}: ERROR — ${err.message}`);
    }
  }
  
  // Verify
  const all = await request('GET', 'industries?select=name,label&order=name.asc');
  console.log(`\nIndustry rows in Supabase: ${all.length}`);
  for (const row of all) {
    console.log(`  - ${row.name}: ${row.label}`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
