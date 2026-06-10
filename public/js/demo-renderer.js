/**
 * DemoRenderer — Client-side Handlebars renderer for dynamic demo generation.
 * Exposes window.DemoRenderer as a global singleton.
 *
 * Depends on Handlebars (handlebars.min.js) loaded before this script.
 */
(function(global) {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  var _pack = null;            // cached template-pack singleton
  var _packPromise = null;     // prevents duplicate fetches
  var _partialsRegistered = false;
  var _helpersRegistered = false;

  /* ── Industry → Product Category Mapping ──────────────── */
  var INDUSTRY_CATEGORIES = {
    'FMCG': ['Biscuits & Snacks', 'Namkeen & Savouries', 'Beverages', 'Sweets & Desserts'],
    'Pharma': ['Tablets & Capsules', 'Syrups & Liquids', 'Injections', 'Ointments & Creams'],
    'Cement': ['OPC', 'PPC', 'White Cement', 'Specialty'],
    'Steel': ['TMT Bars', 'Coils & Sheets', 'Pipes & Tubes', 'Structural Steel'],
    'Construction': ['Cement', 'Steel & TMT', 'Paint & Chemicals', 'Hardware & Tools'],
    'Retail': ['Electronics', 'Clothing & Apparel', 'Groceries & FMCG', 'Home & Kitchen'],
    'General': ['Products', 'Specialty', 'Bulk & Trade']
  };

  function getCategoriesForIndustry(industry) {
    return INDUSTRY_CATEGORIES[industry] || INDUSTRY_CATEGORIES['General'];
  }

  function assignCategoryToProduct(productName, industryCategories) {
    if (!productName || !industryCategories || !industryCategories.length) return 'Products';
    var lower = productName.toLowerCase();
    for (var i = 0; i < industryCategories.length; i++) {
      var cat = industryCategories[i].toLowerCase();
      // Check if product name contains category keywords
      var keywords = cat.split(/[\s&]+/);
      for (var k = 0; k < keywords.length; k++) {
        if (keywords[k].length > 2 && lower.indexOf(keywords[k]) !== -1) {
          return industryCategories[i];
        }
      }
    }
    // Default to first category
    return industryCategories[0];
  }

  /* ── Industry → Store Name Mapping ──────────────────── */
  var INDUSTRY_STORE_NAMES = {
    'FMCG': 'Sharma Food Store',
    'Pharma': 'Sharma Pharma Store',
    'Cement': 'Sharma Cement Store',
    'Steel': 'Sharma Steel Store',
    'Construction': 'Sharma Hardware Store',
    'Retail': 'Sharma Retail Store',
    'General': 'Sharma General Store'
  };

  function getStoreNameForIndustry(industry) {
    return INDUSTRY_STORE_NAMES[industry] || INDUSTRY_STORE_NAMES['General'];
  }

  /* ── Utility: deep clone ─────────────────────────────────── */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ── Utility: slugify a brand name ───────────────────────── */
  function slugify(str) {
    return String(str || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '_')
      .replace(/_+/g, '_');
  }

  /* ── Utility: get initials from a name ───────────────────── */
  function getInitials(name) {
    if (!name) return '';
    return name.split(/\s+/).map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
  }

  /* ── Utility: escape XML/HTML text content ───────────────── */
  function escapeXml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Utility: escape HTML attribute value ────────────────── */
  function escapeAttr(str) {
    return escapeXml(str);
  }

  /* ── Utility: estimate byte size of a string ─────────────── */
  function estimateByteSize(str) {
    if (!str) return 0;
    // Each char may be 1-4 bytes in UTF-8; rough upper bound is str.length * 4
    // but for typical HTML the average is ~1.1-1.3 bytes/char.
    // Blob.size is available in browsers, but for server-side equivalence:
    if (typeof Blob !== 'undefined') {
      try { return new Blob([str]).size; } catch (e) {}
    }
    return String(str).length;
  }

  /* ═══════════════════════════════════════════════════════════
   *  loadPack() — fetches /template-pack.json and returns a
   *  cached promise. Idempotent — subsequent calls reuse
   *  the already-cached _pack or _packPromise.
   * ═══════════════════════════════════════════════════════════ */
  function loadPack() {
    if (_pack) return Promise.resolve(_pack);
    if (_packPromise) return _packPromise;
    _packPromise = fetch('/template-pack.json')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load template pack (HTTP ' + res.status + ')');
        return res.json();
      })
      .then(function(pack) {
        _pack = pack;
        _packPromise = null;
        return pack;
      })
      .catch(function(err) {
        _packPromise = null;
        throw err;
      });
    return _packPromise;
  }

  /* ═══════════════════════════════════════════════════════════
   *  registerPartials(pack) — registers all Handlebars
   *  partials from the pack. Runs once, guarded by flag.
   * ═══════════════════════════════════════════════════════════ */
  function registerPartials(pack) {
    if (_partialsRegistered) return;
    var partials = pack.partials || {};
    for (var name in partials) {
      if (partials.hasOwnProperty(name)) {
        Handlebars.registerPartial(name, partials[name]);
      }
    }
    _partialsRegistered = true;
  }

  /* ═══════════════════════════════════════════════════════════
   *  registerHelpers(pack) — registers Handlebars helpers
   *  from the pack's helpers object (serialized function
   *  bodies). Runs once, guarded by flag.
   * ═══════════════════════════════════════════════════════════ */
  function registerHelpers(pack) {
    if (_helpersRegistered) return;
    var helpers = pack.helpers || {};
    for (var name in helpers) {
      if (helpers.hasOwnProperty(name)) {
        try {
          Handlebars.registerHelper(name, new Function('return ' + helpers[name])());
        } catch (e) {
          console.warn('[DemoRenderer] Failed to register helper:', name, e);
        }
      }
    }
    _helpersRegistered = true;
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildBrand(userInput)
   *  Takes user form input and merges with default brand.
   *  Fields: name, industry, brandColor, brandColorDark, logo
   * ═══════════════════════════════════════════════════════════ */
  function buildBrand(userInput) {
    var base = deepClone(_pack.defaultBrand || {});
    var input = userInput || {};

    // Override id with slug of name
    if (input.name) {
      base.id = slugify(input.name);
    }
    // Override name
    if (input.name) {
      base.name = input.name;
    }
    // Override shortName
    if (input.shortName) {
      base.shortName = input.shortName;
    }
    // Override colors.brand
    if (input.brandColor) {
      base.colors = base.colors || {};
      base.colors.brand = input.brandColor;
      base.theme = base.theme || {};
      base.theme.colors = base.theme.colors || {};
      base.theme.colors.brand = input.brandColor;
      if (input.brandColorDark) {
        base.colors.brandDark = input.brandColorDark;
        base.theme.colors.brandDark = input.brandColorDark;
      } else {
        base.colors.brandDark = input.brandColor;
        base.theme.colors.brandDark = input.brandColor;
      }
    }
    // Override logo
    if (input.logo) {
      base.logo = input.logo;
    }
    // Override industry (from form input or brand JSON)
    if (input.industry) {
      base.industry = input.industry;
    }
    // Override dealer store name from industry mapping if not explicitly provided
    if (!base.dealerStoreName || input.name) {
      base.dealerStoreName = getStoreNameForIndustry(base.industry);
    }

    return base;
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildNavSteps(journeySteps) — transforms journey.steps
   *  into the steps array that the JS navigation expects.
   * ═══════════════════════════════════════════════════════════ */
  function buildNavSteps(journeySteps) {
    var navSteps = [];
    if (!journeySteps || !journeySteps.length) return navSteps;
    for (var i = 0; i < journeySteps.length; i++) {
      var s = journeySteps[i];
      navSteps.push({
        num: s.num,
        displayNum: s.displayNum || s.num,
        title: s.title || 'Step ' + s.num,
        meta: s.meta || ''
      });
    }
    return navSteps;
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildCatalog(userInput, brandId)
   *  Takes user-entered products and maps them into a catalog
   *  object with industry-specific categories.
   * ═══════════════════════════════════════════════════════════ */
  function buildCatalog(userInput, brandId) {
    var input = userInput || {};
    var industry = input.industry || _pack.defaultBrand.industry || 'General';
    var industryCategories = getCategoriesForIndustry(industry);
    var userProducts = input.products || [];

    // If user provided products, build catalog from them
    if (userProducts.length > 0) {
      var prodList = [];
      for (var i = 0; i < userProducts.length; i++) {
        var up = userProducts[i];
        if (!up.name) continue;
        var category = assignCategoryToProduct(up.name, industryCategories);
        prodList.push({
          id: 'up_' + i,
          sku: 'SKU_P' + (i + 1),
          name: up.name,
          price: up.price || 999,
          unit: up.unit || 'piece',
          image: up.imageDataUrl || generatePlaceholderImage(up.name, input.brandColor || '#333'),
          category: category
        });
      }
      return { products: prodList };
    }

    // Otherwise use default catalog from pack
    return { products: deepClone(_pack.defaultCatalog || []) };
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildContent(userInput)
   *  Merges default content labels with user-accepted labels.
   * ═══════════════════════════════════════════════════════════ */
  function buildContent(userInput) {
    var input = userInput || {};
    var defaultLabels = deepClone(_pack.defaultContentLabels || {});
    var acceptedLabels = input.acceptedLabels || {};
    // Merge accepted labels over defaults (only for keys that exist in defaultLabels and were accepted)
    var merged = {};
    for (var key in defaultLabels) {
      if (defaultLabels.hasOwnProperty(key)) {
        merged[key] = (acceptedLabels[key] !== undefined) ? acceptedLabels[key] : defaultLabels[key];
      }
    }
    return merged;
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildCart(catalog) — builds cart summary from catalog,
   *  taking first few products as items.
   * ═══════════════════════════════════════════════════════════ */
  function buildCart(catalog) {
    if (!catalog || !catalog.products) return { items: [], summary: { totalItems: 0, subTotal: 0, tax: 0, delivery: 0, orderValue: 0 } };
    var products = catalog.products;
    var maxItems = Math.min(3, products.length);
    var items = [];
    var subTotal = 0;

    for (var i = 0; i < maxItems; i++) {
      var p = products[i];
      var qty = (i === 0) ? 10 : (i === 1 ? 5 : 2);
      var lineTotal = (p.price || 0) * qty;
      subTotal += lineTotal;
      items.push({
        productId: p.id || 'p' + (i + 1),
        name: p.name || 'Product',
        sku: p.sku || 'SKU' + (i + 1),
        price: p.price || 0,
        qty: qty,
        unit: p.unit || 'piece',
        lineTotal: lineTotal,
        image: p.image || ''
      });
    }

    var tax = Math.round(subTotal * 0.18);
    var delivery = (subTotal > 10000) ? 0 : 499;
    var orderValue = subTotal + tax + delivery;

    return {
      items: items,
      summary: {
        totalItems: maxItems,
        subTotal: subTotal,
        tax: tax,
        delivery: delivery,
        orderValue: orderValue
      }
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildCartItemsFromCatalog(catalog) — maps all catalog
   *  products into cart items (for draft order display).
   * ═══════════════════════════════════════════════════════════ */
  function buildCartItemsFromCatalog(catalog) {
    if (!catalog || !catalog.products) return [];
    return catalog.products.map(function(p) {
      return {
        productId: p.id || 'p',
        name: p.name || 'Product',
        sku: p.sku || 'SKU',
        price: p.price || 0,
        qty: 1,
        unit: p.unit || 'piece',
        lineTotal: p.price || 0,
        image: p.image || ''
      };
    });
  }

  /* ═══════════════════════════════════════════════════════════
   *  applyCatalogToJourney(journey, catalog)
   *  Injects catalog data and transforms journey step data
   *  to use catalog-driven product names for step1 sections.
   * ═══════════════════════════════════════════════════════════ */
  function applyCatalogToJourney(journey, catalog) {
    if (!journey || !catalog || !catalog.products) return;

    // Build category groups from catalog
    var categories = {};
    catalog.products.forEach(function(p) {
      var cat = p.category || 'Products';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    });

    var catKeys = Object.keys(categories);
    var mainCat = catKeys.length > 0 ? catKeys[0] : '';
    var secondaryCats = catKeys.slice(1, 3);
    var offerCat = 'Offers & Solutions';

    // Attach to journey for template use
    journey._catalogCategories = categories;
    journey._mainCategory = mainCat;
    journey._secondaryCategories = secondaryCats;
    journey._offerCategory = offerCat;

    // Update step1 section titles if they exist
    if (journey.screens && journey.screens.length > 0) {
      journey.screens.forEach(function(screen) {
        if (screen.type === 'catalog' && screen.content) {
          if (screen.content.section1 && mainCat) {
            screen.content.section1.title = mainCat;
          }
          if (screen.content.section2) {
            var secNames = secondaryCats.length > 0 ? secondaryCats : ['Products'];
            screen.content.section2.title = secNames[0] || 'More Products';
          }
          if (screen.content.section3) {
            screen.content.section3.title = offerCat;
          }
        }
      });
    }

    // Replace product name references in step data
    if (journey.steps) {
      var productNames = catalog.products.map(function(p) { return p.name; }).filter(Boolean);
      for (var si = 0; si < journey.steps.length; si++) {
        var step = journey.steps[si];
        if (step.productNames) {
          // Use spread: if productNames matches length of catalog products, replace each
          for (var pi = 0; pi < productNames.length && pi < step.productNames.length; pi++) {
            step.productNames[pi] = productNames[pi];
          }
        }
      }
    }

    // Replace journey-level productNames object (e.g. { opc53: '...', ppc: '...' })
    if (journey.productNames && productNames.length > 0) {
      var keys = Object.keys(journey.productNames);
      for (var ki = 0; ki < keys.length && ki < productNames.length; ki++) {
        journey.productNames[keys[ki]] = productNames[ki];
      }
    }

    // Replace cart item names in step3 (draft order cart)
    if (journey.step3 && journey.step3.cartItems && productNames.length > 0) {
      for (var ci = 0; ci < journey.step3.cartItems.length && ci < productNames.length; ci++) {
        journey.step3.cartItems[ci].name = productNames[ci];
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
   *  generateLogoPlaceholder(brandName, primaryColor)
   *  Returns an SVG data URL with brand initials + name.
   * ═══════════════════════════════════════════════════════════ */
  function generatePlaceholderImage(name, color) {
    var initials = getInitials(name || '?');
    var bg = color || '#666';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
      '<rect width="200" height="200" fill="' + bg + '"/>' +
      '<text x="100" y="108" font-family="Arial, sans-serif" font-size="72" font-weight="bold" ' +
      'fill="white" text-anchor="middle" dominant-baseline="middle">' + initials + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ═══════════════════════════════════════════════════════════
   *  generateLogoPlaceholder(brandName, primaryColor) — similar
   *  but rounded rect for logos
   * ═══════════════════════════════════════════════════════════ */
  function generateLogoPlaceholder(brandName, primaryColor) {
    var initials = getInitials(brandName || 'B');
    var bg = primaryColor || '#333';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48" viewBox="0 0 180 48">' +
      '<rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="' + bg + '"/>' +
      '<text x="24" y="28" font-family="Arial, sans-serif" font-size="20" font-weight="bold" ' +
      'fill="white" text-anchor="middle" dominant-baseline="middle">' + initials + '</text>' +
      '<text x="58" y="30" font-family="Arial, sans-serif" font-size="18" font-weight="600" ' +
      'fill="' + bg + '">' + (brandName || 'Brand') + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ═══════════════════════════════════════════════════════════
   *  handwrittenOrderDataUri(storeName, brandName, catalog)
   *  Generates a handwritten-order SVG data URI.
   * ═══════════════════════════════════════════════════════════ */
  function handwrittenOrderDataUri(storeName, brandName, catalog) {
    return generateHandwrittenOrderImage({ dealerStoreName: storeName, name: brandName }, catalog);
  }

  function generateHandwrittenOrderImage(brand, catalog) {
    var storeName = (brand && (brand.dealerStoreName || brand.name)) || 'Your Store';
    var brandName = (brand && brand.name) || 'Brand';
    var productLines = '';
    var qtys = [25, 20, 12];
    if (catalog && catalog.products) {
      for (var i = 0; i < Math.min(3, catalog.products.length); i++) {
        var p = catalog.products[i];
        var name = p.name || 'Item';
        var qty = qtys[i] || 10;
        var unit = p.unit || 'unit';
        productLines += '<text x="38" y="' + (129 + i * 30) + '" font-family="Comic Sans MS, Segoe Print, cursive" font-size="15" fill="#4a3f2b">• ' + escapeXml(name) + ' - ' + qty + ' ' + escapeXml(unit) + '</text>';
      }
    } else {
      productLines = '<text x="38" y="129" font-family="Comic Sans MS, Segoe Print, cursive" font-size="15" fill="#4a3f2b">• JK Super OPC - 25 bag</text>' +
        '<text x="38" y="159" font-family="Comic Sans MS, Segoe Print, cursive" font-size="15" fill="#4a3f2b">• JK PPC - 20 bag</text>';
    }

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320">' +
      '<rect width="400" height="320" fill="#fef9e7" rx="12"/>' +
      '<rect x="12" y="12" width="376" height="296" fill="none" stroke="#d4c9a8" stroke-width="1" rx="10" stroke-dasharray="6,3"/>' +
      '<text x="38" y="58" font-family="Comic Sans MS, Segoe Print, cursive" font-size="28" font-weight="700" fill="#1f2933">Order for ' + escapeXml(storeName) + '</text>' +
      '<text x="38" y="91" font-family="Comic Sans MS, Segoe Print, cursive" font-size="18" fill="#6b5f45">' + escapeXml(brandName) + ' dealer note</text>' +
      '<line x1="38" y1="102" x2="362" y2="102" stroke="#d4c9a8" stroke-width="1"/>' +
      productLines +
      '<text x="38" y="290" font-family="Comic Sans MS, Segoe Print, cursive" font-size="13" fill="#6b5f45">Total: ~₹14,999</text>' +
      '</svg>'
    );
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildJourney(journeyType, brand, catalog, selectedSteps)
   *  Takes journey data from pack.defaultJourneyData[journeyType],
   *  override dealer name, replace "JK Cement" references.
   * ═══════════════════════════════════════════════════════════ */
  function buildJourney(journeyType, brand, catalog, selectedSteps) {
    var templateData = (_pack.defaultJourneyData || {})[journeyType];
    if (!templateData) {
      console.warn('[DemoRenderer] Unknown journey type:', journeyType);
      return {};
    }

    var journey = deepClone(templateData);
    var brandName = brand.name || 'Your Brand';

    // Override dealer name
    var dealerStoreName = brand.dealerStoreName || brand.shortName || brand.name || 'Your Store';
    if (journey.dealer) {
      journey.dealer.name = dealerStoreName;
    }

    // Replace "JK Cement" references in messages
    if (journey.messages) {
      journey.messages = replaceBrandRefs(journey.messages, brandName);
    }

    // Replace hardcoded store name in welcome message body
    if (journey.messages && journey.messages.welcome && journey.messages.welcome.body) {
      journey.messages.welcome.body = journey.messages.welcome.body
        .replace(/<strong>[^<]*<\/strong>/, '<strong>' + escapeXml(dealerStoreName) + '</strong>');
    }

    // Step filtering for custom demos
    if (selectedSteps && selectedSteps.length > 0 && journey.steps) {
      var fullSteps = journey.steps;
      var filtered = [];
      for (var i = 0; i < selectedSteps.length; i++) {
        var stepNum = selectedSteps[i];
        var stepIdx = stepNum - 1;
        if (stepIdx >= 0 && stepIdx < fullSteps.length) {
          var step = deepClone(fullSteps[stepIdx]);
          step.originalNum = step.num;
          step.displayNum = i + 1;
          step.num = step.displayNum;
          filtered.push(step);
        }
      }
      journey.steps = filtered;
    }

    // Replace "JK Cement" references in steps
    if (journey.steps) {
      for (var i = 0; i < journey.steps.length; i++) {
        var step = journey.steps[i];
        if (step.title) step.title = step.title.replace(/JK Cement/g, brandName);
        if (step.meta) step.meta = step.meta.replace(/JK Cement/g, brandName);
        if (step.navTitle) step.navTitle = step.navTitle.replace(/JK Cement/g, brandName);
        if (step.navDesc) step.navDesc = step.navDesc.replace(/JK Cement/g, brandName);
      }
    }

    // Also fix productNames references
    if (journey.productNames) {
      journey.productNames = replaceBrandRefs(journey.productNames, brandName);
    }

    // Fix brand references in title/subtitle
    if (journey.title) journey.title = journey.title.replace(/JK Cement/g, brandName);
    if (journey.subtitle) journey.subtitle = journey.subtitle.replace(/JK Cement/g, brandName);

    applyCatalogToJourney(journey, catalog);

    return journey;
  }

  /**
   * Recursively replace "JK Cement" in string values within an object/array
   */
  function replaceBrandRefs(obj, brandName) {
    if (typeof obj === 'string') {
      return obj.replace(/JK Cement/g, brandName);
    }
    if (Array.isArray(obj)) {
      return obj.map(function(item) { return replaceBrandRefs(item, brandName); });
    }
    if (obj && typeof obj === 'object') {
      var result = {};
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          result[key] = replaceBrandRefs(obj[key], brandName);
        }
      }
      return result;
    }
    return obj;
  }

  /* ═══════════════════════════════════════════════════════════
   *  render(userInput) — main entry point.
   *  1. Loads template-pack (cached)
   *  2. Registers partials + helpers (idempotent)
   *  3. Builds data context overlaying user input
   *  4. Compiles and renders journey template, then layout
   *  5. Returns { html, brand, journeyType, journeyTitle }
   * ═══════════════════════════════════════════════════════════ */
  function render(userInput) {
    var input = userInput || {};

    return loadPack()
      .then(function(pack) {
        // Register partials and helpers (idempotent)
        registerPartials(pack);
        registerHelpers(pack);

        // Determine journey type
        var journeyType = input.journeyType || 'order_to_cash';

        // ── Home page — render hub landing directly ──
        if (journeyType === 'home') {
          var brand = buildBrand(input);
          var brandLogo = brand.logo || generateLogoPlaceholder(
            brand.name || 'Brand',
            brand.colors ? brand.colors.brand : '#333'
          );
          var homeHtml = buildHomePage(brand, brandLogo, pack);
          return {
            html: homeHtml,
            brand: brand,
            journeyType: 'home',
            journeyTitle: 'WhatsApp Commerce OS',
            isCustomDemo: false
          };
        }

        // Handle empty step selection early
        if (input.selectedSteps && input.selectedSteps.length === 0) {
          return {
            html: '',
            brand: null,
            journeyType: journeyType,
            journeyTitle: '',
            isCustomDemo: true,
            error: 'No steps selected'
          };
        }

        // Determine render mode
        var isCustomDemo = !!(input.selectedSteps && input.selectedSteps.length > 0);

        // Build brand context
        var brand = buildBrand(input);

        // Build industry context — pick matching industry from pack
        var industries = pack.industries || {};
        var industry = industries[brand.industry] || industries['general'] || {
          id: 'general',
          label: 'General Trade',
          partnerLabel: 'Partner',
          unit: 'unit',
          unitPlural: 'units',
          currency: 'INR',
          currencySymbol: '\u20B9',
          categoryTabs: ['All']
        };

        // Build catalog — wrap array as { products: [...] }
        var catalog = buildCatalog(input, brand.id);

        // Build cart from first 3 products
        var cart = buildCart(catalog);

        // Build journey data with brand overrides
        var journey = buildJourney(journeyType, brand, catalog, isCustomDemo ? input.selectedSteps : undefined);
        journey.content = buildContent(input);

        // Generate logo placeholder or use provided logo
        var brandLogo = brand.logo || generateLogoPlaceholder(
          brand.name || 'Brand',
          brand.colors ? brand.colors.brand : '#333'
        );

        // Build navSteps from journey data (matches build.js loadScripts)
        var navSteps = buildNavSteps(journey.steps);

        // Combine scripts in correct order, prepended with `const steps = [...]`
        var scriptParts = [];
        scriptParts.push('const steps = ' + JSON.stringify(navSteps) + ';');
        var scripts = pack.scripts || {};
        var scriptOrder = ['journey-core', 'navigation', 'overlays'];
        for (var si = 0; si < scriptOrder.length; si++) {
          var sKey = scriptOrder[si];
          if (scripts[sKey]) {
            scriptParts.push(scripts[sKey]);
          }
        }
        var combinedScripts = scriptParts.join('\n\n');

        // Inject hub-bridge script so "Main Menu" / back-to-menu links
        // post a message to the parent hub instead of navigating to index.html (404)
        combinedScripts += '\n\n/* Hub bridge: intercept main-menu links and notify parent */\n' +
          '(function(){' +
          'document.addEventListener("click",function(e){' +
          'var a=e.target.closest&&e.target.closest("a");' +
          'if(!a)return;' +
          'var href=a.getAttribute("href")||"";' +
          'var text=(a.textContent||"").toLowerCase();' +
          'if(href==="index.html"||href==="#main-menu"||href==="/"||text.indexOf("main menu")!==-1){' +
          'e.preventDefault();' +
          'if(window.parent&&window.parent!==window){' +
          'window.parent.postMessage("zotok:back-to-hub","*");' +
          '}' +
          '}' +
          '});' +
          '})();';

        // Select journey template source
        var journeyTemplateSrc;
        if (isCustomDemo) {
          journeyTemplateSrc = DemoRenderer.buildDynamicOrchestrator(journeyType, input.selectedSteps, pack);
        } else {
          journeyTemplateSrc = (pack.journeyScreens || {})[journeyType];
        }
        if (!journeyTemplateSrc) {
          throw new Error('Unknown journey type: ' + journeyType);
        }
        var journeyTemplate = Handlebars.compile(journeyTemplateSrc);

        // Compile layout from pack.layoutBase
        var layoutTemplate = Handlebars.compile(pack.layoutBase);

        // Assemble full Handlebars context
        var context = {
          brand: brand,
          brandLogo: brandLogo,
          industry: industry,
          catalog: catalog,
          cart: cart,
          journey: journey,
          isCustomDemo: isCustomDemo,
          handwrittenOrderImage: generateHandwrittenOrderImage(brand, catalog),
          sapArchitectureImage: (pack.fixedAssets && pack.fixedAssets.sapArchitectureImage) || '',
          showComposableMarkers: false,
          style: pack.style,
          scripts: combinedScripts
        };

        // Render journey body first (the inner content)
        var bodyHtml = journeyTemplate(context);

        // Pass rendered body into the layout template
        context.body = bodyHtml;
        var finalHtml = layoutTemplate(context);

        // Post-process step references for custom demos
        var stepMap;
        if (isCustomDemo) {
          var fullSteps = (pack.defaultJourneyData[journeyType] || {}).steps || [];
          var remapped = DemoRenderer.remapStepReferences(finalHtml, fullSteps, input.selectedSteps);
          finalHtml = remapped.html;
          stepMap = remapped.stepMap;
        }

        // Determine journey title from journeyDescriptions
        var journeyDescs = pack.journeyDescriptions || {};
        var journeyTitle = (journeyDescs[journeyType] && journeyDescs[journeyType].title) || journey.title || journeyType;

        return {
          html: finalHtml,
          brand: brand,
          journeyType: journeyType,
          journeyTitle: journeyTitle,
          isCustomDemo: isCustomDemo,
          stepMap: stepMap
        };
      });
  }

  /* ═══════════════════════════════════════════════════════════
   *  downloadHtml(html, filename) — create Blob, trigger download
   * ═══════════════════════════════════════════════════════════ */
  function downloadHtml(html, filename) {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'demo.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildHomePage(brand, brandLogoUrl, pack)
   *  Generates a standalone hub/landing HTML page listing all
   *  available journeys as clickable cards. Used when the user
   *  selects "home" (WhatsApp Commerce OS) as their journey.
   * ═══════════════════════════════════════════════════════════ */
  function buildHomePage(brand, brandLogoUrl, pack, selectedTypes) {
    var brandName = brand.name || 'Brand';
    var shortName = brand.shortName || brandName;
    var brandColor = (brand.colors && brand.colors.brand) || '#075e54';
    var brandRgb = hexToRgb(brandColor);
    var dealerStoreName = brand.dealerStoreName || shortName;
    var journeyDescs = pack.journeyDescriptions || {};
    var journeyData = pack.defaultJourneyData || {};

    // Build selectedTypes set for quick lookup
    var selectedSet = null;
    if (Array.isArray(selectedTypes) && selectedTypes.length > 0) {
      selectedSet = {};
      for (var si = 0; si < selectedTypes.length; si++) {
        selectedSet[selectedTypes[si]] = true;
      }
    }

    // Build journey cards from descriptions, merging hubMeta
    var journeyOrder = ['home', 'order_to_cash', 'field_ops_expense', 'automated_collections', 'dealer_engagement', 'retailer_onboarding', 'retailer_loyalty', 'campaigns_queries', 'dt_fulfillment_payment', 'retailer_activation'];
    var cards = '';
    var cardNum = 0;
    for (var oi = 0; oi < journeyOrder.length; oi++) {
      var jt = journeyOrder[oi];
      var desc = journeyDescs[jt];
      if (!desc) continue;
      // Skip "home" card when rendering the home page itself
      if (jt === 'home') continue;
      // Filter by selectedTypes if provided — only show selected journeys
      if (selectedSet && !selectedSet[jt]) continue;
      cardNum++;
      var meta = (journeyData[jt] && journeyData[jt].hubMeta) || {};
      var emoji = meta.emoji || '\u{1F4F1}';
      var color = meta.color || brandColor;
      var tags = meta.tags || [];
      var tagHtml = '';
      for (var ti = 0; ti < tags.length; ti++) {
        tagHtml += '<span class="hp-tag">' + escapeAttr(tags[ti]) + '</span>';
      }
      cards += '<a class="hp-card" href="#section-' + jt + '" style="--c:' + color + '">' +
        '<div class="hp-card-badge"><div class="hp-card-num">' + String(cardNum).padStart(2, '0') + '</div><div class="hp-card-emoji">' + emoji + '</div></div>' +
        '<div class="hp-card-body">' +
        '<div class="hp-card-top"><div class="hp-card-title">' + escapeAttr(desc.title) + '</div><div class="hp-card-steps">' + (desc.steps || '?') + ' Steps</div></div>' +
        '<div class="hp-card-desc">' + escapeAttr(desc.desc || '') + '</div>' +
        '<div class="hp-card-tags">' + tagHtml + '</div>' +
        '</div></a>';
    }

    var html = '<!DOCTYPE html><html lang="en"><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
      '<title>' + escapeAttr(brandName) + ' \u2014 WhatsApp Commerce OS | ZoTok</title>' +
      '<style>' +
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      'html,body{height:100%}' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:#fff;display:flex;flex-direction:column}' +
      '.hp-strip{height:6px;background:' + brandColor + ';flex-shrink:0}' +
      '.hp-wrap{flex:1;display:flex;min-height:0}' +
      '.hp-left{width:42%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;border-right:1px solid #f0f0f0}' +
      '.hp-logo{width:96px;height:96px;border-radius:50%;border:3px solid rgba(' + brandRgb + ',.25);object-fit:cover;margin-bottom:20px}' +
      '.hp-label{font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:2.5px;margin-bottom:10px}' +
      '.hp-title{font-size:32px;font-weight:800;color:#111;line-height:1.15;margin-bottom:16px;text-align:center}' +
      '.hp-title span{color:' + brandColor + '}' +
      '.hp-desc{font-size:13px;color:#555;line-height:1.65;text-align:center;max-width:320px;margin-bottom:28px}' +
      '.hp-badge{display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:24px;padding:9px 18px;font-size:12.5px;color:#222;font-weight:600}' +
      '.hp-stats{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;justify-content:center}' +
      '.hp-stat-pill{font-size:11px;font-weight:700;color:' + brandColor + ';background:rgba(' + brandRgb + ',.07);border:1px solid rgba(' + brandRgb + ',.2);border-radius:14px;padding:5px 13px}' +
      '.hp-right{flex:1;background:#f7f7f8;overflow-y:auto;padding:36px 32px 48px}' +
      '.hp-section-label{font-size:10.5px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px}' +
      '.hp-card{display:flex;align-items:stretch;text-decoration:none;color:inherit;margin-bottom:10px;background:#fff;border-radius:14px;border:1px solid #e8e8e8;overflow:hidden;transition:box-shadow .15s,transform .15s;cursor:pointer}' +
      '.hp-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.1);transform:translateX(4px)}' +
      '.hp-card-badge{background:var(--c);width:68px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:14px 0}' +
      '.hp-card-num{font-size:10.5px;font-weight:900;color:rgba(255,255,255,.45);letter-spacing:.5px}' +
      '.hp-card-emoji{font-size:26px;line-height:1.1}' +
      '.hp-card-body{flex:1;padding:14px 52px 13px 18px;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 50%,calc(100% - 22px) 100%,0 100%);display:flex;flex-direction:column;justify-content:center;gap:5px}' +
      '.hp-card-top{display:flex;align-items:center;gap:10px}' +
      '.hp-card-title{font-size:14.5px;font-weight:700;color:#111;flex:1}' +
      '.hp-card-steps{font-size:10px;font-weight:700;color:var(--c);background:rgba(0,0,0,.04);padding:3px 9px;border-radius:9px;white-space:nowrap;flex-shrink:0}' +
      '.hp-card-desc{font-size:12px;color:#666;line-height:1.45;max-width:480px}' +
      '.hp-tags{display:flex;gap:5px;flex-wrap:wrap}' +
      '.hp-tag{font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.05);color:#555}' +
      '.hp-footer{background:' + brandColor + ';padding:10px 24px;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.hp-footer-text{font-size:11.5px;color:rgba(255,255,255,.85);font-weight:500;text-align:center}' +
      '.hp-footer-text strong{color:#fff}' +
      '@media(max-width:768px){.hp-wrap{flex-direction:column}.hp-left{width:100%;border-right:none;border-bottom:1px solid #f0f0f0;padding:32px 24px 28px}.hp-title{font-size:26px}.hp-right{padding:24px 16px 40px}.hp-card-badge{width:58px}.hp-card-emoji{font-size:22px}.hp-card-title{font-size:13.5px}.hp-card-desc{display:none}}' +
      '</style></head><body>' +
      '<div class="hp-strip"></div>' +
      '<div class="hp-wrap">' +
      '<div class="hp-left">' +
      (brandLogoUrl ? '<img class="hp-logo" src="' + escapeAttr(brandLogoUrl) + '" alt="' + escapeAttr(brandName) + '">' : '') +
      '<div class="hp-label">' + escapeAttr(shortName) + '</div>' +
      '<h1 class="hp-title">WhatsApp<br><span>Commerce OS</span></h1>' +
      '<p class="hp-desc">A unified WhatsApp operating system for ' + escapeAttr(brandName) + ' retail ecosystem \u2014 retailer, field executive, and distributor journeys on a single number. Powered by ZoTok.</p>' +
      '<div class="hp-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#25D366"/><path d="M17.5 14.5c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8.9-1 1.1-.4.2-.7.1a8.5 8.5 0 01-2.6-1.6 9.9 9.9 0 01-1.8-2.2c-.2-.3 0-.5.1-.6l.5-.6.3-.5a.4.4 0 000-.4l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4A4.4 4.4 0 006 9.7a7.6 7.6 0 001.6 4c1.8 2.4 4.1 3.8 7.8 4.3.8.1 1.5-.1 2-.4a4 4 0 001.3-1.7c.1-.4.1-.7 0-.9z" fill="#fff"/></svg>' + escapeAttr(dealerStoreName) + ' &nbsp;\u00B7&nbsp; ' + escapeAttr(brandName) + '</div>' +
      '<div class="hp-stats"><div class="hp-stat-pill">\u25CF ' + cardNum + ' Modules</div><div class="hp-stat-pill">\u25CF Live Journey Demos</div></div>' +
      '</div>' +
      '<div class="hp-right">' +
      '<div class="hp-section-label">Select a Module to Explore</div>' +
      cards +
      '</div>' +
      '</div>' +
      '<div class="hp-footer"><div class="hp-footer-text"><strong>' + escapeAttr(brandName) + ' WhatsApp Commerce OS</strong> &nbsp;\u00B7&nbsp; Powered by <a href="https://zotok.ai" target="_blank" style="color:#fff;font-weight:700;text-decoration:underline;">ZoTok.ai</a> &nbsp;\u00B7&nbsp; Journey Simulations for Internal Demo Use</div></div>' +
      '</body></html>';

    return html;
  }

  /* ── Helper: hex color to RGB tuple ────────────────────── */
  function hexToRgb(hex) {
    var h = String(hex || '#333').replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16) || 0,
      parseInt(h.substring(2, 4), 16) || 0,
      parseInt(h.substring(4, 6), 16) || 0
    ].join(', ');
  }

  /* ═══════════════════════════════════════════════════════════
   *  Multi-Journey — renderMultiJourney(userInput)
   *  Renders multiple journeys into a single hub-style HTML
   *  document, each journey in its own srcdoc iframe to avoid
   *  step-ID collisions. Sticky nav bar for journey switching.
   * ═══════════════════════════════════════════════════════════ */

  /* ── Helper: journey metadata icon/color from hubMeta ──── */
  function getJourneyMeta(journeyType) {
    if (!_pack || !_pack.defaultJourneyData) return {};
    var data = _pack.defaultJourneyData[journeyType];
    return (data && data.hubMeta) || {};
  }

  /* ═══════════════════════════════════════════════════════════
   *  renderMultiJourney(userInput) — renders one or more
   *  journeys and combines them into a single HTML document.
   *
   *  Input:  userInput.journeyTypes = ['order_to_cash', ...]
   *          (falls back to userInput.journeyType for single)
   *  Output: { html, brand, journeyTypes, journeyCount,
   *            estimatedSize }
   * ═══════════════════════════════════════════════════════════ */
  function renderMultiJourney(userInput) {
    var input = userInput || {};
    var journeyTypes = Array.isArray(input.journeyTypes) && input.journeyTypes.length > 0
      ? input.journeyTypes.slice()
      : (input.journeyType ? [input.journeyType] : ['order_to_cash']);

    return loadPack().then(function(pack) {
      var promises = [];
      for (var i = 0; i < journeyTypes.length; i++) {
        (function(jt) {
          var jInput = {};
          // Copy common input (not journey-specific fields)
          for (var k in input) {
            if (k !== 'journeyType' && k !== 'journeyTypes' && k !== 'journeyStepSelections' && input.hasOwnProperty(k)) {
              jInput[k] = input[k];
            }
          }
          jInput.journeyType = jt;
          // Per-journey step selection
          if (input.journeyStepSelections && input.journeyStepSelections[jt]) {
            jInput.selectedSteps = input.journeyStepSelections[jt];
          }
          promises.push(render(jInput));
        })(journeyTypes[i]);
      }

      return Promise.all(promises).then(function(results) {
        return buildMultiJourneyHtml(results, journeyTypes, pack, input);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildMultiJourneyHtml(results, journeyTypes, pack, input)
   *  Haldiram-style two-panel hub. Left: brand info. Right: journey
   *  cards. Click a card to load that journey in the right panel via
   *  Blob URL iframe. Journey HTMLs in <script type="text/plain"> tags.
   * ═══════════════════════════════════════════════════════════ */
  function buildMultiJourneyHtml(results, journeyTypes, pack, input) {
    var brandName = (results[0].brand && results[0].brand.name) || input.name || 'Brand';
    var brandShortName = (results[0].brand && results[0].brand.shortName) || brandName;
    var brandColor = input.brandColor || (results[0].brand && results[0].brand.colors && results[0].brand.colors.brand) || '#075e54';
    var brandRgb = hexToRgb(brandColor);
    var journeyDescs = pack.journeyDescriptions || {};
    var journeyData = pack.defaultJourneyData || {};
    var brandLogoUrl = input.logo || '';

    // Build data scripts — raw HTML, only escape </script>
    var dataScripts = '';
    for (var r = 0; r < results.length; r++) {
      var dt = journeyTypes[r];
      var safe = results[r].html.replace(/<\/script>/gi, '<\\/script>');
      dataScripts += '<script type="text/plain" id="jd-' + dt + '">' + safe + '<\\/script>\n';
    }

    // Build journey cards (matching Haldiram hub design)
    var cards = '';
    for (var i = 0; i < journeyTypes.length; i++) {
      var jt = journeyTypes[i];
      var desc = journeyDescs[jt] || {};
      var title = results[i].journeyTitle || desc.title || jt;
      var meta = (journeyData[jt] && journeyData[jt].hubMeta) || {};
      var emoji = meta.emoji || '\u{1F4F1}';
      var color = meta.color || brandColor;
      var steps = desc.steps || '?';
      var tags = meta.tags || [];
      var tagHtml = '';
      for (var ti = 0; ti < tags.length; ti++) {
        tagHtml += '<span class="hp-tag">' + escapeAttr(tags[ti]) + '</span>';
      }
      cards += '<div class="hp-card" style="--c:' + color + '" onclick="loadJourney(\'' + jt + '\')">' +
        '<div class="hp-card-badge"><div class="hp-card-num">' + String(i + 1).padStart(2, '0') + '</div><div class="hp-card-emoji">' + emoji + '</div></div>' +
        '<div class="hp-card-body">' +
        '<div class="hp-card-top"><div class="hp-card-title">' + escapeAttr(title) + '</div><div class="hp-card-steps">' + steps + ' Steps</div></div>' +
        '<div class="hp-card-desc">' + escapeAttr(desc.desc || '') + '</div>' +
        '<div class="hp-tags">' + tagHtml + '</div>' +
        '</div></div>';
    }

    // Build selected journeys object for inline script (title lookup on card click)
    var selectedDescs = {};
    for (var sdi = 0; sdi < journeyTypes.length; sdi++) {
      var sdk = journeyTypes[sdi];
      if (journeyDescs[sdk]) selectedDescs[sdk] = journeyDescs[sdk];
    }

    var hubHtml = '<!DOCTYPE html><html lang="en"><head>' +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
      '<title>' + escapeAttr(brandName) + ' \u2014 WhatsApp Commerce OS | ZoTok</title>' +
      '<style>' +
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
      'html,body{height:100%}' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:#fff;display:flex;flex-direction:column}' +
      '.hp-strip{height:6px;background:' + brandColor + ';flex-shrink:0}' +
      '.hp-wrap{flex:1;display:flex;min-height:0}' +
      '.hp-left{width:42%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;border-right:1px solid #f0f0f0}' +
      '.hp-logo{width:96px;height:96px;border-radius:50%;border:3px solid rgba(' + brandRgb + ',.25);object-fit:cover;margin-bottom:20px}' +
      '.hp-label{font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:2.5px;margin-bottom:10px}' +
      '.hp-title{font-size:32px;font-weight:800;color:#111;line-height:1.15;margin-bottom:16px;text-align:center}' +
      '.hp-title span{color:' + brandColor + '}' +
      '.hp-desc{font-size:13px;color:#555;line-height:1.65;text-align:center;max-width:320px;margin-bottom:28px}' +
      '.hp-badge{display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:24px;padding:9px 18px;font-size:12.5px;color:#222;font-weight:600}' +
      '.hp-stats{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;justify-content:center}' +
      '.hp-stat-pill{font-size:11px;font-weight:700;color:' + brandColor + ';background:rgba(' + brandRgb + ',.07);border:1px solid rgba(' + brandRgb + ',.2);border-radius:14px;padding:5px 13px}' +
      '.hp-right{flex:1;background:#f7f7f8;overflow-y:auto;padding:36px 32px 48px;position:relative}' +
      '.hp-section-label{font-size:10.5px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px}' +
      '.hp-card{display:flex;align-items:stretch;text-decoration:none;color:inherit;margin-bottom:10px;background:#fff;border-radius:14px;border:1px solid #e8e8e8;overflow:hidden;transition:box-shadow .15s,transform .15s;cursor:pointer}' +
      '.hp-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.1);transform:translateX(4px)}' +
      '.hp-card-badge{background:var(--c);width:68px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:14px 0}' +
      '.hp-card-num{font-size:10.5px;font-weight:900;color:rgba(255,255,255,.45);letter-spacing:.5px}' +
      '.hp-card-emoji{font-size:26px;line-height:1.1}' +
      '.hp-card-body{flex:1;padding:14px 52px 13px 18px;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 50%,calc(100% - 22px) 100%,0 100%);display:flex;flex-direction:column;justify-content:center;gap:5px}' +
      '.hp-card-top{display:flex;align-items:center;gap:10px}' +
      '.hp-card-title{font-size:14.5px;font-weight:700;color:#111;flex:1}' +
      '.hp-card-steps{font-size:10px;font-weight:700;color:var(--c);background:rgba(0,0,0,.04);padding:3px 9px;border-radius:9px;white-space:nowrap;flex-shrink:0}' +
      '.hp-card-desc{font-size:12px;color:#666;line-height:1.45;max-width:480px}' +
      '.hp-tags{display:flex;gap:5px;flex-wrap:wrap}' +
      '.hp-tag{font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.05);color:#555}' +
      // Journey view (when a card is clicked)
      '.journey-view{display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:#f7f7f8;z-index:10;flex-direction:column}' +
      '.journey-view.active{display:flex}' +
      '.jv-bar{display:flex;align-items:center;gap:8px;padding:10px 16px;background:#fff;border-bottom:1px solid #eee;flex-shrink:0}' +
      '.jv-back{font-size:12px;font-weight:600;color:' + brandColor + ';cursor:pointer;padding:6px 12px;border-radius:8px;border:1px solid rgba(' + brandRgb + ',.3);background:rgba(' + brandRgb + ',.05);transition:background .15s}' +
      '.jv-back:hover{background:rgba(' + brandRgb + ',.12)}' +
      '.jv-title{font-size:14px;font-weight:700;color:#111}' +
      '.jv-frame{flex:1;width:100%;border:none}' +
      '@media(max-width:768px){.hp-wrap{flex-direction:column}.hp-left{width:100%;border-right:none;border-bottom:1px solid #f0f0f0;padding:32px 24px 28px}.hp-title{font-size:26px}.hp-right{padding:24px 16px 40px}.hp-card-badge{width:58px}.hp-card-emoji{font-size:22px}.hp-card-title{font-size:13.5px}.hp-card-desc{display:none}}' +
      '</style></head><body>' +
      '<div class="hp-strip"></div>' +
      '<div class="hp-wrap">' +
      // Left panel — brand info
      '<div class="hp-left">' +
      (brandLogoUrl ? '<img class="hp-logo" src="' + escapeAttr(brandLogoUrl) + '" alt="' + escapeAttr(brandName) + '">' : '') +
      '<div class="hp-label">' + escapeAttr(brandShortName) + '</div>' +
      '<h1 class="hp-title">WhatsApp<br><span>Commerce OS</span></h1>' +
      '<p class="hp-desc">A unified WhatsApp operating system for ' + escapeAttr(brandName) + ' retail ecosystem \u2014 retailer, field executive, and distributor journeys on a single number. Powered by ZoTok.</p>' +
      '<div class="hp-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#25D366"/><path d="M17.5 14.5c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2-.8.9-1 1.1-.4.2-.7.1a8.5 8.5 0 01-2.6-1.6 9.9 9.9 0 01-1.8-2.2c-.2-.3 0-.5.1-.6l.5-.6.3-.5a.4.4 0 000-.4l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4A4.4 4.4 0 006 9.7a7.6 7.6 0 001.6 4c1.8 2.4 4.1 3.8 7.8 4.3.8.1 1.5-.1 2-.4a4 4 0 001.3-1.7c.1-.4.1-.7 0-.9z" fill="#fff"/></svg>' + escapeAttr(brandName) + '</div>' +
      '<div class="hp-stats"><div class="hp-stat-pill">\u25CF ' + journeyTypes.length + ' Modules</div><div class="hp-stat-pill">\u25CF Live Demo</div></div>' +
      '</div>' +
      // Right panel — journey cards + journey view
      '<div class="hp-right">' +
      '<div id="hp-cards-container">' +
      '<div class="hp-section-label">Select a Module to Explore</div>' +
      cards +
      '</div>' +
      '<div class="journey-view" id="jv">' +
      '<div class="jv-bar">' +
      '<div class="jv-back" onclick="backToCards()">\u2190 Back to Modules</div>' +
      '<div class="jv-title" id="jv-title"></div>' +
      '</div>' +
      '<iframe class="jv-frame" id="jv-frame" src="about:blank"></iframe>' +
      '</div>' +
      '</div>' +
      '</div>' +
      dataScripts +
      '<script>' +
      '(function(){' +
      'var journeyHtmls = {};' +
      'var scripts = document.querySelectorAll("script[id^=\'jd-\']");' +
      'for (var i = 0; i < scripts.length; i++) {' +
      '  var el = scripts[i];' +
      '  var jt = el.id.replace("jd-", "");' +
      '  journeyHtmls[jt] = el.textContent;' +
      '}' +
      'var currentBlobUrl = null;' +
      'window.loadJourney = function(jt) {' +
      '  var html = journeyHtmls[jt];' +
      '  if (!html) return;' +
      '  // Revoke previous blob URL to free memory' +
      '  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);' +
      '  var blob = new Blob([html], {type: "text/html;charset=utf-8"});' +
      '  currentBlobUrl = URL.createObjectURL(blob);' +
      '  document.getElementById("jv-frame").src = currentBlobUrl;' +
      '  // Show title' +
      '  var desc = ' + JSON.stringify(selectedDescs) + '[jt] || {};' +
      '  document.getElementById("jv-title").textContent = desc.title || jt;' +
      '  // Hide cards, show journey view' +
      '  document.getElementById("hp-cards-container").style.display = "none";' +
      '  document.getElementById("jv").classList.add("active");' +
      '};' +
      'window.backToCards = function() {' +
      '  document.getElementById("jv-frame").src = "about:blank";' +
      '  document.getElementById("jv").classList.remove("active");' +
      '  document.getElementById("hp-cards-container").style.display = "";' +
      '};' +
      '})();' +
      '<\\/script>' +
      '</body></html>';

    return {
      html: hubHtml,
      brand: results[0].brand,
      journeyTypes: journeyTypes,
      journeyCount: journeyTypes.length,
      estimatedSize: estimateByteSize(hubHtml)
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Public API — window.DemoRenderer
   * ═══════════════════════════════════════════════════════════ */
  var DemoRenderer = {
    loadPack: loadPack,
    render: render,
    renderMultiJourney: renderMultiJourney,
    buildBrand: buildBrand,
    buildCatalog: buildCatalog,
    buildContent: buildContent,
    buildCart: buildCart,
    buildJourney: buildJourney,
    buildHomePage: buildHomePage,
    generatePlaceholderImage: generatePlaceholderImage,
    generateLogoPlaceholder: generateLogoPlaceholder,
    downloadHtml: downloadHtml
  };

  // journeyDescriptions getter — returns pack.journeyDescriptions or null
  Object.defineProperty(DemoRenderer, 'journeyDescriptions', {
    get: function() {
      return _pack ? (_pack.journeyDescriptions || null) : null;
    },
    enumerable: true,
    configurable: true
  });

  // getJourneySteps(journeyType) — returns the steps array (with titles) or null
  DemoRenderer.getJourneySteps = function(journeyType) {
    if (!_pack || !_pack.defaultJourneyData) return null;
    var data = _pack.defaultJourneyData[journeyType];
    return data && data.steps ? data.steps : null;
  };

  /**
   * remapStepReferences(html, fullSteps, selectedSteps)
   * Post-processes compiled HTML to remap step IDs, data attributes,
   * scrollToStep calls, and anchor hrefs from original numbers to display numbers.
   * @param {string} html - Compiled HTML with all step sections
   * @param {Array} fullSteps - Full steps array for the journey
   * @param {Array} selectedSteps - Array of selected step numbers (original)
   * @returns {{ html: string, stepMap: Object }}
   */
  /**
   * buildDynamicOrchestrator(journeyType, selectedSteps, pack)
   * Assembles a Handlebars template string from partial sources for only the selected steps.
   */
  DemoRenderer.buildDynamicOrchestrator = function(journeyType, selectedSteps, pack) {
    var p = pack || _pack;
    var partials = p.partials || {};

    // Some journey types use a different naming prefix in their partials
    // than the journeyType key itself. Map known mismatches here.
    var partialPrefix = journeyType;
    var knownMismatches = {
      'field_ops_expense': 'field-ops',
      'automated_collections': 'collections'
    };
    if (knownMismatches[partialPrefix]) {
      partialPrefix = knownMismatches[partialPrefix];
    }

    var parts = [];
    for (var i = 0; i < selectedSteps.length; i++) {
      var stepNum = selectedSteps[i];
      var partialName = 'step' + stepNum + '-' + partialPrefix;
      var source = partials[partialName];
      if (source) {
        parts.push(source);
      }
    }
    return parts.join('\n');
  };

  DemoRenderer.remapStepReferences = function(html, fullSteps, selectedSteps) {
    var stepMap = {};
    for (var i = 0; i < selectedSteps.length; i++) {
      stepMap[selectedSteps[i]] = i + 1;
    }
    // Phase 1: replace original step references with unique placeholders
    // to avoid collisions where a later replacement partially matches
    // a value that was just created by an earlier replacement
    var result = html;
    var placeholders = {};
    for (var j = 0; j < selectedSteps.length; j++) {
      var orig = selectedSteps[j];
      var ph = '%%STEP_' + j + '%%';
      var display = stepMap[orig];
      placeholders['id="' + ph + '"'] = 'id="step-' + display + '"';
      placeholders['data-step="' + ph + '"'] = 'data-step="' + display + '"';
      placeholders['scrollToStep(' + ph + ')'] = 'scrollToStep(' + display + ')';
      placeholders['href="#' + ph + '"'] = 'href="#step-' + display + '"';
      result = result.split('id="step-' + orig + '"').join('id="' + ph + '"');
      result = result.split('data-step="' + orig + '"').join('data-step="' + ph + '"');
      result = result.split('scrollToStep(' + orig + ')').join('scrollToStep(' + ph + ')');
      result = result.split('href="#step-' + orig + '"').join('href="#' + ph + '"');
    }
    // Phase 2: replace placeholders with final values
    for (var ph in placeholders) {
      result = result.split(ph).join(placeholders[ph]);
    }
    return { html: result, stepMap: stepMap };
  };

  global.DemoRenderer = DemoRenderer;

})(typeof window !== 'undefined' ? window : this);
