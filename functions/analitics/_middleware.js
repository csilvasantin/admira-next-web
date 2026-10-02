import { sesionCompleta, respuestaLogin } from '../_webmaster-gate.js';
export async function onRequest({request,env,next}) {
  const path=new URL(request.url).pathname;
  if (!['/analitics','/analitics/','/analitics/index.html'].includes(path)) return next();
  const user=await sesionCompleta(request,env);
  if (!user) return respuestaLogin(env,'','/analitics');
  if (user.role !== 'admin') return new Response('La vista del grupo requiere un administrador de AdmiraNeXT.',{status:403,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  const response=await next();
  const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow');
  return new Response(response.body,{status:response.status,headers});
}
