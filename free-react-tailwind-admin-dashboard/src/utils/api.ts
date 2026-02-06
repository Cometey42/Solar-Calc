/**
 * API Utility for Solar-Calc Admin Dashboard
 * Connects to Express backend running on port 3000
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheData = any;

// Simple in-memory cache
const cache = new Map<string, { data: CacheData; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): CacheData | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key: string, data: CacheData): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

// Optimized fetch with caching
async function cachedFetch(url: string, useCache = true) {
  if (useCache) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  const data = await response.json();
  if (useCache) {
    setCache(url, data);
  }
  return data;
}

// API Functions
export const api = {
  // Parts Management - Search parts from database
  async getParts(search = '', limit = 50) {
    const params = new URLSearchParams();
    if (search) params.append('q', search);  // Use 'q' parameter for search
    params.append('page_size', Math.min(limit, 100).toString());  // Use 'page_size' with max 100
    params.append('page', '1');
    return cachedFetch(`${API_BASE_URL}/search?${params}`);
  },
  async getPartBySku(sku: string) {
    return cachedFetch(`${API_BASE_URL}/parts/${sku}`);
  },

  async createPart(partData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partData),
    });
    if (!response.ok) throw new Error(`Failed to create part: ${response.statusText}`);
    return response.json();
  },

  async updatePart(sku: string, partData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/parts/${sku}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partData),
    });
    if (!response.ok) throw new Error(`Failed to update part: ${response.statusText}`);
    return response.json();
  },

  async deletePart(sku: string) {
    const response = await fetch(`${API_BASE_URL}/parts/${sku}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to delete part: ${response.statusText}`);
    return response.json();
  },

  // Materials Catalog
  async getMaterials(search = '', type = '') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);
    return cachedFetch(`${API_BASE_URL}/materials?${params}`);
  },
  // FEOC Calculator
  async runFeocCalculation(projectData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/feoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    if (!response.ok) throw new Error(`FEOC calculation failed: ${response.statusText}`);
    return response.json();
  },

  // Compare/Comparison
  async runComparison(compareData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(compareData),
    });
    if (!response.ok) throw new Error(`Comparison failed: ${response.statusText}`);
    return response.json();
  },

  async getComparison(id: string) {
    return cachedFetch(`${API_BASE_URL}/comparisons/${id}`, false);
  },
  // Project Archives
  async getProjects(page = 1, perPage = 10) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    return cachedFetch(`${API_BASE_URL}/archives/projects?${params}`, false);
  },
  async getProject(id: string) {
    return cachedFetch(`${API_BASE_URL}/archives/projects/${id}`, false);
  },

  async createProject(projectData: Record<string, unknown>) {
    const response = await fetch(`${API_BASE_URL}/archives/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    if (!response.ok) throw new Error(`Failed to create project: ${response.statusText}`);
    return response.json();
  },

  async deleteProject(id: string) {
    const response = await fetch(`${API_BASE_URL}/archives/projects/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to delete project: ${response.statusText}`);
    return response.json();
  },

  // Metrics & Health
  async getMetrics() {
    return cachedFetch(`${API_BASE_URL}/metrics`, false);
  },

  async getHealth() {
    return cachedFetch(`${API_BASE_URL}/health`, false);
  },

  // AVL (Approved Vendor List)
  async getAvlParts(search = '') {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    return cachedFetch(`${API_BASE_URL}/avl?${params}`);
  },

  // Manufacturers
  async getManufacturers() {
    return cachedFetch(`${API_BASE_URL}/manufacturers`);
  },

  // Component Types
  async getComponentTypes() {
    return cachedFetch(`${API_BASE_URL}/component-types`);
  },

  // Export FEOC Vendor Template
  async exportFeocTemplate() {
    const response = await fetch(`${API_BASE_URL}/export/feoc-vendor-template`);
    if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
    return response.blob();
  },
};

export default api;
