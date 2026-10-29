/*
 * Posición SIMULADA de Luka para los players del móvil (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * Con «Mover también el móvil» encendido, el simulador del mapa publica aquí a Luka cada vez que
 * se suelta, y /pruebas/mapa/player/ con la fuente «Luka del simulador» la sigue. Es una simulación:
 * no entra en el histórico de ubicaciones (KV UBICACIONES) ni pasa por el feed real del SmartTag2.
 *
 * D1 (AUTH_DB) y no KV: el teléfono tiene que ver el cambio en segundos, y KV tarda hasta 60 s en
 * propagar una escritura a otra ubicación de Cloudflare. Una fila por equipo; caduca a las 2 h.
 */
export const CADUCA_SIMULACION_MS = 2 * 60 * 60 * 1000;
const TABLA = `CREATE TABLE IF NOT EXISTS mapa_simulacion (
  equipo TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  ts INTEGER NOT NULL,
  por TEXT NOT NULL
)`;
const CAMPOS = new Set(['equipo', 'lat', 'lon']);
const listo = new WeakSet();

async function asegurar(db) {
  if (listo.has(db)) return;
  await db.prepare(TABLA).run();
  listo.add(db);
}

export function validarSimulacion(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (Object.keys(input).some((key) => !CAMPOS.has(key))) return null;
  const {equipo, lat, lon} = input;
  if (equipo !== 'luka' || !Number.isFinite(lat) || Math.abs(lat) > 85 || !Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  return {equipo, lat, lon};
}

export async function guardarSimulacion(db, entrada, email, now = Date.now()) {
  const valida = validarSimulacion(entrada);
  if (!valida) return null;
  await asegurar(db);
  await db.prepare(`INSERT INTO mapa_simulacion(equipo,lat,lon,ts,por) VALUES(?,?,?,?,?)
    ON CONFLICT(equipo) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, ts=excluded.ts, por=excluded.por`)
    .bind(valida.equipo, valida.lat, valida.lon, now, String(email || '')).run();
  return {...valida, ts:new Date(now).toISOString()};
}

export async function leerSimulacion(db, equipo = 'luka', now = Date.now()) {
  await asegurar(db);
  const fila = await db.prepare('SELECT equipo, lat, lon, ts FROM mapa_simulacion WHERE equipo=?').bind(equipo).first();
  if (!fila || !Number.isFinite(fila.ts) || now - fila.ts > CADUCA_SIMULACION_MS) return null;
  return {equipo:fila.equipo, lat:fila.lat, lon:fila.lon, ts:new Date(fila.ts).toISOString()};
}
