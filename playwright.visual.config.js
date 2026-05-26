// playwright.visual.config.js
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./scripts",
  timeout: 60000,
  use: { headless: true, actionTimeout: 10000 },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
