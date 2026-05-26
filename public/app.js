/* Demo Generator -- Upload-based Frontend */
(function () {
  "use strict";
  const API = window.location.origin;
  const STATE = { sessionId: null, generatedFiles: [], polling: false };
  const $ = id => document.getElementById(id);

  function setText(id, msg, type) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = type === 'error' ? '#d32f2f' : type === 'success' ? '#2e7d32' : '';
  }

  function disableBtn(id, disabled) {
    const b = $(id);
    if (b) b.disabled = !!disabled;
  }

  function journeyNames() {
    return Array.from(document.querySelectorAll('#journeyList input:checked')).map(c => c.value);
  }

  async function createSession() {
    try {
      setText('sessionBox', 'Creating session...');
      const res = await fetch(API + '/api/session/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');
      STATE.sessionId = data.sessionId;
      setText('sessionBox', 'Session: ' + STATE.sessionId);
      return data;
    } catch (err) {
      setText('sessionBox', 'Session error: ' + err.message, 'error');
      throw err;
    }
  }

  async function uploadFile(url, file, fieldName) {
    const form = new FormData();
    form.append('sessionId', STATE.sessionId);
    form.append(fieldName, file, file.name);
    const res = await fetch(API + url, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  async function uploadLogo() {
    const input = $('logoInput');
    const file = input.files && input.files[0];
    if (!file) { setText('uploadStatus', 'Select a logo file first', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { setText('uploadStatus', 'Logo must be < 2MB', 'error'); return; }
    disableBtn('uploadLogoBtn', true);
    setText('uploadStatus', 'Uploading logo...');
    try {
      await ensureSession();
      await uploadFile('/api/upload/logo', file, 'logo');
      setText('uploadStatus', 'Logo uploaded', 'success');
    } catch (e) { setText('uploadStatus', 'Logo upload error: ' + e.message, 'error'); }
    disableBtn('uploadLogoBtn', false);
  }

  async function uploadCatalog() {
    const input = $('catalogInput');
    const file = input.files && input.files[0];
    if (!file) { setText('uploadStatus', 'Select a catalog file first', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { setText('uploadStatus', 'Catalog must be < 5MB', 'error'); return; }
    const allowed = ['.csv', '.xlsx', '.json'];
    const name = file.name.toLowerCase();
    if (!allowed.some(ext => name.endsWith(ext))) { setText('uploadStatus', 'Catalog must be csv, xlsx or json', 'error'); return; }
    disableBtn('uploadCatalogBtn', true);
    setText('uploadStatus', 'Uploading catalog...');
    try {
      await ensureSession();
      await uploadFile('/api/upload/catalog', file, 'catalog');
      setText('uploadStatus', 'Catalog uploaded', 'success');
    } catch (e) { setText('uploadStatus', 'Catalog upload error: ' + e.message, 'error'); }
    disableBtn('uploadCatalogBtn', false);
  }

  async function ensureSession() {
    if (!STATE.sessionId) await createSession();
  }

  async function generate() {
    const journeys = journeyNames();
    if (journeys.length === 0) { setText('genStatus', 'Select at least one journey', 'error'); return; }
    await ensureSession();
    disableBtn('generateBtn', true);
    setText('genStatus', 'Starting generation...');
    try {
      const res = await fetch(API + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: STATE.sessionId, journeys: journeys }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      setText('genStatus', 'Generation started');
      await pollSession(STATE.sessionId);
    } catch (e) { setText('genStatus', 'Generate error: ' + e.message, 'error'); }
    disableBtn('generateBtn', false);
  }

  async function pollSession(sid) {
    setText('genStatus', 'Waiting for generation...');
    STATE.polling = true;
    for (let i = 0; i < 60 && STATE.polling; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const r = await fetch(API + '/api/session/' + sid);
        if (!r.ok) continue;
        const d = await r.json();
        if (d.status === 'complete') { STATE.generatedFiles = d.generatedFiles || []; showPreview(sid, STATE.generatedFiles); setText('genStatus', 'Generation complete', 'success'); STATE.polling = false; return; }
        if (d.status === 'failed') { setText('genStatus', 'Generation failed', 'error'); STATE.polling = false; return; }
        setText('genStatus', 'Generating...');
      } catch (e) { /* ignore transient */ }
    }
    if (STATE.polling) { setText('genStatus', 'Generation timed out', 'error'); STATE.polling = false; }
  }

  function showPreview(sid, files) {
    const el = $('previewLinks');
    el.innerHTML = '';
    if (!files || files.length === 0) { el.textContent = 'No journeys generated.'; return; }
    files.forEach(f => {
      const name = (f.file || f).replace(/\.html$/, '').replace(/_/g, ' ');
      const a = document.createElement('a');
      a.href = API + '/api/preview/' + sid + '/' + (f.file ? f.file.replace(/\.html$/, '') : f);
      a.target = '_blank';
      a.textContent = name.replace(/\b\w/g, c => c.toUpperCase());
      a.className = 'btn';
      a.style.margin = '4px';
      el.appendChild(a);
    });
  }

  async function exportDemo(mode) {
    if (!STATE.sessionId) { setText('exportStatus', 'Generate first', 'error'); return; }
    setText('exportStatus', 'Preparing export...');
    try {
      const r = await fetch(API + '/api/export/' + STATE.sessionId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Export failed');
      const url = API + '/api/export/download/' + STATE.sessionId + '/' + mode;
      window.open(url, '_blank');
      setText('exportStatus', 'Export started', 'success');
    } catch (e) { setText('exportStatus', 'Export error: ' + e.message, 'error'); }
  }

  // Wire global handlers
  window.uploadLogo = uploadLogo;
  window.uploadCatalog = uploadCatalog;
  window.generate = generate;
  window.exportDemo = exportDemo;

  // create session on load
  window.addEventListener('load', function () { createSession().catch(()=>{}); });

})();
