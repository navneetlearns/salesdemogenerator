/* Demo Generator -- Upload-based Frontend (public/app.js) */
(function () {
  'use strict';
  var API = window.location.origin;
  var STATE = { sessionId: null, brandName: null, generatedFiles: [], polling: false };
  function $(id) { return document.getElementById(id); }
  function setStatus(msg, type) {
    var el = $('uploadStatus') || $('genStatus');
    if (!el) return;
    el.textContent = msg; el.className = 'muted';
    if (type === 'error') el.style.color = '#d32f2f';
    else if (type === 'success') el.style.color = '#2e7d32';
    else el.style.color = '';
  }
  function setGenStatus(msg, type) {
    var el = $('genStatus');
    if (!el) return;
    el.textContent = msg; el.className = 'muted';
    if (type === 'error') el.style.color = '#d32f2f';
    else if (type === 'success') el.style.color = '#2e7d32';
    else el.style.color = '';
  }
  function setExportStatus(msg, type) {
    var el = $('exportStatus');
    if (!el) return;
    el.textContent = msg; el.className = 'muted';
    if (type === 'error') el.style.color = '#d32f2f';
    else if (type === 'success') el.style.color = '#2e7d32';
    else el.style.color = '';
  }
  function btn(elId, disabled) { var b = $(elId); if (b) b.disabled = !!disabled; }
  function journeyNames() {
    var c = document.querySelectorAll('#journeyList input:checked');
    return Array.prototype.map.call(c, function (x) { return x.value; });
  }
  async function initSession() {
    var box = $('sessionBox');
    try {
      var r = await fetch(API + '/api/session/create', { method: 'POST' });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      STATE.sessionId = d.sessionId;
      box.textContent = 'Session: ' + d.sessionId.slice(0, 8) + '...';
      box.style.color = '#2e7d32';
      btn('uploadLogoBtn', false); btn('uploadCatalogBtn', false);
    } catch (e) { box.textContent = 'Failed: ' + e.message; box.style.color = '#d32f2f'; }
  }
  async function uploadLogo() {
    var f = $('logoInput').files[0];
    if (!f) { setStatus('Select a logo file', 'error'); return; }
    btn('uploadLogoBtn', true); setStatus('Uploading logo...', '');
    try {
      var fd = new FormData(); fd.append('sessionId', STATE.sessionId); fd.append('logo', f);
      var r = await fetch(API + '/api/upload/logo', { method: 'POST', body: fd });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setStatus('Logo uploaded: ' + d.saved, 'success');
    } catch (e) { setStatus('Error: ' + e.message, 'error'); }
    finally { btn('uploadLogoBtn', false); }
  }
  async function uploadCatalog() {
    var f = $('catalogInput').files[0];
    if (!f) { setStatus('Select a catalog file', 'error'); return; }
    btn('uploadCatalogBtn', true); setStatus('Uploading catalog...', '');
    try {
      var fd = new FormData(); fd.append('sessionId', STATE.sessionId); fd.append('catalog', f);
      var r = await fetch(API + '/api/upload/catalog', { method: 'POST', body: fd });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setStatus('Catalog uploaded: ' + d.saved, 'success');
    } catch (e) { setStatus('Error: ' + e.message, 'error'); }
    finally { btn('uploadCatalogBtn', false); }
  }
  async function generate() {
    var j = journeyNames();
    if (j.length === 0) { setGenStatus('Select at least one journey', 'error'); return; }
    if (!STATE.sessionId) { setGenStatus('No session', 'error'); return; }
    btn('generateBtn', true);
    $('generateBtn').textContent = 'Generating...';
    $('previewLinks').innerHTML = 'Generating...';
    $('previewLinks').className = 'muted';
    setGenStatus('Starting...', '');
    try {
      var r = await fetch(API + '/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: STATE.sessionId, journeys: j })
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setGenStatus('Generation started, waiting...', '');
      STATE.generatedFiles = [];
      await pollSession(STATE.sessionId);
    } catch (e) { setGenStatus('Error: ' + e.message, 'error'); btn('generateBtn', false); $('generateBtn').textContent = 'Generate'; }
  }
  async function pollSession(sid) {
    STATE.polling = true;
    for (var i = 0; i < 90 && STATE.polling; i++) {
      await new Promise(function (r) { setTimeout(r, 2000); });
      try {
        var r = await fetch(API + '/api/session/' + sid);
        var d = await r.json();
        if (!r.ok) continue;
        if (d.status === 'complete') {
          STATE.generatedFiles = (d.generatedFiles || []).filter(function (f) { return f.file && f.file.endsWith('.html'); });
          STATE.brandName = d.metadata && d.metadata.brandName;
          showPreview(sid, STATE.generatedFiles);
          setGenStatus('Complete! ' + STATE.generatedFiles.length + ' journey(s).', 'success');
          btn('generateBtn', false); $('generateBtn').textContent = 'Generate';
          STATE.polling = false; return;
        }
        if (d.status === 'failed') {
          var m = 'Generation failed';
          if (d.metadata && d.metadata.error) m += ': ' + d.metadata.error;
          setGenStatus(m, 'error'); $('previewLinks').innerHTML = m;
          btn('generateBtn', false); $('generateBtn').textContent = 'Generate';
          STATE.polling = false; return;
        }
        if (i % 5 === 0) setGenStatus('Generating... (' + Math.round(i/90*100) + '%)', '');
      } catch (_) {}
    }
    setGenStatus('Timed out', 'error'); $('previewLinks').innerHTML = 'Timed out';
    btn('generateBtn', false); $('generateBtn').textContent = 'Generate';
    STATE.polling = false;
  }
  function showPreview(sid, files) {
    var c = $('previewLinks');
    c.className = ''; c.innerHTML = '';
    if (!files || files.length === 0) { c.innerHTML = 'No files.'; c.className = 'muted'; return; }
    files.forEach(function (f) {
      var n = f.file.replace('.html','').replace(/_/g,' ').replace(/\w/g,function(c){return c.toUpperCase();});
      var a = document.createElement('a');
      a.href = API + '/api/preview/' + sid + '/' + f.file.replace('.html','');
      a.target = '_blank'; a.textContent = n;
      a.style.cssText = 'display:inline-block;padding:8px 16px;margin:4px;background:#075e54;color:white;text-decoration:none;border-radius:6px;font-size:13px;';
      a.onmouseover = function () { this.style.background = '#054d44'; };
      a.onmouseout = function () { this.style.background = '#075e54'; };
      c.appendChild(a);
    });
    var card = document.querySelector('.card:last-of-type');
    if (card) card.style.display = 'block';
  }
  async function exportDemo(mode) {
    if (!STATE.sessionId || STATE.generatedFiles.length === 0) { setExportStatus('Generate first', 'error'); return; }
    var label = mode === 'single' ? 'Single HTML' : 'ZIP';
    setExportStatus('Preparing ' + label + '...', '');
    btn('exportSingleBtn', true); btn('exportZipBtn', true);
    try {
      var r = await fetch(API + '/api/export/' + STATE.sessionId, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode })
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      var a = document.createElement('a');
      a.href = API + '/api/export/' + STATE.sessionId + '/' + mode;
      a.download = ''; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setExportStatus('Downloaded: ' + (d.totalBytes/1024).toFixed(1) + ' KB', 'success');
    } catch (e) { setExportStatus('Error: ' + e.message, 'error'); }
    finally { btn('exportSingleBtn', false); btn('exportZipBtn', false); }
  }
  async function runLocally() {
    if (!STATE.sessionId || STATE.generatedFiles.length === 0) { setExportStatus('Generate first', 'error'); return; }
    setExportStatus('Downloading self-contained demo...', '');
    btn('runLocalBtn', true);
    try {
      var r = await fetch(API + '/api/export/' + STATE.sessionId, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single' })
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      var a = document.createElement('a');
      a.href = API + '/api/export/' + STATE.sessionId + '/single';
      a.download = ''; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setExportStatus('Downloaded ' + (d.totalBytes/1024).toFixed(1) + ' KB -- open .html in browser', 'success');
    } catch (e) { setExportStatus('Error: ' + e.message, 'error'); }
    finally { btn('runLocalBtn', false); }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var row = document.querySelector('.card:last-of-type .row');
    if (row) {
      var rb = document.createElement('button');
      rb.id = 'runLocalBtn'; rb.className = 'btn'; rb.textContent = 'Run Locally';
      rb.onclick = runLocally;
      rb.style.cssText = 'padding:8px 12px;border-radius:8px;border:2px solid #075e54;background:#fff;color:#075e54;cursor:pointer;font-weight:600;flex:1';
      row.appendChild(rb);
    }
    var card = document.querySelector('.card:last-of-type');
    if (card) card.style.display = 'none';
    initSession();
  });
  window.uploadLogo = uploadLogo; window.uploadCatalog = uploadCatalog;
  window.generate = generate; window.exportDemo = exportDemo;
  window.runLocally = runLocally;
})();
