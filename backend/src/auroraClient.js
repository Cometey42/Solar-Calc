// src/auroraClient.js
const axios = require("axios");
const { auroraRequestsTotal, auroraRequestDuration } = require('./metrics');

function makeAurora() {
  const base = process.env.AURORA_API_BASE || "https://api.aurorasolar.com";
  const tenantId = process.env.AURORA_TENANT_ID;
  const token = process.env.AURORA_API_TOKEN;
  const version = process.env.AURORA_API_VERSION || "2024.05";

  if (!tenantId || !token) throw new Error("Missing AURORA_TENANT_ID or AURORA_API_TOKEN in .env");

  // Standard HTTP client for all API calls
  const http = axios.create({
    baseURL: base.replace(/\/+$/, ""),
    timeout: Number(process.env.AURORA_TIMEOUT_MS || 10000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Aurora-Version": version,
      Accept: "application/json",
    },
  });

  // simple circuit breaker + retry
  const breaker = { failures: 0, open: false, openedAt: 0 };
  const MAX_FAILURES = Number(process.env.AURORA_MAX_FAILURES || 5);
  const COOL_DOWN_MS = Number(process.env.AURORA_COOLDOWN_MS || 30000);
  const MAX_RETRIES = Number(process.env.AURORA_MAX_RETRIES || 2);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isRetryable = (err) => {
    const status = err.response?.status;
    return err.code === 'ECONNABORTED' || !status || status >= 500;
  };
  async function callWithRetry(endpointLabel, fn) {
    const now = Date.now();
    if (breaker.open && now - breaker.openedAt < COOL_DOWN_MS) {
      auroraRequestsTotal.inc({ endpoint: endpointLabel, status: 'NA', result: 'circuit_open' });
      const e = new Error('aurora_circuit_open');
      e.code = 'AURORA_CIRCUIT_OPEN';
      throw e;
    }
    let attempt = 0;
    let lastErr;
    const endTimer = auroraRequestDuration.startTimer({ endpoint: endpointLabel, status: 'pending' });
    while (attempt <= MAX_RETRIES) {
      try {
        const res = await fn();
        breaker.failures = 0; breaker.open = false;
        endTimer({ status: 'success' });
        auroraRequestsTotal.inc({ endpoint: endpointLabel, status: '200', result: 'success' });
        return res;
      } catch (err) {
        lastErr = err;
        const status = String(err.response?.status || 'ERR');
        if (isRetryable(err) && attempt < MAX_RETRIES) {
          auroraRequestsTotal.inc({ endpoint: endpointLabel, status, result: 'retry' });
          attempt++;
          await sleep(Math.min(1000 * attempt, 2000));
          continue;
        }
        breaker.failures++;
        if (breaker.failures >= MAX_FAILURES) { breaker.open = true; breaker.openedAt = Date.now(); }
        endTimer({ status: 'error' });
        auroraRequestsTotal.inc({ endpoint: endpointLabel, status, result: 'error' });
        throw err;
      }
    }
    throw lastErr;
  }

  // ---------- Components (limit + possible cursor) ----------
  async function listModules({ limit = 50, cursor } = {}) {
    const { data } = await callWithRetry('modules', () => http.get(`/tenants/${tenantId}/components/modules`, { params: { limit, cursor } }));
    // Normalize different shapes across versions
    const items = data.items || data.modules || [];
    return {
      items,
      next_cursor: data.next_cursor || null,
      limit,
      has_more: items.length >= Number(limit),
    };
  }
  async function listInverters({ limit = 50, cursor } = {}) {
    const { data } = await callWithRetry('inverters', () => http.get(`/tenants/${tenantId}/components/inverters`, { params: { limit, cursor } }));
    const items = data.items || data.inverters || [];
    return {
      items,
      next_cursor: data.next_cursor || null,
      limit,
      has_more: items.length >= Number(limit),
    };
  }
  async function listDcOptimizers({ limit = 50, cursor } = {}) {
    const { data } = await callWithRetry('dc_optimizers', () => http.get(`/tenants/${tenantId}/components/dc_optimizers`, { params: { limit, cursor } }));
    const items = data.items || data.dc_optimizers || [];
    return {
      items,
      next_cursor: data.next_cursor || null,
      limit,
      has_more: items.length >= Number(limit),
    };
  }

  // ---------- Pricing ----------
  async function getDesignPricing(designId) {
    console.log('[getDesignPricing] Fetching pricing for design:', designId);
    const { data } = await callWithRetry('design_pricing', () => http.get(`/tenants/${tenantId}/designs/${designId}/pricing`));
    console.log('[getDesignPricing] Got pricing data keys:', Object.keys(data));
    if (data.pricing_by_component) {
      console.log('[getDesignPricing] pricing_by_component length:', data.pricing_by_component.length);
    }
    return data.pricing || data; // normalize
  }

  // ---------- Projects & Designs (page/per_page) ----------
  async function listProjects({ page = 1, per_page = 50 } = {}) {
    console.log('[listProjects] Using standard token:', token.substring(0, 15) + '...');
    console.log('[listProjects] Authorization header:', http.defaults.headers.Authorization);
    const { data } = await callWithRetry('projects', () => http.get(`/tenants/${tenantId}/projects`, { params: { page, per_page } }));
    const items = data.projects || data.items || [];
    // Docs: without page params, first 100; with per_page max 250. :contentReference[oaicite:4]{index=4}
    return {
      items,
      page: Number(data.page ?? page),
      per_page: Number(data.per_page ?? per_page),
      total: data.total ?? undefined, // not always provided
      has_more: items.length >= Number(per_page),
    };
  }

  async function listDesigns(projectId, { page = 1, per_page = 50 } = {}) {
    const { data } = await callWithRetry('designs', () => http.get(`/tenants/${tenantId}/projects/${projectId}/designs`, { params: { page, per_page } }));
    const items = data.designs || data.items || [];
    return {
      items,
      page: Number(data.page ?? page),
      per_page: Number(data.per_page ?? per_page),
      total: data.total ?? undefined,
      has_more: items.length >= Number(per_page),
    };
  }

  // ---------- Design metadata (attempt to include preview/thumbnail if available) ----------
  async function getDesign(designId) {
    const { data } = await callWithRetry('design', () => http.get(`/tenants/${tenantId}/designs/${designId}`));
    // Try a few likely fields across versions
    const preview =
      data.preview_url ||
      data.thumbnail_url ||
      data.image_url ||
      data.render_url ||
      data.site_image_url ||
      (data.assets && Array.isArray(data.assets) ? (data.assets.find(a => /thumb|preview|image/i.test(a.name || a.type || ''))?.url) : undefined) ||
      null;
    return { raw: data, preview_url: preview };
  }

  function debugInfo() {
    return {
      base: http.defaults.baseURL,
      tenant: tenantId,
      version,
      hasToken: Boolean(token && token.length > 10),
    };
  }

  return {
    // components
    listModules, listInverters, listDcOptimizers,
    // pricing
    getDesignPricing,
    // entities
    listProjects, listDesigns,
    getDesign,
    // debug
    debugInfo,
  };
}

module.exports = makeAurora;
