const fs = require("fs");
const path = require("path");

const brandId = process.argv[2];

if (!brandId) {
  console.error("Usage: node scripts/create-brand-clone.js <brandId>");
  process.exit(1);
}

const brandPath = path.join(
  __dirname,
  "..",
  "data",
  "brands",
  `${brandId}.json`
);

if (!fs.existsSync(brandPath)) {
  console.error(`Brand config not found: ${brandPath}`);
  process.exit(1);
}

const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));

const sourceBrand = brand.cloneFrom;

if (!sourceBrand) {
  console.error(`cloneFrom missing in brand config`);
  process.exit(1);
}

const folders = [
  "data/journeys",
  "data/extracted"
];

function applyReplacements(content, replacements = {}) {
  for (const [from, to] of Object.entries(replacements)) {
    content = content.split(from).join(to);
  }

  return content;
}

function applyProductMappings(content, mappings = {}) {
  for (const [from, to] of Object.entries(mappings)) {
    content = content.split(from).join(to);
  }

  return content;
}

function applyImageMappings(content, mappings = {}) {
  for (const [from, to] of Object.entries(mappings)) {
    content = content.split(from).join(to);
  }

  return content;
}

folders.forEach((folder) => {
  const absFolder = path.join(__dirname, "..", folder);

  const files = fs.readdirSync(absFolder);

  const sourceFiles = files.filter((f) =>
    f.startsWith(`${sourceBrand}_`)
  );

  sourceFiles.forEach((file) => {
    const sourcePath = path.join(absFolder, file);

    const newFile = file.replace(sourceBrand, brandId);

    const destPath = path.join(absFolder, newFile);

    let content = fs.readFileSync(sourcePath, "utf8");

    // Replace source brand ID
    content = content.split(sourceBrand).join(brandId);

    // Semantic replacements
    content = applyReplacements(
      content,
      brand.replacements
    );

    // Product ID mappings
    content = applyProductMappings(
      content,
      brand.productMappings
    );

    // Image path mappings
    content = applyImageMappings(
      content,
      brand.imageMappings
    );

    fs.writeFileSync(destPath, content);

    console.log(`Generated: ${newFile}`);
  });
});

console.log("Brand clone generation complete.");