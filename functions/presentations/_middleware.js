/* /presentations YA NO ES UNA PUERTA (MorfeoMacMini, 21-09-2026 · FLT-100782 b).
 *
 * Aquí vivía un segundo control de acceso, copia del de /presentaciones pero sin directorio,
 * sin Google y sin contraseña genérica: el mismo cliente entraba en castellano y se quedaba
 * fuera en inglés, y cada arreglo de seguridad había que hacerlo dos veces. Ahora hay UNA
 * puerta (functions/presentaciones/_middleware.js) y esto sólo redirige, conservando cada
 * enlace ya enviado:
 *   /presentations/LaCaixa(.html) · caixa · lenovo → /presentaciones/<cliente>/english
 *   /presentations/nvidia(.html)                   → la NVIDIA del generador (su puente)
 *   /presentations/<slug> generado                 → /presentaciones/<slug>/presentacion?lang=en
 *   /presentations/ (galería interna)              → /presentaciones/galeria
 * Nunca llama a next(): los HTML de presentations/ sólo se sirven desde la puerta común.
 * 301 para GET/HEAD con caché corta (si un destino hubiera que corregirlo, los navegadores
 * no se lo quedan para siempre) y 307 para el resto, que conserva el método y el cuerpo.
 */
export const LEGACY_TARGETS = {
  '':'/presentaciones/galeria',
  index:'/presentaciones/galeria',
  lacaixa:'/presentaciones/lacaixa/english',
  caixa:'/presentaciones/caixa/english',
  lenovo:'/presentaciones/lenovo/english',
  nvidia:'/presentaciones/nvidia/presentacion'
};
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function legacyTarget(pathname){
  const rel = String(pathname || '').replace(/^\/presentations\/?/i, '').replace(/^\/+|\/+$/g, '');
  const parts = rel ? rel.split('/').filter(Boolean) : [];
  if (parts.length > 1) return null;
  const key = (parts[0] || '').replace(/\.html$/i, '').toLowerCase();
  if (Object.hasOwn(LEGACY_TARGETS, key)) return {path:LEGACY_TARGETS[key], english:false};
  return SLUG.test(key) ? {path:`/presentaciones/${key}/presentacion`, english:true} : null;
}

export async function onRequest({request}){
  const url = new URL(request.url);
  const target = legacyTarget(url.pathname);
  if (!target) return new Response('Not found', {status:404, headers:{'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow'}});
  const query = new URLSearchParams(url.search);
  if (target.english && !query.has('lang')) query.set('lang', 'en');
  const search = query.toString();
  const permanent = ['GET', 'HEAD'].includes(request.method);
  return new Response(null, {status:permanent ? 301 : 307, headers:{
    location:`${target.path}${search ? `?${search}` : ''}`,
    'cache-control':permanent ? 'public, max-age=3600' : 'no-store',
    'x-robots-tag':'noindex, nofollow'
  }});
}
