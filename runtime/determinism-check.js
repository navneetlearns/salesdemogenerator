const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

async function snapshotDir(dir) {
  const files = [];
  async function walk(p) {
    const entries = await fs.readdir(p);
    for (const e of entries) {
      const fp = path.join(p, e);
      const stat = await fs.stat(fp);
      if (stat.isDirectory()) await walk(fp);
      else files.push(path.relative(dir, fp).replace(/\\/g, '/'));
    }
  }
  await walk(dir);
  files.sort();
  const hashes = {};
  for (const f of files) {
    const buf = await fs.readFile(path.join(dir, f));
    const h = crypto.createHash('sha256').update(buf).digest('hex');
    hashes[f] = h;
  }
  return hashes;
}

async function compareSnapshots(aDir, bDir) {
  const a = await snapshotDir(aDir);
  const b = await snapshotDir(bDir);
  const diffs = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of [...keys].sort()) {
    if (!a[k]) diffs.push({ file: k, a: null, b: b[k] });
    else if (!b[k]) diffs.push({ file: k, a: a[k], b: null });
    else if (a[k] !== b[k]) diffs.push({ file: k, a: a[k], b: b[k] });
  }
  return diffs;
}

module.exports = { snapshotDir, compareSnapshots };
