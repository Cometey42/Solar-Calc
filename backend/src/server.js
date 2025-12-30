// src/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { register, httpRequestsTotal, httpRequestDuration, compareCacheEvents } = require('./metrics');

const { PrismaClient } = require("@prisma/client");
const avl = require('./avl');
const prisma = new PrismaClient();

function validateEnv() {
  const errors = [];
  const warns = [];
  if (!process.env.DATABASE_URL) errors.push('DATABASE_URL is required for Prisma/MySQL');
  if (!process.env.PORT) warns.push('PORT not set, defaulting to 3000');
  if (!process.env.AURORA_TENANT_ID || !process.env.AURORA_API_TOKEN) {
    warns.push('Aurora credentials missing; /aurora and /compare endpoints will be unavailable');
  }
  for (const w of warns) console.warn('[ENV WARN]', w);
  if (errors.length) {
    for (const e of errors) console.error('[ENV ERROR]', e);
    // Do not hard exit inside Docker health cycles; let /health report failure and continue
  }
}
validateEnv();

const makeAurora = require("./auroraClient");
let aurora;
try { aurora = makeAurora(); } catch (e) { console.warn("Aurora client not initialized:", e.message); }

const { buildComparison } = require("./compare");
const { evaluateFeoc } = require('./feoc');

const app = express();
app.use(express.json());
// tighten CORS: allow specific frontend origin in prod, permissive in dev
const FE_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const corsOptions = process.env.NODE_ENV === "production"
  ? { origin: FE_ORIGIN, credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
app.use(express.static("public")); //testing in the browser

// ---------- minimal request logging ----------
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  // attach a simple request id
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  res.on("finish", () => {
    const durMs = Number((process.hrtime.bigint() - start) / 1000000n);
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${durMs}ms id=${req.requestId}`);
    try {
      const seconds = durMs / 1000;
      const routeLabel = req.route?.path || req.originalUrl.split('?')[0] || 'unknown';
      httpRequestsTotal.inc({ method: req.method, route: routeLabel, status: String(res.statusCode) });
      httpRequestDuration.observe({ method: req.method, route: routeLabel, status: String(res.statusCode) }, seconds);
    } catch {}
  });
  next();
});

// ---------- simple rate limit for aurora/compare ----------
const rlStore = new Map();
function rateLimit(max = 60, windowMs = 60_000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl || ''}`;
    const now = Date.now();
    const rec = rlStore.get(key) || { count: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
    rec.count += 1;
    rlStore.set(key, rec);
    if (rec.count > max) return res.status(429).json({ type: "about:blank", title: "rate_limited", limit: max, window_ms: windowMs });
    next();
  };
}

// ---------- helpers ----------
function safeDetail(err) {
  if (err.response?.data) {
    try { return JSON.stringify(err.response.data); } catch {}
    return String(err.response.data);
  }
  return err.message || "unknown_error";
}
function apiStatus(err) { return Number(err.response?.status) || 502; }

// ---------- simple in-memory cache helpers (TTL) ----------
function makeTtlCache() {
  const store = new Map();
  return {
    get(key) {
      const rec = store.get(key);
      if (!rec) return null;
      if (Date.now() > rec.expires) { store.delete(key); return null; }
      return rec.value;
    },
    set(key, value, ttlMs = 300000) { // default 5 minutes
      store.set(key, { value, expires: Date.now() + ttlMs });
    }
  };
}
app.locals.designPricingCache = app.locals.designPricingCache || makeTtlCache();
async function getDesignPricingCached(designId, ttlMs = 300000) {
  const key = `pricing:${designId}`;
  const hit = app.locals.designPricingCache.get(key);
  if (hit) return hit;
  const data = await aurora.getDesignPricing(designId);
  app.locals.designPricingCache.set(key, data, ttlMs);
  return data;
}
app.locals.designMetaCache = app.locals.designMetaCache || makeTtlCache();
async function getDesignMetaCached(designId, ttlMs = 300000) {
  const key = `design:${designId}`;
  const hit = app.locals.designMetaCache.get(key);
  if (hit) return hit;
  const data = await aurora.getDesign(designId).catch(() => ({ raw: null, preview_url: null }));
  app.locals.designMetaCache.set(key, data, ttlMs);
  return data;
}

// ---------- input validation helpers ----------
function getIntParam(req, res, name, { min = 1, max = 1000, def = 1 } = {}) {
  const raw = req.query[name];
  if (raw == null) return def;
  const val = parseInt(raw);
  if (!Number.isFinite(val)) {
    res.status(400).json({ type: "about:blank", title: "invalid_parameter", detail: `${name} must be an integer`, param: name });
    return null;
  }
  if (val < min || val > max) {
    res.status(400).json({ type: "about:blank", title: "out_of_range", detail: `${name} must be between ${min} and ${max}`, param: name });
    return null;
  }
  return val;
}

// ---------- root ----------
app.get("/", (_req, res) => {
  res
    .type("text")
    .send("Aurora backend running. Try /health, /search, /aurora/projects, /aurora/projects/:id/designs, /aurora/modules, /compare/:designId");
});

// ---------- info ----------
app.get("/info", (_req, res) => {
  res.json({
    routes: [
      { path: "/health", desc: "Service + DB + aurora status" },
      { path: "/search", desc: "Parts search", params: ["page", "page_size", "q"] },
      { path: "/parts/:sku", desc: "Single part by SKU" },
      { path: "/avl/lookup", desc: "AVL lookup by manufacturer + model", params: ["manufacturer", "model"] },
      { path: "/avl/validate-bom", desc: "Validate list of items for AVL + domestic", method: "POST" },
      { path: "/avl/validate-bom-by-sku", desc: "Validate AVL by parts SKUs", method: "POST" },
      { path: "/avl/validate-bom-by-sku/report", desc: "Validate SKUs and return CSV", method: "POST" },
      { path: "/avl/validate-bom/report", desc: "Return CSV report of AVL validation", method: "POST" },
      { path: "/avl/validate-bom-by-sku/text", desc: "Plain text SKUs -> CSV", method: "POST" },
      { path: "/reports/avl-compliance", desc: "Compliance summary (JSON/CSV)", method: "POST" },
      { path: "/health/details", desc: "Extended health diagnostics", method: "GET" },
      { path: "/compare/projects", desc: "Projects with design summaries", params: ["page", "per_page", "designs_per_project"] },
      { path: "/compare/:designId", desc: "Single design comparison" },
      { path: "/aurora/projects", desc: "Aurora projects", params: ["page", "per_page"] },
      { path: "/aurora/projects/:projectId/designs", desc: "Aurora designs", params: ["page", "per_page"] },
      { path: "/aurora/modules", desc: "Aurora modules", params: ["limit", "cursor"] },
      { path: "/aurora/inverters", desc: "Aurora inverters", params: ["limit", "cursor"] },
      { path: "/aurora/dc-optimizers", desc: "Aurora DC optimizers", params: ["limit", "cursor"] },
      { path: "/metrics", desc: "Prometheus metrics" },
    ],
  });
});

// ---------- health ----------
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const auroraInfo = aurora ? aurora.debugInfo() : { initialized: false };
    const partsTotal = await prisma.part.count().catch(() => null);
    res.json({ ok: true, db: "up", parts_total: partsTotal, aurora: auroraInfo });
  } catch (e) {
    res.status(500).json({ ok: false, db: "down", error: e.message });
  }
});

