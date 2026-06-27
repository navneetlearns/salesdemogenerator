// Demo Generator - Frontend App
// Supports two modes: static (Vercel) and runtime (local server)

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

async function loadJourneys(brand) {
  try {
    const res = await fetch(API_BASE + '/api/journeys.json?brand=' + brand);
    return await res.json();
  } catch (e) {
    console.error('Failed to load journeys:', e);
    return null;
  }
}

function renderStaticMode(brands) {
  document.getElementById('modeIndicator').textContent = 'Static mode - viewing pre-built demos';
  const container = document.getElementById('brandList');
  if (!container) return;

  container.innerHTML = '';
  if (!brands.length) {
    container.innerHTML = '<p class="muted">No pre-built brand journeys found. Run the build, then refresh this page.</p>';
    return;
  }

  brands.forEach(function(brand) {
    const card = document.createElement('details');
    card.className = 'brand-card brand-details';

    const summary = document.createElement('summary');
    summary.className = 'brand-summary';

    const title = document.createElement('span');
    title.className = 'brand-summary-title';
    title.textContent = brand.id.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });

    const count = document.createElement('span');
    count.className = 'brand-summary-count';
    count.textContent = (brand.journeys || []).length + ' journeys';

    summary.appendChild(title);
    summary.appendChild(count);
    card.appendChild(summary);

    const links = document.createElement('div');
    links.className = 'journey-links grid';
    (brand.journeys || []).forEach(function(j) {
      const btn = document.createElement('a');
      btn.href = j.url;
      btn.className = 'btn primary';
      btn.target = '_blank';
      btn.textContent = j.name;
      links.appendChild(btn);
    });
    card.appendChild(links);
    container.appendChild(card);
  });
}

function renderRuntimeMode() {
  const staticSection = document.getElementById('staticSection');
  const runtimeSection = document.getElementById('runtimeSection');
  if (staticSection) staticSection.style.display = 'none';
  if (runtimeSection) runtimeSection.style.display = 'block';
  document.getElementById('modeIndicator').textContent = 'Runtime mode - upload assets and generate custom demos';
  setupRuntimeJourneySelection();
}

function setupRuntimeJourneySelection() {
  const list = document.getElementById('journeyList');
  if (!list) return;

  const options = list.querySelectorAll('.runtime-journey-option');
  options.forEach(function(option) {
    const input = option.querySelector('input[type="checkbox"]');
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
  const industryInput = document.getElementById('runtimeIndustryInput');
  const industry = industryInput && industryInput.value ? industryInput.value : 'Cement';
  try {
    const res = await fetch(API_BASE + '/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: 'Runtime Demo',
        industry: industry
      })
    });
    const data = await res.json();
    if (data && data.sessionId) {
      window._activeSessionId = data.sessionId;
      const box = document.getElementById('sessionBox');
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
  const mode = await detectMode();
  if (mode === 'static') {
    const brands = await loadBrands();
    renderStaticMode(brands);
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
