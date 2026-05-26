const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const { validateLogo } = require('./validate-assets');
const { normalizeImage } = require('../assets/normalize-image');

const LOGO_NAME = 'logo.webp';

function safeFilename(name) {
  return name.replace(/[^a-z0-9.\-_]/ig, '_');
}

async function processAndStore(session, file) {
  if (!session) throw new Error('Missing session');
  if (!file || !file.buffer) throw new Error('No file uploaded');

  await validateLogo(file);

  // Normalize image to deterministic webp logo
  const buf = await normalizeImage(file.buffer, { width: 800, quality: 80 });

  const brandsDir = session.paths.brands;
  await fs.ensureDir(brandsDir);
  const dest = path.join(brandsDir, LOGO_NAME);
  await fs.writeFile(dest, buf);

  return { savedAs: LOGO_NAME, dest };
}

module.exports = { processAndStore };