// ---------- metrics ----------
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ---------- aurora debug ----------
app.get("/aurora/debug", (_req, res) => {
  try {
    if (!aurora) return res.json({ initialized: false });
    res.json({ initialized: true, ...aurora.debugInfo() });
  } catch (e) {
    res.status(500).json({ type: "about:blank", title: "aurora_debug_failed", status: 500, detail: e.message });
  }
});

// ---------- search (page + page_size + has_more) ----------
app.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim().slice(0, 200);
    const page = getIntParam(req, res, "page", { min: 1, max: 100000, def: 1 }); if (page == null) return;
    const pageSize = getIntParam(req, res, "page_size", { min: 1, max: 100, def: 20 }); if (pageSize == null) return;
    const skip = (page - 1) * pageSize;

    const where = q ? { OR: [{ sku: { contains: q } }, { name: { contains: q } }] } : {};
    const [total, items] = await Promise.all([
      prisma.part.count({ where }),
      prisma.part.findMany({ where, skip, take: pageSize, orderBy: { sku: "asc" } }),
    ]);

    res.json({
      total,
      page,
      page_size: pageSize,
      has_more: page * pageSize < total,
      items: items.map((p) => ({
        sku: p.sku,
        name: p.name,
        unit_price: p.unitPrice,
        origin_country: p.originCountry,
        is_domestic: p.isDomestic,
        weight_kg: p.weightKg,
      })),
    });
  } catch (e) {
    // Fail-safe: return empty list so frontend can continue gracefully
    res.json({
      total: 0,
      page: 1,
      page_size: getIntParam(req, res, "page_size", { min: 1, max: 100, def: 20 }) ?? 20,
      has_more: false,
      items: [],
      warning: "search_failed",
      detail: e.message,
    });
  }
});

// ---------- single part lookup by SKU (query param, supports '/' in SKU) ----------
app.get('/parts/lookup', async (req, res) => {
  const sku = req.query.sku?.toString().trim().slice(0, 200);
  if (!sku) return res.status(400).json({ type: 'about:blank', title: 'invalid_parameter', param: 'sku' });
  try {
    const p = await prisma.part.findUnique({ where: { sku } });
    if (!p) return res.status(404).json({ type: 'about:blank', title: 'not_found', detail: 'part not found' });
    return res.json({
      sku: p.sku,
      name: p.name,
      unit_price: p.unitPrice,
      origin_country: p.originCountry,
      is_domestic: p.isDomestic,
      weight_kg: p.weightKg,
    });
  } catch (e) {
    return res.status(500).json({ type: 'about:blank', title: 'part_lookup_failed', detail: e.message });
  }
});

// ---------- parts: compare similar parts by SKU ----------
function inferPartCategory(text) {
  const s = (text || '').toLowerCase();
  if (s.includes('panel') || s.includes('module')) return 'modules';
  if (s.includes('microinverter') || s.includes('inverter')) return 'inverters';
  if (s.includes('battery')) return 'batteries';
  if (s.includes('racking') || s.includes('mount') || s.includes('rail') || s.includes('rack')) return 'racking';
  if (s.includes('breaker')) return 'breakers';
  return 'other';
}
function categoryKeywords(category) {
  switch (category) {
    case 'modules': return ['panel', 'module'];
    case 'inverters': return ['inverter', 'microinverter'];
    case 'batteries': return ['battery'];
    case 'racking': return ['racking', 'mount', 'rail', 'rack'];
    case 'breakers': return ['breaker'];
    default: return [];
  }
}

