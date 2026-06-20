#!/usr/bin/env node

/**
 * new-journey — Generate a schema-valid skeleton JSON for a new journey.
 *
 * Usage:
 *   npm run new-journey -- --id=post_order_communication
 *   npm run new-journey -- --id=daily_rate_broadcast --steps=4
 *   npm run new-journey -- --id=sales_to_cash --steps=6 --brands=jk_cement,haldirams
 *
 * Creates: data/journeys/<brand>_<id>.json for each brand (or all brands if --brands not specified)
 */

const fs = require('fs-extra');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JOURNEYS_DIR = path.join(ROOT, 'data', 'journeys');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'journey.schema.json');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const journeyId = getArg('id');
const stepCount = parseInt(getArg('steps') || '3', 10);
const brandsArg = getArg('brands');

if (!journeyId) {
  console.error('Error: --id is required');
  console.error('');
  console.error('Usage:');
  console.error('  npm run new-journey -- --id=<journey_id>');
  console.error('  npm run new-journey -- --id=<journey_id> --steps=<n>');
  console.error('  npm run new-journey -- --id=<journey_id> --brands=<brand1,brand2>');
  process.exit(1);
}

// Validate schema exists
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error(`Error: Schema not found at ${SCHEMA_PATH}`);
  process.exit(1);
}

// Determine which brands to generate for
let brands;
if (brandsArg) {
  brands = brandsArg.split(',').map(b => b.trim());
} else {
  // Default: generate for all brands that have journey files
  const existingFiles = fs.readdirSync(JOURNEYS_DIR).filter(f => f.endsWith('.json'));
  brands = [...new Set(existingFiles.map(f => f.replace(/_.*$/, '')))];
}

// Generate skeleton journey
function generateSkeleton(id, steps) {
  const title = id
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const stepArray = [];
  for (let i = 1; i <= steps; i++) {
    stepArray.push({
      num: i,
      title: `Step ${i} — TODO`,
      description: `<span class="tag tag-util">TODO</span><span>Description for step ${i}</span>`,
      tags: ['todo'],
      screens: [
        {
          type: 'whatsapp-message',
          description: `Screen 1 for step ${i}`,
          data: {
            body: `TODO: Add message content for step ${i}`,
            sender: 'user',
            time: '10:00 AM'
          }
        }
      ]
    });
  }

  return {
    id,
    title,
    description: `TODO: Add journey description for ${title}`,
    industry: ['TODO'],
    brands: ['TODO'],
    steps: stepArray
  };
}

// Validate against schema
function validateAgainstSchema(journey) {
  const Ajv = require('ajv');
  const ajv = new Ajv();
  const schema = fs.readJsonSync(SCHEMA_PATH);
  const validate = ajv.compile(schema);
  const valid = validate(journey);

  if (!valid) {
    console.error('Schema validation errors:');
    validate.errors.forEach(err => {
      console.error(`  ${err.instancePath || '/'}: ${err.message}`);
    });
    return false;
  }
  return true;
}

// Generate and write files
let created = 0;
let skipped = 0;

brands.forEach(brand => {
  const filename = `${brand}_${journeyId}.json`;
  const filepath = path.join(JOURNEYS_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.log(`SKIP: ${filename} already exists`);
    skipped++;
    return;
  }

  const skeleton = generateSkeleton(journeyId, stepCount);
  skeleton.brands = [brand];

  // Validate before writing
  if (!validateAgainstSchema(skeleton)) {
    console.error(`ERROR: Generated skeleton for ${filename} fails schema validation`);
    process.exit(1);
  }

  fs.writeJsonSync(filepath, skeleton, { spaces: 2 });
  console.log(`CREATE: ${filename}`);
  created++;
});

console.log('');
console.log(`Done: ${created} created, ${skipped} skipped`);
console.log('');
console.log('Next steps:');
console.log('  1. Edit the generated JSON files to fill in TODO placeholders');
console.log('  2. Add screen types and data for each step');
console.log('  3. Run: npm run build to verify');
