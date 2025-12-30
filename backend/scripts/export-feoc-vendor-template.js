#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseMaterialsListObject(repoRoot) {
  const filePath = path.join(repoRoot, 'backend', 'data', 'materialsList.jsx');
  if (!fs.existsSync(filePath)) {
    throw new Error(`materialsList.jsx not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate object literal in materialsList.jsx');
  }
  const objectLiteral = raw.slice(start, end + 1);
  return vm.runInNewContext(`(${objectLiteral})`, Object.freeze({}), { timeout: 1000 });
}

function normalizeDomestic(source) {
  if (source == null) return '';
  const s = String(source).trim().toLowerCase();
  if (!s) return '';
  if (s.includes('non-domestic') || s.includes('non domestic') || s === 'nd') return 'Non-Domestic';
  if (s === 'domestic' || s === 'd') return 'Domestic';
  if (s.includes('domestic') && !s.includes('non')) return 'Domestic';
  return '';
}

function pickSuggestedUnitCost(entry) {
  const a = entry?.anthonyPrice;
  const c = entry?.curtisPrice;
  const aNum = typeof a === 'number' ? a : (a == null ? null : Number(a));
  if (Number.isFinite(aNum)) return aNum;
  const cNum = typeof c === 'number' ? c : (c == null ? null : Number(c));
  if (Number.isFinite(cNum)) return cNum;
  return '';
}

function guessBucket(entry) {
  const t = String(entry?.type || '').toLowerCase();
  const name = String(entry?.name || '').toLowerCase();
  const steelIron = /\b(rack|racking|rail|mount|mounting|standoff|foot|clamp|bolt|bracket|splice|flashing|base)\b/;
  if (steelIron.test(t) || steelIron.test(name)) return 'Steel/Iron';
  return 'Manufactured Product';
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const data = parseMaterialsListObject(repoRoot);

  const outDir = path.join(repoRoot, 'backend', 'data', 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  const dateTag = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `feoc_vendor_template_${dateTag}.csv`);

  const headers = [
    'Your SKU / Part Number',
    'Aurora Component Name (if different)',
    'Manufacturer',
    'Part Type / Category',
    'FEOC Bucket (Steel/Iron | Manufactured Product | Excluded)',
    'Unit Cost (USD) - REQUIRED',
    'Currency',
    'Domestic? (Y/N) - REQUIRED',
    'Country of Manufacture - REQUIRED',
    'For Steel/Iron: Mill Test Cert / Melt+Pour evidence (link or ref)',
    'For Manufactured Products: Domestic content % (if provided)',
    'FEOC Attestation (Y/N/Unknown)',
    'Attestation / Supporting Doc Link',
    'Effective Date',
    'Notes',
    'Existing Source Label (from our sheet)',
    'Existing Price - Anthony',
    'Existing Price - Curtis',
    'Existing Notes (from our sheet)',
  ];

  const rows = [headers.join(',')];

  for (const [skuKey, entry] of Object.entries(data)) {
    const suggestedCost = pickSuggestedUnitCost(entry);
    const existingSource = normalizeDomestic(entry?.source);

    const row = [
      skuKey,
      entry?.name || '',
      entry?.brand || '',
      entry?.type || '',
      guessBucket(entry),
      suggestedCost,
      'USD',
      existingSource === 'Domestic' ? 'Y' : existingSource === 'Non-Domestic' ? 'N' : '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      existingSource,
      entry?.anthonyPrice ?? '',
      entry?.curtisPrice ?? '',
      entry?.notes ?? '',
    ].map(csvEscape);

    rows.push(row.join(','));
  }

  fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
  console.log(`Wrote: ${outPath}`);
  console.log(`Rows: ${rows.length - 1}`);
}

main();