app.get('/parts/compare', async (req, res) => {
  const sku = req.query.sku?.toString().trim().slice(0, 200) || null;
  const q = req.query.q?.toString().trim().slice(0, 200) || null;
  if (!sku && !q) return res.status(400).json({ type: 'about:blank', title: 'invalid_parameter', detail: 'sku or q is required' });
  const limit = getIntParam(req, res, 'limit', { min: 1, max: 200, def: 50 }); if (limit == null) return;
  try {
    const all = await prisma.part.findMany({ orderBy: { sku: 'asc' } });

    let selectedSku = null;
    let category = 'other';
    let needle = null;

    if (sku) {
      const base = all.find((p) => p.sku === sku) || null;
      if (!base) return res.status(404).json({ type: 'about:blank', title: 'not_found', detail: 'part not found' });
      selectedSku = base.sku;
      category = inferPartCategory(`${base.sku} ${base.name}`);
      needle = null;
    } else {
      needle = q;
      category = inferPartCategory(q);
    }

    const needleLower = needle ? needle.toLowerCase() : null;
    const items = all
      .filter((p) => {
        const cat = inferPartCategory(`${p.sku} ${p.name}`);
        if (category !== 'other') return cat === category;
        if (!needleLower) return true;
        const hay = `${p.sku} ${p.name}`.toLowerCase();
        return hay.includes(needleLower);
      })
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        unit_price: p.unitPrice,
        origin_country: p.originCountry,
        is_domestic: p.isDomestic,
        weight_kg: p.weightKg,
      }))
      .sort((a, b) => {
        const ap = Number.isFinite(Number(a.unit_price)) ? Number(a.unit_price) : Number.POSITIVE_INFINITY;
        const bp = Number.isFinite(Number(b.unit_price)) ? Number(b.unit_price) : Number.POSITIVE_INFINITY;
        return ap - bp;
      })
      .slice(0, limit);

    return res.json({ selected_sku: selectedSku, category, items });
  } catch (e) {
    return res.status(500).json({ type: 'about:blank', title: 'parts_compare_failed', detail: e.message });
  }
});

// ---------- single part by SKU ----------
app.get('/parts/:sku', async (req, res) => {
  const sku = req.params.sku?.toString().trim().slice(0, 100);
  if (!sku) return res.status(400).json({ type: 'about:blank', title: 'invalid_parameter', param: 'sku' });
  try {
    const p = await prisma.part.findUnique({ where: { sku } });
    if (!p) return res.status(404).json({ type: 'about:blank', title: 'not_found', detail: 'part not found' });
    return res.json({
      sku: p.sku,
      name: p.name,
      unit_price: p.unitPrice,
      origin_country: p.originCountry,
      is_domestic: p.isDomestic,
      weight_kg: p.weightKg,
    });
  } catch (e) {
    return res.status(500).json({ type: 'about:blank', title: 'part_lookup_failed', detail: e.message });
  }
});

// ---------- aurora: projects (page/per_page + has_more) ----------
app.get("/aurora/projects", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const page = getIntParam(req, res, "page", { min: 1, max: 100000, def: 1 }); if (page == null) return;
    const per_page = getIntParam(req, res, "per_page", { min: 1, max: 250, def: 50 }); if (per_page == null) return;
    const data = await aurora.listProjects({ page, per_page });
    res.json({
      projects: data.items,
      page: data.page,
      per_page: data.per_page,
      total: data.total ?? undefined,
      has_more: data.has_more,
    });
  } catch (e) {
    res.status(apiStatus(e)).json({ type: "about:blank", title: "aurora_projects_failed", status: apiStatus(e), detail: safeDetail(e) });
  }
});

// ---------- aurora: designs (page/per_page + has_more) ----------
app.get("/aurora/projects/:projectId/designs", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const page = getIntParam(req, res, "page", { min: 1, max: 100000, def: 1 }); if (page == null) return;
    const per_page = getIntParam(req, res, "per_page", { min: 1, max: 250, def: 50 }); if (per_page == null) return;
    const data = await aurora.listDesigns(req.params.projectId, { page, per_page });
    res.json({
      designs: data.items,
      page: data.page,
      per_page: data.per_page,
      total: data.total ?? undefined,
      has_more: data.has_more,
    });
  } catch (e) {
    res.status(apiStatus(e)).json({ type: "about:blank", title: "aurora_designs_failed", status: apiStatus(e), detail: safeDetail(e) });
  }
});

// ---------- aurora: components (limit + next_cursor + has_more) ----------
app.get("/aurora/modules", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const limit = getIntParam(req, res, "limit", { min: 1, max: 50, def: 50 }); if (limit == null) return;
    const cursor = req.query.cursor || undefined;
    const page = await aurora.listModules({ limit, cursor });
    res.json({ modules: page.items, limit: page.limit, next_cursor: page.next_cursor, has_more: page.has_more });
  } catch (e) {
    res.status(apiStatus(e)).json({ type: "about:blank", title: "aurora_modules_failed", status: apiStatus(e), detail: safeDetail(e) });
  }
});

app.get("/aurora/inverters", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const limit = getIntParam(req, res, "limit", { min: 1, max: 50, def: 50 }); if (limit == null) return;
    const cursor = req.query.cursor || undefined;
    const page = await aurora.listInverters({ limit, cursor });
    res.json({ inverters: page.items, limit: page.limit, next_cursor: page.next_cursor, has_more: page.has_more });
  } catch (e) {
    res.status(apiStatus(e)).json({ type: "about:blank", title: "aurora_inverters_failed", status: apiStatus(e), detail: safeDetail(e) });
  }
});

