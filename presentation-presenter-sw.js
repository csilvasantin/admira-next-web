'use strict';

// MODO ANTIFALLO ACOTADO (MorfeoMacMini, 21-09-2026 · FLT-100778 b). La copia offline del
// deck es deliberada —que la presentación aguante si se cae la red de la sala (717df1b)—,
// pero no tenía fin: el HTML privado quedaba en el dispositivo sin caducidad, se servía sin
// red aunque la sesión ya no existiera (un portátil de sala, el siguiente que lo usa) y el
// service worker se registraba sobre TODO el sitio. Ahora:
//  · la copia del deck lleva su hora y sólo se sirve sin red durante OFFLINE_DOC_TTL_MS;
//  · si el servidor contesta 401/403 a un deck, la sesión ya no vale: se borra la caché;
//  · fuera del propio deck se respeta `no-store`;
//  · el alcance es /presentaciones/, y el registro antiguo sobre «/» se da de baja solo.
// v3 purga al activarse las copias guardadas sin hora por versiones anteriores.
const CACHE_VERSION = 'admira-presenter-offline-v3';
const OFFLINE_DOC_TTL_MS = 12 * 60 * 60 * 1000;
const CACHED_AT = 'x-admira-cached-at';
const ALLOWED_DESTINATIONS = new Set(['document', 'style', 'script', 'font', 'image', 'video', 'audio']);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('admira-presenter-offline-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
  if (new URL(self.registration.scope).pathname === '/') {
    await self.registration.unregister();
    return;
  }
  await self.clients.claim();
})()));

function isPresentationPath(pathname) {
  return /^\/presentaciones\/[^/]+\/(?:presentacion(?:\.html)?\/?|$)/i.test(pathname);
}

function cacheable(request, response) {
  if (request.method !== 'GET' || !response || !response.ok || response.type === 'opaque') return false;
  // El deck se guarda aunque venga con no-store: es el modo antifallo, acotado por hora y
  // por sesión. Cualquier otra cosa marcada no-store no se guarda.
  if (isPresentationPath(new URL(request.url).pathname)) return true;
  return !/no-store/i.test(response.headers.get('cache-control') || '');
}

async function stamped(response) {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT, String(Date.now()));
  return new Response(await response.blob(), {status: response.status, statusText: response.statusText, headers});
}

async function fetchAndStore(request) {
  const response = await fetch(request);
  if (isPresentationPath(new URL(request.url).pathname) && (response.status === 401 || response.status === 403)) {
    await caches.delete(CACHE_VERSION);
    return response;
  }
  if (cacheable(request, response)) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, isPresentationPath(new URL(request.url).pathname) ? await stamped(response.clone()) : response.clone());
  }
  return response;
}

async function offlineDeck(request) {
  const cached = await caches.match(request);
  const at = Number(cached ? cached.headers.get(CACHED_AT) : 0);
  if (cached && at && Date.now() - at < OFFLINE_DOC_TTL_MS) return cached;
  if (cached) await (await caches.open(CACHE_VERSION)).delete(request);
  return new Response('Presentación no disponible sin conexión: la copia de este dispositivo ha caducado o no existe. Conéctate para abrirla de nuevo.', {status: 503, headers: {'content-type': 'text/plain; charset=utf-8'}});
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
    event.respondWith(fetchAndStore(request).catch(() => offlineDeck(request)));
    return;
  }
  if (!ALLOWED_DESTINATIONS.has(request.destination)) return;
  event.respondWith(caches.match(request, {ignoreVary: true}).then(cached => cached ? cachedWithRange(request, cached) : fetch(request)));
});
