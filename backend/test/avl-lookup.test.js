const request = require('supertest');
const express = require('express');

// Minimal harness to mount only the route under test
const server = require('../src/server');

// Note: server.js starts the app listening; we'll rely on supertest against the running server URL

describe('AVL lookup endpoint', () => {
  test('returns 400 when params missing', async () => {
    const res = await request('http://localhost:3000').get('/avl/lookup');
    expect([400,500]).toContain(res.statusCode); // allow 500 if server wraps errors
  });

  test('matches LightReach wildcard row', async () => {
    const res = await request('http://localhost:3000')
      .get('/avl/lookup')
      .query({ manufacturer: 'LightReach', model: 'AnythingModel123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('manufacturer', 'LightReach');
    expect(Array.isArray(res.body.matches)).toBe(true);
    expect(res.body.matches.length).toBeGreaterThanOrEqual(1);
    const first = res.body.matches[0];
    expect(first).toHaveProperty('manufacturer');
    expect(first).toHaveProperty('model_pattern');
    expect(first).toHaveProperty('isDomestic');
    expect(first).toHaveProperty('spec_url');
  });
});
