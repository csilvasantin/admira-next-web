/**
 * GET /api/arquitectura — organigrama tecnológico de AdmiraNeXT (9-oct-2026).
 *
 * Los mismos datos que pinta /arquitectura (data/arquitectura.json: nodos, aristas con su
 * evidencia y textos ES/EN) más la versión VIVA de cada web, leída aquí de su /version.json
 * (o /healthz) con un tiempo máximo corto. Pública, CORS abierto: otras webs pueden reutilizarla.
 * ?vivo=0 devuelve sólo los datos, sin consultar versiones.
 */
import DATOS from '../../data/arquitectura.json' with { type: 'json' };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-max-age': '86400',
};

async function versionDe(url, fetcher) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetcher(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const v = j.version || (j.server && j.server.version) || null;
    return v ? { version: String(v), firma: j.signature || j.deployer || (j.server && j.server.agent) || null, desplegado: j.deployedAt || null } : null;
  } catch (_) {
    return null;
  }
}

export async function versionesVivas(nodos, fetcher = fetch) {
  const pares = await Promise.all(nodos.map(async (n) => [n.id, await versionDe(n.version_url, fetcher)]));
  return Object.fromEntries(pares.filter(([, v]) => v));
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const vivo = url.searchParams.get('vivo') !== '0';
  const cuerpo = { ...DATOS, generado: new Date().toISOString() };
  if (vivo) cuerpo.versiones = await versionesVivas(DATOS.nodos);
  return new Response(JSON.stringify(cuerpo, null, 1), {
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' },
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