app.get("/aurora/dc-optimizers", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const limit = getIntParam(req, res, "limit", { min: 1, max: 50, def: 50 }); if (limit == null) return;
    const cursor = req.query.cursor || undefined;
    const page = await aurora.listDcOptimizers({ limit, cursor });
    res.json({ dc_optimizers: page.items, limit: page.limit, next_cursor: page.next_cursor, has_more: page.has_more });
  } catch (e) {
    res.status(apiStatus(e)).json({ type: "about:blank", title: "aurora_dc_optimizers_failed", status: apiStatus(e), detail: safeDetail(e) });
  }
});

// ---------- apply rate limit to aurora and compare namespaces ----------
app.use('/aurora', rateLimit(100, 60_000));
app.use('/compare', rateLimit(60, 60_000));

// ---------- LRU TTL cache for aurora lists ----------
class LruTtl {
  constructor(max = 100) { this.map = new Map(); this.max = max; }
  get(key) {
    const v = this.map.get(key);
    if (!v) return null;
    if (Date.now() > v.expires) { this.map.delete(key); return null; }
    // refresh recency
    this.map.delete(key); this.map.set(key, v);
    return v.data;
  }
  set(key, data, ttlMs = 30_000) {
    if (this.map.size >= this.max) {
      // delete least-recently used (first entry)
      const first = this.map.keys().next();
      if (!first.done) this.map.delete(first.value);
    }
    this.map.set(key, { data, expires: Date.now() + ttlMs });
  }
}
const cache = new LruTtl(200);
function getCache(key) { return cache.get(key); }
function setCache(key, value, ttl) { return cache.set(key, value, ttl); }

// wrap the list endpoints with cache
app.get('/aurora/modules', async (req, res, next) => {
  const key = `modules:${req.query.limit || 50}:${req.query.cursor || ''}`;
  const hit = getCache(key);
  if (hit) return res.json(hit);
  next();
});
app.get('/aurora/inverters', async (req, res, next) => {
  const key = `inverters:${req.query.limit || 50}:${req.query.cursor || ''}`;
  const hit = getCache(key);
  if (hit) return res.json(hit);
  next();
});
app.get('/aurora/dc-optimizers', async (req, res, next) => {
  const key = `dcopt:${req.query.limit || 50}:${req.query.cursor || ''}`;
  const hit = getCache(key);
  if (hit) return res.json(hit);
  next();
});

// after responses, store in cache
const originalJson = res => res.json;
// monkey-patch for caching only for aurora list routes
// keep simple: apply per-request flag
app.use((req, res, next) => {
  const keyMap = req.originalUrl.startsWith('/aurora/modules') ? `modules:${req.query.limit || 50}:${req.query.cursor || ''}`
    : req.originalUrl.startsWith('/aurora/inverters') ? `inverters:${req.query.limit || 50}:${req.query.cursor || ''}`
    : req.originalUrl.startsWith('/aurora/dc-optimizers') ? `dcopt:${req.query.limit || 50}:${req.query.cursor || ''}`
    : null;
  if (!keyMap) return next();
  const sendJson = res.json.bind(res);
  res.json = (body) => { try { setCache(keyMap, body, 30_000); } catch {} return sendJson(body); };
  next();
});

// ================== IMPORTANT ORDER: more specific FIRST ==================

// ---------- AVL lookup ----------
app.get('/avl/lookup', (req, res) => {
  const manufacturer = (req.query.manufacturer || '').toString().trim();
  const model = (req.query.model || '').toString().trim();
  if (!manufacturer) return res.status(400).json({ type: 'about:blank', title: 'invalid_parameter', param: 'manufacturer' });
  if (!model) return res.status(400).json({ type: 'about:blank', title: 'invalid_parameter', param: 'model' });
  try {
    const matches = avl.lookup({ manufacturer, model });
    return res.json({ manufacturer, model, matches });
  } catch (e) {
    return res.status(500).json({ type: 'about:blank', title: 'avl_lookup_failed', detail: e.message });
  }
});

// ---------- AVL BOM validate ----------
app.post('/avl/validate-bom', (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ type: 'about:blank', title: 'invalid_body', detail: 'items[] required' });
    const report = avl.validateBom(items);
    return res.json(report);
  } catch (e) {
    return res.status(500).json({ type: 'about:blank', title: 'avl_validate_bom_failed', detail: e.message });
  }
});

// ---------- AVL BOM validate by SKU ----------
app.post('/avl/validate-bom-by-sku', async (req, res) => {
  try {
    const skus = Array.isArray(req.body?.skus) ? req.body.skus : [];
    if (!skus.length) return res.status(400).json({ type: 'about:blank', title: 'invalid_body', detail: 'skus[] required' });
    const parts = await prisma.part.findMany({ where: { sku: { in: skus } } });
    const items = parts.map(p => {
      const sku = (p.sku || '').toString();
      const name = (p.name || '').toString();
      const brand = (p.brand || p.vendor || p.manufacturer || '').toString();
      // Heuristic: "EATON BR220 - (20A)" => manufacturer=Eaton, model=BR220
      let manufacturer = brand.trim();
      let model = '';
      const m = sku.match(/^([A-Za-z]+)\s+([A-Za-z0-9-]+)/);
      if (m) {
        manufacturer = manufacturer || m[1];
        model = m[2];
      } else {
        // Try from name like "Breakers BR220 (20A)" => model BR220
        const n = name.match(/\b([A-Za-z0-9-]{3,})\b/);
        if (n) model = n[1];
      }
      // Normalize capitalization for manufacturer
      if (manufacturer) manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
      return { manufacturer: manufacturer || 'UNKNOWN', model: model || sku, sku };
    });
    const report = avl.validateBom(items);
    return res.json(report);
  } catch (e) {
    return res.status(500).json({ type: 'about:blank', title: 'avl_validate_bom_by_sku_failed', detail: e.message });
  }
});

