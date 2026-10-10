/* Vídeo del visor a 600 px. Mismo acceso que /pruebas/visor (el middleware). */
const MAX = 600;
const TOPE = 8 * 1024 * 1024;
const LIGERO = 1200000;
const HOST = 'stock.admira.store';

function texto(status, cuerpo) {
  return new Response(cuerpo, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

export function origenPermitido(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 2000) return null;
  if (value.includes('..') || value.includes('\\') || value.includes('\0') || value.includes('@')) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.hostname !== HOST) return null;
  return url;
}

function u32(u, i) {
  return ((u[i] << 24) | (u[i + 1] << 16) | (u[i + 2] << 8) | u[i + 3]) >>> 0;
}

export function medidasMp4(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf || 0);
  let ancho = 0;
  let alto = 0;
  function walk(start, end) {
    let i = start;
    while (i + 8 <= end) {
      let size = u32(u, i);
      const tipo = String.fromCharCode(u[i + 4], u[i + 5], u[i + 6], u[i + 7]);
      let hdr = 8;
      if (size === 1) return;
      if (size === 0) size = end - i;
      if (size < 8 || i + size > end) return;
      const caja = i + size;
      if (tipo === 'moov' || tipo === 'trak' || tipo === 'mdia' || tipo === 'minf' || tipo === 'stbl') walk(i + hdr, caja);
      else if (tipo === 'tkhd' && u[i + hdr] === 0 && i + hdr + 84 <= caja) {
        const w = u32(u, i + hdr + 76) / 65536;
        const h = u32(u, i + hdr + 80) / 65536;
        if (w >= 2 && h >= 2) { ancho = Math.round(w); alto = Math.round(h); }
      }
      i = caja;
    }
  }
  if (u.length < 12) return null;
  walk(0, u.length);
  if (!ancho || !alto) return null;
  return { w: ancho, h: alto };
}

export async function nombreDerivado(src) {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

function mp4(bytes, request) {
  const total = bytes.byteLength;
  const cabeceras = {
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=86400',
    'x-content-type-options': 'nosniff',
  };
  const rango = request && request.headers ? request.headers.get('range') || '' : '';
  const pedido = /^bytes=(\d+)-(\d*)$/.exec(rango);
  if (!pedido) {
    cabeceras['content-length'] = String(total);
    return new Response(bytes, { status: 200, headers: cabeceras });
  }
  const inicio = Number(pedido[1]);
  let fin = pedido[2] ? Number(pedido[2]) : total - 1;
  if (!Number.isFinite(inicio) || inicio >= total) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
  }
  if (fin >= total) fin = total - 1;
  const trozo = bytes.slice(inicio, fin + 1);
  cabeceras['content-range'] = `bytes ${inicio}-${fin}/${total}`;
  cabeceras['content-length'] = String(trozo.byteLength);
  return new Response(trozo, { status: 206, headers: cabeceras });
}

async function derivadoDe(assetFetch, origin, nombre) {
  if (typeof assetFetch !== 'function') return null;
  let res;
  try { res = await assetFetch(`${origin}/pruebas/visor/media/${nombre}.mp4`); } catch { return null; }
  if (!res || !res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  const lado = medidasMp4(buf);
  if (!lado || Math.max(lado.w, lado.h) > MAX || buf.byteLength > LIGERO || buf.byteLength < 32) return null;
  return buf;
}

export async function servirVideo(src, fetchImpl, assetFetch, request) {
  const origen = origenPermitido(src);
  if (!origen) return texto(400, 'Vídeo no permitido.\n');
  const url = origen.toString();
  const pagina = request ? new URL(request.url) : new URL('https://www.admiranext.com/pruebas/visor/vid');
  const listo = await derivadoDe(assetFetch, pagina.origin, await nombreDerivado(url));
  if (listo) return mp4(listo, request);
  let res;
  try { res = await fetchImpl(url, { redirect: 'manual' }); } catch { return texto(502, 'No he podido leer el vídeo.\n'); }
  if (!res || res.status < 200 || res.status >= 300) return texto(502, 'No he podido leer el vídeo.\n');
  const anunciado = Number(res.headers.get('content-length') || 0);
  if (anunciado > TOPE) return texto(413, 'Vídeo demasiado grande.\n');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > TOPE) return texto(413, 'Vídeo demasiado grande.\n');
  const lado = medidasMp4(buf);
  if (!lado) return texto(415, 'Vídeo no compatible.\n');
  if (Math.max(lado.w, lado.h) > MAX || buf.byteLength > LIGERO) return texto(415, 'Vídeo demasiado grande para la lente.\n');
  return mp4(buf, request);
}

export async function onRequestGet(context) {
  const src = new URL(context.request.url).searchParams.get('src');
  const assets = context.env && context.env.ASSETS;
  const assetFetch = assets && typeof assets.fetch === 'function'
    ? (url) => assets.fetch(new Request(url))
    : null;
  return servirVideo(src, (url, opts) => fetch(url, opts), assetFetch, context.request);
}
