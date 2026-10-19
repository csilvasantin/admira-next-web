/*
 * Encargos abiertos por persona — tabla matinal (Carlos, 19-10-2026).
 *
 * Vive en functions/ a propósito: Cloudflare Pages no sirve esta carpeta como
 * asset (GET /functions/... da 404), así que las cifras solo salen por
 * /roadmap/encargos, detrás del login (functions/roadmap/encargos.js).
 *
 * De dónde salen las cifras, por orden:
 *   1) KV PRESENTATION_IDEAS, clave «encargos:matinal» (mismo formato que SEMILLA).
 *      Permite refrescar cada mañana SIN redesplegar. Si falta o está mal, se ignora.
 *   2) SEMILLA, abajo: la tabla del 19-10-2026 08:01 (Europe/Madrid).
 * Hoy no hay ningún endpoint ni secreto en este repo que lea el bot-inbox de
 * admira.live en vivo; no se inventa uno. Para regenerar el JSON desde el HTML
 * matinal: node scripts/encargos-matinal.mjs <tabla.html>.
 */
export const CLAVE_KV = 'encargos:matinal';

export const SEMILLA = Object.freeze({
  fecha: '2026-10-19T08:01:00+02:00',
  fuente: 'semilla · tabla matinal del 19-10-2026',
  filas: [
    { persona: 'Wozniak', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    { persona: 'Jobs', abiertos: 1, hoy: 1, ayer: 0, anteriores: 0 },
    { persona: 'Lucas', abiertos: 1, hoy: 0, ayer: 0, anteriores: 1 },
    { persona: 'Disney', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    { persona: 'Musk', abiertos: 5, hoy: 2, ayer: 3, anteriores: 0 },
    { persona: 'Huang', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
    { persona: 'Neo', abiertos: 5, hoy: 0, ayer: 1, anteriores: 4 },
    { persona: 'Morfeo', abiertos: 8, hoy: 0, ayer: 8, anteriores: 0 },
    { persona: 'Trinity', abiertos: 9, hoy: 0, ayer: 5, anteriores: 4 },
    { persona: 'Oráculo', abiertos: 6, hoy: 0, ayer: 4, anteriores: 2 },
    { persona: 'Smith', abiertos: 18, hoy: 0, ayer: 7, anteriores: 11 },
    { persona: 'Niobe', abiertos: 8, hoy: 0, ayer: 7, anteriores: 1 },
    { persona: 'Resto de agentes', abiertos: 0, hoy: 0, ayer: 0, anteriores: 0 },
  ],
  notas: [
    'Resto de agentes: Cypher, Switch, Link, Perséfone, Seraph, Arquitecto y Merovingio.',
    'De Y no hay cifras.',
  ],
});

export const COLUMNAS = Object.freeze(['abiertos', 'hoy', 'ayer', 'anteriores']);

const entero = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

/** Valida y normaliza un parte; devuelve null si no sirve (nunca medio parte). */
export function normalizar(parte) {
  if (!parte || typeof parte !== 'object' || !Array.isArray(parte.filas) || !parte.filas.length) return null;
  const fecha = new Date(parte.fecha);
  if (Number.isNaN(fecha.getTime())) return null;
  const filas = [];
  for (const f of parte.filas) {
    const persona = String((f && f.persona) || '').trim().slice(0, 80);
    if (!persona) return null;
    const fila = { persona };
    for (const c of COLUMNAS) {
      const n = entero(f[c]);
      if (n === null) return null;
      fila[c] = n;
    }
    filas.push(fila);
  }
  const notas = Array.isArray(parte.notas) ? parte.notas.map((n) => String(n).slice(0, 300)).filter(Boolean).slice(0, 10) : [];
  return { fecha: parte.fecha, fuente: String(parte.fuente || 'kv').slice(0, 120), filas, notas };
}

export function totales(filas) {
  const t = { persona: 'Total' };
  for (const c of COLUMNAS) t[c] = filas.reduce((s, f) => s + f[c], 0);
  return t;
}

/** El parte vigente: KV si es válido, si no la semilla. */
export async function parteVigente(env) {
  try {
    const kv = env && env.PRESENTATION_IDEAS;
    if (kv && typeof kv.get === 'function') {
      const crudo = await kv.get(CLAVE_KV);
      if (crudo) {
        const p = normalizar(JSON.parse(crudo));
        if (p) return { ...p, origen: 'kv' };
      }
    }
  } catch (_) { /* KV caído o JSON roto: se sirve la semilla */ }
  return { ...normalizar(SEMILLA), origen: 'semilla' };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fechaMadrid(iso) {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(/\s+de\s+/g, '-').replace(/\./g, '').replace(/\s+/g, '-');
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} a las ${hora}`;
}

/** Pinta tbody, tfoot y notas para inyectar en roadmap/encargos.html. */
export function htmlParte(parte) {
  const celdas = (f) => `<td>${esc(f.persona)}</td>` + COLUMNAS.map((c) => `<td>${f[c]}</td>`).join('');
  const t = totales(parte.filas);
  return {
    fecha: esc(fechaMadrid(parte.fecha)),
    origen: parte.origen === 'kv' ? 'parte del día (KV)' : 'semilla del 19-10-2026',
    filas: parte.filas.map((f) => `<tr>${celdas(f)}</tr>`).join('\n'),
    total: `<tr>${celdas(t)}</tr>`,
    notas: parte.notas.map((n) => `<p class="enc-nota">${esc(n)}</p>`).join('\n'),
  };
}
