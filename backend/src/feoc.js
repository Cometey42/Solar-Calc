function getRequiredManufacturedDomesticPercent(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return 40;
  if (y >= 2029) return 55;
  if (y >= 2027) return 50;
  if (y >= 2025) return 45;
  return 40;
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

  // Steel/Iron (100% domestic requirement)
  // NOTE: This is still a heuristic; accurate classification requires better source data.
  const steelIronRegex = /\b(rack|racking|rail|mount|mounting|standoff|foot|clamp|bolt|bracket|splice|flashing|base)\b/;
  if (steelIronRegex.test(type) || steelIronRegex.test(name)) return 'steel_iron';

  // Default to manufactured products
  return 'manufactured';
}

function evaluateFeoc({
  items,
  installationYear,
  maxNetOutputMW,
  constructionStartDate,
  prevailingWageCompliant,
} = {}) {
  const year = parseNumberish(installationYear) ?? new Date().getFullYear();
  const requiredManufactured = getRequiredManufacturedDomesticPercent(year);

  const maxMW = parseNumberish(maxNetOutputMW);
  const constructionDate = parseDateish(constructionStartDate);
  const jan29_2023 = new Date('2023-01-29');
  const wage = parseBooleanish(prevailingWageCompliant);

  const eligibility = {
    smallProject: maxMW == null ? null : maxMW < 1,
    earlyConstruction: constructionDate == null ? null : constructionDate < jan29_2023,
    prevailingWage: wage,
  };

  const eligible = (eligibility.smallProject === true || eligibility.earlyConstruction === true || eligibility.prevailingWage === true)
    ? true
    : (eligibility.smallProject === false && eligibility.earlyConstruction === false && eligibility.prevailingWage === false)
    ? false
    : null;

  const acc = {
    steel_total: 0,
    steel_domestic_total: 0,
    steel_unknown_total: 0,
    manufactured_total: 0,
    manufactured_domestic_total: 0,
    manufactured_unknown_total: 0,
  };

  const normalizedItems = Array.isArray(items) ? items : [];
  for (const raw of normalizedItems) {
    const bucket = classifyFeocBucket(raw);
    const lineTotal = parseNumberish(raw?.line_total ?? raw?.lineTotal);
    const isDomestic = parseBooleanish(raw?.is_domestic ?? raw?.isDomestic);

    // If we can't price it, we can't use it for a cost-based IRS calc.
    if (lineTotal == null) continue;

    if (bucket === 'steel_iron') {
      acc.steel_total += lineTotal;
      if (isDomestic === true) acc.steel_domestic_total += lineTotal;
      else if (isDomestic == null) acc.steel_unknown_total += lineTotal;
    } else if (bucket === 'manufactured') {
      acc.manufactured_total += lineTotal;
      if (isDomestic === true) acc.manufactured_domestic_total += lineTotal;
      else if (isDomestic == null) acc.manufactured_unknown_total += lineTotal;
    }
  }

  const steelPct = acc.steel_total > 0
    ? (acc.steel_unknown_total > 0 ? null : Math.round((acc.steel_domestic_total / acc.steel_total) * 100))
    : null;

  const manufacturedPct = acc.manufactured_total > 0
    ? (acc.manufactured_unknown_total > 0 ? null : Math.round((acc.manufactured_domestic_total / acc.manufactured_total) * 100))
    : null;

  const steelIronCompliant = steelPct == null ? null : steelPct >= 100;
  const manufacturedProductsCompliant = manufacturedPct == null ? null : manufacturedPct >= requiredManufactured;

  const feocCompliant = (steelIronCompliant === false || manufacturedProductsCompliant === false || eligible === false)
    ? false
    : (steelIronCompliant == null || manufacturedProductsCompliant == null || eligible == null)
    ? null
    : true;

  return {
    inputs: {
      installationYear: year,
      requiredManufacturedDomesticPercent: requiredManufactured,
      maxNetOutputMW: maxMW,
      constructionStartDate: constructionDate ? constructionDate.toISOString().slice(0, 10) : null,
      prevailingWageCompliant: wage,
    },
    totals: {
      steel_total: Number(acc.steel_total.toFixed(2)),
      steel_domestic_total: Number(acc.steel_domestic_total.toFixed(2)),
      steel_unknown_total: Number(acc.steel_unknown_total.toFixed(2)),
      manufactured_total: Number(acc.manufactured_total.toFixed(2)),
      manufactured_domestic_total: Number(acc.manufactured_domestic_total.toFixed(2)),
      manufactured_unknown_total: Number(acc.manufactured_unknown_total.toFixed(2)),
    },
    percentages: {
      steel_domestic_percent: steelPct,
      manufactured_domestic_percent: manufacturedPct,
    },
    compliance: {
      steelIronCompliant,
      manufacturedProductsCompliant,
      projectEligible: eligible,
      feocCompliant,
    },
    eligibility: {
      eligible,
      reasons: eligibility,
    },
  };
}

module.exports = {
  classifyFeocBucket,
  evaluateFeoc,
  getRequiredManufacturedDomesticPercent,
};
