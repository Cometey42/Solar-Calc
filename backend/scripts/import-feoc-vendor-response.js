#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function parseArgs(argv) {
  const args = { file: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run' || a === '--dryrun') args.dryRun = true;
    else if (!args.file) args.file = a;
  }
  return args;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  // last field
  row.push(field);
  rows.push(row);
  return rows;
}

function toBoolDomestic(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (['y', 'yes', 'true', '1'].includes(s)) return true;
  if (['n', 'no', 'false', '0'].includes(s)) return false;
  return null;
}

function toNumber(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const num = Number(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function pickLatestTemplate(repoRoot) {
  const dir = path.join(repoRoot, 'backend', 'data', 'exports');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => /^feoc_vendor_template_\d{4}-\d{2}-\d{2}\.csv$/i.test(f))
    .sort();
  if (!files.length) return null;
  return path.join(dir, files[files.length - 1]);
}

function headerIndex(headers) {
  const idx = new Map();
  headers.forEach((h, i) => idx.set(String(h || '').trim().toLowerCase(), i));
  return (name) => {
    const key = String(name || '').trim().toLowerCase();
    return idx.has(key) ? idx.get(key) : -1;
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(__dirname, '..', '..');

  const filePath = args.file ? path.resolve(process.cwd(), args.file) : pickLatestTemplate(repoRoot);
  if (!filePath) {
    throw new Error('No CSV path provided and no template found in backend/data/exports');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }

  const csvText = fs.readFileSync(filePath, 'utf8');
  const table = parseCSV(csvText);
  if (table.length < 2) {
    throw new Error('CSV has no data rows');
  }

  const headers = table[0];
  const ix = headerIndex(headers);

  // Template headers (primary)
  const colSku = ix('Your SKU / Part Number');
  const colName = ix('Aurora Component Name (if different)');
  const colMfg = ix('Manufacturer');
  const colType = ix('Part Type / Category');
  const colUnitCost = ix('Unit Cost (USD) - REQUIRED');
  const colDomestic = ix('Domestic? (Y/N) - REQUIRED');
  const colCountry = ix('Country of Manufacture - REQUIRED');

  if (colSku === -1) {
    throw new Error('CSV missing required header: Your SKU / Part Number');
  }

  const prisma = new PrismaClient();

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let noops = 0;

  for (let r = 1; r < table.length; r += 1) {
    const row = table[r] || [];
    const sku = String(row[colSku] || '').trim();
    if (!sku) {
      skipped += 1;
      continue;
    }

    const unitPrice = colUnitCost !== -1 ? toNumber(row[colUnitCost]) : null;
    const domestic = colDomestic !== -1 ? toBoolDomestic(row[colDomestic]) : null;
    const country = colCountry !== -1 ? String(row[colCountry] || '').trim() : '';

    // Build patch without overwriting with nulls
    const patch = {};
    if (unitPrice != null) patch.unitPrice = unitPrice;
    if (domestic != null) patch.isDomestic = domestic;

    if (country) {
      patch.originCountry = country.toUpperCase();
    } else if (domestic === true) {
      patch.originCountry = 'US';
    } else if (domestic === false) {
      patch.originCountry = 'NONUS';
    }

    // Optional: use name if row provides it and SKU is new
    const nameRaw = colName !== -1 ? String(row[colName] || '').trim() : '';
    const typeRaw = colType !== -1 ? String(row[colType] || '').trim() : '';
    const mfgRaw = colMfg !== -1 ? String(row[colMfg] || '').trim() : '';
    const suggestedName = [mfgRaw, typeRaw].filter(Boolean).join(' ') || nameRaw || sku;

    const existing = await prisma.part.findUnique({ where: { sku } });

    if (!Object.keys(patch).length) {
      noops += 1;
      continue;
    }

    if (args.dryRun) {
      if (existing) updated += 1;
      else created += 1;
      continue;
    }

    if (existing) {
      await prisma.part.update({ where: { sku }, data: patch });
      updated += 1;
    } else {
      await prisma.part.create({
        data: {
          sku,
          name: suggestedName,
          unitPrice: patch.unitPrice ?? null,
          originCountry: patch.originCountry ?? 'UNKNOWN',
          isDomestic: patch.isDomestic ?? false,
          weightKg: null,
        }
      });
      created += 1;
    }
  }

  await prisma.$disconnect();

  console.log(JSON.stringify({
    file: filePath,
    dryRun: args.dryRun,
    created,
    updated,
    skipped_missing_sku: skipped,
    noops_missing_fields: noops,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
