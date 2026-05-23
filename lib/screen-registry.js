/**
 * Central registry mapping journey screen types → Handlebars partial names.
 * Used by the build orchestrator for validation and dynamic partial resolution.
 */
const SCREEN_REGISTRY = {
  catalog: 'screen-catalog',
  cart: 'screen-cart',
  receipt: 'screen-receipt',
  whatsapp: 'screen-whatsapp',
  architecture: 'screen-architecture',
  order_history: 'screen-order-history',
};

function getPartialName(screenType) {
  return SCREEN_REGISTRY[screenType] || `screen-${screenType}`;
}

function validateScreenTypes(screenTypes) {
  const unknown = screenTypes.filter(t => !SCREEN_REGISTRY[t]);
  return { valid: unknown.length === 0, unknown };
}

module.exports = { SCREEN_REGISTRY, getPartialName, validateScreenTypes };
