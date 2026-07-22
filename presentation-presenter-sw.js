'use strict';

const CACHE_VERSION = 'admira-presenter-offline-v2';
const ALLOWED_DESTINATIONS = new Set(['document', 'style', 'script', 'font', 'image', 'video', 'audio']);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('admira-presenter-offline-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
  await self.clients.claim();
})()));

function cacheable(request, response) {
  return request.method === 'GET' && response && response.ok && response.type !== 'opaque';
}

function isPresentationPath(pathname) {
  return /^\/presentaciones\/[^/]+\/(?:presentacion(?:\.html)?\/?|$)/i.test(pathname);
}

async function fetchAndStore(request) {
  const response = await fetch(request);
  if (cacheable(request, response)) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cachedWithRange(request, cached) {
  const range = request.headers.get('range');
  if (!range || !cached || !/^bytes=\d+-\d*$/i.test(range)) return cached;
  const bytes = await cached.arrayBuffer();
  const match = range.match(/^bytes=(\d+)-(\d*)$/i);
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : bytes.byteLength - 1;
  const end = Math.min(requestedEnd, bytes.byteLength - 1);
  if (start >= bytes.byteLength || start > end) return new Response(null, {status: 416, headers: {'content-range': `bytes */${bytes.byteLength}`}});
  const headers = new Headers(cached.headers);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-range', `bytes ${start}-${end}/${bytes.byteLength}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), {status: 206, statusText: 'Partial Content', headers});
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'ADMIRA_PRESENTATION_PRECACHE') return;
  event.waitUntil((async () => {
    const urls = Array.isArray(data.urls) ? data.urls : [];
    const sameOrigin = urls.map(value => {
      try { return new URL(value, self.location.origin); } catch (_) { return null; }
    }).filter(url => url && url.origin === self.location.origin && !url.pathname.includes('/api/'));
    const results = await Promise.allSettled(sameOrigin.map(url => fetchAndStore(new Request(url.href, {credentials: 'same-origin'}))));
    const ok = results.length > 0 && results.every(result => result.status === 'fulfilled');
    if (event.ports[0]) event.ports[0].postMessage({requestId: data.requestId, ok, cached: results.filter(result => result.status === 'fulfilled').length, total: results.length});
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate' && isPresentationPath(url.pathname)) {
    event.respondWith(fetchAndStore(request).catch(() => caches.match(request).then(response => response || new Response('Presentación no disponible offline todavía.', {status: 503, headers: {'content-type': 'text/plain; charset=utf-8'}}))));
    return;
  }
  if (!ALLOWED_DESTINATIONS.has(request.destination)) return;
  event.respondWith(caches.match(request, {ignoreVary: true}).then(cached => cached ? cachedWithRange(request, cached) : fetch(request)));
});
