/**
 * /roadmap/encargos — sección «Misiones» (antes «Encargos»): abiertas por persona, bajo RoadMap (Carlos, 19-10-2026).
 * 22-10-2026 (#7059): dos tablas, Consejeros | Agentes, y latido en quien trabaja ahora.
 *
 * Misma verja de SERVIDOR que /roadmap (functions/roadmap.js): identidad de Google +
 * directorio AUTH_DB (_webmaster-gate.js). Sin sesión responde 401 con el login
 * interno y ni siquiera se pide la plantilla. La plantilla estática
 * (roadmap/encargos.html) no lleva cifras: las inyecta esta función desde
 * functions/_encargos-matinal.js, que Pages no sirve como asset.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';
import { parteVigente, htmlParte, leerActivos } from '../_encargos-matinal.js';

export const RUTA = '/roadmap/encargos';

async function plantilla(env, url) {
  // ASSETS no pasa por Functions: pedir la ruta limpia devuelve el HTML tal cual.
  for (const p of [RUTA, RUTA + '.html']) {
    const r = await env.ASSETS.fetch(new URL(p, url));
    if (r.ok) return r.text();
  }
  return null;
}

export async function onRequestGet({ request, env }) {
  if (!env.WEBMASTER_SIGNING_KEY) return respuestaLogin(env, 'Acceso no disponible ahora mismo.', RUTA, 503);
  const current = await sesionCompleta(request, env);
  if (!current) return respuestaLogin(env, 'Zona protegida: identifícate para entrar.', RUTA, 401);

  const url = new URL(request.url);
  const html = env.ASSETS && typeof env.ASSETS.fetch === 'function' ? await plantilla(env, url) : null;
  if (!html) return new Response('Ahora mismo no está la tabla de misiones.\n', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' } });

  const [parte, vivos] = await Promise.all([parteVigente(env), leerActivos(env)]);
  const p = htmlParte(parte, vivos.activos);
  const latido = vivos.ok
    ? (p.activos ? `${p.activos} ${p.activos === 1 ? 'persona late' : 'personas laten'} ahora: trabajan en una misión` : 'Ahora mismo nadie de la tabla trabaja en una misión')
    : 'Sin lectura de actividad de admira.live todavía: nadie late hasta que responda (se reintenta desde el navegador)';
  const out = html
    .replace('<!--ENC_FECHA-->', p.fecha)
    .replace('<!--ENC_ORIGEN-->', p.origen)
    .replace('<!--ENC_LATIDO-->', latido)
    .replace('<!--ENC_FILAS_CONSEJEROS-->', p.filasConsejeros)
    .replace('<!--ENC_TOTAL_CONSEJEROS-->', p.totalConsejeros)
    .replace('<!--ENC_FILAS_AGENTES-->', p.filasAgentes)
    .replace('<!--ENC_TOTAL_AGENTES-->', p.totalAgentes)
    .replace('<!--ENC_NOTAS-->', p.notas);
  return new Response(out, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
