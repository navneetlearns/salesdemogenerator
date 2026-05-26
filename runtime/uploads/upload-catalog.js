const fs = require('fs-extra');
const path = require('path');
const { validateCatalog } = require('./validate-assets');

function deterministicName(sessionId, originalName) {
  const ext = path.extname(originalName).toLowerCase() || '.json';
  return `catalog${ext}`;
}

async function processAndStore(session, file) {
  if (!session) throw new Error('Missing session');
  if (!file || !file.buffer) throw new Error('No file uploaded');

  await validateCatalog(file);

  const uploadsDir = path.join(session.paths.root, 'uploads');
  await fs.ensureDir(uploadsDir);

  const name = deterministicName(session.id, file.originalname);
  const dest = path.join(uploadsDir, name);

  await fs.writeFile(dest, file.buffer);

  return { savedAs: name, dest };
}

module.exports = { processAndStore, deterministicName };
