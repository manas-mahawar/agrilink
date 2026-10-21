// Path-based gateway that makes the local services look like one Supabase project URL.
//   /auth/v1/*    -> Supabase Auth
//   /rest/v1/*    -> PostgREST
//   /storage/v1/* -> storage emulator
// Adds permissive CORS like hosted Supabase. TEST HARNESS ONLY.

import http from 'node:http';

const routes = [
  ['/auth/v1', Number(process.env.AUTH_PORT)],
  ['/rest/v1', Number(process.env.REST_PORT)],
  ['/storage/v1', Number(process.env.STORAGE_PORT)],
];
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, prefer, range, x-upsert, accept-profile, content-profile, x-supabase-api-version, cache-control',
  'access-control-expose-headers': 'content-range, x-total-count',
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    const match = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix + '/') || req.url.startsWith(prefix + '?'));
    if (!match) {
      res.writeHead(404, { 'content-type': 'application/json', ...cors });
      return res.end('{"error":"no route"}');
    }
    const [prefix, port] = match;
    const upstream = http.request(
      { host: '127.0.0.1', port, method: req.method, path: req.url.slice(prefix.length) || '/', headers: { ...req.headers, host: `127.0.0.1:${port}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify({ error: 'bad_gateway', message: e.message }));
    });
    req.pipe(upstream);
  })
  .listen(Number(process.env.GATEWAY_PORT ?? 54321), '127.0.0.1', () => console.log('gateway up'));
