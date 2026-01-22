const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

// Optimized fetch with caching
async function cachedFetch(url, useCache = true) {
  if (useCache) {
    const cached = getCached(url);
    if (cached) return cached;
  }
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
    // Add keepalive for persistent connections
    keepalive: true,
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  
  if (useCache) setCache(url, data);
  return data;
}

export function fetchProjects({ page = 1, perPage = 10 } = {}) {
  const url = `${API_BASE_URL}/compare/projects?page=${page}&per_page=${perPage}`;
  return cachedFetch(url).catch(() => ({ items: [], page, per_page: perPage, has_more: false }));
}

export function fetchDesignDetails(designId) {
  if (!designId) return Promise.reject(new Error("No designId provided"));
  return fetch(`${API_BASE_URL}/compare/${designId}`)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch design details");
      return res.json();
    });
}

export async function fetchParts({ page = 1, parts = [], search = '' } = {}) {
  const query = search ? `&q=${encodeURIComponent(search)}` : '';
  const response = await fetch(`${API_BASE_URL}/search?page=${page}&page_size=50${query}`);
  
  if (response.ok) {
    const data = await response.json();
    return { parts: [...parts, ...data.items], hasMore: data.has_more };
  } else {
    throw new Error("Failed to fetch parts");
  }
}

export async function fetchFEOCCalculatorData() {
  try {
    const response = await fetch(`${API_BASE_URL}/feoc/data`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function fetchArchiveProjects({ page = 1, perPage = 12 } = {}) {
  const url = `${API_BASE_URL}/archives/projects?page=${page}&per_page=${perPage}`;  return cachedFetch(url).catch(() => ({ items: [] }));
}

export async function fetchPartBySku(sku) {
  if (!sku) throw new Error('No sku provided');
  const response = await fetch(`${API_BASE_URL}/parts/lookup?sku=${encodeURIComponent(sku)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch part');
  }
  return response.json();
}

export async function findCompareMatchBySku(sku, { limit = 1 } = {}) {
  if (!sku) throw new Error('No sku provided');
  const response = await fetch(
    `${API_BASE_URL}/compare/find-by-sku?sku=${encodeURIComponent(sku)}&limit=${encodeURIComponent(limit)}`
  );
  if (!response.ok) {
    throw new Error('Failed to find compare match');
  }
  return response.json();
}

export async function compareParts({ sku, q, limit = 50 } = {}) {
  if (!sku && !q) throw new Error('sku or q is required');
  const qs = new URLSearchParams();
  if (sku) qs.set('sku', sku);
  if (q) qs.set('q', q);
  qs.set('limit', String(limit));
  const response = await fetch(`${API_BASE_URL}/parts/compare?${qs.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to compare parts');
  }
  return response.json();
}