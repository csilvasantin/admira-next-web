/*
 * POST /marcablanca/api/analizar {url} · «Tu marca · introduce una URL» en /marcablanca
 * (SubMorfeoMacMini, 01-10-2026 · FLT-101330 b).
 *
 * Analiza la web pública de una marca con el MISMO analizador del generador de presentaciones
 * (functions/presentaciones/_inspiration.js) y devuelve una PROPUESTA de marca blanca (logo,
 * primario, secundario, acento, fondo, tipografía, modo y nombre) hecha con marcablanca/marca.js.
 * NO guarda nada: guardar en el catálogo exige entrar en el generador (POST /presentaciones/api/marcas).
 *
 * Defensas (las de /presentaciones/api/inspiration y más):
 *   - mismo origen (cabecera Origin) y cuerpo pequeño;
 *   - solo https, sin IPs ni nombres locales, DNS comprobado, redirecciones revisadas salto a salto,
 *     plazo total y tope de bytes (ver fetchPublico en _inspiration.js);
 *   - límite de frecuencia por IP (functions/_limite-frecuencia.js);
 *   - si la web bloquea a los analizadores (401/403/429 o un muro antibots), se dice tal cual, con
 *     el código HTTP: no se finge ser un navegador para saltárselo.
 */
import {analyzeInspiration, fetchPublico, sanitizeSvg, ErrorAnalisis} from '../../presentaciones/_inspiration.js';
import {ensureHttpsUrl} from '../../presentaciones/_defaults.js';
import {datosDesdeInspiracion, propuestaDesdeDatos, coloresDeSvg} from '../../../marcablanca/marca.js';
import {limitarFrecuencia} from '../../_limite-frecuencia.js';
import {RESERVADOS} from '../_catalogo.js';

export const ANALISIS_POR_VENTANA = 12;
export const VENTANA_SEG = 10 * 60;
const MAX_CUERPO = 2048;
const MAX_LOGO = 120 * 1024;
const TIPOS_LOGO = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;

function respuesta(body, status = 200, extra = {}){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex', ...extra}});
}
function base64(bytes){
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const svgADataUrl = svg => 'data:image/svg+xml;base64,' + base64(new TextEncoder().encode(svg));

/** Descarga el logo (mismas defensas) y lo devuelve como data: para no depender del sitio ajeno. */
export async function logoComoDataUrl(url, opciones = {}){
  try {
    const {response} = await fetchPublico(url, {...opciones, accept:'image/svg+xml,image/png,image/webp,image/jpeg,image/gif;q=.9', timeoutMs:5000});
    const tipo = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!response.ok || !TIPOS_LOGO.test(tipo)) return '';
    if (Number(response.headers.get('content-length') || 0) > MAX_LOGO) return '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_LOGO) return '';
    if (tipo === 'image/svg+xml') { const svg = sanitizeSvg(new TextDecoder().decode(bytes)); return svg ? svgADataUrl(svg) : ''; }
    return `data:${tipo};base64,${base64(bytes)}`;
  } catch (_) { return ''; }
}

export async function analizarMarca(url, opciones = {}){
  const ins = await analyzeInspiration(url, {...opciones, detectarBloqueo:true});
  let logo = '', logoColores = [], logoOrigen = 'no detectado';
  if (ins.logo?.type === 'svg' && ins.logo.svg) {
    logo = svgADataUrl(ins.logo.svg); logoColores = coloresDeSvg(ins.logo.svg); logoOrigen = 'SVG de la cabecera de la web';
  } else if (ins.logo?.type === 'url' && ins.logo.url) {
    logo = await logoComoDataUrl(ins.logo.url, opciones) || ins.logo.url;
    logoOrigen = /icon/i.test(ins.logo.alt || '') ? 'icono de la web' : 'imagen de la web';
    if (/^data:image\/svg/.test(logo)) logoColores = coloresDeSvg(atob(logo.split(',')[1]));
  }
  const datos = datosDesdeInspiracion(ins, {logo, logoColores});
  // Nunca con el id de una marca protegida (admira, los ejemplos…): la propuesta no la pisa.
  if (RESERVADOS.has(datos.id) || ['lumbre', 'brumelle', 'frescaria'].includes(datos.id)) datos.id = `${datos.id}-web`;
  const propuesta = propuestaDesdeDatos(datos);
  return {
    datos, propuesta,
    // Lo justo para que el navegador recalcule la paleta si decodifica un logo PNG/JPG/WebP.
    inspiracion:{url:ins.url, host:ins.host, title:ins.title, siteName:ins.siteName, themeColor:ins.themeColor, primary:ins.primary, accent:ins.accent, palette:ins.palette, background:ins.background, mode:ins.mode, sourceFont:ins.sourceFont, fontStyle:ins.fontStyle},
    analisis:{url:ins.url, finalUrl:ins.finalUrl, host:ins.host, titulo:ins.title, nombre:datos.nombre, fuente:datos.fuenteDetectada || '',
      logo:{origen:logoOrigen, url:ins.logo?.type === 'url' ? ins.logo.url : '', enLinea:/^data:/.test(logo)},
      colorTema:ins.themeColor || '', paletaWeb:ins.palette || [], fondoWeb:ins.background, modoWeb:ins.mode === 'dark' ? 'oscuro' : 'claro', analizadaEn:ins.analyzedAt},
    aviso:`Propuesta generada automáticamente a partir de ${ins.url}. No es la marca oficial de ${datos.nombre}.`
  };
}

export async function onRequestPost(context){
  const {request, env} = context;
  const origen = request.headers.get('Origin');
  if (!origen || origen !== new URL(request.url).origin) return respuesta({error:'Origen no permitido.'}, 403);
  if (Number(request.headers.get('content-length') || 0) > MAX_CUERPO) return respuesta({error:'Petición demasiado grande.'}, 413);
  let body;
  try { const texto = await request.text(); if (texto.length > MAX_CUERPO) return respuesta({error:'Petición demasiado grande.'}, 413); body = JSON.parse(texto); }
  catch (_) { return respuesta({error:'JSON no válido.'}, 400); }
  const url = ensureHttpsUrl(body?.url);
  if (!url) return respuesta({error:'Escribe la web de la marca (https://…).'}, 400);
  if (!/^https:\/\//i.test(url)) return respuesta({error:'La web debe comenzar por https://'}, 400);
  const cupo = await limitarFrecuencia(env, request, {ambito:'marcablanca-analizar', maximo:ANALISIS_POR_VENTANA, ventanaSeg:VENTANA_SEG});
  if (!cupo.permitido) return respuesta({error:`Demasiados análisis desde tu conexión. Vuelve a probar en ${Math.max(1, Math.ceil(cupo.reintentarEn / 60))} min.`}, 429, {'retry-after':String(cupo.reintentarEn)});
  try {
    return respuesta({ok:true, ...await analizarMarca(url)});
  } catch (error) {
    if (error instanceof ErrorAnalisis) return respuesta({error:error.message, estado:error.estado || null, bloqueo:Boolean(error.bloqueo), url}, 422);
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return respuesta({error:'La web ha tardado demasiado en responder (más de 8 s).', url}, 504);
    if (error instanceof TypeError) return respuesta({error:'No se pudo conectar con esa web (¿existe el dominio?).', url}, 502);
    return respuesta({error:error?.message || 'No se pudo analizar la web.', url}, 400);
  }
}
