/* Ultra: imagen reducida en servidor y contenida en 410×502. Sin CORS nuevo. */
import { servirImagen, encajar } from './img.js';
import { decode } from '../_jpeg/decoder.js';
import { encode } from '../_jpeg/encoder.js';
export async function imagenWatch(src, fetchImpl) {
  const response = await servirImagen(src, fetchImpl);
  if (!response.ok) return response;
  const raw = decode(new Uint8Array(await response.arrayBuffer()), { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 1 });
  // Un máximo de 410 en ambos ejes siempre cabe también en el alto 502 del Ultra.
  const fit = encajar(raw, 410);
  return new Response(encode(fit, 72).data, { headers: {
    'content-type': 'image/jpeg', 'cache-control': 'private, max-age=3600',
    'x-content-type-options': 'nosniff', 'x-admira-image-bounds': '410x502',
  } });
}
export async function onRequestGet({ request }) {
  return imagenWatch(new URL(request.url).searchParams.get('src'), fetch);
}
