const fs = require('fs-extra');
const path = require('path');

const INDUSTRIES_DIR = path.join(__dirname, '..', 'data', 'industries');

const DEFAULT_INDUSTRY = {
  id: 'general',
  label: 'General Trade',
  partnerLabel: 'Partner',
  unit: 'units',
  unitPlural: 'units',
  currency: 'INR',
  currencySymbol: '₹',
  categoryTabs: ['All'],
};

async function loadIndustry(industryId) {
  if (!industryId) return { ...DEFAULT_INDUSTRY };
  const filePath = path.join(INDUSTRIES_DIR, `${industryId}.json`);
  if (await fs.pathExists(filePath)) {
    return fs.readJson(filePath);
  }
  return { ...DEFAULT_INDUSTRY, id: industryId };
}

function formatPrice(amount, industry) {
  const symbol = industry.currencySymbol || '₹';
  return `${symbol}${amount}`;
}

function formatQuantity(qty, industry) {
  const unit = qty === 1 ? (industry.unit || 'unit') : (industry.unitPlural || industry.unit || 'units');
  return `${qty} ${unit}`;
}

module.exports = { loadIndustry, formatPrice, formatQuantity, DEFAULT_INDUSTRY };
