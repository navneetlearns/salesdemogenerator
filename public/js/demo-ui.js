/**
 * demo-ui.js — Wizard UI Controller for dynamic demo generation.
 * Exposes window.demoUI as a global singleton.
 */
(function(global) {
  'use strict';

  var _currentStep = 1;
  var _logoDataUrl = null;
  var _productRowCount = 0;
  var _selectedJourneys = ['order_to_cash'];
  var _contentAdaptation = null;
  var MAX_GUIDELINE_IMAGE_SIZE = 1024 * 1024;
  var LAST_PREVIEW_KEY = 'zotok.demoGenerator.lastPreview';

  var GROUP_D_JOURNEYS = ['retailer_activation', 'dt_fulfillment_payment'];
  var GROUP_B_C_JOURNEYS = ['retailer_loyalty', 'automated_collections', 'field_ops_expense', 'campaigns_queries'];

  // Journey buckets for grouped display in Step 3
  var JOURNEY_BUCKETS = [
    { id: 'sales', label: 'Order to Cash (Sales Cycle)', icon: '🛒', journeys: ['order_to_cash', 'dt_fulfillment_payment', 'automated_collections'] },
    { id: 'field', label: 'Field Operations & Dealer', icon: '🔧', journeys: ['field_ops_expense', 'dealer_engagement'] },
    { id: 'retailer', label: 'Retailer Management', icon: '🏪', journeys: ['retailer_onboarding', 'retailer_activation', 'retailer_loyalty'] },
    { id: 'comms', label: 'Communications & Post-Order', icon: '📱', journeys: ['campaigns_queries', 'post_order_communication'] },
  ];

  function isJourneySelected(journeyKey) {
    return _selectedJourneys.indexOf(journeyKey) !== -1;
  }

  function primarySelectedJourney() {
    return _selectedJourneys[0] || 'order_to_cash';
  }

  function getJourneyAdaptGroup(journeyKey) {
    if (GROUP_D_JOURNEYS.indexOf(journeyKey) !== -1) return 'D';
    if (GROUP_B_C_JOURNEYS.indexOf(journeyKey) !== -1) return 'BC';
    return 'A';
  }

  function getIndustryValue() {
    var runtimeIndustry = document.getElementById('runtimeIndustryInput');
    var wizardIndustry = document.getElementById('industryInput');
    var value = (wizardIndustry && wizardIndustry.value) || (runtimeIndustry && runtimeIndustry.value) || 'Cement';
    if (wizardIndustry && !wizardIndustry.value) wizardIndustry.value = value;
    if (runtimeIndustry && !runtimeIndustry.value) runtimeIndustry.value = value;
    return value;
  }

  function getDefaultContentLabels() {
    if (window.DemoRenderer && typeof DemoRenderer.buildContent === 'function') {
      return DemoRenderer.buildContent({});
    }
    return {};
  }

  function getSelectedContentLabels() {
    if (_contentAdaptation && _contentAdaptation.acceptedLabels) {
      return _contentAdaptation.acceptedLabels;
    }
    return getDefaultContentLabels();
  }

  /* ── Step Navigation ──────────────────────────────────── */

  function showStep(n) {
    _currentStep = n;
    // Hide all steps
    var steps = document.querySelectorAll('.wizard-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.remove('active');
    }
    // Show target step
    var target = document.getElementById('step' + n);
    if (target) target.classList.add('active');

    // Update step dots
    var dots = document.querySelectorAll('.step-dot');
    for (var j = 0; j < dots.length; j++) {
      dots[j].classList.remove('active', 'completed');
      if (j < n - 1) dots[j].classList.add('completed');
      if (j === n - 1) dots[j].classList.add('active');
    }

    // Show/hide nav buttons
    var prevBtn = document.getElementById('prevStepBtn');
    var nextBtn = document.getElementById('nextStepBtn');
    if (prevBtn) prevBtn.style.display = n > 1 ? 'inline-block' : 'none';
    if (nextBtn) nextBtn.style.display = n < 3 ? 'inline-block' : 'none';
  }

  function nextStep() {
    if (_currentStep === 1) {
      var brandName = document.getElementById('brandNameInput');
      if (!brandName || !brandName.value.trim()) {
        brandName && brandName.focus();
        showError('Please enter a brand name.');
        return;
      }
    }
    if (_currentStep === 2) {
      var rows = document.querySelectorAll('.product-row');
      var valid = true;
      for (var i = 0; i < rows.length; i++) {
        var nameInput = rows[i].querySelector('.product-name-input');
        if (!nameInput || !nameInput.value.trim()) {
          valid = false;
          break;
        }
      }
      if (!valid) {
        showError('Please fill in all product names.');
        return;
      }
    }
    clearError();
    if (_currentStep < 3) showStep(_currentStep + 1);
  }

  function prevStep() {
    clearError();
    if (_currentStep > 1) showStep(_currentStep - 1);
  }

  /* ── Error display ────────────────────────────────────── */

  function showError(msg) {
    var el = document.getElementById('wizardError');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  function clearError() {
    var el = document.getElementById('wizardError');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  /* ── Logo Upload ──────────────────────────────────────── */

  function handleLogoFile(file) {
    if (!file) return;
    if (file.size > MAX_GUIDELINE_IMAGE_SIZE) {
      showError('Logo is larger than the 1 MB guideline. It may still work, but smaller images create faster previews and share links.');
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      _logoDataUrl = e.target.result;
      var preview = document.getElementById('logoPreview');
      if (preview) {
        preview.src = _logoDataUrl;
        preview.style.display = 'block';
      }
      var placeholder = document.getElementById('logoPlaceholder');
      if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function setupLogoDropZone() {
    var dropZone = document.getElementById('logoDropZone');
    var fileInput = document.getElementById('logoFileInput');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', function() {
      fileInput.click();
    });

    fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        handleLogoFile(this.files[0]);
      }
    });

    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-hover');
    });

    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-hover');
    });

    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-hover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleLogoFile(e.dataTransfer.files[0]);
      }
    });
  }

  /* ── Product Rows ──────────────────────────────────────── */

  function addProductRow(data) {
    var container = document.getElementById('productRowsContainer');
    if (!container) return;
    var count = container.querySelectorAll('.product-row').length;
    if (count >= 8) return;

    var dataUrl = (data && data.imageDataUrl) || '';
    var name = (data && data.name) || '';
    var price = (data && data.price) || '';
    var unit = (data && data.unit) || 'bag';

    _productRowCount++;
    var idx = _productRowCount;
    var row = document.createElement('div');
    row.className = 'product-row';
    row.setAttribute('data-row-id', idx);

    var thumbDiv = document.createElement('div');
    thumbDiv.className = 'product-thumb';
    if (dataUrl) {
      thumbDiv.innerHTML = '<img src="' + dataUrl + '" alt="Product">';
      thumbDiv.setAttribute('data-image-url', dataUrl);
    } else {
      thumbDiv.innerHTML = '<span class="product-thumb-placeholder">&#128247;</span>';
    }
    thumbDiv.addEventListener('click', function() {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.style.display = 'none';
      inp.addEventListener('change', function() {
        if (this.files && this.files[0]) {
          handleProductImage(this.files[0], thumbDiv);
        }
      });
      document.body.appendChild(inp);
      inp.click();
      document.body.removeChild(inp);
    });

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'product-name-input';
    nameInput.placeholder = 'Product name';
    nameInput.value = name;

    var priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.className = 'product-price-input';
    priceInput.placeholder = 'Price';
    priceInput.min = '0';
    priceInput.value = price;

    var unitSelect = document.createElement('select');
    unitSelect.className = 'product-unit-select';
    var units = ['piece', 'bag', 'box', 'pack', 'kg', 'ltr'];
    for (var u = 0; u < units.length; u++) {
      var opt = document.createElement('option');
      opt.value = units[u];
      opt.textContent = units[u];
      if (units[u] === unit) opt.selected = true;
      unitSelect.appendChild(opt);
    }

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-sm btn-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove product';
    removeBtn.addEventListener('click', function() {
      removeProductRow(row);
    });

    row.appendChild(thumbDiv);
    row.appendChild(nameInput);
    row.appendChild(priceInput);
    row.appendChild(unitSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);

    updateAddProductButton();
    clearError();
  }

  function removeProductRow(rowEl) {
    var container = document.getElementById('productRowsContainer');
    if (!container) return;
    var count = container.querySelectorAll('.product-row').length;
    if (count <= 1) return; // min 1
    rowEl.remove();
    updateAddProductButton();
  }

  function updateAddProductButton() {
    var container = document.getElementById('productRowsContainer');
    var btn = document.getElementById('addProductBtn');
    if (!container || !btn) return;
    var count = container.querySelectorAll('.product-row').length;
    btn.style.display = count >= 8 ? 'none' : 'inline-block';
  }

  /* ── Product Image Upload ─────────────────────────────── */

  function handleProductImage(file, thumbEl) {
    if (!file) return;
    if (file.size > MAX_GUIDELINE_IMAGE_SIZE) {
      showError('Product image is larger than the 1 MB guideline. Smaller images keep generated demos and share links lighter.');
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      thumbEl.innerHTML = '<img src="' + e.target.result + '" alt="Product">';
      thumbEl.setAttribute('data-image-url', e.target.result);
    };
    reader.readAsDataURL(file);
  }

  /* ── Journey Cards ────────────────────────────────────── */

  function renderJourneyCards() {
    var container = document.getElementById('journeyCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    var descriptions = (window.DemoRenderer && window.DemoRenderer.journeyDescriptions) || null;
    if (!descriptions) {
      container.innerHTML = '<p class="muted">Loading journeys...</p>';
      return;
    }

    // Build lookup of journey key → description, tracking which are assigned to buckets
    var assigned = {};
    
    // Render each bucket section
    JOURNEY_BUCKETS.forEach(function(bucket) {
      var bucketKeys = bucket.journeys.filter(function(k) { return descriptions[k] && k !== 'home'; });
      if (!bucketKeys.length) return;
      
      var section = document.createElement('div');
      section.className = 'journey-bucket';
      
      var header = document.createElement('div');
      header.className = 'journey-bucket-header';
      header.innerHTML = '<span class="journey-bucket-icon">' + (bucket.icon || '') + '</span> <span class="journey-bucket-label">' + bucket.label + '</span>';
      section.appendChild(header);
      
      var grid = document.createElement('div');
      grid.className = 'journey-cards-grid';
      
      bucketKeys.forEach(function(key) {
        assigned[key] = true;
        var desc = descriptions[key];
        var card = document.createElement('div');
        card.className = 'journey-card';
        card.setAttribute('data-journey', key);
        card.setAttribute('role', 'checkbox');
        card.setAttribute('aria-checked', isJourneySelected(key) ? 'true' : 'false');
        if (desc.scaffold) card.classList.add('journey-card-wip');
        if (isJourneySelected(key)) card.classList.add('selected');

        var title = document.createElement('h4');
        title.textContent = desc.title || key;

        var meta = document.createElement('p');
        meta.className = 'journey-meta';
        meta.textContent = (desc.steps || '?') + ' steps';

        var descP = document.createElement('p');
        descP.className = 'journey-desc';
        descP.textContent = desc.desc || '';

        var selectedMark = document.createElement('span');
        selectedMark.className = 'journey-selected-mark';
        selectedMark.textContent = 'Selected';

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(descP);
        card.appendChild(selectedMark);

        if (desc.scaffold) {
          var badge = document.createElement('span');
          badge.className = 'scaffold-badge';
          badge.textContent = 'Work in progress';
          card.appendChild(badge);
        }

        (function(journeyKey, cardEl) {
          cardEl.addEventListener('click', function() {
            var idx = _selectedJourneys.indexOf(journeyKey);
            if (idx === -1) {
              _selectedJourneys.push(journeyKey);
              cardEl.classList.add('selected');
              cardEl.setAttribute('aria-checked', 'true');
            } else {
              _selectedJourneys.splice(idx, 1);
              cardEl.classList.remove('selected');
              cardEl.setAttribute('aria-checked', 'false');
            }
            updateStepSelection();
          });
        })(key, card);

        grid.appendChild(card);
      });
      
      section.appendChild(grid);
      container.appendChild(section);
    });
    
    // Any unassigned journeys (not in any bucket) go into an "Other" section
    var unassigned = [];
    for (var key in descriptions) {
      if (!descriptions.hasOwnProperty(key)) continue;
      if (key === 'home') continue;
      if (!assigned[key]) unassigned.push(key);
    }
    
    if (unassigned.length) {
      var otherSection = document.createElement('div');
      otherSection.className = 'journey-bucket';
      otherSection.innerHTML = '<div class="journey-bucket-header"><span class="journey-bucket-icon">📋</span> <span class="journey-bucket-label">Other Journeys</span></div>';
      var otherGrid = document.createElement('div');
      otherGrid.className = 'journey-cards-grid';
      
      unassigned.forEach(function(key) {
        var desc = descriptions[key];
        var card = document.createElement('div');
        card.className = 'journey-card';
        card.setAttribute('data-journey', key);
        card.setAttribute('role', 'checkbox');
        card.setAttribute('aria-checked', isJourneySelected(key) ? 'true' : 'false');
        if (isJourneySelected(key)) card.classList.add('selected');
        // ... same card build as above, minimal version
        card.innerHTML = '<h4>' + (desc.title || key) + '</h4>' +
          '<p class="journey-meta">' + (desc.steps || '?') + ' steps</p>' +
          '<p class="journey-desc">' + (desc.desc || '') + '</p>' +
          '<span class="journey-selected-mark">Selected</span>';
        (function(journeyKey, cardEl) {
          cardEl.addEventListener('click', function() {
            var idx = _selectedJourneys.indexOf(journeyKey);
            if (idx === -1) { _selectedJourneys.push(journeyKey); cardEl.classList.add('selected'); cardEl.setAttribute('aria-checked', 'true'); }
            else { _selectedJourneys.splice(idx, 1); cardEl.classList.remove('selected'); cardEl.setAttribute('aria-checked', 'false'); }
            updateStepSelection();
          });
        })(key, card);
        otherGrid.appendChild(card);
      });
      
      otherSection.appendChild(otherGrid);
      container.appendChild(otherSection);
    }
  }

  /* ── Step Selection ──────────────────────────────────── */

  function updateStepSelection() {
    var panel = document.getElementById('stepSelectionPanel');
    var items = document.getElementById('stepChecklistItems');
    if (!panel || !items) return;

    var journeyKey = primarySelectedJourney();
    if (!journeyKey) {
      panel.style.display = 'none';
      return;
    }

    var descs = (window.DemoRenderer && window.DemoRenderer.journeyDescriptions) || {};
    var desc = descs[journeyKey];
    if (!desc || !desc.steps || desc.steps <= 1) {
      panel.style.display = 'none';
      window.selectedSteps = null;
      return;
    }

    items.innerHTML = '';
    var steps = window.DemoRenderer && window.DemoRenderer.getJourneySteps
      ? window.DemoRenderer.getJourneySteps(journeyKey)
      : null;
    for (var i = 1; i <= desc.steps; i++) {
      var label = document.createElement('label');
      label.className = 'step-checkbox-row';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = i;
      cb.checked = true;
      cb.onchange = onStepToggle;
      var badge = document.createElement('span');
      badge.className = 'step-num-badge';
      badge.textContent = i;
      var lbl = document.createElement('span');
      lbl.className = 'step-label';
      // Use step title from journey data if available, fall back to "Step N"
      var stepTitle = (steps && steps[i - 1] && steps[i - 1].title) || null;
      lbl.textContent = stepTitle || 'Step ' + i;
      // Add a subtitle line for meta
      var stepMeta = (steps && steps[i - 1] && steps[i - 1].meta) || null;
      label.appendChild(cb);
      label.appendChild(badge);
      var textWrap = document.createElement('span');
      textWrap.className = 'step-text-wrap';
      var titleSpan = document.createElement('span');
      titleSpan.className = 'step-title';
      titleSpan.textContent = lbl.textContent;
      textWrap.appendChild(titleSpan);
      if (stepMeta) {
        var metaSpan = document.createElement('span');
        metaSpan.className = 'step-meta';
        metaSpan.textContent = stepMeta;
        textWrap.appendChild(metaSpan);
      }
      label.appendChild(textWrap);
      items.appendChild(label);
    }

    panel.style.display = 'block';
    window.selectedSteps = null; // null = all steps
  }

  function toggleAllSteps(checked) {
    var checkboxes = document.querySelectorAll('#stepChecklistItems input[type="checkbox"]');
    checkboxes.forEach(function(cb) { cb.checked = checked; });
    onStepToggle();
  }

  function onStepToggle() {
    var checkboxes = document.querySelectorAll('#stepChecklistItems input[type="checkbox"]');
    var checked = [];
    checkboxes.forEach(function(cb) {
      if (cb.checked) checked.push(parseInt(cb.value));
    });
    window.selectedSteps = (checked.length === checkboxes.length) ? null : checked;
    var generateBtn = document.getElementById('generateBtn');
    if (generateBtn) generateBtn.disabled = (checked.length === 0);
  }

  /* ── Collect Form Data ─────────────────────────────────── */

  function collectFormData() {
    var brandName = (document.getElementById('brandNameInput') || {}).value || '';
    var industry = getIndustryValue();
    var primaryColor = (document.getElementById('primaryColorInput') || {}).value || '#075e54';
    var secondaryColor = (document.getElementById('secondaryColorInput') || {}).value || '#064e46';
    var logoDataUrl = _logoDataUrl;

    var productRows = document.querySelectorAll('.product-row');
    var products = [];
    for (var i = 0; i < productRows.length; i++) {
      var row = productRows[i];
      var nameInput = row.querySelector('.product-name-input');
      var priceInput = row.querySelector('.product-price-input');
      var unitSelect = row.querySelector('.product-unit-select');
      var thumbEl = row.querySelector('.product-thumb');

      var pName = (nameInput && nameInput.value.trim()) || '';
      var pPrice = parseFloat((priceInput && priceInput.value) || '0');
      var pUnit = (unitSelect && unitSelect.value) || 'piece';
      var pImage = (thumbEl && thumbEl.getAttribute('data-image-url')) || '';

      if (pName) {
        products.push({
          name: pName,
          price: pPrice,
          unit: pUnit,
          imageDataUrl: pImage || (window.DemoRenderer ? DemoRenderer.generatePlaceholderImage(pName, primaryColor) : ''),
          category: 'All'
        });
      }
    }

    return {
      brandName: brandName,
      industry: industry,
      primaryColor: primaryColor,
      secondaryColor: secondaryColor,
      logoDataUrl: logoDataUrl,
      products: products,
      journeyType: primarySelectedJourney(),
      journeyTypes: _selectedJourneys.slice()
    };
  }

  function saveLastPreview(result, fallbackBrandName) {
    if (!global.localStorage || !result || !result.html) return;
    var payload = {
      html: result.html,
      brandName: result.brand ? result.brand.name || fallbackBrandName : fallbackBrandName,
      journeyType: result.journeyType || primarySelectedJourney(),
      journeyTypes: _selectedJourneys.slice(),
      journeyTitle: result.journeyTitle || '',
      savedAt: new Date().toISOString()
    };
    try {
      global.localStorage.setItem(LAST_PREVIEW_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[demo-ui] Could not persist generated preview:', err);
    }
  }

  function restoreLastPreview() {
    if (!global.localStorage) return;
    var raw = null;
    try {
      raw = global.localStorage.getItem(LAST_PREVIEW_KEY);
    } catch (err) {
      return;
    }
    if (!raw) return;

    var payload;
    try {
      payload = JSON.parse(raw);
    } catch (err2) {
      return;
    }
    if (!payload || !payload.html) return;

    var iframe = document.getElementById('previewIframe');
    var previewArea = document.getElementById('previewArea');
    var previewTitle = document.getElementById('previewTitle');

    window._generatedHtml = payload.html;
    window._generatedBrand = payload.brandName || 'Demo';
    _selectedJourneys = Array.isArray(payload.journeyTypes) && payload.journeyTypes.length
      ? payload.journeyTypes
      : [payload.journeyType || primarySelectedJourney()];

    if (iframe) {
      if (window._previewBlobUrl) URL.revokeObjectURL(window._previewBlobUrl);
      var blob = new Blob([payload.html], {type: 'text/html;charset=utf-8'});
      window._previewBlobUrl = URL.createObjectURL(blob);
      iframe.src = window._previewBlobUrl;
    }
    if (previewArea) previewArea.style.display = 'block';
    if (previewTitle) {
      previewTitle.textContent = payload.journeyTitle ? 'Preview - ' + payload.journeyTitle : 'Preview';
    }
  }

  /* ── Generate ─────────────────────────────────────────── */

  function generate() {
    clearError();
    var progressEl = document.getElementById('progressBar');
    var progressFill = document.getElementById('progressFill');
    var previewArea = document.getElementById('previewArea');

    if (!window.DemoRenderer) {
      showError('DemoRenderer not loaded. Please refresh the page.');
      return;
    }

    var formData = collectFormData();
    if (!formData.brandName) {
      showError('Brand name is required.');
      return;
    }
    if (formData.products.length === 0) {
      showError('At least one product is required.');
      return;
    }
    if (formData.journeyTypes.length === 0) {
      showError('Select at least one journey.');
      return;
    }

    // Show progress
    if (progressEl) progressEl.style.display = 'block';
    if (progressFill) progressFill.style.width = '20%';

    // Auto-adapt content to selected industry before rendering
    adaptContent()
      .then(function() {
        // Adaptation complete (or failed — we render either way)
        if (progressFill) progressFill.style.width = '50%';

        // Map form data to DemoRenderer.render() input format
        var formData = collectFormData();
        var userInput = {
          name: formData.brandName,
          industry: formData.industry,
          brandColor: formData.primaryColor,
          brandColorDark: formData.secondaryColor,
          logo: formData.logoDataUrl || null,
          products: formData.products,
          journeyType: formData.journeyType,
          journeyTypes: formData.journeyTypes.length > 1 ? formData.journeyTypes : undefined,
          acceptedLabels: getSelectedContentLabels()
        };

        // Add step selection if user has selected specific steps
        if (window.selectedSteps) {
          userInput.selectedSteps = window.selectedSteps;
        }

        if (progressFill) progressFill.style.width = '60%';

        // Always use renderMultiJourney — it wraps output in a hub page regardless of count
        return DemoRenderer.renderMultiJourney(userInput);
      })
      .then(function(result) {
        if (progressFill) progressFill.style.width = '100%';
        setTimeout(function() {
          if (progressEl) progressEl.style.display = 'none';
        }, 500);

        // Write to iframe via Blob URL (srcdoc fails with large multi-journey HTML)
        var iframe = document.getElementById('previewIframe');
        if (iframe) {
          if (window._previewBlobUrl) URL.revokeObjectURL(window._previewBlobUrl);
          var blob = new Blob([result.html], {type: 'text/html;charset=utf-8'});
          window._previewBlobUrl = URL.createObjectURL(blob);
          iframe.src = window._previewBlobUrl;
        }

        // Show preview area
        if (previewArea) previewArea.style.display = 'block';

        // Store generated HTML and journey results for share
        window._generatedHtml = result.html;
        window._journeyResults = result.journeyResults || null;
        window._generatedBrand = result.brand ? result.brand.name || formData.brandName : formData.brandName;
        saveLastPreview(result, formData.brandName);
      })
      .catch(function(err) {
        if (progressEl) progressEl.style.display = 'none';
        showError('Generation failed: ' + (err.message || err));
        console.error('[demo-ui] Generation error:', err);
      });
  }

  /* ── Share Link Helpers ───────────────────────────────── */

  function getGeneratedHtml() {
    var html = window._generatedHtml || '';
    if (html) return html;
    // Fallback: read from iframe (Blob URL or srcdoc)
    var iframe = document.getElementById('previewIframe');
    if (iframe) {
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        html = doc.documentElement.outerHTML;
      } catch (e) { /* cross-origin or not loaded */ }
    }
    return html || '';
  }

  function setShareStatus(message, isError) {
    var el = document.getElementById('shareStatus');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('error', !!isError);
    el.style.display = message ? 'block' : 'none';
  }

  function copyShareUrl(url) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return Promise.resolve(false);
    }
    return navigator.clipboard.writeText(url)
      .then(function() { return true; })
      .catch(function() { return false; });
  }

  // Safe JSON parser for fetch responses — handles non-JSON error pages
  function safeJson(res) {
    return res.text().then(function(text) {
      try { return JSON.parse(text); }
      catch (e) {
        var msg = text.substring(0, 200) || ('Server error (HTTP ' + res.status + ')');
        var err = new Error(msg);
        err.status = res.status;
        throw err;
      }
    });
  }

  function createShareLink() {
    clearError();
    var html = getGeneratedHtml();
    if (!html || html.indexOf('<html') === -1) {
      showError('No demo generated yet.');
      return;
    }

    var btn = document.getElementById('createShareLinkBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating...';
    }
    setShareStatus('Creating secure share link...', false);

    var formData = collectFormData();
    var config = {
      name: formData.brandName,
      industry: formData.industry,
      brandColor: formData.primaryColor,
      brandColorDark: formData.secondaryColor,
      logo: formData.logoDataUrl || null,
      products: formData.products,
      journeyType: formData.journeyType,
      journeyTypes: formData.journeyTypes
    };

    // Add step selection if user has selected specific steps
    if (window.selectedSteps) {
      config.selectedSteps = window.selectedSteps;
    }

    // Add accepted content labels if adaptation was applied
    var acceptedLabels = getSelectedContentLabels();
    if (acceptedLabels && Object.keys(acceptedLabels).length > 0) {
      config.acceptedLabels = acceptedLabels;
    }

    // v3 multi-blob: two-step upload (init hub → upload journeys one at a time)
    // Each request stays under Vercel's ~4.1MB limit
    var journeyResults = window._journeyResults;
    if (journeyResults && journeyResults.length > 0) {
      // Step 1: Init hub (tiny — just config + journey types)
      setShareStatus('Initializing share hub...', false);
      return fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: config,
          journeyTypes: formData.journeyTypes.slice(),
          brandName: formData.brandName
        })
      })
        .then(safeJson)
        .then(function(hubData) {
          if (hubData.error) throw new Error(hubData.error);
          var hubToken = hubData.token;
          var shareUrl = hubData.url;

          // Step 2: Upload each journey one at a time
          var chain = Promise.resolve();
          journeyResults.forEach(function(r, i) {
            chain = chain.then(function() {
              setShareStatus('Uploading journey ' + (i + 1) + ' of ' + journeyResults.length + '...', false);
              return fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  hubToken: hubToken,
                  journeyType: r.type,
                  html: r.html
                })
              }).then(safeJson).then(function(data) {
                if (data.error) throw new Error(data.error);
                return data;
              });
            });
          });

          return chain.then(function() {
            window._generatedShareUrl = shareUrl;
            window.open(shareUrl, '_blank');
            return copyShareUrl(shareUrl).then(function(copied) {
              setShareStatus('Share link ' + (copied ? 'copied and ' : '') + 'opened. Expires in 24 hours.', false);
            });
          });
        })
        .catch(function(err) {
          showError(err.message || 'Could not create share link.');
          setShareStatus(err.message || 'Could not create share link.', true);
        })
        .finally(function() {
          if (btn) { btn.disabled = false; btn.textContent = 'Create Share Link'; }
        });
    }

    // v2 config-based share: single request, ~2KB payload (single journey or fallback)
    var bodyPayload = {
      config: config,
      brandName: formData.brandName,
      journeyType: formData.journeyType
    };
    if (formData.journeyTypes.length > 1) {
      bodyPayload.journeyTypes = formData.journeyTypes.slice();
    }

    fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    })
      .then(function(res) {
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1) {
          return res.json().then(function(data) {
            if (!res.ok) {
              var err = new Error(data.error || 'Could not create share link.');
              err.status = res.status;
              throw err;
            }
            return data;
          });
        }
        return res.text().then(function(text) {
          if (res.status === 413) {
            throw new Error('Server rejected the request — please try again.');
          }
          throw new Error('Server error (' + res.status + '): ' + (text.substring(0, 200) || res.statusText));
        });
      })
      .then(function(data) {
        var url = data.url;
        window._generatedShareUrl = url;
        window.open(url, '_blank');
        return copyShareUrl(url).then(function(copied) {
          var expires = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : '24 hours';
          setShareStatus('Share link ' + (copied ? 'copied and ' : '') + 'opened. Expires: ' + expires, false);
        });
      })
      .catch(function(err) {
        showError(err.message || 'Could not create share link.');
        setShareStatus(err.message || 'Could not create share link.', true);
      })
      .finally(function() {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Create Share Link';
        }
      });
  }

  function adaptContent() {
    clearError();
    if (!window.DemoRenderer) {
      return Promise.resolve(null);
    }

    var formData = collectFormData();
    var labels = getDefaultContentLabels();
    var payload = {
      industry: formData.industry,
      brandName: formData.brandName,
      journeyType: formData.journeyType,
      products: formData.products.map(function(p) { return p.name; }),
      labels: labels
    };

    return fetch('/api/experiments/adapt-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(res) {
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1) {
          return res.json().then(function(data) {
            if (!res.ok) {
              var err = new Error(data.error || 'Could not adapt content.');
              err.status = res.status;
              throw err;
            }
            return data;
          });
        }
        return res.text().then(function(text) {
          throw new Error('Server error (' + res.status + '): ' + (text.substring(0, 200) || res.statusText));
        });
      })
      .then(function(data) {
        _contentAdaptation = {
          industry: formData.industry,
          brandName: formData.brandName,
          originalLabels: labels,
          acceptedLabels: data.acceptedLabels || labels,
          adaptationDiff: data.adaptationDiff || {},
          provider: data.provider || 'OpenCode',
          model: data.model || 'deepseek-v4-flash'
        };
        return _contentAdaptation;
      })
      .catch(function(err) {
        _contentAdaptation = {
          industry: formData.industry,
          brandName: formData.brandName,
          originalLabels: labels,
          acceptedLabels: labels,
          adaptationDiff: {},
          provider: 'fallback',
          model: 'original'
        };
        return _contentAdaptation;
      });
  }

  /* ── Download ─────────────────────────────────────────── */

  function download() {
    var html = getGeneratedHtml();
    if (!html) {
      showError('No demo generated yet.');
      return;
    }
    var brandName = window._generatedBrand || 'demo';
    var filename = brandName.replace(/[^a-zA-Z0-9]/g, '_') + '_demo.html';
    if (window.DemoRenderer) {
      DemoRenderer.downloadHtml(html, filename);
    } else {
      // Fallback
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /* ── Initialize ───────────────────────────────────────── */

  function init() {
    setupLogoDropZone();
    getIndustryValue();
    addProductRow();
    renderJourneyCards();
    restoreLastPreview();
    updateStepSelection();
    showStep(1);
  }

  /* ── Public API ────────────────────────────────────────── */

  var demoUI = {
    init: init,
    nextStep: nextStep,
    prevStep: prevStep,
    addProductRow: addProductRow,
    removeProductRow: removeProductRow,
    handleLogoFile: handleLogoFile,
    renderJourneyCards: renderJourneyCards,
    generate: generate,
    adaptContent: adaptContent,
    restoreLastPreview: restoreLastPreview,
    createShareLink: createShareLink,
    openInNewTab: createShareLink,
    download: download,
    updateStepSelection: updateStepSelection,
    toggleAllSteps: toggleAllSteps,
    onStepToggle: onStepToggle
  };

  global.demoUI = demoUI;

})(typeof window !== 'undefined' ? window : this);