// ---------- AVL BOM report by SKU (CSV) ----------
app.post('/avl/validate-bom-by-sku/report', async (req, res) => {
  try {
    const skus = Array.isArray(req.body?.skus) ? req.body.skus : [];
    if (!skus.length) return res.status(400).json({ type: 'about:blank', title: 'invalid_body', detail: 'skus[] required' });
    const parts = await prisma.part.findMany({ where: { sku: { in: skus } } });
    const items = parts.map(p => {
      const sku = (p.sku || '').toString();
      const name = (p.name || '').toString();
      const brand = (p.brand || p.vendor || p.manufacturer || '').toString();
      let manufacturer = brand.trim();
      let model = '';
      const m = sku.match(/^([A-Za-z]+)\s+([A-Za-z0-9-]+)/);
      if (m) {
        manufacturer = manufacturer || m[1];
        model = m[2];
      } else {
        const n = name.match(/\b([A-Za-z0-9-]{3,})\b/);
        if (n) model = n[1];
      }
      if (manufacturer) manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
      return { manufacturer: manufacturer || 'UNKNOWN', model: model || sku, sku };
    });
    const report = avl.validateBom(items);
    const csv = avl.toCsv(report);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="avl-report-by-sku.csv"');
    return res.send(csv);
  } catch (e) {
    return res.status(500).send(e.message);
  }
});

// ---------- Text SKUs to CSV (GET helper + POST handler) ----------
app.get('/avl/validate-bom-by-sku/text', (req, res) => {
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>Text SKUs → CSV</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;margin:24px;max-width:900px} textarea{width:100%;height:220px} button{padding:8px 14px;margin-top:8px}</style>
  </head><body>
  <h1>Text SKUs → CSV</h1>
  <p>Paste one SKU per line and click Download CSV.</p>
  <textarea id="skus">EATON BR220 - (20A)\nGEN-INVX-5000W</textarea><br>
  <button id="go">Download CSV</button>
  <script>
  document.getElementById('go').onclick = async () => {
    const text = document.getElementById('skus').value;
    const resp = await fetch('/avl/validate-bom-by-sku/text', { method:'POST', headers:{'Content-Type':'text/plain'}, body:text });
    if (!resp.ok) { alert('Request failed: '+resp.status); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'avl-report-by-sku-text.csv'; a.click(); URL.revokeObjectURL(url);
  };
  </script>
  </body></html>`;
  res.type('html').send(html);
});

app.post('/avl/validate-bom-by-sku/text', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const text = (req.body || '').toString();
    const skus = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!skus.length) return res.status(400).json({ type: 'about:blank', title: 'invalid_body', detail: 'text with SKUs required' });
    const parts = await prisma.part.findMany({ where: { sku: { in: skus } } });
    const items = parts.map(p => {
      const sku = (p.sku || '').toString();
      const name = (p.name || '').toString();
      const brand = (p.brand || p.vendor || p.manufacturer || '').toString();
      let manufacturer = brand.trim();
      let model = '';
      const m = sku.match(/^([A-Za-z]+)\s+([A-Za-z0-9-]+)/);
      if (m) {
        manufacturer = manufacturer || m[1];
        model = m[2];
      } else {
        const n = name.match(/\b([A-Za-z0-9-]{3,})\b/);
        if (n) model = n[1];
      }
      if (manufacturer) manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
      return { manufacturer: manufacturer || 'UNKNOWN', model: model || sku, sku };
    });
    const csv = avl.toCsv(avl.validateBom(items));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="avl-report-by-sku-text.csv"');
    return res.send(csv);
  } catch (e) {
    return res.status(500).send(e.message);
  }
});

// ---------- Compliance summary (GET helper + POST handler) ----------
app.get('/reports/avl-compliance', (req, res) => {
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>AVL Compliance Summary</title>
  <style>body{font-family:system-ui,Segoe UI,Arial;margin:24px;max-width:900px} textarea{width:100%;height:220px} button{padding:8px 14px;margin-top:8px} select{margin-left:8px}</style>
  </head><body>
  <h1>AVL Compliance Summary</h1>
  <p>Paste JSON array of items with manufacturer/model/sku. Choose JSON or CSV.</p>
  <textarea id="items">{"items":[{"manufacturer":"Eaton","model":"BR220","sku":"EATON BR220 - (20A)"},{"manufacturer":"Gen","model":"INVX-5000W","sku":"GEN-INVX-5000W"}]}</textarea><br>
  <label>Format:</label><select id="fmt"><option value="json">JSON</option><option value="csv">CSV</option></select>
  <button id="go">Submit</button>
  <pre id="out" style="white-space:pre-wrap"></pre>
  <script>
  document.getElementById('go').onclick = async () => {
    const fmt = document.getElementById('fmt').value;
    let body; try { body = JSON.parse(document.getElementById('items').value); } catch(e){ alert('Invalid JSON'); return; }
    const url = fmt==='csv' ? '/reports/avl-compliance?format=csv' : '/reports/avl-compliance';
    const resp = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!resp.ok) { alert('Request failed: '+resp.status); return; }
    if (fmt==='csv') {
      const blob = await resp.blob(); const url2 = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url2; a.download = 'avl-compliance-summary.csv'; a.click(); URL.revokeObjectURL(url2);
    } else {
      const json = await resp.json(); document.getElementById('out').textContent = JSON.stringify(json, null, 2);
    }
  };
  </script>
  </body></html>`;
  res.type('html').send(html);
});

