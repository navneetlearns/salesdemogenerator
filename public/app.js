/* Demo Generator -- Upload-based Frontend */
(function () {
  "use strict";
  var API = window.location.origin;
  var STATE = { sessionId: null, brandName: null, generatedFiles: [], polling: false };
  var $ = function(id) { return document.getElementById(id); };

  function setGenStatus(msg, type) {
    var el = ;
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === "error" ? "#d32f2f" : type === "success" ? "#2e7d32" : "";
  }
  function setExportStatus(msg, type) {
    var el = ;
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === "error" ? "#d32f2f" : type === "success" ? "#2e7d32" : "";
  }
  function btn(id, disabled) { var b = uid=0(root) gid=0(root) groups=0(root); if (b) b.disabled = !!disabled; }
  function journeyNames() {
    var c = document.querySelectorAll("#journeyList input:checked");
    return Array.prototype.map.call(c, function (x) { return x.value; });
  }
  function showCard(id) { var el = uid=0(root) gid=0(root) groups=0(root); if (el) el.style.display = ""; }

  async function generate() {
    var j = journeyNames();
    if (j.length === 0) { setGenStatus("Select at least one journey", "error"); return; }
    var logoFile = .files[0];
    if (!logoFile) { setGenStatus("Select a logo file", "error"); return; }
    btn("generateBtn", true);
    .textContent = "Generating...";
    .innerHTML = "";
    setGenStatus("Uploading and generating...", "");
    try {
      var fd = new FormData();
      fd.append("logo", logoFile);
      var catFile = .files[0];
      if (catFile) fd.append("catalog", catFile);
      fd.append("journeys", JSON.stringify(j));
      var bn = .value.trim();
      if (bn) fd.append("brandName", bn);
      var r = await fetch(API + "/api/generate", { method: "POST", body: fd });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
      STATE.sessionId = d.sessionId;
      if (d.status === "complete") {
        afterGenerate(d);
      } else if (d.status === "generating") {
        setGenStatus("Generating...", "");
        await pollSession(STATE.sessionId);
      } else if (d.status === "failed") {
        throw new Error(d.error || "Generation failed");
      } else {
        setGenStatus("Waiting for generation...", "");
        await pollSession(STATE.sessionId);
      }
    } catch (e) { setGenStatus("Error: " + e.message, "error"); }
    btn("generateBtn", false);
    .textContent = "Generate Demos";
  }

  function afterGenerate(data) {
    STATE.generatedFiles = data.generatedFiles || [];
    STATE.brandName = data.metadata && data.metadata.brandName;
    showPreview(STATE.sessionId, STATE.generatedFiles);
    setGenStatus("Complete! " + STATE.generatedFiles.length + " journey(s).", "success");
    showCard("previewCard");
    showCard("exportCard");
  }

  async function pollSession(sid) {
    STATE.polling = true;
    for (var i = 0; i < 60 && STATE.polling; i++) {
      await new Promise(function (r) { setTimeout(r, 2000); });
      try {
        var r = await fetch(API + "/api/session/" + sid);
        if (!r.ok) continue;
        var d = await r.json();
        if (d.status === "complete" || d.generatedFiles) {
          afterGenerate(d);
          STATE.polling = false; return;
        }
        if (d.status === "failed" || (d.metadata && d.metadata.generationFailed)) {
          var m = d.metadata && d.metadata.generationError || "Generation failed";
          setGenStatus(m, "error");
          STATE.polling = false; return;
        }
        if (i % 5 === 0) setGenStatus("Generating... (" + (i*2) + "s)", "");
      } catch (_) {}
    }
    if (STATE.polling) { setGenStatus("Timed out", "error"); STATE.polling = false; }
  }

  function showPreview(sid, files) {
    var c = ;
    c.innerHTML = "";
    if (!files || files.length === 0) { c.innerHTML = "No journeys generated."; return; }
    files.forEach(function (f) {
      var n = f.file.replace(".html","").replace(/_/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();});
      var a = document.createElement("a");
      a.href = API + "/api/preview/" + sid + "/" + f.file.replace(".html","");
      a.target = "_blank"; a.textContent = n;
      a.style.cssText = "display:inline-block;padding:8px 16px;margin:4px;background:#075e54;color:white;text-decoration:none;border-radius:6px;font-size:13px;";
      a.onmouseover = function () { this.style.background = "#054d44"; };
      a.onmouseout = function () { this.style.background = "#075e54"; };
      c.appendChild(a);
    });
  }

  async function exportDemo(mode) {
    if (!STATE.sessionId || STATE.generatedFiles.length === 0) { setExportStatus("Generate first", "error"); return; }
    btn("exportSingleBtn", true); btn("exportZipBtn", true);
    var label = mode === "zip" ? "ZIP" : "HTML";
    setExportStatus("Preparing " + label + "...", "");
    try {
      var r = await fetch(API + "/api/export/" + STATE.sessionId, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: mode })
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      var a = document.createElement("a");
      a.href = API + "/api/export/" + STATE.sessionId + "/" + mode;
      a.download = ""; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setExportStatus("Downloaded (" + (d.totalBytes ? (d.totalBytes/1024).toFixed(1) : "?") + " KB)", "success");
    } catch (e) { setExportStatus("Error: " + e.message, "error"); }
    btn("exportSingleBtn", false); btn("exportZipBtn", false);
  }

  window.generate = generate;
  window.exportDemo = exportDemo;
})();
