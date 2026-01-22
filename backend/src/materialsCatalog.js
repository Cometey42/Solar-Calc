const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cached = null;

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function parseSourceToDomestic(source) {
  if (source == null) return null;
  const s = String(source).trim().toLowerCase();
  if (!s) return null;
  if (s.includes('non-domestic') || s.includes('non domestic') || s === 'nd') return false;
  if (s === 'domestic' || s === 'd') return true;
  // If it contains domestic but not non-domestic
  if (s.includes('domestic') && !s.includes('non')) return true;
  return null;
}

function pickUnitPrice(entry) {
  const a = entry?.anthonyPrice;
  const c = entry?.curtisPrice;
  const aNum = typeof a === 'number' ? a : (a == null ? null : Number(a));
  if (Number.isFinite(aNum)) return aNum;
  const cNum = typeof c === 'number' ? c : (c == null ? null : Number(c));
  if (Number.isFinite(cNum)) return cNum;
  return null;
}

function loadMaterialsListObject() {
  // NOTE: This reads a local JS object literal from materialsList.jsx.
  // We intentionally only evaluate the object literal portion.
  const filePath = path.join(process.cwd(), 'data', 'materialsList.jsx');
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const objectLiteral = raw.slice(start, end + 1);
  const sandbox = Object.freeze({});
  return vm.runInNewContext(`(${objectLiteral})`, sandbox, { timeout: 1000 });
}

function getCatalog() {
  if (cached) return cached;

  const obj = loadMaterialsListObject();
  const byKey = new Map();

  if (obj && typeof obj === 'object') {
    for (const [sku, entry] of Object.entries(obj)) {
      const domestic = parseSourceToDomestic(entry?.source);
      const unitPrice = pickUnitPrice(entry);
      const originCountry = domestic === true ? 'US' : domestic === false ? 'NONUS' : null;

      byKey.set(normalizeKey(sku), {
        sku,
        name: entry?.name || sku,
        unitPrice,
        isDomestic: domestic,
        originCountry,
      });
    }
  }

  cached = { byKey };
  return cached;
}

function lookupMaterial(candidate) {
  if (!candidate) return null;
  const { byKey } = getCatalog();
  return byKey.get(normalizeKey(candidate)) || null;
}

module.exports = {
  lookupMaterial,
};
