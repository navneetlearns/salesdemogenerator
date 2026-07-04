// Demo Generator - Frontend App
// Shows brands grouped by industry with journey filtering

const API_BASE = window.location.origin;

async function detectMode() {
  try {
    const res = await fetch(API_BASE + '/api/health.json');
    const data = await res.json();
    return data.mode || 'static';
  } catch (e) {
    return 'static';
  }
}

async function loadBrands() {
  try {
    const res = await fetch(API_BASE + '/api/brands.json');
    if (!res.ok) throw new Error('Brands API returned ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.brands || []);
  } catch (e) {
    console.error('Failed to load brands:', e);
    return [];
  }
}

async function loadAllJourneys() {
  try {
    const res = await fetch(API_BASE + '/api/journeys.json');
    return await res.json();
  } catch (e) {
    console.error('Failed to load journeys:', e);
    return {};
  }
}

function renderStaticMode(brands, allJourneys) {
  document.getElementById('modeIndicator').textContent = 'Select a brand to view pre-built demos';
  var container = document.getElementById('brandList');
  if (!container) return;

  container.innerHTML = '';
  if (!brands.length) {
    container.innerHTML = '<p class="muted">No pre-built brand journeys found. Run the build, then refresh this page.</p>';
    return;
  }

  // Group brands by industry
  var byIndustry = {};
  brands.forEach(function(b) {
    var ind = b.industry || 'general';
    if (!byIndustry[ind]) byIndustry[ind] = [];
    b._journeys = allJourneys[b.id] || [];
    byIndustry[ind].push(b);
  });

  var industryOrder = ['cement', 'fmcg', 'industrial', 'pharma', 'agri', 'general'];
  var industryLabels = {
    cement: 'Cement & Construction',
    fmcg: 'FMCG / Consumer Goods',
    industrial: 'Industrial & Manufacturing',
    pharma: 'Pharma & Healthcare',
    agri: 'Agriculture',
    general: 'General / Retail'
  };

  // Build industry filter bar
  var filterBar = document.createElement('div');
  filterBar.className = 'industry-filter';
  filterBar.innerHTML = '<button class="filter-btn active" data-industry="all">All (' + brands.length + ')</button>';
  industryOrder.forEach(function(ind) {
    var list = byIndustry[ind];
    if (!list || !list.length) return;
    var total = list.reduce(function(sum, b) { return sum + (b.journeyCount || 0); }, 0);
    var btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.industry = ind;
    btn.textContent = (industryLabels[ind] || ind) + ' (' + list.length + ' brands, ' + total + ' journeys)';
    btn.onclick = function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.industry-group').forEach(function(g) {
        g.style.display = (ind === 'all' || g.dataset.industry === ind) ? '' : 'none';
      });
    };
    filterBar.appendChild(btn);
  });
  container.appendChild(filterBar);

  // Build industry groups
  industryOrder.forEach(function(ind) {
    var list = byIndustry[ind];
    if (!list || !list.length) return;

    var group = document.createElement('div');
    group.className = 'industry-group';
    group.dataset.industry = ind;

    var heading = document.createElement('h3');
    heading.className = 'industry-heading';
    heading.textContent = industryLabels[ind] || ind.charAt(0).toUpperCase() + ind.slice(1);
    group.appendChild(heading);

    var brandGrid = document.createElement('div');
    brandGrid.className = 'brand-grid';

    list.forEach(function(brand) {
      var card = document.createElement('div');
      card.className = 'brand-card';

      var logoPath = './assets/brands/' + brand.id + '/logo.png';
      var fallbackLogo = './assets/brands/' + brand.id + '/logo.svg';
      var logoExt = brand.id === 'vn_fogg' ? '' : '';

      card.innerHTML =
        '<a href="./' + brand.id + '/" class="brand-card-link">' +
          '<div class="brand-card-logo">' +
            '<img src="' + logoPath + '" alt="' + brand.name + '" onerror="this.src=\'' + fallbackLogo + '\';this.onerror=null" loading="lazy">' +
          '</div>' +
          '<div class="brand-card-info">' +
            '<strong class="brand-card-name">' + brand.name + '</strong>' +
            '<span class="brand-card-count">' + brand.journeyCount + ' journey' + (brand.journeyCount !== 1 ? 's' : '') + '</span>' +
          '</div>' +
        '</a>';

      // Add quick-journey links
      if (brand._journeys && brand._journeys.length) {
        var jLinks = document.createElement('div');
        jLinks.className = 'brand-card-journeys';
        brand._journeys.slice(0, 5).forEach(function(j) {
          var jPath = './' + brand.id + '/' + j.id + '.html';
          var jLink = document.createElement('a');
          jLink.href = jPath;
          jLink.className = 'journey-pill';
          jLink.textContent = (j.title || j.id).replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
          jLink.target = '_blank';
          jLinks.appendChild(jLink);
        });
        if (brand._journeys.length > 5) {
          var more = document.createElement('span');
          more.className = 'journey-pill more';
          more.textContent = '+' + (brand._journeys.length - 5) + ' more';
          jLinks.appendChild(more);
        }
        card.appendChild(jLinks);
      }

      brandGrid.appendChild(card);
    });

    group.appendChild(brandGrid);
    container.appendChild(group);
  });
}

