const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { ingestBrand } = require('./brand-ingestion');
const { buildBrandFromSession } = require('./brand-generator');
const { getSession, touchSession } = require('./session-manager');

const PROJECT_ROOT = path.resolve(__dirname, '..');

async function generateSession(sessionId, brandUrl, options = {}) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found: ' + sessionId);
  
  const selectedJourneys = options.journeys || ['order_to_cash'];
  console.log('[generate] Session:', sessionId, 'URL:', brandUrl);
  
  // 1. Ingest brand from URL
  const ingestion = await ingestBrand(brandUrl, session);
  console.log('[generate] Ingestion complete:', ingestion.brandId);
  
  // 2. Create journey JSONs for selected journeys
  await createJourneyJsons(ingestion, session, selectedJourneys);
  
  // 3. Create a session-local workspace (under /tmp/sessions/<id>/workspace)
  // so we never mutate project files. Copy project into workspace (excluding node_modules, generated, dist).
  const workspace = path.join(session.paths.root, 'workspace');
  await fs.remove(workspace).catch(() => {});
  await fs.ensureDir(workspace);
  console.log('[generate] Preparing workspace:', workspace);

  // Copy project files into workspace but skip heavy dirs
  await fs.copy(PROJECT_ROOT, workspace, {
    filter: (src) => {
      const rel = src.replace(PROJECT_ROOT, '');
      if (rel.includes('node_modules')) return false;
      if (rel.includes(path.join('generated'))) return false;
      if (rel.includes(path.join('dist'))) return false;
      if (rel.includes(path.join(session.paths.root))) return false;
      return true;
    }
  });

  // Merge session data and assets into workspace
  const sessionDataDir = path.join(session.paths.root, 'data');
  if (await fs.pathExists(sessionDataDir)) {
    await fs.copy(sessionDataDir, path.join(workspace, 'data'));
  }
  await fs.copy(session.paths.assets, path.join(workspace, 'assets'));

  // Ensure fallback assets in workspace
  await fs.ensureDir(path.join(workspace, 'assets', 'fallbacks'));

  try {
    const flags = '--dist';
    console.log('[generate] Running build in workspace...');
    execSync('node build.js ' + flags, {
      cwd: workspace,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000,
      env: Object.assign({}, process.env, { NODE_ENV: 'production' }),
    });

    // Copy generated output from workspace to session
    const genSrc = path.join(workspace, 'generated', ingestion.brandId);
    if (await fs.pathExists(genSrc)) {
      await fs.emptyDir(session.paths.generated).catch(() => {});
      await fs.copy(genSrc, session.paths.generated);
      console.log('[generate] Output copied to session');
    }

    const distSrc = path.join(workspace, 'dist', ingestion.brandId);
    if (await fs.pathExists(distSrc)) {
      const distDst = path.join(session.paths.root, 'dist');
      await fs.ensureDir(distDst);
      await fs.copy(distSrc, distDst);
    }
  } finally {
    // Clean up workspace to avoid leaving large copies
    await fs.remove(workspace).catch(() => {});
  }
  
  await touchSession(sessionId);
  
  // Save generation metadata
  session.metadata.generatedAt = Date.now();
  session.metadata.brandId = ingestion.brandId;
  session.metadata.brandName = ingestion.brandName;
  session.metadata.journeys = selectedJourneys;
  session.metadata.ingestion = {
    brandName: ingestion.brandName,
    colors: ingestion.colors,
    productCount: ingestion.products.length,
    logoSource: ingestion.logo.source,
  };
  await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });
  
  return { session, ingestion, paths: session.paths };
}

