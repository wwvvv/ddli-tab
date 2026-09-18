// Test-only composition of two loopback upstreams. This is NOT an EdgeOne adapter.
import http from 'node:http';

export function selectMigrationUpstream(pathname, publicFiles) {
  if (pathname === '/os' || pathname.startsWith('/os/') ||
      pathname === '/api/v1' || pathname.startsWith('/api/v1/') ||
      pathname === '/_next' || pathname.startsWith('/_next/')) return 'next';
  if (['/', '/index.html', '/newtab.html', '/popup.html', '/console', '/console/'].includes(pathname) ||
      pathname.startsWith('/s/') || pathname.startsWith('/api/') || publicFiles.has(pathname)) return 'legacy';
  return 'next';
}

function loopbackOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new Error('Migration test upstream must be an http://127.0.0.1 origin');
  return url;
}

/** Overrides are for lifecycle fixtures, never driven by HTTP request parameters. */
export function createMigrationOrigin({ legacyOrigin, nextOrigin, publicFiles, override }) {
  const upstreams = { legacy: loopbackOrigin(legacyOrigin), next: loopbackOrigin(nextOrigin) };
  const files = new Set(publicFiles);
  return http.createServer(async (req, res) => {
    try {
      if (!req.url?.startsWith('/') || req.url.startsWith('//')) {
        res.writeHead(400).end();
        return;
      }
      const url = new URL(req.url, 'http://127.0.0.1');
      if (override && await override(url.pathname, req, res)) return;
      const kind = selectMigrationUpstream(url.pathname, files);
      const upstream = upstreams[kind];
      // Preserve request bytes/query and headers, but never let the caller choose an upstream.
      const forwarded = http.request({
        hostname: upstream.hostname,
        port: upstream.port,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: upstream.host },
      }, (response) => {
        res.writeHead(response.statusCode ?? 502, {
          ...response.headers,
          'x-dtab-test-upstream': kind,
        });
        response.on('error', () => res.destroy());
        response.pipe(res);
      });
      forwarded.setTimeout(15000, () => forwarded.destroy(new Error('Test upstream timeout')));
      forwarded.on('error', () => {
        if (res.destroyed) return;
        if (res.headersSent) return res.destroy();
        res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: { code: 'TEST_UPSTREAM_UNAVAILABLE' } }));
      });
      req.on('aborted', () => forwarded.destroy());
      res.on('close', () => { if (!res.writableFinished) forwarded.destroy(); });
      req.pipe(forwarded);
    } catch {
      if (res.headersSent) res.destroy();
      else res.writeHead(500).end('Migration test fixture failed');
    }
  });
}

export async function listenLoopback(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

export async function closeTestServer(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
