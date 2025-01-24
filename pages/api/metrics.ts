import { NextApiRequest, NextApiResponse } from 'next';
import client from 'prom-client';

const register = new client.Registry();

// Default metrics
client.collectDefaultMetrics({ register });

// HTTP requests counter
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestCounter);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  httpRequestCounter.inc({
    method: req.method,
    route: req.url,
    status_code: res.statusCode,
  });

  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
}
