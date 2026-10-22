/* Colores de «Trabajando ahora» para /roadmap/encargos.
 * Misma fuente que el panel de admira.live/consumos:
 * GET https://www.admira.live/api/flota/trabajando (CORS *).
 * { tarjetas: [{ agente, estado, motivo, enCurso }] }
 * estado: verde | amarillo | rojo | gris.
 * Huang y Jensen son la misma fila. */
export const TRABAJANDO_API = 'https://www.admira.live/api/flota/trabajando';

const ESTADOS = new Set(['verde', 'amarillo', 'rojo', 'gris']);

export const ETIQUETA = Object.freeze({
  verde: 'trabajando',
  amarillo: 'hace poco',
  rojo: '>1 h',
  gris: 'en espera',
});

const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

/** Clave para casar la tarjeta con data-persona. Huang y Jensen coinciden. */
export function claveTrabajando(raw) {
  const k = fold(raw);
  if (k === 'huang' || k === 'jensen') return 'jensen';
  return k;
}

/** Mapa clave → { estado, etiqueta, motivo, agente }. Ignora tarjetas sin estado conocido. */
export function normalizarTarjetas(data) {
  const tarjetas = data && Array.isArray(data.tarjetas) ? data.tarjetas : [];
  const por = {};
  for (const t of tarjetas) {
    if (!t || typeof t !== 'object') continue;
    const clave = claveTrabajando(t.agente);
    const estado = String(t.estado || '').trim();
    if (!clave || !ESTADOS.has(estado)) continue;
    por[clave] = {
      clave,
      agente: String(t.agente || ''),
      estado,
      etiqueta: ETIQUETA[estado],
      motivo: String(t.motivo || '').trim(),
    };
  }
  return por;
}
