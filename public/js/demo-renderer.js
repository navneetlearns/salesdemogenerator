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
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dataUriSvg(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ═══════════════════════════════════════════════════════════
   *  loadPack() — fetch /template-pack.json (singleton, cached)
   *  Returns Promise resolving to the pack object.
   * ═══════════════════════════════════════════════════════════ */
  function loadPack() {
    if (_pack) return Promise.resolve(_pack);
    if (_packPromise) return _packPromise;

    _packPromise = fetch('/template-pack.json')
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load template-pack.json: ' + res.status);
        return res.json();
      })
      .then(function(data) {
        _pack = data;
        return _pack;
      })
      .catch(function(err) {
        _packPromise = null; // allow retry on failure
        throw err;
      });

    return _packPromise;
  }

  /* ═══════════════════════════════════════════════════════════
   *  registerPartials(pack) — register Handlebars partials
   * ═══════════════════════════════════════════════════════════ */
  function registerPartials(pack) {
    if (_partialsRegistered) return;
    _partialsRegistered = true;

    var partials = pack.partials || {};
    for (var name in partials) {
      if (partials.hasOwnProperty(name)) {
        Handlebars.registerPartial(name, partials[name]);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
   *  registerHelpers(pack) — register Handlebars helpers
   *  Each helper value is a JS function source string.
   *  We eval() to create the function, matching the helper
   *  key name (the function name in source has a _ prefix).
   * ═══════════════════════════════════════════════════════════ */
  function registerHelpers(pack) {
    if (_helpersRegistered) return;
    _helpersRegistered = true;

    var helpers = pack.helpers || {};
    for (var name in helpers) {
      if (helpers.hasOwnProperty(name)) {
        try {
          /* The source strings look like "function _formatCurrency(amount) { ... }"
             We eval them to get the function. The underscore-prefixed inner name
             doesn't matter — eval returns the function value. */
          var fn = eval('(' + helpers[name] + ')');
          Handlebars.registerHelper(name, fn);
        } catch (e) {
          console.warn('[DemoRenderer] Failed to register helper "' + name + '":', e);
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildBrand(userInput) — overlay user input on pack defaults
   *  Starts from pack.defaultBrand, then overrides:
   *    id (slug), name, shortName, colors.brand,
   *    colors.brandDark, logo (→ assets.logo), assets.logo
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
    }
    // Override colors.brandDark
    if (input.brandColorDark) {
      base.colors = base.colors || {};
      base.colors.brandDark = input.brandColorDark;
      base.theme = base.theme || {};
      base.theme.colors = base.theme.colors || {};
      base.theme.colors.brandDark = input.brandColorDark;
    }
    // Override colors.accent
    if (input.accentColor) {
      base.colors = base.colors || {};
      base.colors.accent = input.accentColor;
      base.theme = base.theme || {};
      base.theme.colors = base.theme.colors || {};
      base.theme.colors.accent = input.accentColor;
    }
    // Override logo — maps to both top-level .logo and .assets.logo
    if (input.logo) {
      base.logo = input.logo;
      base.assets = base.assets || {};
      base.assets.logo = input.logo;
    }
    // Override industry
    if (input.industry) {
      base.industry = input.industry;
    }
    // Override dealerStoreName
    if (input.dealerName) {
      base.dealerStoreName = input.dealerName;
    } else if (input.name) {
      base.dealerStoreName = getStoreNameForIndustry(input.industry || base.industry || 'General');
    }

    return base;
  }

    /* ════════════════════════════════════════════════════════════
   *  buildNavSteps(journeySteps) — convert journey.steps into
   *  the navSteps format expected by navigation.js
   *  Each entry: { title, desc, num, active }
   * ═════════════════════════════════════════════════════════════ */
  function buildNavSteps(journeySteps) {
    if (!Array.isArray(journeySteps)) return [];
    return journeySteps.map(function(step, i) {
      return {
        title: step.navTitle || ('Step ' + (step.num || (i + 1)) + ' — ' + (step.title || '')),
        desc: step.navDesc || ('<span style="color:#555;font-size:12px;">' + (step.meta || step.title || '') + '</span>'),
        num: step.num || (i + 1),
        active: i === 0
      };
    });
  }

  /* ═════════════════════════════════════════════════════════════
   *  buildCatalog(userInput, brandId) — build { products: [...] }
   *  If defaultCatalog is an array, use it as base and overlay
   *  user product entries on top. User products receive:
   *    id, sku, name, category, price, unit, image
   * ═══════════════════════════════════════════════════════════ */
  function buildCatalog(userInput, brandId) {
    var input = userInput || {};
    var defaultCatalog = _pack.defaultCatalog;
    var baseProducts;

    // Start from default catalog (it's an array — wrap as { products: [...] })
    if (Array.isArray(defaultCatalog)) {
      baseProducts = deepClone(defaultCatalog);
    } else {
      baseProducts = [];
    }

    // Get industry categories for product assignment
    var industry = input.industry || 'General';
    var industryCategories = getCategoriesForIndustry(industry);

    // User products fully replace the default catalog so old product names do not leak.
    var userProducts = input.products || [];
    if (userProducts.length > 0) {
      baseProducts = [];
      for (var i = 0; i < userProducts.length; i++) {
        var up = userProducts[i];
        var category = up.category;
        // If category is generic ('All', 'General'), assign based on industry
        if (!category || category === 'All' || category === 'General') {
          category = assignCategoryToProduct(up.name, industryCategories);
        }
        var product = {
          id: up.id || ('up' + (i + 1)),
          sku: up.sku || ('SKU_' + (i + 1)),
          name: up.name || ('Product ' + (i + 1)),
          category: category,
          price: up.price || 100,
          unit: up.unit || 'unit',
          image: up.imageDataUrl || up.image || ''
        };
        if (up.tags) product.tags = up.tags;
        baseProducts.push(product);
      }
    }

    return { products: baseProducts };
  }

  function buildContent(userInput) {
    var input = userInput || {};
    var base = deepClone(_pack.defaultContentLabels || {});
    var overrides = input.acceptedLabels || input.content || input.contentOverrides || {};

    for (var key in overrides) {
      if (overrides.hasOwnProperty(key) && typeof overrides[key] === 'string') {
        base[key] = overrides[key];
      }
    }

    return base;
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildCart(catalog) — takes first 3 products, qty 1-3,
   *  computes lineTotal and orderValue
   * ═══════════════════════════════════════════════════════════ */
  function buildCart(catalog) {
    var products = (catalog && catalog.products) ? catalog.products : [];
    var items = [];
    var orderValue = 0;

    for (var i = 0; i < Math.min(3, products.length); i++) {
      var qty = i + 1;
      var lineTotal = (products[i].price || 0) * qty;
      items.push({
        product: products[i],
        qty: qty,
        lineTotal: lineTotal
      });
      orderValue += lineTotal;
    }

    return {
      items: items,
      summary: {
        subtotal: orderValue,
        discount: 0,
        total: orderValue
      }
    };
  }

  function buildCartItemsFromCatalog(catalog) {
    var products = (catalog && catalog.products) ? catalog.products : [];
    var qtys = [25, 20, 12, 16];
    var items = [];

    for (var i = 0; i < Math.min(4, products.length); i++) {
      var product = products[i] || {};
      var qty = qtys[i] || (i + 1);
      var unitPrice = Number(product.price || 0);
      items.push({
        id: product.id || ('item' + (i + 1)),
        sku: product.sku || ('SKU_' + (i + 1)),
        name: product.name || ('Product ' + (i + 1)),
        qty: qty,
        unitPrice: unitPrice,
        lineTotal: unitPrice * qty,
        unit: product.unit || 'unit',
        image: product.image || '',
        category: product.category || 'All'
      });
    }

    return items;
  }

  function applyCatalogToJourney(journey, catalog) {
    var products = (catalog && catalog.products) ? catalog.products : [];
    if (!journey || !products.length) return journey;

    var names = products.map(function(product, index) {
      return product && product.name ? product.name : ('Product ' + (index + 1));
    });

    journey.productNames = journey.productNames || {};
    var productNameKeys = ['opc53', 'opc43', 'ppc', 'cementPpc'];
    for (var i = 0; i < productNameKeys.length; i++) {
      journey.productNames[productNameKeys[i]] = names[i] || names[0];
    }

    journey.step3 = journey.step3 || {};
    var cartItems = buildCartItemsFromCatalog(catalog);
    if (cartItems.length) {
      var orderValue = cartItems.reduce(function(sum, item) { return sum + item.lineTotal; }, 0);
      var totalQty = cartItems.reduce(function(sum, item) { return sum + item.qty; }, 0);
      journey.step3.cartItems = cartItems;
      journey.step3.draftOrder = journey.step3.draftOrder || {};
      journey.step3.draftOrder.totalValue = orderValue;
      journey.step3.draftOrder.netValue = orderValue;
      journey.step3.draftOrder.skuCount = cartItems.length;
      journey.step3.cartSummary = journey.step3.cartSummary || {};
      journey.step3.cartSummary.totalItems = cartItems.length;
      journey.step3.cartSummary.totalQty = totalQty;
      journey.step3.cartSummary.orderValue = orderValue;
    }

    // Derive product categories from catalog for step1 sections
    if (journey.messages && journey.messages.step1) {
      var productsByCategory = {};
      for (var j = 0; j < products.length; j++) {
        var p = products[j];
        var cat = (p && p.category) || 'Other';
        if (!productsByCategory[cat]) productsByCategory[cat] = [];
        productsByCategory[cat].push(p);
      }
      var categories = Object.keys(productsByCategory);
      var sections = [];

      // Section 1: Main product category (first category, up to 3 items)
      if (categories.length > 0) {
        var mainCat = categories[0];
        sections.push({
          label: mainCat,
          items: productsByCategory[mainCat].slice(0, 3).map(function(p) {
            return {
              title: p.name || 'Product',
              desc: p.description || (p.unit ? p.category + ' \u00b7 ' + p.unit : (p.category || ''))
            };
          })
        });
      }

      // Section 2: Secondary categories (remaining categories)
      if (categories.length > 1) {
        var secondaryItems = [];
        for (var k = 1; k < categories.length; k++) {
          var secCat = categories[k];
          for (var m = 0; m < productsByCategory[secCat].length; m++) {
            var sp = productsByCategory[secCat][m];
            secondaryItems.push({
              title: sp.name || 'Product',
              desc: sp.description || (sp.unit ? sp.category + ' \u00b7 ' + sp.unit : (sp.category || ''))
            });
          }
        }
        if (secondaryItems.length > 0) {
          var label = categories.length === 2 ? categories[1] : categories.slice(1).join(' & ');
          sections.push({ label: label, items: secondaryItems.slice(0, 3) });
        }
      }

      // Section 3: Offers & Trade (always present)
      sections.push({
        label: 'Offers & Solutions',
        items: [
          { title: 'Seasonal Offers', desc: 'Seasonal combos & clearance offers' },
          { title: 'Business Solutions', desc: 'Bulk orders & trade schemes' }
        ]
      });

      journey.messages.step1.sections = sections;
    }

    return journey;
  }

  function generateHandwrittenOrderImage(brand, catalog) {
    var products = (catalog && catalog.products) ? catalog.products : [];
    var storeName = (brand && brand.dealerStoreName) || 'Your Store';
    var brandName = (brand && brand.name) || 'Brand';
    var qtys = [25, 20, 12];
    var lines = [];

    for (var i = 0; i < Math.min(3, products.length); i++) {
      var product = products[i] || {};
      lines.push((product.name || ('Product ' + (i + 1))) + ' - ' + (qtys[i] || (i + 1)) + ' ' + (product.unit || 'unit'));
    }
    if (!lines.length) lines.push('Please deliver today');

    var svgLines = lines.map(function(line, index) {
      return '<text x="38" y="' + (128 + index * 34) + '" font-family="Comic Sans MS, Segoe Print, cursive" font-size="22" fill="#222">' +
        escapeXml(line) +
        '</text>';
    }).join('');

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="680" height="430" viewBox="0 0 680 430">' +
      '<rect width="680" height="430" rx="18" fill="#fffdf7"/>' +
      '<rect x="18" y="18" width="644" height="394" rx="14" fill="none" stroke="#e5d8b8" stroke-width="2"/>' +
      '<text x="38" y="58" font-family="Comic Sans MS, Segoe Print, cursive" font-size="28" font-weight="700" fill="#1f2933">Order for ' + escapeXml(storeName) + '</text>' +
      '<text x="38" y="91" font-family="Comic Sans MS, Segoe Print, cursive" font-size="18" fill="#6b5f45">' + escapeXml(brandName) + ' dealer note</text>' +
      svgLines +
      '<text x="38" y="356" font-family="Comic Sans MS, Segoe Print, cursive" font-size="20" fill="#444">Need delivery today. Please confirm.</text>' +
      '</svg>';

    return dataUriSvg(svg);
  }

  /* ═══════════════════════════════════════════════════════════
   *  buildJourney(journeyType, brand) — deep clone
   *  defaultJourneyData[journeyType], override dealer name,
   *  replace "JK Cement" references in messages
   * ═══════════════════════════════════════════════════════════ */
  function buildJourney(journeyType, brand, catalog) {
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
   *  render(userInput) — main render function
   *
   *  1. Loads template pack
   *  2. Registers partials and helpers
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
        var journey = buildJourney(journeyType, brand, catalog);
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

        // Compile journey template from pack.journeyScreens[journeyType]
        var journeyTemplateSrc = (pack.journeyScreens || {})[journeyType];
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

        // Determine journey title from journeyDescriptions
        var journeyDescs = pack.journeyDescriptions || {};
        var journeyTitle = (journeyDescs[journeyType] && journeyDescs[journeyType].title) || journey.title || journeyType;

        return {
          html: finalHtml,
          brand: brand,
          journeyType: journeyType,
          journeyTitle: journeyTitle
        };
      });
  }

  /* ═══════════════════════════════════════════════════════════
   *  generatePlaceholderImage(name, color) — returns SVG data URL
   *  with colored rect + initials
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
   *  Public API — window.DemoRenderer
   * ═══════════════════════════════════════════════════════════ */
  var DemoRenderer = {
    loadPack: loadPack,
    render: render,
    buildBrand: buildBrand,
    buildCatalog: buildCatalog,
    buildContent: buildContent,
    buildCart: buildCart,
    buildJourney: buildJourney,
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

  global.DemoRenderer = DemoRenderer;

})(typeof window !== 'undefined' ? window : this);
