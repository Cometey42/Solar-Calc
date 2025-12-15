const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: 3000, path }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

describe('backend smoke', () => {
  test('health returns ok', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(true);
    expect(json.db).toBe('up');
  });

  test('search returns items array', async () => {
    const res = await get('/search?page=1&page_size=5&q=a');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(Array.isArray(json.items)).toBe(true);
  });

  test('aurora modules returns array', async () => {
    const res = await get('/aurora/modules?limit=5');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(Array.isArray(json.modules)).toBe(true);
  });
});
