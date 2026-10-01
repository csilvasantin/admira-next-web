import { sesionCompleta,csrfValido } from '../../_webmaster-gate.js';
import { appAllowed,issueAccess,json,digest,preflight } from '../../_xpace-auth.js';
import { CLIENT_ORIGINS,ensureRegistry } from '../../_xpace-registry.js';
export async function onRequestPost({request,env}) {
 const current=await sesionCompleta(request,env);
 if(!current||!csrfValido(request,current)) return json(request,{ok:false,error:'Sesión o CSRF inválidos'},403);
 let body;try{body=await request.json();}catch{return json(request,{ok:false,error:'JSON inválido'},400);}
 if(!CLIENT_ORIGINS.has(body.origin)) return json(request,{ok:false,error:'Cliente no permitido'},422);
 if(body.state){
  if(!/^[a-f0-9]{64}$/.test(body.state)||!await appAllowed(env,current.email))return json(request,{ok:false,error:'Conexión no autorizada'},403);
  await ensureRegistry(env);const linked=await env.AUTH_DB.prepare('UPDATE admiranext_xpace_links SET user_email=?,session_version=? WHERE state=? AND origin=? AND expires_at>? AND user_email IS NULL RETURNING state').bind(current.email,current.session_version,body.state,body.origin,Date.now()).first();
  return json(request,{ok:!!linked,error:linked?'':'La conexión caducó; vuelve a iniciarla desde XpaceOS'},linked?200:410);
 }
 try{return json(request,{ok:true,...await issueAccess(env,current,body.origin)});}catch{return json(request,{ok:false,error:'Esta cuenta no tiene acceso a XpaceOS'},403);}
}
export const onRequestOptions=({request})=>preflight(request);
export async function onRequestDelete({request,env}) {
 const origin=request.headers.get('origin'),bearer=request.headers.get('authorization')||'';
 if(!CLIENT_ORIGINS.has(origin)||!/^Bearer [0-9a-f]{64}$/.test(bearer))return json(request,{ok:false},403);
 await ensureRegistry(env);await env.AUTH_DB.prepare('DELETE FROM admiranext_xpace_access WHERE token_hash=? AND origin=?').bind(await digest(bearer.slice(7)),origin).run();
 return json(request,{ok:true});
}
