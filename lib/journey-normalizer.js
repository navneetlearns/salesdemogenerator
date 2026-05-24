const { getPartialName } = require('./screen-registry');

const DEFAULT_STEPS = [
  { num: 1, displayNum: 1, title: 'Catalog Browse', meta: 'Browse & order', navTitle: 'Step 1 — Catalog Browse', navDesc: '<span class="tag tag-ord">Catalog</span>' },
  { num: 2, displayNum: 2, title: 'Cart & Checkout', meta: 'Review cart', navTitle: 'Step 2 — Cart & Checkout', navDesc: '<span class="tag tag-ord">Cart</span>' },
];

function buildNavSteps(steps) {
  return steps.map((step, i) => ({
    title: step.navTitle || `Step ${step.num} — ${step.title}`,
    desc: step.navDesc || `<span style="color:#555;font-size:12px;">${step.meta || step.title}</span>`,
    num: step.num ?? i + 1,
    active: i === 0,
  }));
}

function resolveCartItems(cartConfig, productsById) {
  if (!cartConfig?.items?.length) {
    const defaults = Object.values(productsById).slice(0, 2);
    return defaults.map((p, i) => ({
      ...p,
      qty: i === 0 ? 12 : 8,
      tag: p.tag || p.category || '',
    }));
  }
  return cartConfig.items.map(item => {
    const product = productsById[item.productId] || productsById[item.id];
    if (!product) {
      throw new Error(`Cart references unknown product: ${item.productId || item.id}`);
    }
    return {
      ...product,
      qty: item.qty ?? 1,
      tag: item.tag ?? product.tag ?? product.category ?? '',
    };
  });
}

function normalizeJourney(rawJourney, catalogProducts) {
  const journey = { ...rawJourney };
  const productsById = Object.fromEntries(catalogProducts.map(p => [p.id, p]));

  journey.steps = (journey.steps?.length ? journey.steps : DEFAULT_STEPS).map((step, i) => ({
    ...step,
    num: step.num ?? i + 1,
    displayNum: step.displayNum ?? step.num ?? i + 1,
    active: i === 0,
  }));

  journey.navSteps = buildNavSteps(journey.steps);
  journey.subtitle = journey.subtitle || journey.title || 'Customer Journey';

  journey.screens = (journey.screens || []).map(screen => {
    const type = screen.type || screen.template;
    return {
      ...screen,
      type,
      partial: screen.partial || getPartialName(type),
    };
  });

  journey.cart = {
    items: resolveCartItems(journey.cart, productsById),
    summary: journey.cart?.summary || {
      totalItems: journey.cart?.items?.length || 2,
      totalQuantity: '13',
      orderValue: '₹4,416',
    },
  };

  journey.composableScreens = journey.screens.filter(s => s.type && s.type !== 'legacy');

  return journey;
}

module.exports = { normalizeJourney, buildNavSteps, DEFAULT_STEPS };
