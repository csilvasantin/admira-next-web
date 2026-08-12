import { sesionCompleta, csrfValido, auditar, cookiesBorradas } from '../_webmaster-gate.js';

export async function onRequestPost({ request, env }) {
  const current = await sesionCompleta(request, env);
  if (!current || !csrfValido(request, current)) return Response.json({ok:false,error:'sesión o CSRF inválidos'}, {status:403});
  await auditar(env, current.email, current.email, 'logout', current.sid).catch(() => {});
  const headers = new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  cookiesBorradas().forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(JSON.stringify({ok:true}), {headers});
}
