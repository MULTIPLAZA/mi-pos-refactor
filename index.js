// ─── IMPORTANTE: cambiá este número cada vez que subas cambios al repo ───
// Esto fuerza a todos los dispositivos a descartar el caché viejo y bajar
// los archivos nuevos. Usá la fecha del día: YYYYMMDD-HHmm
const CACHE = 'ampersand-pos-v20260327-1600';
// ─────────────────────────────────────────────────────────────────────────

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/js/ui.js',
  '/js/ventas.js',
  '/js/cobro.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Dejar pasar siempre a la red: Supabase y CDNs externos
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('jsdelivr.net')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('cdnjs.cloudflare.com')) return;

  // Network First: intenta red primero, usa caché si falla
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(cached => cached || caches.match('/'))
      )
  );
});
