/*
 * CATÁLOGO ÚNICO DE MARCAS · marca blanca de la Galaxia Admira (SubMorfeoMacMini, 01-10-2026 · FLT-101330 a).
 *
 * Una sola fuente de verdad para las marcas que leen /marcablanca, el cargador marcablanca.js
 * (y con él Studio/Pixeria, Store/XpaceOS, App/ClearChannel y Yokup) y el generador de
 * presentaciones (panel prospect y render con ?marca=).
 *
 *   SEMILLA  marcablanca/clientes/*.json (estáticos, en el repo). Son el respaldo: la API los sirve
 *            aunque KV esté vacío o caído. Están protegidos: Admira y los ejemplos se cambian en el
 *            repo, nunca por la API.
 *   KV       PRESENTATION_IDEAS (binding que ya existe; no se crea nada en Cloudflare) con prefijo
 *            propio `marca:<id>` → {version, marca, catalogo}. La metadata de cada clave lleva el
 *            resumen, así que listar no exige leer cada marca.
 *   R2       PRESENTATION_MEDIA (ya existe) con prefijo `marcas/<id>/logo.<ext>` para los logos
 *            subidos (data:) — servidos por /marcablanca/api/marcas/<id>/logo.
 *
 * Cada entrada declara su origen (semilla · url · generador · propuesta), su tipo (real · ejemplo), si es una
 * PROPUESTA automática, la web de la que salió, autor (si había sesión) y fechas.
 */
import {normalizarMarca, validarMarca, idMarca, urlSegura} from '../../marcablanca/marca.js';
import {plataformasCatalogo} from '../../data/pilares-historia.mjs';

export const PREFIJO_KV = 'marca:';
export const PREFIJO_R2 = 'marcas/';
export const MAX_MARCAS = 500;
export const MAX_CUERPO = 320 * 1024;          // petición de escritura
export const MAX_LOGO = 160 * 1024;            // bytes de un logo subido (igual que el prospect)
export const MAX_LOGO_EN_LINEA = 48 * 1024;    // sin R2, un data: hasta aquí se guarda dentro de la marca
export const MAX_ENTRADA = 96 * 1024;          // JSON guardado en KV (sin logo en línea grande)
/** ids que no puede tomar una marca nueva (además de las semillas). */
export const RESERVADOS = new Set(['admira', 'nueva', 'actual', 'prospect', 'ninguna', 'index', 'esquema', 'api', 'marcas', 'analizar', 'logo', 'demo', 'presentacion', 'clientes', 'logos', 'fuentes', 'propuesta', 'estilo']);
/** Orígenes de una marca guardada: analizada por URL en /marcablanca, creada en el generador o por la propuesta automática. */
export const ORIGENES = ['url', 'generador', 'propuesta'];
const SEMILLAS_RESPALDO = ['admira', 'lumbre', 'brumelle', 'frescaria'];
const BASE = 'https://www.admiranext.com/';

const ahora = () => new Date().toISOString();
const corto = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

export function json(body, status = 200, extra = {}){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff', ...extra}});
}
/** Cabeceras de la lectura pública: cualquier web de la Galaxia (y los dominios de cliente) la consume. */
export const CORS_LECTURA = {'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS','cache-control':'public, max-age=30, must-revalidate'};

