/*
 * GET /api/finde-pilares — misma fuente que data/pilares-finde.json; sesión requerida.
 */
import DATOS from '../../data/pilares-finde.json' with { type: 'json' };
import { sesionCompleta } from '../_webmaster-gate.js';

export async function onRequestGet({ request, env }) {
  const current = await sesionCompleta(request, env);
  if (!current) {
    return Response.json({ ok: false, error: 'Zona protegida: sesión requerida.' }, {
      status: 401,
      headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
  return Response.json({ ok: true, ...DATOS }, {
    headers: { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}
