/*
 * /api/sello — ¿este visitante puede ver el sello de versión y sus novedades? (06-10-2026)
 *
 * Carlos: en la parte pública de admiranext.com no se enseña el sello ni las novedades;
 * solo a usuarios registrados con sesión válida (la misma de /webmaster). Responde 200
 * siempre —{sesion:true|false}— para no llenar la consola del visitante anónimo de 401, y
 * sin datos personales. Sin cookie no toca D1 (leerToken corta antes).
 */
import { sesionCompleta } from '../_webmaster-gate.js';

export async function onRequestGet({ request, env }) {
  const current = await sesionCompleta(request, env);
  return Response.json({ ok: true, sesion: !!current }, {
    headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
