// Demo Generator - Frontend App
// Supports two modes: static (Vercel) and runtime (local server)

const API_BASE = window.location.origin;

async function detectMode() {
  try {
    const res = await fetch(API_BASE + '/api/health');
    const data = await res.json();
    return data.mode || 'static';
  } catch (e) {
    return 'static';
  }
}

async function loadBrands() {
  try {
    const res = await fetch(API_BASE + '/api/brands');
    const data = await res.json();
    return data.brands || [];
  } catch (e) {
    console.error('Failed to load brands:', e);
    return [];
  }
}

async function loadJourneys(brand) {
  try {
    const res = await fetch(API_BASE + '/api/journeys?brand=' + brand);
    return await res.json();
  } catch (e) {
    console.error('Failed to load journeys:', e);
    return null;
  }
}

function renderStaticMode(brands) {
  document.getElementById('modeIndicator').textContent = 'Static mode — viewing pre-built demos';
  const container = document.getElementById('brandList');
  if (!container) return;
  
  container.innerHTML = '';
  brands.forEach(function(brand) {
    const card = document.createElement('div');
    card.className = 'brand-card';
    
    const title = document.createElement('h3');
    title.textContent = brand.id.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    card.appendChild(title);
    
    const links = document.createElement('div');
    links.className = 'journey-links grid';
    brand.journeys.forEach(function(j) {
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
  document.getElementById('modeIndicator').textContent = 'Runtime mode — upload assets and generate custom demos';
}

async function init() {
  const mode = await detectMode();
  if (mode === 'static') {
    const brands = await loadBrands();
    renderStaticMode(brands);
  } else {
    renderRuntimeMode();
  }
}

document.addEventListener('DOMContentLoaded', init);
