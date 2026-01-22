// Foreign Entity of Concern (FEOC) Compliance Calculator
// Per Palmetto LightReach AVL (Updated 12/30/25)
// Calculates FOREIGN content only - not domestic content bonus

const FEOC_COUNTRIES = ['CN', 'RU', 'KP', 'IR']; // China, Russia, North Korea, Iran
const FEOC_COMPLIANCE_THRESHOLD = 0.0; // 0% FEOC allowed starting 2026

function getMaxAllowedFEOCPercent(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return 0;
  if (y >= 2026) return 0; // 0% FEOC allowed starting 2026
  return 100; // Before 2026, no restrictions
}

function parseBooleanish(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(s)) return false;
  return null;
}

function parseNumberish(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDateish(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function classifyFeocBucket(item) {
  const name = String(item?.name || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  const combined = `${name} ${type}`;

  // Steel/Iron structural components (racking, mounting)
  const steelIronRegex = /\b(rack|racking|rail|mount|mounting|standoff|foot|clamp|bolt|bracket|splice|flashing|base|anchor|ballast|beam|channel|post|stanchion|fastener|screw|washer|nut|hardware|stringer|purlin|torque tube)\b/;
  if (steelIronRegex.test(combined)) return 'steel_iron';

  // Default to manufactured products (panels, inverters, batteries)
  return 'manufactured';
}

function isFEOCCountry(originCountry) {
  if (!originCountry) return false;
  const country = String(originCountry).toUpperCase().trim();
  return FEOC_COUNTRIES.includes(country);
}

function isForeignContent(originCountry, isDomestic) {
  // If origin_country is explicitly US, it's domestic
  if (originCountry && String(originCountry).toUpperCase() === 'US') return false;
  
  // If isDomestic flag is explicitly true, it's domestic
  if (isDomestic === true) return false;
  
  // Everything else is foreign
  return true;
}

function evaluateFeoc({
  items,
  installationYear,
} = {}) {
  const year = parseNumberish(installationYear) ?? new Date().getFullYear();
  const maxAllowedFEOC = getMaxAllowedFEOCPercent(year);

  const acc = {
    steel_total: 0,
    steel_foreign_total: 0,
    steel_feoc_total: 0,
    steel_unknown_total: 0,
    manufactured_total: 0,
    manufactured_foreign_total: 0,
    manufactured_feoc_total: 0,
    manufactured_unknown_total: 0,
    total_project_cost: 0,
    total_foreign_cost: 0,
    total_feoc_cost: 0,
  };

  const feocParts = []; // Track FEOC parts for detailed reporting
  const normalizedItems = Array.isArray(items) ? items : [];

  for (const raw of normalizedItems) {
    const bucket = classifyFeocBucket(raw);
    const lineTotal = parseNumberish(raw?.line_total ?? raw?.lineTotal);
    const originCountry = raw?.origin_country ?? raw?.originCountry;
    const isDomestic = parseBooleanish(raw?.is_domestic ?? raw?.isDomestic);

    // If we can't price it, skip it
    if (lineTotal == null) continue;

    const isForeign = isForeignContent(originCountry, isDomestic);
    const isFeoc = isFEOCCountry(originCountry);

    if (bucket === 'steel_iron') {
      acc.steel_total += lineTotal;
      if (isForeign) acc.steel_foreign_total += lineTotal;
      if (isFeoc) {
        acc.steel_feoc_total += lineTotal;
        feocParts.push({
          name: raw?.name,
          sku: raw?.sku,
          origin_country: originCountry,
          category: 'Steel/Iron',
          line_total: lineTotal,
        });
      }
      if (!originCountry && isDomestic == null) acc.steel_unknown_total += lineTotal;
    } else if (bucket === 'manufactured') {
      acc.manufactured_total += lineTotal;
      if (isForeign) acc.manufactured_foreign_total += lineTotal;
      if (isFeoc) {
        acc.manufactured_feoc_total += lineTotal;
        feocParts.push({
          name: raw?.name,
          sku: raw?.sku,
          origin_country: originCountry,
          category: 'Manufactured Products',
          line_total: lineTotal,
        });
      }
      if (!originCountry && isDomestic == null) acc.manufactured_unknown_total += lineTotal;
    }
  }

  acc.total_project_cost = acc.steel_total + acc.manufactured_total;
  acc.total_foreign_cost = acc.steel_foreign_total + acc.manufactured_foreign_total;
  acc.total_feoc_cost = acc.steel_feoc_total + acc.manufactured_feoc_total;

  // Calculate foreign content percentages
  const steelForeignPct = acc.steel_total > 0
    ? (acc.steel_unknown_total > 0 ? null : Number(((acc.steel_foreign_total / acc.steel_total) * 100).toFixed(2)))
    : null;

  const manufacturedForeignPct = acc.manufactured_total > 0
    ? (acc.manufactured_unknown_total > 0 ? null : Number(((acc.manufactured_foreign_total / acc.manufactured_total) * 100).toFixed(2)))
    : null;

  const totalForeignPct = acc.total_project_cost > 0
    ? Number(((acc.total_foreign_cost / acc.total_project_cost) * 100).toFixed(2))
    : 0;

  // Calculate FEOC content percentages
  const steelFeocPct = acc.steel_total > 0
    ? Number(((acc.steel_feoc_total / acc.steel_total) * 100).toFixed(2))
    : 0;

  const manufacturedFeocPct = acc.manufactured_total > 0
    ? Number(((acc.manufactured_feoc_total / acc.manufactured_total) * 100).toFixed(2))
    : 0;

  const totalFeocPct = acc.total_project_cost > 0
    ? Number(((acc.total_feoc_cost / acc.total_project_cost) * 100).toFixed(2))
    : 0;

  // FEOC Compliance Check (2026+: 0% FEOC allowed)
  const feocCompliant = totalFeocPct <= maxAllowedFEOC;
  const feocDetected = feocParts.length > 0;

  return {
    inputs: {
      installationYear: year,
      maxAllowedFEOCPercent: maxAllowedFEOC,
    },
    totals: {
      steel_total: Number(acc.steel_total.toFixed(2)),
      steel_foreign_total: Number(acc.steel_foreign_total.toFixed(2)),
      steel_feoc_total: Number(acc.steel_feoc_total.toFixed(2)),
      steel_unknown_total: Number(acc.steel_unknown_total.toFixed(2)),
      manufactured_total: Number(acc.manufactured_total.toFixed(2)),
      manufactured_foreign_total: Number(acc.manufactured_foreign_total.toFixed(2)),
      manufactured_feoc_total: Number(acc.manufactured_feoc_total.toFixed(2)),
      manufactured_unknown_total: Number(acc.manufactured_unknown_total.toFixed(2)),
      total_project_cost: Number(acc.total_project_cost.toFixed(2)),
      total_foreign_cost: Number(acc.total_foreign_cost.toFixed(2)),
      total_feoc_cost: Number(acc.total_feoc_cost.toFixed(2)),
    },
    percentages: {
      steel_foreign_percent: steelForeignPct,
      manufactured_foreign_percent: manufacturedForeignPct,
      total_foreign_percent: totalForeignPct,
      steel_feoc_percent: steelFeocPct,
      manufactured_feoc_percent: manufacturedFeocPct,
      total_feoc_percent: totalFeocPct,
    },
    compliance: {
      feocCompliant,
      feocDetected,
      feocCountries: [...new Set(feocParts.map(p => p.origin_country))],
      feocParts: feocParts.length > 0 ? feocParts : null,
    },
  };
}

module.exports = {
  classifyFeocBucket,
  evaluateFeoc,
  getMaxAllowedFEOCPercent,
  isFEOCCountry,
  isForeignContent,
  FEOC_COUNTRIES,
};
