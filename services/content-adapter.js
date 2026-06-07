const fs = require('fs-extra');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_LABELS_PATH = path.join(ROOT, 'data', 'content', 'order_to_cash_labels.json');
const DEFAULT_SESSION_OVERRIDE_PATH = 'overrides/content.json';

const DEFAULT_MODEL_CONFIG = Object.freeze({
  provider: 'OpenCode',
  model: 'deepseek-v4-flash',
  baseUrl: process.env.OPENCODE_BASE_URL || process.env.OPENCODE_API_BASE_URL || 'https://opencode.ai/zen/go/v1',
});

const DISALLOWED_MARKETING = [
  'buy now',
  'click here',
  'amazing',
  'best',
  'exclusive',
  'limited offer',
];

function loadDefaultLabels() {
  return fs.readJsonSync(DEFAULT_LABELS_PATH);
}

const DEFAULT_LABELS = loadDefaultLabels();

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasHtmlOrMarkdown(value) {
  return /<[^>]+>/.test(value) || /[*_`\[\]#>]/.test(value);
}

function hasEmoji(value) {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(value);
}

function hasDisallowedMarketing(value) {
  const lower = String(value).toLowerCase();
  return DISALLOWED_MARKETING.some(term => lower.includes(term));
}

function isValidLabelValue(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && !hasHtmlOrMarkdown(value)
    && !hasEmoji(value)
    && !hasDisallowedMarketing(value);
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) return [];
  return products
    .map(product => {
      if (typeof product === 'string') return product.trim();
      if (product && typeof product === 'object') {
        return product.name || product.label || product.title || '';
      }
      return '';
    })
    .filter(Boolean);
}

function buildSystemPrompt({ industry, brandName, products, labels, industryContext }) {
  const parts = [
    'You are an expert B2B enterprise UX copywriter. Adapt button labels and UI text',
    'for the given industry. CHANGE the labels to use terminology SPECIFIC to that industry.',
    'The labels must sound natural for someone working in that industry day-to-day.',
    '',
    'Industry:',
    industry,
    '',
    'Brand:',
    brandName,
    '',
    'Sample Products:',
    JSON.stringify(products, null, 2),
  ];

  if (industryContext) {
    parts.push('');
    parts.push('Industry Context:');
    if (industryContext.productCategories) {
      parts.push('Product Categories: ' + industryContext.productCategories.join(', '));
    }
    if (industryContext.partnerTypes) {
      parts.push('Business Partners: ' + industryContext.partnerTypes.join(', '));
    }
    if (industryContext.terminology) {
      parts.push('Industry Terms: ' + JSON.stringify(industryContext.terminology));
    }
  }

  parts.push('');
  parts.push('Task:');
  parts.push('Rewrite each label below. CHANGE at least half of them to be industry-specific.');
  parts.push('');
  parts.push('Examples of good adaptations:');
  parts.push('  Pharma: "Browse Products" -> "Browse Medicines", "Place Order" -> "Create Purchase Order", "Price List" -> "Product Catalogue"');
  parts.push('  Steel:  "Browse Products" -> "Browse Stockyard", "Place Order" -> "Raise Indent", "Price List" -> "Rate List"');
  parts.push('  Cement: "Browse Products" -> "Browse Inventory", "Place Order" -> "Raise Material Request", "Price List" -> "Price Bulletin"');
  parts.push('  FMCG:   "Browse Products" -> "Browse Stocks", "Place Order" -> "Place Indent", "Price List" -> "Trade Price List"');
  parts.push('');
  parts.push('Requirements:');
  parts.push('- CHANGE at least half the labels to be industry-specific.');
  parts.push('- Keep labels concise (2-4 words preferred).');
  parts.push('- Do NOT use marketing/sales/promotional language.');
  parts.push('- No HTML, no markdown, no emoji.');
  parts.push('- Return ONLY a JSON object with the exact same keys.');
  parts.push('- Each value must be the adapted label string.');
  parts.push('');
  parts.push('Labels to adapt:');
  parts.push(JSON.stringify(labels, null, 2));
  return parts.join('\n');
}

function buildPromptPayload({ industry, brandName, journeyType, products, labels, industryContext }) {
  return {
    industry,
    brandName,
    journeyType,
    products,
    labels,
    industryContext,
  };
}

function validateAdaptationResponse(response, labels) {
  const safe = {};
  const expectedKeys = Object.keys(labels || DEFAULT_LABELS);
  const source = response && typeof response === 'object'
    ? (response.acceptedLabels || response.content || response.labels || response)
    : {};

  for (const key of expectedKeys) {
    const original = labels[key];
    const value = source[key];
    safe[key] = isValidLabelValue(value) ? value.trim() : original;
  }

  return safe;
}

function buildAdaptationDiff(originalLabels, proposedLabels) {
  const diff = {};
  for (const key of Object.keys(originalLabels)) {
    const original = originalLabels[key];
    const proposed = proposedLabels[key];
    diff[key] = {
      original,
      proposed,
      changed: proposed !== original,
    };
  }
  return diff;
}

function buildJourneyContent({ acceptedLabels = {}, defaultLabels = DEFAULT_LABELS }) {
  return {
    ...defaultLabels,
    ...acceptedLabels,
  };
}

async function callOpenCodeApi(payload, options = {}) {
  const config = {
    ...DEFAULT_MODEL_CONFIG,
    ...options.config,
  };
  const apiKey = options.apiKey || process.env.OPENCODE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenCode API key is not configured');
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 90000;
  const timer = setTimeout(() => controller.abort(new Error('OpenCode request timed out')), timeoutMs);
  timer.unref?.();

  try {
    const res = await (options.fetchImpl || fetch)(config.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.systemPrompt || buildSystemPrompt(payload) },
          { role: 'user', content: 'Industry: ' + payload.industry + '\nBrand: ' + payload.brandName + '\nJourney: ' + payload.journeyType + '\nProducts: ' + JSON.stringify(payload.products) },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenCode API error ${res.status}: ${text.slice(0, 250)}`);
    }

    const data = await res.json();
    const content =
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      data?.content ||
      '';

    if (!content || typeof content !== 'string') {
      throw new Error('OpenCode API returned an empty response');
    }

    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

