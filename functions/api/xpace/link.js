// PKCE-style, single-use rendezvous survives Google redirect/COOP severing opener.
// The verifier and access token never enter a URL. This route cannot edit data.
import { CLIENT_ORIGINS,ensureRegistry } from '../../_xpace-registry.js';
import { json,digest,issueAccess } from '../../_xpace-auth.js';
import { buscarUsuario } from '../../_webmaster-gate.js';
export function onRequestOptions({request}){const origin=request.headers.get('origin');if(!CLIENT_ORIGINS.has(origin))return new Response(null,{status:403});return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type','vary':'Origin','access-control-max-age':'600'}});}
export async function onRequestPost({request,env}){
 const origin=request.headers.get('origin');if(!CLIENT_ORIGINS.has(origin))return json(request,{ok:false},403);
 let body;try{body=await request.json();}catch{return json(request,{ok:false},400);}
 if(!/^[a-f0-9]{64}$/.test(body.state||''))return json(request,{ok:false},422);
 await ensureRegistry(env);
 if(body.action==='begin'){
  if(!/^[a-f0-9]{64}$/.test(body.challenge||''))return json(request,{ok:false},422);
  await env.AUTH_DB.prepare('DELETE FROM admiranext_xpace_links WHERE expires_at<=?').bind(Date.now()).run();
  const inserted=await env.AUTH_DB.prepare('INSERT INTO admiranext_xpace_links(state,challenge,origin,expires_at) VALUES(?,?,?,?) ON CONFLICT(state) DO NOTHING RETURNING state').bind(body.state,body.challenge,origin,Date.now()+300000).first();
  return json(request,{ok:!!inserted},inserted?201:409);
 }
 if(body.action!=='claim'||!/^[a-f0-9]{64}$/.test(body.verifier||''))return json(request,{ok:false},422);
 const challenge=await digest(body.verifier),row=await env.AUTH_DB.prepare('SELECT * FROM admiranext_xpace_links WHERE state=? AND challenge=? AND origin=? AND expires_at>?').bind(body.state,challenge,origin,Date.now()).first();
 if(!row)return json(request,{ok:false,error:'Conexión caducada o inválida'},410);
 if(!row.user_email)return json(request,{ok:false,pending:true},202);
 const consumed=await env.AUTH_DB.prepare('DELETE FROM admiranext_xpace_links WHERE state=? AND challenge=? AND origin=? AND expires_at>? AND user_email IS NOT NULL RETURNING user_email,session_version').bind(body.state,challenge,origin,Date.now()).first();
 if(!consumed)return json(request,{ok:false},410);
 const user=await buscarUsuario(env,consumed.user_email);
 if(!user||Number(user.session_version)!==Number(consumed.session_version))return json(request,{ok:false},401);
 try{return json(request,{ok:true,...await issueAccess(env,{email:user.email,session_version:user.session_version},origin)});}catch{return json(request,{ok:false},403);}
}
