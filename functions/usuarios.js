import { exigirRol, respuestaLogin } from './_webmaster-gate.js';

export async function onRequest({ request, env, next }) {
  const current = await exigirRol(request, env, ['admin']);
  if (!current) return respuestaLogin('Necesitas una sesión de administrador.', '/usuarios', 401);
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store'); headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(response.body, {status:response.status, headers});
}
