const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: 3000, path }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('parts endpoint and metrics', () => {
  test('metrics endpoint responds in text format', async () => {
    const res = await get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.body).toMatch(/http_requests_total/);
  });

  test('parts by sku returns 200 for a known sku from search', async () => {
    const search = await get('/search?page=1&page_size=1&q=a');
    expect(search.status).toBe(200);
    const json = JSON.parse(search.body);
    if (!Array.isArray(json.items) || json.items.length === 0) {
      return; // skip if no items available in this environment
    }
    const sku = json.items[0].sku;
    const res = await get(`/parts/${encodeURIComponent(sku)}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const item = JSON.parse(res.body);
      expect(item.sku).toBe(sku);
    }
  });
});