async function createJourneyJsons(ingestion, session, journeyTypes) {
  const jd = path.join(session.paths.root, 'data', 'journeys');
  await fs.ensureDir(jd);
  const brandId = ingestion.brandId;
  const brandName = ingestion.brandName;
  const products = ingestion.products;
  
  const templateJourneys = {
    order_to_cash: generateOtcJourney,
    field_ops_expense: generateFieldOpsJourney,
    automated_collections: generateCollectionsJourney,
    dealer_engagement: generateDealerEngagementJourney,
    retailer_onboarding: generateRetailerOnboardingJourney,
    retailer_loyalty: generateRetailerLoyaltyJourney,
  };
  
  for (const jt of journeyTypes) {
    const gen = templateJourneys[jt];
    if (!gen) { console.warn('[generate] Unknown journey:', jt); continue; }
    const journey = gen(brandName, brandId, products);
    await fs.writeJson(path.join(jd, brandId + '_' + jt + '.json'), journey, { spaces: 2 });
    console.log('[generate] Created journey:', jt);
  }
}

async function generateSessionFromUploads(sessionId, options = {}) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found: ' + sessionId);
  const selectedJourneys = options.journeys || ['order_to_cash'];
  console.log('[generate:uploads] Session:', sessionId);

  // 1. Build brand from session uploads
  const ingestion = await buildBrandFromSession(session);
  console.log('[generate:uploads] Ingestion complete:', ingestion.brandId);

  // 2. Create journey JSONs
  await createJourneyJsons(ingestion, session, selectedJourneys);

  // 3. Run build inside a session-local workspace to avoid mutating project files
  const workspace = path.join(session.paths.root, 'workspace');
  await fs.remove(workspace).catch(() => {});
  await fs.ensureDir(workspace);

  await fs.copy(PROJECT_ROOT, workspace, {
    filter: (src) => {
      const rel = src.replace(PROJECT_ROOT, '');
      if (rel.includes('node_modules')) return false;
      if (rel.includes(path.join('generated'))) return false;
      if (rel.includes(path.join('dist'))) return false;
      if (rel.includes(path.join(session.paths.root))) return false;
      return true;
    }
  });

  // Merge session data and assets
  const sessionDataDir2 = path.join(session.paths.root, 'data');
  if (await fs.pathExists(sessionDataDir2)) {
    await fs.copy(sessionDataDir2, path.join(workspace, 'data'));
  }
  await fs.copy(session.paths.assets, path.join(workspace, 'assets'));

  try {
    const flags = '--dist';
    console.log('[generate:uploads] Running build in workspace...');
    execSync('node build.js ' + flags, {
      cwd: workspace,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000,
      env: Object.assign({}, process.env, { NODE_ENV: 'production' }),
    });

    const genSrc = path.join(workspace, 'generated', ingestion.brandId);
    if (await fs.pathExists(genSrc)) {
      await fs.emptyDir(session.paths.generated).catch(() => {});
      await fs.copy(genSrc, session.paths.generated);
      console.log('[generate:uploads] Output copied to session');
    }
    const distSrc = path.join(workspace, 'dist', ingestion.brandId);
    if (await fs.pathExists(distSrc)) {
      const distDst = path.join(session.paths.root, 'dist');
      await fs.ensureDir(distDst);
      await fs.copy(distSrc, distDst);
    }
  } finally {
    await fs.remove(workspace).catch(() => {});
  }

  await touchSession(sessionId);

  session.metadata.generatedAt = Date.now();
  session.metadata.brandId = ingestion.brandId;
  session.metadata.brandName = ingestion.brandName;
  session.metadata.journeys = selectedJourneys;
  session.metadata.ingestion = {
    brandName: ingestion.brandName,
    colors: ingestion.colors,
    productCount: (ingestion.products && ingestion.products.length) || 0,
    logoSource: ingestion.logo && ingestion.logo.source,
  };
  await fs.writeJson(path.join(session.paths.root, 'metadata.json'), session, { spaces: 2 });

  return { session, ingestion, paths: session.paths };
}

