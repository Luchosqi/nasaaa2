// Service worker: lets the experience run with no connection on any phone, tablet or computer.
// - Pages and code: network first (updates show up at once), cached copy when offline.
// - Textures, models and vendor libraries: cache first.
// - "Save for offline" (start screen) asks it to download every file in offline-files.json.
const CACHE = 'abnf-v1';
const CODE = /(\.(html|js|mjs|css|json)|\/)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/sw.js')) return;
  if (req.headers.has('range')) return;
  e.respondWith(handle(req, url));
});

function timeout(ms) { return new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms)); }

async function handle(req, url) {
  const cache = await caches.open(CACHE);
  const nav = req.mode === 'navigate';
  // ?go=eagle&pace=step all open the same page
  const key = nav ? new URL(url.pathname, url.origin).href : req;
  if (nav || CODE.test(url.pathname)) {
    try {
      const res = await Promise.race([fetch(req), timeout(6000)]);
      if (res.ok) cache.put(key, res.clone());
      return res;
    } catch {
      const hit = await cache.match(key, { ignoreSearch: true });
      return hit || Response.error();
    }
  }
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) cache.put(req, res.clone());
  return res;
}

self.addEventListener('message', (e) => {
  if (e.data?.type === 'save' && Array.isArray(e.data.urls)) e.waitUntil(saveAll(e.data.urls, !!e.data.refresh, e.source));
});

async function saveAll(urls, refresh, client) {
  const cache = await caches.open(CACHE);
  let done = 0, failed = 0, next = 0;
  const errors = [];
  const fetchPut = async (u) => {
    const res = await fetch(u, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    await cache.put(u, res);
  };
  const one = async (u) => {
    try {
      if (refresh || !(await cache.match(u))) {
        // The page may be loading the same file through the fetch handler at this moment;
        // if the two cache writes collide, check whether the other one landed, else retry.
        try { await fetchPut(u); } catch (err) { if (!(await cache.match(u))) await fetchPut(u); }
      }
    } catch (err) { failed++; errors.push(u + ' ' + (err?.message || err)); }
    done++;
    client?.postMessage({ type: 'save-progress', done, total: urls.length, failed, errors });
  };
  const worker = async () => { while (next < urls.length) await one(urls[next++]); };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
