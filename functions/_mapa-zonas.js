/*
 * Zonas del player por ubicación (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * El editor de /pruebas/mapa publica aquí sus zonas para que el player del móvil
 * (/pruebas/mapa/player/) reproduzca con las mismas. Antes vivían solo en el
 * localStorage de quien las editaba. Un único documento en el KV UBICACIONES,
 * clave mapa-zonas:v1, sin caducidad: zonas y temas, nunca posiciones.
 *
 * Las reglas son las de AdmiraMapaZonas.validate (editor-zonas.js); si cambian
 * allí, cambian aquí. Concurrencia optimista con rev: quien publica desde una
 * copia vieja recibe 409 y la rev vigente, en vez de pisar al otro editor.
 */
export const CLAVE_ZONAS = 'mapa-zonas:v1';
export const MAX_ZONAS_BYTES = 16 * 1024;
const TAG = /^[a-z0-9][a-z0-9-]{0,47}$/;
const ID = /^[a-z][a-z0-9-]{0,47}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

export function validarZonas(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.zones) || value.zones.length > 8 ||
      !value.outside || typeof value.outside.tag !== 'string' || !TAG.test(value.outside.tag)) return null;
  const ids = new Set();
  const zones = [];
  for (const zone of value.zones) {
    if (!zone || typeof zone.id !== 'string' || !ID.test(zone.id) || zone.id === 'exterior' || ids.has(zone.id) ||
        typeof zone.name !== 'string' || !zone.name.trim() || zone.name.length > 48 || CONTROL.test(zone.name) ||
        (zone.address != null && (typeof zone.address !== 'string' || zone.address.length > 160 || CONTROL.test(zone.address))) ||
        typeof zone.tag !== 'string' || !TAG.test(zone.tag) || !Number.isFinite(zone.lat) || Math.abs(zone.lat) > 85 ||
        !Number.isFinite(zone.lon) || Math.abs(zone.lon) > 180 || !Number.isFinite(zone.radius) || zone.radius < 50 || zone.radius > 5000) return null;
    ids.add(zone.id);
    const normalized = {id:zone.id, name:zone.name.trim(), tag:zone.tag, lat:zone.lat, lon:zone.lon, radius:Math.round(zone.radius)};
    if (zone.address) normalized.address = zone.address.trim();
    zones.push(normalized);
  }
  return {version:1, zones, outside:{tag:value.outside.tag}};
}

const revValida = rev => Number.isSafeInteger(rev) && rev >= 0;

export async function leerZonas(kv) {
  const raw = await kv.get(CLAVE_ZONAS);
  let doc = null;
  try { doc = raw ? JSON.parse(raw) : null; } catch (_) { doc = null; }
  const rev = doc && revValida(doc.rev) ? doc.rev : 0;
  const zonas = doc ? validarZonas(doc.zonas) : null;
  // Un documento roto no se sirve: el player cae a las zonas de ejemplo y se puede republicar.
  if (!zonas) return {zonas:null, rev, actualizado_en:null, actualizado_por:null};
  return {zonas, rev, actualizado_en:doc.actualizado_en || null, actualizado_por:doc.actualizado_por || null};
}

export async function guardarZonas(kv, entrada, email, now = Date.now()) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return {ok:false, status:400, error:'datos_invalidos'};
  const zonas = validarZonas(entrada.zonas);
  if (!zonas) return {ok:false, status:400, error:'zonas_invalidas'};
  if (!revValida(entrada.rev)) return {ok:false, status:400, error:'rev_invalida'};
  const actual = await leerZonas(kv);
  if (entrada.rev !== actual.rev) return {ok:false, status:409, error:'rev_desfasada', rev:actual.rev};
  const doc = {rev:actual.rev + 1, zonas, actualizado_en:new Date(now).toISOString(), actualizado_por:String(email || '')};
  await kv.put(CLAVE_ZONAS, JSON.stringify(doc));
  return {ok:true, ...doc};
}
