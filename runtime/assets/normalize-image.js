const sharp = require('sharp');

async function normalizeImage(buffer, options = {}) {
  const width = options.width || 800;
  const quality = typeof options.quality === 'number' ? options.quality : 80;
  // Resize deterministically, convert to webp, strip metadata
  const pipeline = sharp(buffer).rotate().resize({ width: width, withoutEnlargement: true }).webp({ quality: quality });
  const out = await pipeline.toBuffer();
  return out;
}

module.exports = { normalizeImage };
