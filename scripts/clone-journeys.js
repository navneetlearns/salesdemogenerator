const fs = require('fs');
const path = require('path');

const directories = [
  '../data/journeys',
  '../data/extracted'
];

const jsonReplacements = [
  { from: /jk_cement/g, to: 'sunder_masala' },

  // Product image remapping
  { from: /product_opc_43/g, to: 'product_garam_masala_200g' },
  { from: /product_ppc_53/g, to: 'product_turmeric_500g' },
  { from: /product_ready_mix/g, to: 'product_turmeric_500g' },

  // Correct legacy sidebar badge typo in cloned journey data
  { from: /"displayNum":\s*"100"/g, to: '"displayNum": 10' }
];

console.log('Cloning JSON data to Sunder Masala...');

directories.forEach(dir => {

  const dirPath = path.join(__dirname, dir);

  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath);

  files.forEach(file => {

    if (file.startsWith('jk_cement_')) {

      const sourcePath = path.join(dirPath, file);

      const destFile = file.replace(
        'jk_cement_',
        'sunder_masala_'
      );

      const destPath = path.join(dirPath, destFile);

      let content = fs.readFileSync(sourcePath, 'utf8');

      jsonReplacements.forEach(r => {
        content = content.replace(r.from, r.to);
      });

      fs.writeFileSync(destPath, content, 'utf8');

      console.log(`✅ Cloned: ${dir}/${destFile}`);
    }
  });
});
