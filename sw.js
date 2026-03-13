const CACHE = 'attendance-v1';
const STATIC = [
  '/',
  '/dashboard.html',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   API calls → network only (always fresh data)
//   Static assets → cache first, fallback network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for API
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'You are offline. Cannot fetch live data.' }),
          { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Cache first for everything else
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
    ).catch(() => caches.match('/dashboard.html'))
  );
});
