const path = require('path');
const fs = require('fs-extra');

/**
 * processAndStore(session, file)
 * - session: session object from session-manager
 * - file: multer file object { originalname, buffer, mimetype }
 * Saves the uploaded catalog into session overrides and returns saved path.
 */
async function processAndStore(session, file) {
	if (!session || !file || !file.buffer) throw new Error('Invalid session or file');

	const ext = path.extname(file.originalname || '') || '.csv';
	const fileName = 'catalog' + ext;
	const outDir = session.paths && session.paths.overrides ? session.paths.overrides : path.join(session.paths.root, 'overrides');
	await fs.ensureDir(outDir);
	const outPath = path.join(outDir, fileName);
	await fs.writeFile(outPath, file.buffer);

	const relative = path.relative(session.paths.root, outPath).replace(/\\/g, '/');
	return { savedAs: relative };
}

module.exports = { processAndStore };
