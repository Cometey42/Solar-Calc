// src/metrics.js
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10]
});

const auroraRequestsTotal = new client.Counter({
  name: 'aurora_requests_total',
  help: 'Aurora API requests total',
  labelNames: ['endpoint', 'status', 'result'] // result: success|error|retry|circuit_open
});

const auroraRequestDuration = new client.Histogram({
  name: 'aurora_request_duration_seconds',
  help: 'Aurora API request duration in seconds',
  labelNames: ['endpoint', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10]
});

const compareCacheEvents = new client.Counter({
  name: 'compare_cache_events_total',
  help: 'Compare projects cache events',
  labelNames: ['event'] // HIT|MISS
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(auroraRequestsTotal);
register.registerMetric(auroraRequestDuration);
register.registerMetric(compareCacheEvents);

module.exports = {
  client,
  register,
  httpRequestsTotal,
  httpRequestDuration,
  auroraRequestsTotal,
  auroraRequestDuration,
  compareCacheEvents,
};