async function adaptJourneyContent({
  industry,
  brandName,
  journeyType,
  products,
  labels,
  industryContext,
  client,
  config,
  apiKey,
  timeoutMs,
} = {}) {
  const defaultLabels = { ...DEFAULT_LABELS, ...(labels || {}) };
  const payload = buildPromptPayload({
    industry,
    brandName,
    journeyType,
    products: normalizeProducts(products),
    labels: defaultLabels,
    industryContext,
  });

  let rawResponse = null;
  try {
    rawResponse = client
      ? await client(payload)
      : await callOpenCodeApi(payload, { config, apiKey, timeoutMs });
  } catch (err) {
    rawResponse = null;
  }

  const validated = validateAdaptationResponse(rawResponse, defaultLabels);
  const adaptationDiff = buildAdaptationDiff(defaultLabels, validated);

  return {
    provider: DEFAULT_MODEL_CONFIG.provider,
    model: DEFAULT_MODEL_CONFIG.model,
    payload,
    acceptedLabels: validated,
    adaptationDiff,
  };
}

async function saveContentOverrides(session, payload) {
  if (!session || !session.paths || !session.paths.root) {
    throw new Error('Session is required');
  }

  const overrideDir = session.paths.overrides || path.join(session.paths.root, 'overrides');
  await fs.ensureDir(overrideDir);

  const filePath = path.join(overrideDir, 'content.json');
  const record = {
    version: 1,
    industry: payload.industry,
    generatedAt: new Date().toISOString(),
    provider: payload.provider || DEFAULT_MODEL_CONFIG.provider,
    model: payload.model || DEFAULT_MODEL_CONFIG.model,
    acceptedLabels: payload.acceptedLabels || {},
    adaptationDiff: payload.adaptationDiff || {},
  };

  await fs.writeJson(filePath, record, { spaces: 2 });
  return { filePath, record, savedAs: path.relative(session.paths.root, filePath).replace(/\\/g, '/') };
}

async function loadContentOverrides(session) {
  if (!session || !session.paths || !session.paths.root) return null;
  const filePath = path.join(session.paths.overrides || path.join(session.paths.root, 'overrides'), 'content.json');
  if (!await fs.pathExists(filePath)) return null;
  return fs.readJson(filePath);
}

module.exports = {
  DEFAULT_LABELS,
  DEFAULT_SESSION_OVERRIDE_PATH,
  DEFAULT_MODEL_CONFIG,
  buildPromptPayload,
  buildSystemPrompt,
  validateAdaptationResponse,
  buildAdaptationDiff,
  buildJourneyContent,
  callOpenCodeApi,
  adaptJourneyContent,
  saveContentOverrides,
  loadContentOverrides,
};
