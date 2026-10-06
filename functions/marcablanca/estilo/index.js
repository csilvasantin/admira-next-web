/*
 * GET /marcablanca/estilo?marca=<id> · LIBRO DE ESTILO con la marca ya nombrada en el HTML (06-10-2026 · FLT-101666 a).
 *
 * El libro lo sigue pintando marcablanca/estilo/estilo.js en el navegador (lee /marcablanca/api/marcas/<id>).
 * Esta función solo sirve el mismo index.html sin el salto 308 a /marcablanca/estilo/ y, si la marca está
 * en el catálogo, deja escritos el título, la descripción, el theme-color y una ficha mínima (nombre, sector
 * y colores principales) para quien no ejecute JavaScript, buscadores internos o una comprobación con curl.
 * Sin marca, o con una que no existe, devuelve el HTML tal cual (estilo.js enseña el índice o el aviso).
 */
import {obtenerMarca} from '../_catalogo.js';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const HEX = /^#[0-9a-f]{6}$/i;
const CABECERAS = {'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=0, must-revalidate', 'access-control-allow-origin':'*', 'x-content-type-options':'nosniff'};

export function idPedido(url){
  return (new URL(url).searchParams.get('marca') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

/** Inserta en el HTML del libro el nombre de la marca y su ficha mínima. Puro: se prueba sin Cloudflare. */
export function conMarca(html, m){
  const c = m?.colores?.[m.modo] || m?.colores?.claro || {};
  const nombre = esc(m.nombre || m.id);
  const colores = ['primario', 'secundario', 'acento', 'fondo', 'texto'].filter((k) => HEX.test(c[k] || ''))
    .map((k) => `<li data-color="${k}">${k} <code>${esc(c[k].toUpperCase())}</code></li>`).join('');
  const ficha = `<p class="cargando">Cargando el libro de estilo de <b data-marca="${esc(m.id)}">${nombre}</b>…</p>
  <noscript><section class="ficha-ssr"><h1>Libro de estilo · ${nombre}</h1><p>${esc(m.sector || '')}</p><ul>${colores}</ul></section></noscript>`;
  let out = html
    .replace(/<title>[^<]*<\/title>/, () => `<title>Libro de estilo · ${nombre} · Marca blanca AdmiraNeXT</title>`)
    .replace(/<html([^>]*)>/, (t, a) => `<html${a.replace(/\sdata-libro-marca="[^"]*"/, '')} data-libro-marca="${esc(m.id)}">`)
    .replace(/<p class="cargando">[^<]*<\/p>/, () => ficha);
  if (m.descripcion) out = out.replace(/(<meta name="description" content=")[^"]*(")/, (t, a, b) => a + esc(String(m.descripcion).slice(0, 300)) + b);
  if (HEX.test(c.fondo || '')) out = out.replace(/(<meta name="theme-color" content=")[^"]*(")/, (t, a, b) => a + c.fondo + b);
  return out;
}

export async function onRequestGet(context){
  const {request, env} = context;
  let asset = null;
  try { asset = await env.ASSETS.fetch(new URL('/marcablanca/estilo/', request.url)); } catch (_) { asset = null; }
  if (!asset || !asset.ok) return context.next ? context.next() : new Response('No disponible', {status: 503});
  const html = await asset.text();
  const id = idPedido(request.url);
  let marca = null;
  if (id) { try { marca = await obtenerMarca(env, request, id); } catch (_) { marca = null; } }
  return new Response(marca ? conMarca(html, marca) : html, {status: 200, headers: CABECERAS});
}
