import { safeConnection } from '../_xpace-registry.js';
export function onRequestGet({request}) {
 const route=safeConnection(new URL(request.url).pathname+new URL(request.url).search);
 if(!route) return new Response('Cliente o estado inválido',{status:400});
 const u=new URL(request.url),nonce=crypto.randomUUID(),config=JSON.stringify({origin:u.searchParams.get('origin'),state:u.searchParams.get('state'),route}).replaceAll('<','\\u003c');
 return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Conectar XpaceOS · AdmiraNext</title><style nonce="${nonce}">body{background:#07121b;color:#b0efdf;font:16px system-ui;padding:32px}h1{font-size:24px}a{color:#6effd0}</style><h1>AdmiraNext → XpaceOS</h1><p id="status">Comprobando tu sesión central…</p><script nonce="${nonce}">
 const c=${config},status=document.getElementById('status');
 (async()=>{
  const session=await fetch('/api/session',{cache:'no-store'});
  if(session.status===401){location.assign('/webmaster?return_to='+encodeURIComponent(c.route));return;}
  if(!session.ok)throw Error('No se puede comprobar la sesión central.');
  const me=await session.json();
  const response=await fetch('/api/xpace/connect',{method:'POST',headers:{'Content-Type':'application/json','X-Admira-CSRF':me.csrf},body:JSON.stringify({origin:c.origin,state:c.state})});
  const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'No se pudo conectar');
  status.textContent='Conexión completada. Puedes cerrar esta ventana.';window.close();
 })().catch(e=>{status.textContent=e.message;});
 </script></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`}});
}