app.post('/reports/avl-compliance', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const asCsv = String(req.query?.format || req.body?.format || '').toLowerCase() === 'csv';
    const report = avl.validateBom(items);
    const summary = {
      total: report.total,
      approved_count: report.approved_count,
      domestic_count: report.domestic_count,
      approved_pct: report.total ? Number(((report.approved_count / report.total) * 100).toFixed(2)) : 0,
      domestic_pct: report.total ? Number(((report.domestic_count / report.total) * 100).toFixed(2)) : 0,
    };
    if (!asCsv) return res.json({ summary, items: report.items });
    const header = 'total,approved_count,domestic_count,approved_pct,domestic_pct\n';
    const line = `${summary.total},${summary.approved_count},${summary.domestic_count},${summary.approved_pct},${summary.domestic_pct}\n`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="avl-compliance-summary.csv"');
    return res.send(header + line);
  } catch (e) {
    return res.status(500).send(e.message);
  }
});

// ---------- Health details ----------
app.get('/health/details', async (req, res) => {
  try {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const details = {
      status: 'ok',
      uptime_seconds: Math.floor(uptime),
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
      aurora: aurora && typeof aurora.debugInfo === 'function' ? aurora.debugInfo() : null,
    };
    return res.json(details);
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---------- AVL BOM report (CSV) ----------
app.post('/avl/validate-bom/report', (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ type: 'about:blank', title: 'invalid_body', detail: 'items[] required' });
    const report = avl.validateBom(items);
    const csv = avl.toCsv(report);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="avl-report.csv"');
    return res.send(csv);
  } catch (e) {
    return res.status(500).send(e.message);
  }
});

// ---------- NEW: compare projects (page/per_page) ----------
app.get("/compare/projects", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const page = getIntParam(req, res, 'page', { min: 1, max: 100000, def: 1 }); if (page == null) return;
    const per_page = getIntParam(req, res, 'per_page', { min: 1, max: 50, def: 10 }); if (per_page == null) return;
    const designs_per_project = getIntParam(req, res, 'designs_per_project', { min: 1, max: 5, def: 1 }); if (designs_per_project == null) return;

    // Simple 30s in-memory cache keyed by pagination; speeds up repeat visits
    const compareCacheKey = `cmp:projects:p${page}:pp${per_page}:dpp${designs_per_project}`;
    if (!app.locals.compareCache) app.locals.compareCache = new Map();
    const cacheRec = app.locals.compareCache.get(compareCacheKey);
    if (cacheRec && cacheRec.expires > Date.now()) {
      res.setHeader("X-Compare-Cache", "HIT");
      try { compareCacheEvents.inc({ event: 'HIT' }); } catch {}
      return res.json(cacheRec.payload);
    }

    const proj = await aurora.listProjects({ page, per_page });

    // Build summaries in parallel for speed while keeping requests bounded
    const items = await Promise.all(
      proj.items.map(async (p) => {
        const d = await aurora.listDesigns(p.id, { page: 1, per_page: designs_per_project });
        const summaries = await Promise.all(
          d.items.map(async (z) => {
            const raw = await getDesignPricingCached(z.id, 300000);
            const pricing = raw && raw.pricing ? raw.pricing : raw;
            const cmp = await buildComparison(raw);
            return {
              design_id: z.id,
              name: z.name,
              ppw: pricing.price_per_watt ?? null,
              base_system_price: pricing.system_price ?? pricing.system_cost ?? null,
              totals: cmp.summary,
            };
          })
        );
        // Derive optional archive/sales fields to match FE card format without changing FE
        const first = summaries[0] || {};
        const ppwVal = Number(first.ppw) || null;
        const priceVal = Number(first.base_system_price) || null;
        const sizeKw = ppwVal && priceVal ? Number((priceVal / ppwVal / 1000).toFixed(1)) : null;
        const taxCredit = priceVal ? Math.round(priceVal * 0.30) : null;

        // Rebuild the first design comparison to compute FEOC consistently.
        let feoc = null;
        let domesticPct = null;
        let totals = first.totals || null;
        if (first.design_id) {
          const raw = await getDesignPricingCached(first.design_id, 300000);
          const cmp = await buildComparison(raw);
          totals = cmp.summary;
          const feocEval = evaluateFeoc({
            items: cmp.items,
            installationYear: new Date().getFullYear(),
            maxNetOutputMW: sizeKw == null ? null : (sizeKw / 1000),
          });
          feoc = feocEval?.compliance?.feocCompliant ?? null;
          // Only surface a domesticContent percent if evaluator computed it (no unknown manufactured costs)
          domesticPct = feocEval?.percentages?.manufactured_domestic_percent ?? null;
        }

        return {
          project_id: p.id,
          project_name: p.name,
          designs: summaries,
          totals: first.totals || null,
          // Optional fields for Project Archives cards (FE uses fallbacks if undefined)
          customerName: p.name || null,
          projectType: 'residential',
          systemSize: sizeKw,
          totalCost: priceVal,
          domesticContent: domesticPct,
          feocCompliant: feoc,
          taxCreditAmount: taxCredit,
          profitMargin: null,
          completedDate: (p?.updated_at || p?.created_at) ? new Date(p.updated_at || p.created_at).toISOString().slice(0, 10) : null,
          location: null,
          status: 'completed',
        };
      })
    );

    const payload = {
      page: proj.page,
      per_page: proj.per_page,
      has_more: proj.has_more,
      items,
      cache_ttl_ms: 30000,
    };
    app.locals.compareCache.set(compareCacheKey, { payload, expires: Date.now() + 30_000 });
    res.setHeader("X-Compare-Cache", "MISS");
    try { compareCacheEvents.inc({ event: 'MISS' }); } catch {}
    res.json(payload);
  } catch (e) {
    res.status(apiStatus(e)).json({
      type: "about:blank",
      title: "compare_projects_failed",
      status: apiStatus(e),
      detail: safeDetail(e),
      request_id: req.requestId,
    });
  }
});