function makeDealer(brandName) {
  return { name: brandName + ' Store', contactName: 'Rajesh', phone: '+91-9876543210', address: '123 Main Street' };
}
function makeOrder(products) {
  const items = products.slice(0, 3).map((p, i) => ({
    productId: p.id, sku: p.sku, qty: 10 + i * 5, unit: 'pcs', lineTotal: (p.price || 100) * (10 + i * 5),
  }));
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  return { primaryOrderId: 'ORD-001', date: new Date().toISOString().slice(0, 10), transporter: 'FastExpress', items, summary: { totalItems: items.length, totalQuantity: items.reduce((s, i) => s + i.qty, 0), orderValue: total }, historyOrders: [] };
}
function defaultSteps(count, prefix) {
  return Array.from({ length: count }, function(_, i) {
    var n = i + 1; return { num: n, displayNum: n, title: prefix + ' ' + n, meta: '', navTitle: prefix + ' ' + n, navDesc: '' };
  });
}

function generateOtcJourney(bn, bid, products) {
  return { id: 'order_to_cash', title: 'Order to Cash', dealer: makeDealer(bn), order: makeOrder(products), invoice: { id: 'INV-001', date: '2026-01-15', dueDate: '2026-02-15', discount: 50, docId: 'DOC-001' }, payment: { amount: 100000, date: '2026-01-20', method: 'Bank Transfer' }, ledger: { creditNoteId: 'CN-001', creditNoteAmount: 200, entries: [] }, step3: { cartItems: [], cartSummary: { subtotal: 0, discount: 0, total: 0 } }, messages: { step1: { greeting: 'Welcome! How can I help?', sections: ['Catalog'], categoryQuestion: 'Which category?' } }, navSteps: Array.from({length:11},function(_,i){return 'step-'+(i+1)}), steps: defaultSteps(11, 'Step') };
}

function generateFieldOpsJourney(bn, bid, products) {
  return { id: 'field_ops_expense', title: 'Field Ops & Expense', dealer: makeDealer(bn), order: makeOrder(products), invoice: { id: 'INV-001', date: '2026-01-15', dueDate: '2026-02-15', discount: 50, docId: 'DOC-001' }, payment: { amount: 100000, date: '2026-01-20', method: 'Bank Transfer' }, ledger: { creditNoteId: 'CN-001', creditNoteAmount: 200, entries: [] }, step3: { cartItems: [], cartSummary: { subtotal: 0, discount: 0, total: 0 } }, messages: { step1: { greeting: 'Welcome!', sections: ['Catalog'], categoryQuestion: 'Which?' } }, navSteps: Array.from({length:15},function(_,i){return 'step-'+(i+1)}), steps: defaultSteps(15, 'Step') };
}

function generateCollectionsJourney(bn, bid, products) {
  return { id: 'automated_collections', title: 'Automated Collections', dealer: makeDealer(bn), order: makeOrder(products), navSteps: Array.from({length:11},function(_,i){return 'step-'+(i+1)}), steps: defaultSteps(11, 'Step'),
    cart: { items: products.slice(0,2).map(function(p){ return { productId: p.id, qty: 5 }; }) },
    messages: { overdueReminder: 'Your payment is overdue. Please pay at earliest.', reminderDate: '2026-01-25' } };
}

function generateDealerEngagementJourney(bn, bid, products) {
  return { id: 'dealer_engagement', title: 'Dealer Engagement', dealer: makeDealer(bn), navSteps: ['step-1','step-2','step-3'], steps: defaultSteps(3, 'DE') };
}

function generateRetailerOnboardingJourney(bn, bid, products) {
  return { id: 'retailer_onboarding', title: 'Retailer Onboarding', dealer: makeDealer(bn), navSteps: Array.from({length:10},function(_,i){return 'step-'+(i+1)}), steps: defaultSteps(10, 'RO') };
}

function generateRetailerLoyaltyJourney(bn, bid, products) {
  return { id: 'retailer_loyalty', title: 'Retailer Loyalty', dealer: makeDealer(bn), navSteps: Array.from({length:6},function(_,i){return 'step-'+(i+1)}), steps: defaultSteps(6, 'RL') };
}

module.exports = { generateSession, generateSessionFromUploads, createJourneyJsons };

