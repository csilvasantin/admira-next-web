import { asegurarDirectorio, exigirRol, csrfValido, auditar } from '../_webmaster-gate.js';
import { catalogoProyectos, normalizarPermisos } from '../_project-access.js';
import { estadoUsuario, leerListaBlanca, cruzarListaBlanca, textoInvitacion } from '../_usuarios-estado.js';

const ROLES = new Set(['admin','editor','viewer']);
const json = (body, status=200) => Response.json(body, {status, headers:{'cache-control':'no-store'}});
const email = (value) => { const v=String(value||'').trim().toLowerCase(); return v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v:''; };

async function admin(request, env, write=false) {
  const current = await exigirRol(request, env, ['admin']);
  if (!current) return {error:json({ok:false,error:'administrador requerido'},403)};
  if (write && !csrfValido(request,current)) return {error:json({ok:false,error:'CSRF inválido'},403)};
  return {current};
}
async function activeAdmins(env) {
  const row = await env.AUTH_DB.prepare("SELECT COUNT(*) n FROM admiranext_users WHERE role='admin' AND status='active'").first();
  return Number(row && row.n || 0);
}
async function permisosPorUsuario(env) {
  const rows=await env.AUTH_DB.prepare('SELECT user_email,project_key FROM admiranext_user_projects ORDER BY user_email,project_key').all();
  return (rows.results||[]).reduce((map,row)=>{(map[row.user_email]||(map[row.user_email]=[])).push(row.project_key);return map},{});
}
async function reemplazarPermisos(env,target,keys,actor) {
  const now=Date.now(), statements=[env.AUTH_DB.prepare('DELETE FROM admiranext_user_projects WHERE user_email=?').bind(target)];
  keys.forEach((key)=>statements.push(env.AUTH_DB.prepare('INSERT INTO admiranext_user_projects(user_email,project_key,created_at,created_by) VALUES(?,?,?,?)').bind(target,key,now,actor)));
  if(typeof env.AUTH_DB.batch==='function')await env.AUTH_DB.batch(statements);
  else for(const statement of statements)await statement.run();
}
async function permisosValidos(body,env) {
  if(!Array.isArray(body.project_keys))return {error:'elige al menos un proyecto'};
  const catalog=await catalogoProyectos(env), requested=[...new Set(body.project_keys.map(String).map((v)=>v.trim()).filter(Boolean))];
  const keys=normalizarPermisos(requested,catalog.projects);
  if(!keys.length)return {error:'elige al menos un proyecto'};
  if(!keys.includes('*')&&keys.length!==requested.length)return {error:'hay proyectos que no pertenecen al censo'};
  return {keys,catalog};
}

export async function onRequestGet({request,env}) {
  const auth=await admin(request,env); if(auth.error)return auth.error;
  await asegurarDirectorio(env);
  const [users,audit,permissions,catalog,lista]=await Promise.all([
    env.AUTH_DB.prepare('SELECT email,display_name,role,status,session_version,created_at,updated_at,last_login_at FROM admiranext_users ORDER BY status,role,email').all(),
    env.AUTH_DB.prepare('SELECT actor_email,target_email,action,detail,created_at FROM admiranext_user_audit ORDER BY created_at DESC LIMIT 80').all(),
    permisosPorUsuario(env), catalogoProyectos(env), leerListaBlanca(env)
  ]);
  const rows=(users.results||[]).map((user)=>({...user,project_keys:permissions[user.email]||[]}));
  // Directorio honesto (FLT-1577): estado real, cruce con admira.live e invitación lista.
  const cruce=cruzarListaBlanca(rows,lista);
  const url=new URL(request.url);
  const entrada=url.origin.endsWith('admiranext.com')?url.origin+'/webmaster':undefined;
  return json({ok:true,current:{email:auth.current.email,role:auth.current.role,csrf:auth.current.csrf},
    users:rows.map((user)=>({...user,estado:estadoUsuario(user),...cruce.por_email[user.email],
      invitacion:textoInvitacion(user,user.project_keys,catalog.projects,entrada)})),audit:audit.results||[],
    projects:catalog.projects,catalog_complete:catalog.complete,catalog_warning:catalog.warning,
    lista_blanca:{complete:lista.complete,warning:lista.warning,total:lista.emails.length,
      solo_en_lista_blanca:cruce.solo_en_lista_blanca,solo_en_directorio:cruce.solo_en_directorio}});
}

