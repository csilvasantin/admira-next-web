import { sesionCompleta, buscarUsuario, asegurarDirectorio } from './_webmaster-gate.js';
import { ensureRegistry, CLIENT_ORIGINS } from './_xpace-registry.js';
export const TTL=10*60*1000;
export const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');
export async function appAllowed(env,email) {
 const user=await buscarUsuario(env,email);
 if(!user||!['admin','editor','viewer'].includes(user.role)||user.status!=='active'||Number(user.expires_at||0)>0&&Number(user.expires_at)<Date.now()) return false;
 if(!['guest','partner'].includes(user.account_kind)) return true;
 return !!await env.AUTH_DB.prepare("SELECT app_key FROM admiranext_user_apps WHERE user_email=? AND app_key='xpaceos'").bind(email).first();
}
export async function issueAccess(env,current,origin) {
 await ensureRegistry(env);
 if(!CLIENT_ORIGINS.has(origin)||!await appAllowed(env,current.email)) throw Error('XpaceOS no contratado o cliente no permitido');
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join(''),expires_at=Date.now()+TTL;
 await env.AUTH_DB.prepare('DELETE FROM admiranext_xpace_access WHERE expires_at<=?').bind(Date.now()).run();
 await env.AUTH_DB.prepare('INSERT INTO admiranext_xpace_access VALUES(?,?,?,?,?)').bind(await digest(token),current.email,current.session_version,origin,expires_at).run();
 return {token,expires_at};
}
export async function contextUser(request,env) {
 const origin=request.headers.get('origin'), bearer=request.headers.get('authorization');
 if(bearer) {
  if(!CLIENT_ORIGINS.has(origin)||!/^Bearer [0-9a-f]{64}$/.test(bearer)) return null;
  await asegurarDirectorio(env);await ensureRegistry(env);
  const access=await env.AUTH_DB.prepare('SELECT * FROM admiranext_xpace_access WHERE token_hash=?').bind(await digest(bearer.slice(7))).first();
  if(!access||access.origin!==origin||Number(access.expires_at)<=Date.now()) return null;
  const user=await buscarUsuario(env,access.user_email);
  if(!await appAllowed(env,access.user_email)||Number(user.session_version)!==Number(access.session_version)) return null;
  const keys=await env.AUTH_DB.prepare('SELECT project_key FROM admiranext_user_projects WHERE user_email=? ORDER BY project_key').bind(user.email).all();
  return {email:user.email,display_name:user.display_name,project_keys:keys.results.map(p=>p.project_key)};
 }
 if(origin && origin!==new URL(request.url).origin) return null;
 const current=await sesionCompleta(request,env);
 return current&&await appAllowed(env,current.email)?current:null;
}
export function json(request,body,status=200,publicRead=false) {
 const origin=request.headers.get('origin'), headers={'cache-control':'no-store','vary':'Origin','x-content-type-options':'nosniff'};
 if(publicRead) headers['access-control-allow-origin']='*';
 else if(CLIENT_ORIGINS.has(origin)) headers['access-control-allow-origin']=origin;
 return Response.json(body,{status,headers});
}
export function preflight(request) {
 if(!CLIENT_ORIGINS.has(request.headers.get('origin'))) return new Response(null,{status:403});
 return new Response(null,{status:204,headers:{'access-control-allow-origin':request.headers.get('origin'),'access-control-allow-methods':'GET, DELETE, OPTIONS','access-control-allow-headers':'Authorization','access-control-max-age':'600','vary':'Origin'}});
}
