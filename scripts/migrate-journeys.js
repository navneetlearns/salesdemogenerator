#!/usr/bin/env node

/**
 * migrate-journeys.js
 * 
 * Phase 4: Migrate existing journey JSONs to the new schema format.
 * 
 * This script converts the old journey format (with steps[] metadata and 
 * hardcoded partial includes) to the new schema-driven format where each
 * step contains screens[] with type and data fields.
 * 
 * For existing journeys, each step becomes a screen of type `step-partial`
 * that references the existing step partial, preserving visual identity.
 * 
 * Usage:
 *   node scripts/migrate-journeys.js [--dry-run] [--brand=<brandId>]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without writing files
 *   --brand=X    Only migrate journeys for brand X (e.g., jk_cement)
 */

const fs = require('fs-extra');
const path = require('path');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..');
const JOURNEYS_DIR = path.join(ROOT, 'data', 'journeys');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'journey.schema.json');

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const brandArg = args.find(a => a.startsWith('--brand='));
const targetBrand = brandArg ? brandArg.split('=')[1] : null;

// Load schema
const ajv = new Ajv();
const schema = fs.readJsonSync(SCHEMA_PATH);
const validate = ajv.compile(schema);

// Map journey IDs to their step partial names
// This is the mapping from the old system where each step had a hardcoded partial
const JOURNEY_STEP_PARTIALS = {
  'order_to_cash': [
    'step1-self-service',
    'step2-catalog',
    'step3-ai-capture',
    'step4-back-office',
    'step5-order-confirmed',
    'step6-sap-architecture',
    'step7-invoice',
    'step8-cash-discount',
    'step9-payment',
    'step10-credit-note',
    'step11-nav-menu'
  ],
  'field_ops_expense': Array.from({length: 15}, (_, i) => `step${i+1}-field-ops`),
  'automated_collections': Array.from({length: 11}, (_, i) => `step${i+1}-collections`),
  'dealer_engagement': Array.from({length: 3}, (_, i) => `step${i+1}-dealer_engagement`),
  'retailer_onboarding': Array.from({length: 12}, (_, i) => `step${i+1}-retailer_onboarding`),
  'retailer_loyalty': Array.from({length: 6}, (_, i) => `step${i+1}-retailer_loyalty`),
  'campaigns_queries': Array.from({length: 3}, (_, i) => `step${i+1}-campaigns_queries`),
  'dt_fulfillment_payment': Array.from({length: 5}, (_, i) => `step${i+1}-dt_fulfillment_payment`),
  'retailer_activation': Array.from({length: 2}, (_, i) => `step${i+1}-retailer_activation`)
};

/**
 * Migrate a single journey JSON to the new schema
 */
function migrateJourney(oldJourney) {
  const journeyId = oldJourney.id;
  const stepPartials = JOURNEY_STEP_PARTIALS[journeyId];
  
  if (!stepPartials) {
    throw new Error(`Unknown journey type: ${journeyId}. No step partial mapping found.`);
  }
  
  // Build new steps array with screens
  const newSteps = [];
  
  // Use the old steps array for metadata (title, description, tags)
  const oldSteps = oldJourney.steps || [];
  
  for (let i = 0; i < stepPartials.length; i++) {
    const partialName = stepPartials[i];
    const oldStep = oldSteps[i] || {};
    
    const newStep = {
      num: i + 1,
      title: oldStep.title || oldStep.navTitle || `Step ${i + 1}`,
      description: oldStep.navDesc || oldStep.meta || '',
      tags: oldStep.tags || [],
      screens: [
        {
          type: 'step-partial',
          description: `Existing step partial: ${partialName}`,
          data: {
            partialName: partialName
          }
        }
      ]
    };
    
    newSteps.push(newStep);
  }
  
  // Build new journey object
  const newJourney = {
    id: oldJourney.id,
    title: oldJourney.title,
    description: oldJourney.subtitle || '',
    industry: oldJourney.industry || [],
    brands: oldJourney.brands || [],
    steps: newSteps
  };
  
  // Preserve other data fields (cart, messages, dealer, order, etc.)
  // These are still needed by the step partials
  const preservedFields = [
    'cart', 'messages', 'dealer', 'order', 'invoice', 'payment',
    'ledger', 'step3', 'step10', 'step11', 'productNames',
    'categoryTabs', 'hubMeta', 'retailer', 'distributor',
    'nudgeRetailers'
  ];
  
  for (const field of preservedFields) {
    if (oldJourney[field] !== undefined) {
      newJourney[field] = oldJourney[field];
    }
  }
  
  return newJourney;
}

/**
 * Main migration logic
 */
async function main() {
  console.log('Journey Migration Script');
  console.log('========================\n');
  
  if (dryRun) {
    console.log('DRY RUN MODE — no files will be written\n');
  }
  
  // Find all journey JSON files
  const journeyFiles = await fs.readdir(JOURNEYS_DIR);
  const jsonFiles = journeyFiles.filter(f => f.endsWith('.json'));
  
  console.log(`Found ${jsonFiles.length} journey files\n`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of jsonFiles) {
    const brandId = file.split('_')[0];
    
    // Skip if --brand filter is set and doesn't match
    if (targetBrand && brandId !== targetBrand) {
      continue;
    }
    
    const filepath = path.join(JOURNEYS_DIR, file);
    
    try {
      const oldJourney = await fs.readJson(filepath);
      
      // Check if already migrated (has steps[].screens)
      if (oldJourney.steps && oldJourney.steps[0] && oldJourney.steps[0].screens) {
        console.log(`SKIP: ${file} (already migrated)`);
        skipped++;
        continue;
      }
      
      console.log(`Migrating: ${file}`);
      
      // Migrate
      const newJourney = migrateJourney(oldJourney);
      
      // Validate against new schema
      const valid = validate(newJourney);
      if (!valid) {
        console.error(`  ERROR: Validation failed for ${file}`);
        console.error(`  ${JSON.stringify(validate.errors, null, 2)}`);
        errors++;
        continue;
      }
      
      if (dryRun) {
        console.log(`  Would write: ${newJourney.steps.length} steps`);
      } else {
        // Write migrated journey
        await fs.writeJson(filepath, newJourney, { spaces: 2 });
        console.log(`  Migrated: ${newJourney.steps.length} steps`);
      }
      
      migrated++;
      
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      errors++;
    }
  }
  
  console.log('\n========================');
  console.log(`Migration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  if (errors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
