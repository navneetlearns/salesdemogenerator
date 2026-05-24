/**
 * Central registry mapping journey screen types → Handlebars partial names.
 * Phase 2 — full composable architecture: all 11 steps extracted as partials.
 */
const SCREEN_REGISTRY = {
  catalog: 'screen-catalog',
  cart: 'screen-cart',
  receipt: 'screen-receipt',
  whatsapp: 'screen-whatsapp',
  architecture: 'screen-architecture',
  order_history: 'screen-order-history',
  // Phase 2 — composable step partials (extracted from monolith)
  'step1-self-service': 'step1-self-service',
  'step2-catalog': 'step2-catalog',
  'step3-ai-capture': 'step3-ai-capture',
  'step4-back-office': 'step4-back-office',
  'step5-order-confirmed': 'step5-order-confirmed',
  'step6-sap-architecture': 'step6-sap-architecture',
  'step7-invoice': 'step7-invoice',
  'step8-cash-discount': 'step8-cash-discount',
  'step9-payment': 'step9-payment',
  'step10-credit-note': 'step10-credit-note',
  'step11-nav-menu': 'step11-nav-menu',
  'step1-field-ops': 'step1-field-ops',
  'step2-field-ops': 'step2-field-ops',
  'step3-field-ops': 'step3-field-ops',
  'step4-field-ops': 'step4-field-ops',
  'step5-field-ops': 'step5-field-ops',
  'step6-field-ops': 'step6-field-ops',
  'step7-field-ops': 'step7-field-ops',
  'step8-field-ops': 'step8-field-ops',
  'step9-field-ops': 'step9-field-ops',
  'step10-field-ops': 'step10-field-ops',
  'step11-field-ops': 'step11-field-ops',
  'step12-field-ops': 'step12-field-ops',
  'step13-field-ops': 'step13-field-ops',
  'step14-field-ops': 'step14-field-ops',
  'step15-field-ops': 'step15-field-ops',
  'step1-collections': 'step1-collections',
  'step2-collections': 'step2-collections',
  'step3-collections': 'step3-collections',
  'step4-collections': 'step4-collections',
  'step5-collections': 'step5-collections',
  'step6-collections': 'step6-collections',
  'step7-collections': 'step7-collections',
  'step8-collections': 'step8-collections',
  'step9-collections': 'step9-collections',
  'step10-collections': 'step10-collections',
  'step11-collections': 'step11-collections',
  'step1-dealer_engagement': 'step1-dealer_engagement',
  'step2-dealer_engagement': 'step2-dealer_engagement',
  'step3-dealer_engagement': 'step3-dealer_engagement',
  'step1-retailer_onboarding': 'step1-retailer_onboarding',
  'step2-retailer_onboarding': 'step2-retailer_onboarding',
  'step3-retailer_onboarding': 'step3-retailer_onboarding',
  'step4-retailer_onboarding': 'step4-retailer_onboarding',
  'step5-retailer_onboarding': 'step5-retailer_onboarding',
  'step6-retailer_onboarding': 'step6-retailer_onboarding',
  'step7-retailer_onboarding': 'step7-retailer_onboarding',
  'step8-retailer_onboarding': 'step8-retailer_onboarding',
  'step9-retailer_onboarding': 'step9-retailer_onboarding',
  'step10-retailer_onboarding': 'step10-retailer_onboarding',
  'step1-retailer_loyalty': 'step1-retailer_loyalty',
  'step2-retailer_loyalty': 'step2-retailer_loyalty',
  'step3-retailer_loyalty': 'step3-retailer_loyalty',
  'step4-retailer_loyalty': 'step4-retailer_loyalty',
  'step5-retailer_loyalty': 'step5-retailer_loyalty',
  'step6-retailer_loyalty': 'step6-retailer_loyalty',
};

function getPartialName(screenType) {
  return SCREEN_REGISTRY[screenType] || `screen-${screenType}`;
}

function validateScreenTypes(screenTypes) {
  const unknown = screenTypes.filter(t => !SCREEN_REGISTRY[t]);
  return { valid: unknown.length === 0, unknown };
}

module.exports = { SCREEN_REGISTRY, getPartialName, validateScreenTypes };
