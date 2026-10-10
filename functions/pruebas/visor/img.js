/* Imagen del visor a 600 px. Mismo acceso que /pruebas/visor (el middleware). jpeg-js 0.4.4. */
import { decode } from '../_jpeg/decoder.js';
import { encode } from '../_jpeg/encoder.js';

const MAX = 600;
const TOPE_BYTES = 8 * 1024 * 1024;
const LIGERO = 180000;
const HOST = 'stock.admira.store';

function texto(status, cuerpo) {
  return new Response(cuerpo, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}

function jpeg(bytes) {
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
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

export function medidasJpeg(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf || 0);
  if (u.length < 10 || u[0] !== 0xff || u[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < u.length) {
    if (u[i] !== 0xff) { i += 1; continue; }
    const marca = u[i + 1];
    if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd9)) { i += 2; continue; }
    const len = (u[i + 2] << 8) | u[i + 3];
    if (len < 2) return null;
    if (marca === 0xc0 || marca === 0xc1 || marca === 0xc2) {
      return { w: (u[i + 7] << 8) | u[i + 8], h: (u[i + 5] << 8) | u[i + 6] };
    }
    i += 2 + len;
  }
  return null;
}

export function encajar(src, max) {
  const sw = src && src.width | 0;
  const sh = src && src.height | 0;
  const pix = src && src.data;
  if (!sw || !sh || !pix || sw > 16000 || sh > 16000) return null;
  if (sw <= max && sh <= max) return { data: pix, width: sw, height: sh };
  let dw = Math.round((sw * max) / Math.max(sw, sh));
  let dh = Math.round((sh * max) / Math.max(sw, sh));
  if (dw > max) dw = max;
  if (dh > max) dh = max;
  if (dw < 1) dw = 1;
  if (dh < 1) dh = 1;
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const ys = Math.floor((y * sh) / dh);
    const ye = Math.max(ys + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const xs = Math.floor((x * sw) / dw);
      const xe = Math.max(xs + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let yy = ys; yy < ye; yy++) {
        let row = (yy * sw + xs) * 4;
        for (let xx = xs; xx < xe; xx++) {
          r += pix[row];
          g += pix[row + 1];
          b += pix[row + 2];
          a += pix[row + 3];
          row += 4;
          n += 1;
        }
      }
      const i = (y * dw + x) * 4;
      out[i] = r / n;
      out[i + 1] = g / n;
      out[i + 2] = b / n;
      out[i + 3] = a / n;
    }
  }
  return { data: out, width: dw, height: dh };
}

async function leer(fetchImpl, url, conCf) {
  const opts = { redirect: 'manual' };
  if (conCf) {
    opts.cf = { image: { width: MAX, height: MAX, fit: 'scale-down', format: 'jpeg', quality: 72 } };
  }
  const res = await fetchImpl(url, opts);
  if (!res || res.status < 200 || res.status >= 300) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > TOPE_BYTES) return { grande: true };
  return { buf };
}

export async function servirImagen(src, fetchImpl) {
  const origen = origenPermitido(src);
  if (!origen) return texto(400, 'Imagen no permitida.\n');
  const url = origen.toString();
  let leido;
  try { leido = await leer(fetchImpl, url, true); } catch { return texto(502, 'No he podido leer la imagen.\n'); }
  if (!leido) return texto(502, 'No he podido leer la imagen.\n');
  if (leido.grande) return texto(413, 'Imagen demasiado grande.\n');
  let buf = leido.buf;
  let lado = medidasJpeg(buf);
  if (lado && lado.w <= MAX && lado.h <= MAX && buf.byteLength <= LIGERO) return jpeg(buf);
  if (!lado) {
    try { leido = await leer(fetchImpl, url, false); } catch { return texto(502, 'No he podido leer la imagen.\n'); }
    if (!leido) return texto(502, 'No he podido leer la imagen.\n');
    if (leido.grande) return texto(413, 'Imagen demasiado grande.\n');
    buf = leido.buf;
    lado = medidasJpeg(buf);
  }
  if (lado && lado.w * lado.h > 8_000_000) return texto(413, 'Imagen demasiado grande.\n');
  let raw;
  try {
    raw = decode(buf, { useTArray: true, formatAsRGBA: true, tolerantDecoding: true, maxResolutionInMP: 8 });
  } catch {
    return texto(502, 'No he podido leer la imagen.\n');
  }
  const fit = encajar(raw, MAX);
  if (!fit || fit.width > MAX || fit.height > MAX) return texto(502, 'No he podido leer la imagen.\n');
  const jpg = encode({ data: fit.data, width: fit.width, height: fit.height }, 72);
  const salida = medidasJpeg(jpg.data);
  if (!salida || salida.w > MAX || salida.h > MAX) return texto(502, 'No he podido leer la imagen.\n');
  return jpeg(jpg.data);
}

export async function onRequestGet(context) {
  const src = new URL(context.request.url).searchParams.get('src');
  return servirImagen(src, (url, opts) => fetch(url, opts));
}
