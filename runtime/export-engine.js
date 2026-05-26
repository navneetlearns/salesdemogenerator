const fs = require('fs-extra');
const path = require('path');
const { getSession } = require('./session-manager');

async function exportSession(sessionId, mode) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found: ' + sessionId);

  const exportDir = path.join(session.paths.root, 'exports');
  await fs.ensureDir(exportDir);
  const brandId = session.metadata.brandId || 'brand';
  const brandName = session.metadata.brandName || brandId;
  const generatedDir = session.paths.generated;
  const files = [];

  if (mode === 'single') {
    const journeys = [];
    if (await fs.pathExists(generatedDir)) {
      for (const f of await fs.readdir(generatedDir)) {
        if (f.endsWith('.html')) journeys.push(f);
      }
    }

    var parts = [];
    parts.push('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">');
    parts.push('<meta name="viewport" content="width=device-width,initial-scale=1.0">');
    parts.push('<title>' + brandName + ' - Demo Export</title>');
    parts.push('<style>body{font-family:sans-serif;margin:0;padding:20px;background:#f5f5f5}');
    parts.push('.nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}');
    parts.push('.nav a{padding:8px 16px;background:#075e54;color:white;text-decoration:none;border-radius:4px;font-size:14px}');
    parts.push('.nav a:hover{background:#054d44}iframe{width:100%;height:90vh;border:1px solid #ddd;border-radius:4px;background:white}</style></head><body>');
    parts.push('<h2>' + brandName + ' - Demo Journeys</h2>');
    parts.push('<div class="nav" id="navBar">');

    for (const jf of journeys) {
      var name = jf.replace('.html', '').replace(/_/g, ' ');
      var jid = jf.replace('.html', '');
      parts.push('<a href="#" data-jid="' + jid + '">' + name + '</a>');
    }
    parts.push('</div>');

    for (const jf of journeys) {
      var jid = jf.replace('.html', '');
      var display = jid === journeys[0].replace('.html', '') ? 'block' : 'none';
      var content = await fs.readFile(path.join(generatedDir, jf), 'utf8');
      parts.push('<div class="jf" id="j-' + jid + '" style="display:' + display + '">' + content + '</div>');
    }

    parts.push('<script>' +
      'document.getElementById("navBar").addEventListener("click",function(e){' +
      'var el=e.target;if(el.tagName==="A"&&el.hasAttribute("data-jid")){' +
      'document.querySelectorAll(".jf").forEach(function(p){p.style.display="none"});' +
      'var t=document.getElementById("j-"+el.getAttribute("data-jid"));if(t)t.style.display="block";}});' +
    '</script></body></html>');

    var masterHtml = parts.join('\n');
    var singlePath = path.join(exportDir, brandId + '-demo.html');
    await fs.writeFile(singlePath, masterHtml, 'utf8');
    files.push({ path: singlePath, type: 'single-html', bytes: masterHtml.length });

  } else if (mode === 'zip') {
    try {
      var JSZip = require('jszip');
      var zip = new JSZip();

      if (await fs.pathExists(generatedDir)) {
        for (const f of await fs.readdir(generatedDir)) {
          if (f.endsWith('.html')) zip.file('journeys/' + f, await fs.readFile(path.join(generatedDir, f), 'utf8'));
        }
      }

      var distDir = path.join(session.paths.root, 'dist');
      if (await fs.pathExists(distDir)) { await addDirToZip(zip, distDir, 'assets'); }
      if (await fs.pathExists(session.paths.assets)) { await addDirToZip(zip, session.paths.assets, 'source-assets'); }

      var idxHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">';
      idxHtml += '<meta name="viewport" content="width=device-width,initial-scale=1.0">';
      idxHtml += '<title>' + brandName + ' Demo</title>';
      idxHtml += '<style>body{font-family:sans-serif;padding:20px;background:#f5f5f5}';
      idxHtml += 'ul{list-style:none;padding:0}li{margin:8px 0}';
      idxHtml += 'a{display:block;padding:12px 20px;background:#075e54;color:white;text-decoration:none;border-radius:6px;font-size:16px;max-width:400px}';
      idxHtml += 'a:hover{background:#054d44}</style></head><body>';
      idxHtml += '<h2>' + brandName + ' Demo Package</h2>';
      idxHtml += '<p>Open a journey below. No internet required.</p><ul>';

      if (await fs.pathExists(generatedDir)) {
        for (const f of await fs.readdir(generatedDir)) {
          if (f.endsWith('.html')) {
            var name2 = f.replace('.html', '').replace(/_/g, ' ');
            idxHtml += '<li><a href="journeys/' + f + '">' + name2 + '</a></li>';
          }
        }
      }
      idxHtml += '</ul></body></html>';
      zip.file('index.html', idxHtml);

      var zipPath = path.join(exportDir, 'demo-package.zip');
      var zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      await fs.writeFile(zipPath, zipBuf);
      files.push({ path: zipPath, type: 'zip', bytes: zipBuf.length });
    } catch (zipErr) {
      console.warn('[export] ZIP generation failed:', zipErr.message);
      throw zipErr;
    }
  }

  var totalBytes = files.reduce(function(s, f) { return s + f.bytes; }, 0);
  return { files: files, totalBytes: totalBytes, paths: files.map(function(f) { return f.path; }), mode: mode };
}

async function addDirToZip(zip, dirPath, zipPath) {
  var entries = await fs.readdir(dirPath);
  for (const entry of entries) {
    var fullPath = path.join(dirPath, entry);
    var stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await addDirToZip(zip, fullPath, zipPath + '/' + entry);
    } else {
      zip.file(zipPath + '/' + entry, await fs.readFile(fullPath));
    }
  }
}

module.exports = { exportSession };