/* ── Semillas (estáticos del repo) ───────────────────────────────────────── */
async function estatico(env, request, ruta){
  if (!env?.ASSETS) return null;
  try {
    const r = await env.ASSETS.fetch(new URL(ruta, request?.url || BASE));
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}
/** «../logos/x.svg» (y fuentes/, escenas/) → «/marcablanca/logos/x.svg»: la semilla servida desde la API no depende de su ruta. */
export function absolutizarSemilla(valor){
  if (typeof valor === 'string') return valor.replace(/^\.\.\/(logos|fuentes|escenas)\//, '/marcablanca/$1/');
  if (Array.isArray(valor)) return valor.map(absolutizarSemilla);
  if (valor && typeof valor === 'object') { const r = {}; for (const k of Object.keys(valor)) r[k] = absolutizarSemilla(valor[k]); return r; }
  return valor;
}
export async function indiceSemilla(env, request){
  const indice = await estatico(env, request, '/marcablanca/clientes/index.json');
  if (indice && Array.isArray(indice.clientes)) return indice;
  return {porDefecto:'admira', plataformas:{}, dominios:{}, clientes:SEMILLAS_RESPALDO.map(id => ({id, nombre:id, ejemplo:id !== 'admira'}))};
}
async function semilla(env, request, id){
  const m = await estatico(env, request, `/marcablanca/clientes/${id}.json`);
  return m && m.id === id ? absolutizarSemilla(m) : null;
}
function metaSemilla(m){
  return {tipo:m.ejemplo ? 'ejemplo' : 'real', origen:'semilla', propuesta:false, protegida:true};
}

/* ── KV ──────────────────────────────────────────────────────────────────── */
const claveKv = id => PREFIJO_KV + id;
async function leerKv(env, id){
  if (!env?.PRESENTATION_IDEAS) return null;
  try { return await env.PRESENTATION_IDEAS.get(claveKv(id), {type:'json'}); } catch (_) { return null; }
}
/** Lo que se enseña en público de la ficha de catálogo (el correo del autor no sale). */
function metaPublica(c = {}){
  return {tipo:c.tipo === 'ejemplo' ? 'ejemplo' : 'real', origen:ORIGENES.includes(c.origen) ? c.origen : 'generador', propuesta:Boolean(c.propuesta),
    web:c.web || '', aviso:c.aviso || '', autor:c.autor?.nombre || '', creadaEn:c.creadaEn || '', actualizadaEn:c.actualizadaEn || c.creadaEn || '', protegida:false,
    ...(c.pendienteLogo ? {pendienteLogo:true} : {})};
}

/**
 * Lista el catálogo: semillas + KV. Si KV falla, las semillas solas (`degradado: true`).
 * `completo` añade la marca entera de cada entrada (para el panel prospect).
 */
export async function listarMarcas(env, request, {completo = false} = {}){
  const indice = await indiceSemilla(env, request);
  const ids = new Set(indice.clientes.map(c => c.id));
  const clientes = indice.clientes.map(c => ({id:c.id, nombre:c.nombre, sector:c.sector || '', ejemplo:Boolean(c.ejemplo), catalogo:metaSemilla(c)}));
  let degradado = !env?.PRESENTATION_IDEAS;
  if (env?.PRESENTATION_IDEAS) {
    try {
      let cursor;
      do {
        const page = await env.PRESENTATION_IDEAS.list({prefix:PREFIJO_KV, limit:1000, cursor});
        for (const key of page.keys || []) {
          const id = key.name.slice(PREFIJO_KV.length);
          if (!idMarca(id) || idMarca(id) !== id || ids.has(id)) continue;
          const md = key.metadata || {};
          ids.add(id);
          clientes.push({id, nombre:corto(md.nombre, 80) || id, sector:corto(md.sector, 80), ejemplo:md.tipo === 'ejemplo', catalogo:metaPublica({tipo:md.tipo, origen:md.origen, propuesta:md.propuesta, web:md.web, creadaEn:md.creadaEn, actualizadaEn:md.actualizadaEn, pendienteLogo:md.pendienteLogo})});
        }
        cursor = page.list_complete === false ? page.cursor : undefined;
      } while (cursor && clientes.length < MAX_MARCAS + 10);
    } catch (_) { degradado = true; }
  }
  const salida = {nombre:indice.nombre || 'Marca blanca · Galaxia Admira', version:'2', porDefecto:indice.porDefecto || 'admira', plataformas:plataformasCatalogo(), dominios:indice.dominios || {}, clientes, fuente:degradado ? 'semilla' : 'semilla+kv', degradado};
  if (completo) {
    const marcas = await Promise.all(clientes.slice(0, 120).map(c => obtenerMarca(env, request, c.id).catch(() => null)));
    salida.marcas = marcas.filter(Boolean);
  }
  return salida;
}

/** Una marca por id (esquema de clientes/esquema.json + `catalogo`), o null. Las semillas mandan. */
export async function obtenerMarca(env, request, id){
  const limpio = idMarca(id);
  if (!limpio || limpio !== String(id || '').toLowerCase()) return null;
  const indice = await indiceSemilla(env, request);
  const fila = indice.clientes.find(c => c.id === limpio);
  if (fila) {
    const m = await semilla(env, request, limpio);
    return m ? {...m, catalogo:metaSemilla(m)} : null;
  }
  const entrada = await leerKv(env, limpio);
  if (!entrada?.marca || entrada.marca.id !== limpio) return null;
  return {...entrada.marca, catalogo:metaPublica(entrada.catalogo)};
}

export async function esSemilla(env, request, id){
  const indice = await indiceSemilla(env, request);
  return indice.clientes.some(c => c.id === id);
}

/* ── Escritura (solo con acceso al generador: functions/presentaciones/api/marcas.js) ── */
const EXT = {'image/svg+xml':'svg','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
export function bytesDeDataUrl(dataUrl){
  const m = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const bin = atob(m[2]);
  if (bin.length > MAX_LOGO) throw new ErrorCatalogo('El logo supera 160 KB.', 413);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  if (m[1] === 'image/svg+xml') {
    const svg = new TextDecoder().decode(bytes);
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i.test(svg)) throw new ErrorCatalogo('El logo SVG no es válido.', 400);
  }
  return {bytes, tipo:m[1]};
}
export class ErrorCatalogo extends Error { constructor(msg, estado = 400){ super(msg); this.estado = estado; } }

async function guardarLogo(env, id, dataUrl){
  const archivo = bytesDeDataUrl(dataUrl);
  if (!archivo) return '';
  if (!env?.PRESENTATION_MEDIA) {
    if (dataUrl.length > MAX_LOGO_EN_LINEA * 1.37) throw new ErrorCatalogo('Logo demasiado grande para guardarlo sin almacén de ficheros (máx. 48 KB).', 413);
    return dataUrl;
  }
  // Una sola clave por marca: al cambiar de formato se borra la anterior.
  for (const ext of Object.values(EXT)) if (ext !== EXT[archivo.tipo]) { try { await env.PRESENTATION_MEDIA.delete?.(`${PREFIJO_R2}${id}/logo.${ext}`); } catch (_) {} }
  await env.PRESENTATION_MEDIA.put(`${PREFIJO_R2}${id}/logo.${EXT[archivo.tipo]}`, archivo.bytes, {httpMetadata:{contentType:archivo.tipo, cacheControl:'public, max-age=300'}, customMetadata:{marca:id, kind:'catalogo-logo'}});
  return `/marcablanca/api/marcas/${id}/logo`;
}
export async function leerLogo(env, id){
  if (!env?.PRESENTATION_MEDIA || !idMarca(id)) return null;
  for (const ext of Object.values(EXT)) {
    const obj = await env.PRESENTATION_MEDIA.get(`${PREFIJO_R2}${id}/logo.${ext}`);
    if (obj) return obj;
  }
  return null;
}

/**
 * Valida y normaliza lo que llega para el catálogo. Devuelve la marca lista para guardar
 * (sin el logo data:, que se resuelve aparte) o lanza ErrorCatalogo con un mensaje claro.
 */
export function prepararMarca(entrada){
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErrorCatalogo('Falta la marca (objeto JSON con el esquema de clientes/esquema.json).');
  const nombre = corto(entrada.nombre, 80);
  if (!nombre) throw new ErrorCatalogo('La marca necesita un nombre.');
  const colores = entrada.colores && typeof entrada.colores === 'object' ? entrada.colores : {};
  const algunPrimario = ['claro', 'oscuro'].some(modo => /^#[0-9a-f]{6}$/i.test(String(colores[modo]?.primario || '')));
  if (!algunPrimario) throw new ErrorCatalogo('La marca necesita al menos el color primario (#RRGGBB) de uno de sus modos.');
  const id = idMarca(entrada.id) || idMarca(nombre);
  if (!id) throw new ErrorCatalogo('No se puede sacar un id válido (slug) del nombre.');
  const logoEntrada = entrada.logo && typeof entrada.logo === 'object' ? entrada.logo : (typeof entrada.logo === 'string' ? {imagen:entrada.logo} : {});
  const logoData = [logoEntrada.imagen, logoEntrada.svg].find(v => /^data:image\//.test(String(v || ''))) || '';
  const logoUrl = [logoEntrada.svg, logoEntrada.imagen].find(v => v && !/^data:/.test(String(v))) || '';
  if (logoUrl && !urlSegura(logoUrl)) throw new ErrorCatalogo('El logo debe ser una URL https:// o una imagen subida (data:image).');
  if (logoData && !bytesDeDataUrl(logoData)) throw new ErrorCatalogo('El logo subido debe ser PNG, JPG, WebP, GIF o SVG en base64.');
  const marca = normalizarMarca({...entrada, id, nombre, logo:{...logoEntrada, svg:undefined, imagen:logoUrl || undefined}, favicon:/^data:/.test(String(entrada.favicon || '')) ? '' : entrada.favicon});
  // En el catálogo una marca nunca es la «por defecto» ni trae dominios propios: eso es del repo.
  delete marca.porDefecto; delete marca.dominios;
  const errores = validarMarca(marca);
  if (errores.length) throw new ErrorCatalogo('La marca no cumple el esquema: ' + errores.slice(0, 4).join(' '));
  return {marca, logoData};
}

/**
 * Crea (o, con `actualizar`, sobrescribe) una marca del catálogo.
 * @param {{marca:object, origen:'url'|'generador'|'propuesta', tipo?:'real'|'ejemplo', web?:string, autor?:{nombre,email}, actualizar?:boolean, propuesta?:boolean, aviso?:string, pendienteLogo?:boolean}} o
 */
export async function guardarMarca(env, request, o){
  if (!env?.PRESENTATION_IDEAS) throw new ErrorCatalogo('El catálogo no está disponible ahora mismo (KV).', 503);
  const {marca, logoData} = prepararMarca(o.marca);
  const id = marca.id;
  if (RESERVADOS.has(id) || id.startsWith('prospect-') || await esSemilla(env, request, id)) throw new ErrorCatalogo(`«${id}» es una marca protegida del catálogo (semilla del repo): elige otro nombre o id.`, 409);
  const previa = await leerKv(env, id);
  if (previa && !o.actualizar) throw new ErrorCatalogo(`Ya existe la marca «${id}» en el catálogo. Para sustituirla, actualízala.`, 409);
  if (!previa) {
    const page = await env.PRESENTATION_IDEAS.list({prefix:PREFIJO_KV, limit:MAX_MARCAS + 1});
    if ((page.keys || []).length >= MAX_MARCAS) throw new ErrorCatalogo(`El catálogo ya tiene ${MAX_MARCAS} marcas.`, 507);
  }
  if (logoData) {
    const ruta = await guardarLogo(env, id, logoData);
    marca.logo = {...marca.logo, imagen:ruta};
    marca.favicon = /^data:/.test(ruta) ? '' : ruta;
  } else if (!marca.favicon && marca.logo.imagen) marca.favicon = marca.logo.imagen;
  const origen = ORIGENES.includes(o.origen) ? o.origen : 'generador';
  const web = urlSegura(o.web || marca.origen?.web || '') || '';
  const propuesta = o.propuesta ?? origen !== 'generador';
  const autor = o.autor?.email || o.autor?.nombre ? {nombre:corto(o.autor.nombre, 100), email:corto(o.autor.email, 180).toLowerCase()} : null;
  const t = ahora();
  const catalogo = {
    tipo:o.tipo === 'ejemplo' ? 'ejemplo' : 'real', origen, propuesta, web,
    aviso:corto(o.aviso, 300) || (propuesta ? `Propuesta generada automáticamente a partir de ${web || 'su web'}; no es la marca oficial de ${marca.nombre}.` : ''),
    ...(o.pendienteLogo ? {pendienteLogo:true} : {}),
    autor:previa?.catalogo?.autor || autor, creadaEn:previa?.catalogo?.creadaEn || t, actualizadaEn:t,
    ...(previa ? {actualizadaPor:autor} : {})
  };
  marca.ejemplo = catalogo.tipo === 'ejemplo';
  marca.origen = {tipo:origen, web, creadaEn:catalogo.creadaEn};
  const entrada = {version:1, marca, catalogo};
  const texto = JSON.stringify(entrada);
  if (texto.length > MAX_ENTRADA + (/^data:/.test(marca.logo.imagen || '') ? MAX_LOGO_EN_LINEA * 1.4 : 0)) throw new ErrorCatalogo('La marca es demasiado grande para el catálogo.', 413);
  const metadata = {nombre:marca.nombre.slice(0, 80), sector:String(marca.sector || '').slice(0, 60), tipo:catalogo.tipo, origen, propuesta, web:web.slice(0, 200), creadaEn:catalogo.creadaEn, actualizadaEn:t, ...(catalogo.pendienteLogo ? {pendienteLogo:true} : {})};
  await env.PRESENTATION_IDEAS.put(claveKv(id), texto, {metadata});
  return {id, marca:{...marca, catalogo:metaPublica(catalogo)}, creada:!previa};
}
