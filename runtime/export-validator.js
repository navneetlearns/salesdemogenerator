const fs = require('fs-extra');
const path = require('path');

function findExternalUrls(html) {
  const re = /(?:src|href)=["']([^"']+)["']/ig;
  const matches = [];
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^https?:\/\//i.test(url) && !/^data:/i.test(url)) matches.push(url);
  }
  return matches;
}

async function validateExport(session) {
  const genDir = session.paths.generated;
  const exportDir = path.join(session.paths.root, 'exports');
  if (!await fs.pathExists(exportDir)) throw new Error('No exports found');

  // Scan exported HTML files for external references and missing assets
  const htmlFiles = (await fs.readdir(exportDir)).filter(f=>f.endsWith('.html') || f.endsWith('.htm'));
  for (const hf of htmlFiles) {
    const content = await fs.readFile(path.join(exportDir,hf),'utf8');
    const externals = findExternalUrls(content);
    if (externals.length>0) throw new Error('External resources found in export: ' + externals.slice(0,5).join(', '));

    // Check linked local assets referenced by src/href
    const re = /(?:src|href)=["']([^"']+)["']/ig;
    let m;
    while ((m = re.exec(content))) {
      const ref = m[1];
      if (/^https?:\/\//i.test(ref) || /^data:/i.test(ref)) continue;
      const candidate = path.join(exportDir, ref);
      if (!await fs.pathExists(candidate)) {
        // Also check in generated and assets directories
        const gcandidate = path.join(genDir, ref);
        if (!await fs.pathExists(gcandidate)) throw new Error('Missing asset in export: ' + ref);
      }
    }
  }
  return true;
}

module.exports = { validateExport };
