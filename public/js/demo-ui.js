/**
 * demo-ui.js — Wizard UI Controller for dynamic demo generation.
 * Exposes window.demoUI as a global singleton.
 */
(function(global) {
  'use strict';

  var _currentStep = 1;
  var _logoDataUrl = null;
  var _productRowCount = 0;
  var _selectedJourney = 'order_to_cash';

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
          var reader = new FileReader();
          reader.onload = function(ev) {
            thumbDiv.innerHTML = '<img src="' + ev.target.result + '" alt="Product">';
            thumbDiv.setAttribute('data-image-url', ev.target.result);
          };
          reader.readAsDataURL(this.files[0]);
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

    for (var key in descriptions) {
      if (!descriptions.hasOwnProperty(key)) continue;
      var desc = descriptions[key];
      var card = document.createElement('div');
      card.className = 'journey-card';
      card.setAttribute('data-journey', key);
      if (key === _selectedJourney) card.classList.add('selected');

      var title = document.createElement('h4');
      title.textContent = desc.title || key;

      var meta = document.createElement('p');
      meta.className = 'journey-meta';
      meta.textContent = (desc.steps || '?') + ' steps';

      var descP = document.createElement('p');
      descP.className = 'journey-desc';
      descP.textContent = desc.desc || '';

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(descP);

      if (desc.scaffold) {
        var badge = document.createElement('span');
        badge.className = 'scaffold-badge';
        badge.textContent = 'Scaffold';
        card.appendChild(badge);
      }

      (function(journeyKey) {
        card.addEventListener('click', function() {
          var cards = container.querySelectorAll('.journey-card');
          for (var c = 0; c < cards.length; c++) {
            cards[c].classList.remove('selected');
          }
          card.classList.add('selected');
          _selectedJourney = journeyKey;
        });
      })(key);

      container.appendChild(card);
    }
  }

  /* ── Collect Form Data ─────────────────────────────────── */

  function collectFormData() {
    var brandName = (document.getElementById('brandNameInput') || {}).value || '';
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
      primaryColor: primaryColor,
      secondaryColor: secondaryColor,
      logoDataUrl: logoDataUrl,
      products: products,
      journeyType: _selectedJourney
    };
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

    // Show progress
    if (progressEl) progressEl.style.display = 'block';
    if (progressFill) progressFill.style.width = '30%';

    // Map form data to DemoRenderer.render() input format
    var userInput = {
      name: formData.brandName,
      brandColor: formData.primaryColor,
      brandColorDark: formData.secondaryColor,
      logo: formData.logoDataUrl || null,
      products: formData.products,
      journeyType: formData.journeyType
    };

    if (progressFill) progressFill.style.width = '60%';

    DemoRenderer.render(userInput)
      .then(function(result) {
        if (progressFill) progressFill.style.width = '100%';
        setTimeout(function() {
          if (progressEl) progressEl.style.display = 'none';
        }, 500);

        // Write to iframe
        var iframe = document.getElementById('previewIframe');
        if (iframe) {
          // Use srcdoc for better script isolation and execution
          iframe.srcdoc = result.html;
        }

        // Show preview area
        if (previewArea) previewArea.style.display = 'block';

        // Store generated HTML for later use
        window._generatedHtml = result.html;
        window._generatedBrand = result.brand ? result.brand.name || formData.brandName : formData.brandName;
      })
      .catch(function(err) {
        if (progressEl) progressEl.style.display = 'none';
        showError('Generation failed: ' + (err.message || err));
        console.error('[demo-ui] Generation error:', err);
      });
  }

  /* ── Open in New Tab ──────────────────────────────────── */

  function openInNewTab() {
    var html = window._generatedHtml || '';
    var iframe = document.getElementById('previewIframe');
    if (!html && iframe && iframe.srcdoc) {
      html = iframe.srcdoc;
    } else if (!html && iframe) {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      html = doc.documentElement.outerHTML;
    }
    // Wrap in full HTML if needed
    if (!html || html.indexOf('<html') === -1) {
      html = '<p>No preview available</p>';
    }
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  /* ── Download ─────────────────────────────────────────── */

  function download() {
    var html = window._generatedHtml;
    if (!html) {
      // Try srcdoc first, then contentDocument
      var iframe = document.getElementById('previewIframe');
      if (iframe && iframe.srcdoc) {
        html = iframe.srcdoc;
      } else if (iframe) {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        html = doc.documentElement.outerHTML;
      }
    }
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
    addProductRow();
    renderJourneyCards();
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
    openInNewTab: openInNewTab,
    download: download
  };

  global.demoUI = demoUI;

})(typeof window !== 'undefined' ? window : this);
