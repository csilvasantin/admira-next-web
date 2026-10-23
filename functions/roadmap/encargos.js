/**
 * /roadmap/encargos — encargos abiertos por persona, bajo RoadMap (Carlos, 19-10-2026).
 *
 * Misma verja de SERVIDOR que /roadmap (functions/roadmap.js): identidad de Google +
 * directorio AUTH_DB (_webmaster-gate.js). Sin sesión responde 401 con el login
 * interno y ni siquiera se pide la plantilla. La plantilla estática
 * (roadmap/encargos.html) no lleva cifras: las inyecta esta función desde
 * functions/_encargos-matinal.js, que Pages no sirve como asset.
 */
import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';
import { parteVigente, htmlParte } from '../_encargos-matinal.js';

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
  if (!html) return new Response('Ahora mismo no está la tabla de encargos.\n', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' } });

  const p = htmlParte(await parteVigente(env));
  const out = html
    .replaceAll('<!--ENC_FECHA-->', p.fecha)
    .replaceAll('<!--ENC_ORIGEN-->', p.origen)
    .replace('<!--ENC_AGENTES-->', p.agentes)
    .replace('<!--ENC_TOTAL_AGENTES-->', p.totalAgentes)
    .replace('<!--ENC_CONSEJEROS-->', p.consejeros)
    .replace('<!--ENC_TOTAL_CONSEJEROS-->', p.totalConsejeros)
    .replace('<!--ENC_DETALLE-->', p.detalle)
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
