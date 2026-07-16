const MEDIA = {
  'audio.m4a': 'https://pub-bf043a4daa3b43b7a0b769617729d074.r2.dev/grid/ccdoc/aed054da9db9b102.m4a',
  'video.mp4': 'https://pub-bf043a4daa3b43b7a0b769617729d074.r2.dev/grid/ccdoc/d30496f31e860ccc.mp4',
};

export async function onRequest({ request, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const source = MEDIA[String(params.file || '').toLowerCase()];
  if (!source) return new Response('Not found', { status: 404 });

  const upstreamHeaders = new Headers();
  for (const name of ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  const upstream = await fetch(source, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: 'follow',
  });

  const headers = new Headers();
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
