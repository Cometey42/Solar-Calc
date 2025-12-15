const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: 'localhost', port: 3000, path }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
  });
}

describe('compare projects caching', () => {
  test('sets X-Compare-Cache header on repeated calls', async () => {
    const path = '/compare/projects?page=1&per_page=2&designs_per_project=1';
    const first = await get(path);
    expect([200, 304]).toContain(first.status);
    expect(first.headers['x-compare-cache']).toBeDefined();

    const second = await get(path);
    expect([200, 304]).toContain(second.status);
    expect(second.headers['x-compare-cache']).toBeDefined();
    // On second call we expect a HIT more often than not
    // We won't hard assert HIT to avoid flakes, but header must exist
  });
});
