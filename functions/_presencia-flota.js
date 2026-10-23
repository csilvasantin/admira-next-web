/**
 * Presencia declarada en bot.yokup.com/api/presence.
 * admira.live/api/flota/trabajando no pinta verde un latido mode=trabajando
 * con verified:0 (identity_state declared_surface, sin tokens). Encargos sí.
 * No reenvía el foco ni la cuenta: solo quién acaba de decir que trabaja.
 */
import { personaClave } from '../assets/misiones-vivas.js';

export const PRESENCIA_URL = 'https://bot.yokup.com/api/presence';
export const PRESENCIA_FRESCURA_S = 90;

/** clave de fila → { clave, mode, ageS, proyecto, verified }. Solo mode trabajando y fresco. */
export function reducirPresencia(data, ahoraS = Math.floor(Date.now() / 1000)) {
  const rows = data && Array.isArray(data.presence) ? data.presence : [];
  const now = Number(data && data.now);
  const reloj = Number.isFinite(now) && now > 0 ? now : ahoraS;
  const por = {};
  for (const p of rows) {
    if (!p || p.mode !== 'trabajando') continue;
    const updated = Number(p.updated);
    if (!Number.isFinite(updated) || updated <= 0) continue;
    const ageS = Math.round(reloj - updated);
    if (!Number.isFinite(ageS) || ageS < 0 || ageS > PRESENCIA_FRESCURA_S) continue;
    const clave = personaClave(p.persona);
    if (!clave) continue;
    const prev = por[clave];
    if (prev && prev.ageS <= ageS) continue;
    por[clave] = {
      clave,
      mode: 'trabajando',
      ageS,
      proyecto: String(p.project || '').trim(),
      verified: p.verified === 1 || p.verified === true,
    };
  }
  return por;
}

export async function leerPresenciaTrabajando(fetchImpl = fetch) {
  const r = await fetchImpl(PRESENCIA_URL, {
    headers: { accept: 'application/json', 'user-agent': 'admiranext-roadmap' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('presencia ' + r.status);
  return reducirPresencia(await r.json());
}
