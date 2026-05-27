const path = require('path');
const fs = require('fs-extra');

/**
 * processAndStore(session, file)
 * - session: session object from session-manager (contains paths)
 * - file: multer file object { originalname, buffer, mimetype }
 * Returns: { savedAs: '<relative-path>' }
 */
async function processAndStore(session, file) {
	if (!session || !file || !file.buffer) throw new Error('Invalid session or file');

	const ext = path.extname(file.originalname || '') || '.png';
	const fileName = 'logo' + ext;
	const outDir = session.paths && session.paths.brands ? session.paths.brands : path.join(session.paths.root, 'assets', 'brands');
	await fs.ensureDir(outDir);
	const outPath = path.join(outDir, fileName);
	await fs.writeFile(outPath, file.buffer);

	// Return path relative to session root for storing in metadata
	const relative = path.relative(session.paths.root, outPath).replace(/\\/g, '/');
	return { savedAs: relative };
}

module.exports = { processAndStore };