function renderRuntimeMode() {
  var staticSection = document.getElementById('staticSection');
  var runtimeSection = document.getElementById('runtimeSection');
  if (staticSection) staticSection.style.display = 'none';
  if (runtimeSection) runtimeSection.style.display = 'block';
  document.getElementById('modeIndicator').textContent = 'Runtime mode - upload assets and generate custom demos';
  setupRuntimeJourneySelection();
}

function setupRuntimeJourneySelection() {
  var list = document.getElementById('journeyList');
  if (!list) return;

  var options = list.querySelectorAll('.runtime-journey-option');
  options.forEach(function(option) {
    var input = option.querySelector('input[type="checkbox"]');
    if (!input) return;
    if (option.dataset.selectionBound === 'true') return;
    option.dataset.selectionBound = 'true';

    function syncSelectedState() {
      option.classList.toggle('selected', input.checked);
      option.setAttribute('aria-checked', input.checked ? 'true' : 'false');
    }

    input.addEventListener('change', syncSelectedState);
    option.addEventListener('click', function() {
      setTimeout(syncSelectedState, 0);
    });
    syncSelectedState();
  });
}

async function ensureRuntimeSession() {
  if (window._activeSessionId) return window._activeSessionId;
  var industryInput = document.getElementById('runtimeIndustryInput');
  var industry = industryInput && industryInput.value ? industryInput.value : 'Cement';
  try {
    var res = await fetch(API_BASE + '/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: 'Runtime Demo',
        industry: industry
      })
    });
    var data = await res.json();
    if (data && data.sessionId) {
      window._activeSessionId = data.sessionId;
      var box = document.getElementById('sessionBox');
      if (box) {
        box.textContent = 'Session: ' + data.sessionId + ' (expires ' + (data.expiresAt ? new Date(data.expiresAt).toLocaleString() : 'soon') + ')';
      }
      return data.sessionId;
    }
  } catch (e) {
    console.warn('Could not create runtime session:', e);
  }
  return null;
}

async function init() {
  var mode = await detectMode();
  if (mode === 'static') {
    var brands = await loadBrands();
    var allJourneys = await loadAllJourneys();
    renderStaticMode(brands, allJourneys);
  } else {
    renderRuntimeMode();
    await ensureRuntimeSession();
  }
  setupRuntimeJourneySelection();

  if (window.DemoRenderer) {
    DemoRenderer.loadPack().then(function() {
      if (window.demoUI) demoUI.renderJourneyCards();
    });
    if (window.demoUI) demoUI.init();
  }
}

document.addEventListener('DOMContentLoaded', init);