export async function onRequestPost({request,env}) {
  const auth=await admin(request,env,true); if(auth.error)return auth.error;
  let body; try{body=await request.json()}catch{return json({ok:false,error:'JSON no válido'},400)}
  const target=email(body.email), role=String(body.role||'viewer');
  if(!target||!ROLES.has(role))return json({ok:false,error:'email o rol no válidos'},422);
  const access=await permisosValidos(body,env); if(access.error)return json({ok:false,error:access.error},422);
  const exists=await env.AUTH_DB.prepare('SELECT email FROM admiranext_users WHERE email=?').bind(target).first();
  if(exists)return json({ok:false,error:'el usuario ya existe'},409);
  const now=Date.now(), name=String(body.display_name||'').trim().slice(0,100);
  await env.AUTH_DB.prepare("INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at) VALUES(?,?,?,'active',1,?,?)")
    .bind(target,name,role,now,now).run();
  await reemplazarPermisos(env,target,access.keys,auth.current.email);
  await auditar(env,auth.current.email,target,'user_created',JSON.stringify({role,projects:access.keys}));
  return json({ok:true,email:target,role,project_keys:access.keys},201);
}

export async function onRequestPatch({request,env}) {
  const auth=await admin(request,env,true); if(auth.error)return auth.error;
  let body; try{body=await request.json()}catch{return json({ok:false,error:'JSON no válido'},400)}
  const target=email(body.email); if(!target)return json({ok:false,error:'email no válido'},422);
  const user=await env.AUTH_DB.prepare('SELECT * FROM admiranext_users WHERE email=?').bind(target).first();
  if(!user)return json({ok:false,error:'usuario no encontrado'},404);
  const action=String(body.action||'update');
  if(action==='revoke_sessions'){
    await env.AUTH_DB.prepare('UPDATE admiranext_users SET session_version=session_version+1,updated_at=? WHERE email=?').bind(Date.now(),target).run();
    await auditar(env,auth.current.email,target,'sessions_revoked','manual');
    return json({ok:true,email:target,action});
  }
  const role=String(body.role||user.role), status=String(body.status||user.status);
  if(!ROLES.has(role)||!['active','suspended'].includes(status))return json({ok:false,error:'rol o estado no válidos'},422);
  const removesAdmin=user.role==='admin'&&user.status==='active'&&(role!=='admin'||status!=='active');
  if(removesAdmin&&await activeAdmins(env)<=1)return json({ok:false,error:'no se puede retirar el último administrador activo'},409);
  if(target===auth.current.email&&(role!=='admin'||status!=='active'))return json({ok:false,error:'no puedes retirar tu propia administración'},409);
  const oldRows=await env.AUTH_DB.prepare('SELECT project_key FROM admiranext_user_projects WHERE user_email=? ORDER BY project_key').bind(target).all();
  const oldProjects=(oldRows.results||[]).map((row)=>row.project_key);
  let projects=oldProjects;
  if(body.project_keys!==undefined){const access=await permisosValidos(body,env);if(access.error)return json({ok:false,error:access.error},422);projects=access.keys}
  const projectsChanged=JSON.stringify(projects)!==JSON.stringify(oldProjects);
  const changed=role!==user.role||status!==user.status||projectsChanged;
  const name=body.display_name==null?user.display_name:String(body.display_name).trim().slice(0,100);
  const result=await env.AUTH_DB.prepare(`UPDATE admiranext_users SET display_name=?,role=?,status=?,session_version=session_version+?,updated_at=?
    WHERE email=? AND (?=0 OR EXISTS(SELECT 1 FROM admiranext_users other WHERE other.email<>? AND other.role='admin' AND other.status='active'))`)
    .bind(name,role,status,changed?1:0,Date.now(),target,removesAdmin?1:0,target).run();
  if(!result||!result.meta||Number(result.meta.changes)!==1)return json({ok:false,error:'no se puede retirar el último administrador activo'},409);
  if(projectsChanged)await reemplazarPermisos(env,target,projects,auth.current.email);
  await auditar(env,auth.current.email,target,'user_updated',JSON.stringify({from:{role:user.role,status:user.status,projects:oldProjects},to:{role,status,projects}}));
  return json({ok:true,email:target,role,status,project_keys:projects,sessions_revoked:changed});
}
