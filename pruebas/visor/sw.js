/* Visor · poca red. Guarda la carcasa y la demo. No guarda playlist ni stock ni vídeo. */
const CACHE = 'visor-5563-v2';
const SHELL = [
  '/pruebas/visor/',
  '/pruebas/visor/index.html',
  '/pruebas/visor/visor.css?v=20261010-visor-5563',
  '/pruebas/visor/visor.js?v=20261010-visor-5563',
  '/pruebas/visor/demo/',
  '/pruebas/visor/demo/index.html',
  '/pruebas/visor/demo.json',
  '/pruebas/frontier/assets/frontier.js?v=20261010-frontier-2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (/stock\.admira\.store|admira\.tv\/api\/playlist|video|mp4|webm/i.test(url.href)) return;
  if (!url.pathname.startsWith('/pruebas/visor/') && !url.pathname.endsWith('/frontier.js')) return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
      if (res.ok && url.origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match('/pruebas/visor/demo/index.html')))
  );
});
