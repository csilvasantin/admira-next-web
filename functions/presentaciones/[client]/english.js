// LOS DECKS EN INGLÉS, DETRÁS DE LA PUERTA COMÚN (MorfeoMacMini, 21-09-2026 · FLT-100782 b).
//
// Las versiones inglesas de La Caixa y Lenovo vivían en /presentations/, con un middleware
// propio que repetía el de /presentaciones sin directorio, sin Google y sin contraseña
// genérica: el mismo cliente entraba en castellano y se quedaba fuera en inglés. Ahora se
// sirven en /presentaciones/<cliente>/english, así que pasan por _middleware.js como
// cualquier otra sala (misma contraseña PRES_<CLIENTE>, misma cookie, mismo registro).
// Los HTML siguen en presentations/: env.ASSETS los lee sin pasar por las Functions, y
// /presentations/* ya sólo redirige aquí (functions/presentations/_middleware.js).
export const ENGLISH_DECKS = {lacaixa:'LaCaixa', caixa:'caixa', lenovo:'lenovo'};

export async function onRequest({request, env, params}){
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', {status:405, headers:{allow:'GET, HEAD'}});
  }
  const file = ENGLISH_DECKS[String(params.client || '').toLowerCase()];
  if (!file) return new Response('Not found', {status:404, headers:{'cache-control':'no-store'}});
  const asset = await env.ASSETS.fetch(new URL(`/presentations/${file}.html`, request.url));
  if (!asset.ok) return new Response('English deck unavailable', {status:503, headers:{'cache-control':'no-store'}});
  return new Response(request.method === 'HEAD' ? null : await asset.text(), {headers:{
    'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow'
  }});
}
