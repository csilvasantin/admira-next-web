/*
 * MARCAS PÚBLICAS (Carlos, 10-10-2026). Sin sesión del directorio de AdmiraNeXT
 * (_webmaster-gate.js, el mismo login que /pruebas, /flota o /presentaciones) solo
 * se enseñan Admira y las marcas de EJEMPLO: los años de cine (81-89) y las
 * ficticias (Lumbre, Brumelle, Frescaria). Ningún cliente ni prospecto real sale en
 * un listado público, y JTI y Altadis nunca aparecen juntos.
 * Es una lista CERRADA a propósito: una marca nueva no se hace pública por
 * marcarse como «ejemplo» en el catálogo; se añade aquí, en el repo.
 */
import { sesionCompleta } from './_webmaster-gate.js';

export const MARCAS_PUBLICAS = Object.freeze(new Set([
  'admira', 'lumbre', 'brumelle', 'frescaria',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
]));

export const esMarcaPublica = (id) => MARCAS_PUBLICAS.has(String(id || '').toLowerCase());

export async function conSesion(request, env) {
  if (!env || !env.WEBMASTER_SIGNING_KEY || !env.AUTH_DB) return false;
  try { return Boolean(await sesionCompleta(request, env)); } catch (_) { return false; }
}

/** Índice de marcas (formato clientes/index.json o /marcablanca/api/marcas) reducido a lo público. */
export function indicePublico(indice) {
  const r = { ...indice };
  if (Array.isArray(indice.clientes)) r.clientes = indice.clientes.filter((c) => c && esMarcaPublica(c.id));
  if (Array.isArray(indice.marcas)) r.marcas = indice.marcas.filter((m) => m && esMarcaPublica(m.id));
  if (indice.dominios && typeof indice.dominios === 'object') {
    r.dominios = Object.fromEntries(Object.entries(indice.dominios).filter(([, id]) => esMarcaPublica(id)));
  }
  if (!esMarcaPublica(r.porDefecto)) r.porDefecto = 'admira';
  r.publico = true;
  return r;
}
