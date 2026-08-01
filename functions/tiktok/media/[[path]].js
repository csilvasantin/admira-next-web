const PACKAGE_ID_RE = /^pkg-[a-f0-9]{20}$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;

export async function onRequest(context){
  const method = context.request.method;
  if(method !== 'GET' && method !== 'HEAD') return new Response('Method Not Allowed', {status:405, headers:{allow:'GET, HEAD'}});
  if(!context.env.PRESENTATION_MEDIA) return new Response('Not Found', {status:404});
  const parts = new URL(context.request.url).pathname.split('/').filter(Boolean);
  const id = parts[2] || '';
  const token = parts[3] || '';
  if(parts.length !== 4 || !PACKAGE_ID_RE.test(id) || !TOKEN_RE.test(token)) return new Response('Not Found', {status:404});

  const prefix = `tiktok/packages/${id}-${token}.`;
  const candidates = ['mp4', 'webm', 'mov'];
  let object = null;
  for(const extension of candidates){
    object = method === 'HEAD'
      ? await context.env.PRESENTATION_MEDIA.head(`${prefix}${extension}`)
      : await context.env.PRESENTATION_MEDIA.get(`${prefix}${extension}`);
    if(object) break;
  }
  if(!object) return new Response('Not Found', {status:404});

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('access-control-allow-origin', '*');
  headers.set('cross-origin-resource-policy', 'cross-origin');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-length', String(object.size));
  return new Response(method === 'HEAD' ? null : object.body, {status:200, headers});
}
