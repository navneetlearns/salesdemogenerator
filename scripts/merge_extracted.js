const fs = require('fs');
const path = require('path');

console.log("Starting data merge process...");

// Paths
const extractedDir = path.join(__dirname, '..'); // Assuming extracted JSONs dropped in root
const brandsDir = path.join(__dirname, '..', 'data', 'brands');
const catalogDir = path.join(__dirname, '..', 'data', 'catalog');

// Helper to safely read JSON
function readJSON(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } 
    catch (e) { return null; }
}

// 1. We will merge whatever the extractor found into the canonical JK Cement config
const jkBrandPath = path.join(brandsDir, 'jk_cement.json');
let jkBrandData = readJSON(jkBrandPath) || { brand_id: "jk_cement", brand_name: "JK Cement" };

// Check if jk_cement_index.json exists (from the extractor script)
const extractedIndexData = readJSON(path.join(extractedDir, 'jk_cement_index.json'));
if (extractedIndexData) {
    jkBrandData = { ...jkBrandData, ...extractedIndexData };
    fs.writeFileSync(jkBrandPath, JSON.stringify(jkBrandData, null, 2));
    console.log("✅ Merged JK Cement brand data.");
}

console.log("✅ Data merge complete! You can now run the build.");