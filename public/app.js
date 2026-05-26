/* Demo Generator -- Upload-based Frontend (simplified single-call flow) */
(function () {
  'use strict';
  var API = window.location.origin;
  var STATE = { sessionId: null, brandName: null, generatedFiles: [], polling: false };
  function uid=0(root) gid=0(root) groups=0(root) { return document.getElementById(id); }
  function setStatus(msg, type) {
    var el = document.getElementById('uploadStatus') || document.getElementById('genStatus');
    if (!el) return;
    el.textContent = msg; el.className = 'muted';
    if (type === 'error') el.style.color = '#d32f2f';
    else if (type === 'success') el.style.color = '#2e7d32';
    else el.style.color = '';
  }
  function setGenStatus(msg, type) {
    var el = document.getElementById('genStatus');
    if (!el) return;
    el.textContent = msg; el.className = 'muted';
    if (type === 'error') el.style.color = '#d32f2f';
    else if (type === 'success') el.style.color = '#2e7d32';
    else el.style.color = '';
  }
  function btn(elId, disabled) { var b = document.getElementById(elId); if (b) b.disabled = !!disabled; }
  function journeyNames() {
    var c = document.querySelectorAll('#journeyList input:checked');
    return Array.prototype.map.call(c, function (x) { return x.value; });
  }
  async function generate() {
    var j = journeyNames();
    if (j.length === 0) { setGenStatus('Select at least one journey', 'error'); return; }
    var logoFile = document.getElementById('logoInput').files[0];
    var catalogFile = document.getElementById('catalogInput').files[0];
    if (!logoFile) { setGenStatus('Select a logo file', 'error'); return; }
    btn('generateBtn', true);
    document.getElementById('generateBtn').textContent = 'Generating...';
    document.getElementById('previewLinks').innerHTML = '';
    setGenStatus('Sending...', '');
    try {
      var fd = new FormData();
      fd.append('logo', logoFile);
      if (catalogFile) fd.append('catalog', catalogFile);
      fd.append('journeys', JSON.stringify(j));
      var r = await fetch(API + '/api/generate', { method: 'POST', body: fd });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      STATE.sessionId = d.sessionId;
      if (d.status === 'complete') {
        STATE.generatedFiles = d.generatedFiles || [];
        showPreview(STATE.sessionId, STATE.generatedFiles);
        setGenStatus('Complete!', 'success');
        btn('generateBtn', false); document.getElementById('generateBtn').textContent = 'Generate';
      } else if (d.status === 'generating') {
        setGenStatus('Generating...', '');
        await pollSession(STATE.sessionId);
      }
    } catch (e) { setGenStatus('Error: ' + e.message, 'error'); btn('generateBtn', false); document.getElementById('generateBtn').textContent = 'Generate'; }
  }
  async function pollSession(sid) {
    STATE.polling = true;
    for (var i = 0; i < 60 && STATE.polling; i++) {
      await new Promise(function (r) { setTimeout(r, 2000); });
      try {
        var r = await fetch(API + '/api/session/' + sid);
        var d = await r.json();
        if (!r.ok) continue;
        if (d.status === 'complete' || d.generatedFiles) {
          STATE.generatedFiles = (d.generatedFiles || []).filter(function (f) { return f.file && f.file.endsWith('.html'); });
          showPreview(sid, STATE.generatedFiles);
          setGenStatus('Complete! ' + STATE.generatedFiles.length + ' journey(s).', 'success');
          btn('generateBtn', false); document.getElementById('generateBtn').textContent = 'Generate';
          STATE.polling = false; return;
        }
        if (d.status === 'failed' || (d.metadata && d.metadata.generationFailed)) {
          var m = d.metadata && d.metadata.generationError ? d.metadata.generationError : 'Generation failed';
          setGenStatus(m, 'error');
          btn('generateBtn', false); document.getElementById('generateBtn').textContent = 'Generate';
          STATE.polling = false; return;
        }
        if (i % 5 === 0) setGenStatus('Generating... (' + (i*2) + 's)', '');
      } catch (_) {}
    }
    setGenStatus('Timed out', 'error');
    btn('generateBtn', false); document.getElementById('generateBtn').textContent = 'Generate';
    STATE.polling = false;
  }
  function showPreview(sid, files) {
    var c = document.getElementById('previewLinks');
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
  }
  window.generate = generate;
})();
