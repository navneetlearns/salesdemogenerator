/* Demo Generator -- Dual Mode Frontend */
(function () {
  "use strict";
  var API = window.location.origin;
  var STATE = { sessionId: null, generatedFiles: [], polling: false, mode: 'static', brands: [] };
  var $ = function(id) { return document.getElementById(id); };

  function setText(id, msg, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = type === 'error' ? '#d32f2f' : type === 'success' ? '#2e7d32' : '';
  }

  function titleCase(s) {
    return s.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }

  async function detectMode() {
    try {
      var r = await fetch(API + '/api/health');
      if (r.ok) {
        var d = await r.json();
        STATE.mode = d.mode || 'static';
      }
    } catch (e) {
      STATE.mode = 'static';
    }
    return STATE.mode;
  }

  // ── STATIC MODE ──
  async function loadStaticBrands() {
    try {
      var r = await fetch(API + '/api/brands');
      if (!r.ok) throw new Error('Failed to fetch brands');
      var data = await r.json();
      STATE.brands = data.brands || [];
      renderStaticUI();
    } catch (e) {
      // Fallback: try to load from /dist/ directly
      renderFallbackUI(e.message);
    }
  }

  function renderStaticUI() {
    var container = $('brandList');
    if (!container) return;
    container.innerHTML = '';
    if (STATE.brands.length === 0) {
      container.innerHTML = '<p class="muted">No pre-built brands available.</p>';
      return;
    }
    STATE.brands.forEach(function(brand) {
      var card = document.createElement('div');
      card.className = 'brand-card';
      var html = '<h3>' + titleCase(brand.id) + '</h3>';
      html += '<p class="muted">' + brand.journeys.length + ' journeys</p>';
      html += '<div class="journey-links">';
      brand.journeys.forEach(function(jid) {
        html += '<a href="/dist/' + brand.id + '/' + jid + '.html" target="_blank" class="btn" style="margin:4px">' + titleCase(jid) + '</a>';
      });
      html += '</div>';
      card.innerHTML = html;
      container.appendChild(card);
    });
  }

  function renderFallbackUI(errorMsg) {
    var container = $('brandList');
    if (!container) return;
    // List known brands as fallback
    var fallbackBrands = ['haldirams', 'jk_cement', 'sundaram_store'];
    container.innerHTML = '';
    fallbackBrands.forEach(function(bid) {
      var card = document.createElement('div');
      card.className = 'brand-card';
      card.innerHTML = '<h3>' + titleCase(bid) + '</h3>' +
        '<a href="/dist/' + bid + '/order_to_cash.html" target="_blank" class="btn">Order to Cash</a> ' +
        '<a href="/dist/' + bid + '/field_ops_expense.html" target="_blank" class="btn">Field Ops</a> ' +
        '<a href="/dist/' + bid + '/automated_collections.html" target="_blank" class="btn">Collections</a>';
      container.appendChild(card);
    });
  }

  // ── RUNTIME MODE ──
  async function createSession() {
    try {
      setText('sessionBox', 'Creating session...');
      var res = await fetch(API + '/api/session/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');
      STATE.sessionId = data.sessionId;
      setText('sessionBox', 'Session: ' + STATE.sessionId);
      return data;
    } catch (err) {
      setText('sessionBox', 'Session error: ' + err.message, 'error');
      throw err;
    }
  }

  async function generate() {
    var journeys = Array.from(document.querySelectorAll('#journeyList input:checked')).map(function(c) { return c.value; });
    if (journeys.length === 0) { setText('genStatus', 'Select at least one journey', 'error'); return; }
    if (STATE.mode === 'static') {
      setText('genStatus', 'Use the brand links above to view pre-built demos', 'error');
      return;
    }
    if (!STATE.sessionId) await createSession();
    var btn = $('generateBtn');
    if (btn) btn.disabled = true;
    setText('genStatus', 'Starting generation...');
    try {
      var res = await fetch(API + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: STATE.sessionId, journeys: journeys })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      setText('genStatus', 'Generation started');
    } catch (e) { setText('genStatus', 'Generate error: ' + e.message, 'error'); }
    if (btn) btn.disabled = false;
  }

  // ── INIT ──
  async function init() {
    var mode = await detectMode();
    var modeIndicator = $('modeIndicator');
    var staticSection = $('staticSection');
    var runtimeSection = $('runtimeSection');

    if (modeIndicator) {
      modeIndicator.textContent = mode === 'static' ? 'Pre-built brand demos (static)' : 'Runtime: Upload & generate';
    }

    if (mode === 'static') {
      if (staticSection) staticSection.style.display = '';
      if (runtimeSection) runtimeSection.style.display = 'none';
      await loadStaticBrands();
    } else {
      if (staticSection) staticSection.style.display = 'none';
      if (runtimeSection) runtimeSection.style.display = '';
      try { await createSession(); } catch(e) {}
    }
  }

  window.generate = generate;
  init();
})();
