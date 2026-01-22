const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_PATH = path.join(DATA_DIR, 'avl-template.json');
const CSV_PATH = path.join(DATA_DIR, 'avl-template.csv');

function safeReadJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (_) {
    return [];
  }
}

function safeReadCSV(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const header = parseCsvLine(lines.shift());
    const rows = lines.map((l) => {
      const cols = parseCsvLine(l);
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = (cols[i] || '').replace(/^"|"$/g, '');
      });
      return obj;
    });
    return rows;
  } catch (_) {
    return [];
  }
}

  function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { // escaped quote
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

// Simple in-memory cache; reload on demand
let cache = null;

function loadAVL() {
  const jsonRows = safeReadJSON(JSON_PATH);
  const csvRows = safeReadCSV(CSV_PATH);
  const rows = jsonRows.length ? jsonRows : csvRows;
  cache = normalizeRows(rows);
  return cache;
}

function normalizeRows(rows) {
  return (rows || []).map((r) => ({
    manufacturer: (r.manufacturer || '').trim(),
    model_pattern: (r.model_pattern || '').trim(),
    isDomestic: !!r.isDomestic,
    approved_sku: (r.approved_sku || '').trim(),
    spec_url: (r.spec_url || '').trim(),
  })).filter((r) => r.manufacturer && r.model_pattern);
}

function getAVL() {
  if (!cache) loadAVL();
  return cache || [];
}

function matchesPattern(model, pattern) {
  if (!pattern || pattern === '*') return true;
  // support simple wildcard at end (e.g., "Inverter X*") and exact match
  if (pattern.endsWith('*')) {
    const base = pattern.slice(0, -1);
    return model.toLowerCase().startsWith(base.toLowerCase());
  }
  return model.toLowerCase() === pattern.toLowerCase();
}

function lookup({ manufacturer, model }) {
  const rows = getAVL();
  const mfg = (manufacturer || '').toLowerCase();
  const mdl = (model || '').trim();
  const candidates = rows.filter((r) => r.manufacturer.toLowerCase() === mfg);
  const matches = candidates.filter((r) => matchesPattern(mdl, r.model_pattern));
  return matches;
}

module.exports = { loadAVL, getAVL, lookup };

// Validate a BOM: array of items with manufacturer/model (and optional sku)
function validateBom(items = []) {
  const rows = getAVL();
  const results = (items || []).map((it) => {
    const manufacturer = (it.manufacturer || '').toString().trim();
    const model = (it.model || '').toString().trim();
    const sku = (it.sku || '').toString().trim();
    const matches = lookup({ manufacturer, model });
    const approved = matches.length > 0;
    const domestic = matches.some((m) => !!m.isDomestic);
    const approvedSku = matches.find((m) => (m.approved_sku || '').trim())?.approved_sku || '';
    const specUrl = matches.find((m) => (m.spec_url || '').trim())?.spec_url || '';
    return {
      manufacturer,
      model,
      sku,
      approved,
      domestic,
      approved_sku: approvedSku,
      spec_url: specUrl,
      matches,
    };
  });
  return {
    total: results.length,
    approved_count: results.filter((r) => r.approved).length,
    domestic_count: results.filter((r) => r.domestic).length,
    items: results,
  };
}

module.exports.validateBom = validateBom;

function toCsv(rows) {
  const header = ['manufacturer','model','sku','approved','domestic','approved_sku','spec_url'];
  const lines = [header.join(',')];
  for (const r of rows.items || []) {
    const vals = [
      r.manufacturer,
      r.model,
      r.sku,
      String(!!r.approved),
      String(!!r.domestic),
      r.approved_sku || '',
      r.spec_url || '',
    ].map(v => (v ?? '').toString().replace(/"/g,'""'));
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

module.exports.toCsv = toCsv;