// ---------- compare: find matching design(s) by part SKU ----------
app.get('/compare/find-by-sku', rateLimit(30, 60_000), async (req, res) => {
  try {
    if (!aurora) throw new Error('Aurora not initialized');
    const sku = req.query.sku?.toString().trim().slice(0, 100);
    if (!sku) return res.status(400).json({ type: 'about:blank', title: 'invalid_parameter', param: 'sku' });

    const page = getIntParam(req, res, 'page', { min: 1, max: 100000, def: 1 }); if (page == null) return;
    const per_page = getIntParam(req, res, 'per_page', { min: 1, max: 50, def: 25 }); if (per_page == null) return;
    const designs_per_project = getIntParam(req, res, 'designs_per_project', { min: 1, max: 5, def: 2 }); if (designs_per_project == null) return;
    const limit = getIntParam(req, res, 'limit', { min: 1, max: 25, def: 5 }); if (limit == null) return;

    const skuLower = sku.toLowerCase();
    const cacheKey = `cmp:find_sku:${skuLower}:p${page}:pp${per_page}:dpp${designs_per_project}:l${limit}`;
    if (!app.locals.compareSkuCache) app.locals.compareSkuCache = new Map();
    const cacheRec = app.locals.compareSkuCache.get(cacheKey);
    if (cacheRec && cacheRec.expires > Date.now()) {
      res.setHeader('X-Compare-Cache', 'HIT');
      return res.json(cacheRec.payload);
    }

    const proj = await aurora.listProjects({ page, per_page });
    const matches = [];

    for (const p of proj.items) {
      if (matches.length >= limit) break;
      const d = await aurora.listDesigns(p.id, { page: 1, per_page: designs_per_project });
      for (const z of d.items) {
        if (matches.length >= limit) break;
        const raw = await getDesignPricingCached(z.id, 300000);
        const cmp = await buildComparison(raw);
        const hasSku = (cmp.items || []).some((it) => String(it?.matched_sku || '').toLowerCase() === skuLower);
        if (!hasSku) continue;
        matches.push({
          project_id: p.id,
          project_name: p.name || null,
          design_id: z.id,
          design_name: z.name || null,
        });
      }
    }

    const payload = {
      sku,
      found: matches.length > 0,
      matches,
      searched: { page: proj.page, per_page: proj.per_page, designs_per_project },
      cache_ttl_ms: 30000,
    };
    app.locals.compareSkuCache.set(cacheKey, { payload, expires: Date.now() + 30_000 });
    res.setHeader('X-Compare-Cache', 'MISS');
    return res.json(payload);
  } catch (e) {
    return res.status(apiStatus(e)).json({
      type: 'about:blank',
      title: 'compare_find_by_sku_failed',
      status: apiStatus(e),
      detail: safeDetail(e),
      request_id: req.requestId,
    });
  }
});

// ---------- compare single design ----------
app.get("/compare/:designId", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const [raw, meta] = await Promise.all([
      getDesignPricingCached(req.params.designId, 300000),
      getDesignMetaCached(req.params.designId, 300000),
    ]);
    const p = raw && raw.pricing ? raw.pricing : raw;

    const cmp = await buildComparison(raw);
    const year = req.query?.year ? Number(req.query.year) : new Date().getFullYear();
    const maxNetOutputMW = req.query?.max_net_output_mw != null ? Number(req.query.max_net_output_mw) : null;
    const constructionStartDate = req.query?.construction_start_date ?? null;
    const prevailingWageCompliant = req.query?.prevailing_wage_compliant ?? null;
    const feoc = evaluateFeoc({
      items: cmp.items,
      installationYear: year,
      maxNetOutputMW,
      constructionStartDate,
      prevailingWageCompliant,
    });

    res.json({
      design_id: req.params.designId,
      pricing_method: p.pricing_method ?? p.pricing_mode ?? null,
      ppw: p.price_per_watt ?? null,
      base_system_price: p.system_price ?? p.system_cost ?? null,
      incentives: p.incentives ?? [],
      component_count: Array.isArray(p?.pricing_by_component) ? p.pricing_by_component.length : 0,
      preview_url: meta?.preview_url ?? null,
      feoc,
      ...cmp, // { items, summary }
    });
  } catch (e) {
    res.status(apiStatus(e)).json({
      type: "about:blank",
      title: "compare_failed",
      status: apiStatus(e),
      detail: safeDetail(e),
      request_id: req.requestId,
    });
  }
});

