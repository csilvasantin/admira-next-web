import { sesionCompleta,csrfValido,auditar } from '../../_webmaster-gate.js';
import { projects,ensureRegistry,validateVenue,auditRegistry } from '../../_xpace-registry.js';
import { json } from '../../_xpace-auth.js';
async function admin(request,env){const c=await sesionCompleta(request,env);return c?.role==='admin'?c:null;}
export async function onRequestGet({request,env}) {
 if(!await admin(request,env))return json(request,{ok:false,error:'Necesitas administración de AdmiraNext'},403);
 await ensureRegistry(env);return json(request,{ok:true,projects:await projects(env),venues:(await env.AUTH_DB.prepare('SELECT * FROM admiranext_xpace_venues ORDER BY name').all()).results,audit:(await env.AUTH_DB.prepare('SELECT * FROM admiranext_xpace_audit ORDER BY created_at DESC LIMIT 30').all()).results});
}
export async function onRequestPost({request,env}) {
 const current=await admin(request,env);
 if(!current||!csrfValido(request,current))return json(request,{ok:false,error:'Administración y CSRF requeridos'},403);
 let body;try{body=await request.json();}catch{return json(request,{ok:false,error:'JSON inválido'},400);}
 await ensureRegistry(env);
 try{
  if(body.kind==='project') {
   const id=String(body.id||''),name=String(body.name||'').trim(),circuit=String(body.circuit||'');
   if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)||name.length<2||name.length>160||! /^[a-z0-9][a-z0-9_-]{1,79}$/.test(circuit))throw Error('ID, nombre o circuito inválidos');
   const old=await env.AUTH_DB.prepare('SELECT circuit FROM admiranext_commercial_projects WHERE id=?').bind(id).first();
   if(old&&old.circuit!==circuit)throw Error('El circuito existente es estable; crea otro proyecto para otro circuito');
   await env.AUTH_DB.prepare(`INSERT INTO admiranext_commercial_projects VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(id,name,circuit,Date.now(),current.email).run();
   await auditRegistry(env,current.email,id,'xpace_project_saved',{id,name,circuit});
   await auditar(env,current.email,'-','xpace_project_saved',id);
  }else if(body.kind==='venue') {
   const v=validateVenue(body,await projects(env));
   const old=await env.AUTH_DB.prepare('SELECT project_id FROM admiranext_xpace_venues WHERE id=?').bind(v.id).first();
   if(old&&old.project_id!==v.project_id)throw Error('No se puede trasladar un ID de local a otro proyecto');
   await env.AUTH_DB.prepare(`INSERT INTO admiranext_xpace_venues VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,xpace_url=excluded.xpace_url,enabled=excluded.enabled,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(v.id,v.project_id,v.name,v.xpace_url,v.enabled,Date.now(),current.email).run();
   await auditRegistry(env,current.email,v.id,'xpace_venue_saved',v);
   await auditar(env,current.email,'-','xpace_venue_saved',v.id);
  }else throw Error('Tipo de registro inválido');
  return json(request,{ok:true});
 }catch(error){return json(request,{ok:false,error:error.message},422);}
}
