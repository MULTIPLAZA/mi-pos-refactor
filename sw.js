const CACHE = 'ampersand-pos-v2';

self.addEventListener('install', e => {
  // Pre-cache the main page
  e.waitUntil(
    caches.open(CACHE).then(c => c.add('/')).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Skip Supabase and external requests
  const url = new URL(e.request.url);
  if(!url.hostname.includes('workers.dev') && !url.hostname.includes('localhost')) return;
  if(e.request.url.includes('supabase.co')) return;

  e.respondWith(
    // Network first, fallback to cache
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline fallback: return cached version
        return caches.match(e.request)
          .then(cached => cached || caches.match('/'));
      })
  );
});
