/*
 * Silicio, fase 1. El emisor sólo conoce la clave de su equipo; la lectura usa
 * la sesión Google/directorio existente. Nunca se graban claves ni cookies.
 *
 * Cada aviso es inmutable y expira a los siete días de la medición, también
 * cuando el equipo deja de informar. El timestamp invertido ordena primero el
 * más reciente: un aviso retrasado/concurrente no puede pisar la última posición.
 * KV tiene consistencia eventual; la visibilidad entre regiones puede demorarse.
 */
export const RETENCION_DIAS = 7;
export const DESACTUALIZADO_MS = 2 * 60 * 60 * 1000;
export const RETENCION_MS = RETENCION_DIAS * 24 * 60 * 60 * 1000;
export const MAX_BODY_BYTES = 2048;
const MAX_RETRASO_MS = 24 * 60 * 60 * 1000;
const MAX_ADELANTO_MS = 5 * 60 * 1000;
const INVERTIR_TS = 9999999999999;
const CAMPOS = new Set(['equipo', 'lat', 'lon', 'precision_m', 'bateria', 'fuente', 'ts']);
const encoder = new TextEncoder();

export const EQUIPOS = Object.freeze([
  Object.freeze({equipo:'iphone-carlos', nombre:'iPhone 17 Pro Max de Carlos', tipo:'movil'}),
  // Posición manual de la dirección, verificada en OSM/Nominatim (10-10-2026),
  // nodo11967748167. No es telemetría ni un aviso automático del Mac mini.
  Object.freeze({equipo:'mac-mini', nombre:'Mac mini', tipo:'fijo', direccion:'Gran de Gràcia 51, Barcelona',lat:41.3993419,lon:2.1559172}),
]);

export function respuestaUbicacion(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {status, headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'private, no-store',
    'cdn-cache-control':'no-store',
    'cloudflare-cdn-cache-control':'no-store',
    'pragma':'no-cache',
    'x-robots-tag':'noindex, nofollow',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff',
    ...extraHeaders,
  }});
}

export async function claveUbicacionValida(request, env) {
  const expected = env.UBICACION_KEY_IPHONE;
  const match = /^Bearer ([A-Za-z0-9._~+\/-]+=*)$/i.exec(request.headers.get('Authorization') || '');
  if (typeof expected !== 'string' || expected.length < 32 || !match || match[1].length > 512) return false;
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(match[1])),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

class EntradaInvalida extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}

// Se cuenta el stream real: Content-Length puede faltar o mentir.
export async function leerAviso(request) {
  if (!(request.headers.get('content-type') || '').match(/^application\/json(?:\s*;|\s*$)/i)) {
    throw new EntradaInvalida('content_type_invalido', 415);
  }
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > MAX_BODY_BYTES) throw new EntradaInvalida('cuerpo_demasiado_grande', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new EntradaInvalida('json_invalido');
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new EntradaInvalida('cuerpo_demasiado_grande', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
  catch (_) { throw new EntradaInvalida('json_invalido'); }
}

function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e11 ? value * 1000 : value;
    return Number.isSafeInteger(ms) ? ms : NaN;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const [y, m, d] = value.slice(0,10).split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y,m,0)).getUTCDate()) return NaN;
  return Date.parse(value);
}

export function validarAviso(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !CAMPOS.has(key))) {
    throw new EntradaInvalida('datos_invalidos');
  }
  // La clave del iPhone no autoriza escribir la posición de otro equipo.
  if (input.equipo !== 'iphone-carlos') throw new EntradaInvalida('equipo_no_autorizado', 401);
  for (const [key, min, max] of [['lat',-90,90], ['lon',-180,180], ['precision_m',0,100000]]) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
      throw new EntradaInvalida(`${key}_invalido`);
    }
  }
  if ('bateria' in input && (typeof input.bateria !== 'number' || !Number.isFinite(input.bateria) || input.bateria < 0 || input.bateria > 100)) {
    throw new EntradaInvalida('bateria_invalida');
  }
  if (typeof input.fuente !== 'string' || !input.fuente.trim() || input.fuente.length > 64 || /[\u0000-\u001f\u007f]/.test(input.fuente)) {
    throw new EntradaInvalida('fuente_invalida');
  }
  const ts = timestamp(input.ts);
  if (!Number.isFinite(ts) || ts < now - MAX_RETRASO_MS || ts > now + MAX_ADELANTO_MS) throw new EntradaInvalida('ts_invalido');
  return {
    equipo:'iphone-carlos', lat:input.lat, lon:input.lon, precision_m:input.precision_m,
    bateria:input.bateria ?? null, fuente:input.fuente.trim(),
    ts:new Date(ts).toISOString(), recibido_en:new Date(now).toISOString(),
  };
}

const prefijo = (equipo) => `ubicacion:v1:${equipo}:`;

export async function guardarAviso(kv, aviso, now = Date.now()) {
  const ts = Date.parse(aviso.ts);
  const key = `${prefijo(aviso.equipo)}${String(INVERTIR_TS-ts).padStart(13,'0')}:${crypto.randomUUID()}`;
  // Aun una medición futura por desfase de reloj nunca se conserva >7 días.
  const expiration = Math.floor((Math.min(ts, now) + RETENCION_MS) / 1000);
  await kv.put(key, JSON.stringify(aviso), {expiration, metadata:aviso});
}

export async function ultimaPosicion(kv, equipo, now = Date.now()) {
  let cursor;
  // list puede devolver páginas vacías con cursor por claves recién expiradas.
  for (let page = 0; page < 16; page++) {
    const result = await kv.list({prefix:prefijo(equipo), limit:1, ...(cursor ? {cursor} : {})});
    for (const entry of result.keys) {
      const aviso = entry.metadata;
      const ts = Date.parse(aviso?.ts);
      if (aviso?.equipo === equipo && Number.isFinite(ts) && ts >= now - RETENCION_MS && ts <= now + MAX_ADELANTO_MS) return aviso;
    }
    if (result.list_complete) return null;
    if (!result.cursor || result.cursor === cursor) throw new Error('paginacion_ubicacion_invalida');
    cursor = result.cursor;
  }
  throw new Error('limite_paginacion_ubicacion');
}

export async function listarEquipos(kv, now = Date.now()) {
  return Promise.all(EQUIPOS.map(async (equipo) => {
    const aviso = equipo.tipo === 'movil' ? await ultimaPosicion(kv, equipo.equipo, now) : null;
    const desactualizado = equipo.tipo === 'movil' && (!aviso || now - Date.parse(aviso.ts) > DESACTUALIZADO_MS);
    return {
      ...equipo, lat:aviso?.lat ?? equipo.lat ?? null, lon:aviso?.lon ?? equipo.lon ?? null,
      precision_m:aviso?.precision_m ?? null, bateria:aviso?.bateria ?? null,
      fuente:aviso?.fuente ?? (equipo.tipo === 'fijo' ? 'manual' : null),
      ts:aviso?.ts ?? null, ultimo_aviso:aviso?.ts ?? null,
      recibido_en:aviso?.recibido_en ?? null, desactualizado,
      estado:equipo.tipo === 'fijo' ? 'fijo' : !aviso ? 'sin_datos' : desactualizado ? 'desactualizado' : 'actualizado',
    };
  }));
}

export function errorAviso(error) {
  return error instanceof EntradaInvalida ? respuestaUbicacion({ok:false,error:error.message}, error.status) : null;
}