// ---------- FEOC evaluate (IRS-style, cost-based) ----------
app.post('/feoc/evaluate', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const project = req.body?.project || {};
    const year = project.installationYear ?? project.year ?? new Date().getFullYear();
    const result = evaluateFeoc({
      items,
      installationYear: year,
      maxNetOutputMW: project.maxNetOutput ?? project.maxNetOutputMW ?? project.maxNetOutputMw ?? null,
      constructionStartDate: project.constructionStartDate ?? null,
      prevailingWageCompliant: project.prevailingWageCompliant ?? null,
    });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({
      type: 'about:blank',
      title: 'feoc_evaluate_failed',
      status: 500,
      detail: safeDetail(e),
      request_id: req.requestId,
    });
  }
});

// ---------- archives projects (card-friendly payload) ----------
app.get("/archives/projects", async (req, res) => {
  try {
    if (!aurora) throw new Error("Aurora not initialized");
    const page = getIntParam(req, res, 'page', { min: 1, max: 100000, def: 1 }); if (page == null) return;
    const per_page = getIntParam(req, res, 'per_page', { min: 1, max: 50, def: 12 }); if (per_page == null) return;
    const designs_per_project = 1; // for archives, just the first design summary

    // Small cache for archives as well
    const archKey = `arch:projects:p${page}:pp${per_page}`;
    if (!app.locals.archivesCache) app.locals.archivesCache = new Map();
    const archHit = app.locals.archivesCache.get(archKey);
    if (archHit && archHit.expires > Date.now()) {
      res.setHeader("X-Archives-Cache", "HIT");
      return res.json(archHit.payload);
    }

    const proj = await aurora.listProjects({ page, per_page });

    const items = await Promise.all(
      proj.items.map(async (p) => {
        const d = await aurora.listDesigns(p.id, { page: 1, per_page: designs_per_project });
        const firstDesign = d.items[0];
        let ppwVal = null, priceVal = null, totals = null, keyParts = [], cmpItems = null;
        if (firstDesign) {
          const raw = await getDesignPricingCached(firstDesign.id, 300000);
          const pricing = raw && raw.pricing ? raw.pricing : raw;
          const cmp = await buildComparison(raw);
          ppwVal = Number(pricing?.price_per_watt) || null;
          priceVal = Number(pricing?.system_price ?? pricing?.system_cost) || null;
          totals = cmp?.summary || null;
          cmpItems = Array.isArray(cmp?.items) ? cmp.items : null;
          // Build top key parts by highest line total (up to 3)
          if (Array.isArray(cmp?.items)) {
            keyParts = cmp.items
              .slice()
              .sort((a, b) => (b.line_total || 0) - (a.line_total || 0))
              .slice(0, 3)
              .map((x) => x.name)
              .filter(Boolean);
          }
        }

        const sizeKw = ppwVal && priceVal ? Number((priceVal / ppwVal / 1000).toFixed(1)) : null;
        const taxCredit = priceVal ? Math.round(priceVal * 0.30) : null;

        const completedDate = (p?.updated_at || p?.created_at)
          ? new Date(p.updated_at || p.created_at).toISOString().slice(0, 10)
          : null;
        const year = completedDate ? new Date(completedDate).getFullYear() : new Date().getFullYear();
        const maxOutputMW = sizeKw == null ? null : (sizeKw / 1000);

        const feocEval = evaluateFeoc({
          items: cmpItems,
          installationYear: year,
          maxNetOutputMW: maxOutputMW,
        });

        const domesticPct = feocEval?.percentages?.manufactured_domestic_percent ?? null;
        const feoc = feocEval?.compliance?.feocCompliant ?? null;

        return {
          projectId: p.id,
          projectName: p.name,
          customerName: p.name || null,
          projectType: 'residential',
          systemSize: sizeKw,
          totalCost: priceVal,
          domesticContent: domesticPct,
          feocCompliant: feoc,
          taxCreditAmount: taxCredit,
          profitMargin: null,
          completedDate,
          location: null,
          status: 'completed',
          keyParts,
          complianceDetails: totals ? {
            ...totals,
            domesticContent: domesticPct,
            feocCompliant: feoc,
            steelIronCompliant: feocEval?.compliance?.steelIronCompliant ?? null,
            manufacturedProductsCompliant: feocEval?.compliance?.manufacturedProductsCompliant ?? null,
            requiredDomestic: feocEval?.inputs?.requiredManufacturedDomesticPercent ?? null,
            projectEligible: feocEval?.eligibility?.eligible ?? null,
            smallProject: feocEval?.eligibility?.reasons?.smallProject ?? null,
            earlyConstruction: feocEval?.eligibility?.reasons?.earlyConstruction ?? null,
            prevailingWageCompliant: feocEval?.eligibility?.reasons?.prevailingWage ?? null,
            feocBreakdown: feocEval,
          } : null,
        };
      })
    );

    const payload = {
      page: proj.page,
      per_page: proj.per_page,
      has_more: proj.has_more,
      items,
      cache_ttl_ms: 30000,
    };
    app.locals.archivesCache.set(archKey, { payload, expires: Date.now() + 30_000 });
    res.setHeader("X-Archives-Cache", "MISS");
    return res.json(payload);
  } catch (e) {
    res.status(apiStatus(e)).json({
      type: "about:blank",
      title: "archives_projects_failed",
      status: apiStatus(e),
      detail: safeDetail(e),
      request_id: req.requestId,
    });
  }
});

// ================== END ORDER SENSITIVE SECTION ==================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
