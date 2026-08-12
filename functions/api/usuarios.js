import { asegurarDirectorio, exigirRol, csrfValido, auditar } from '../_webmaster-gate.js';

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

export async function onRequestGet({request,env}) {
  const auth=await admin(request,env); if(auth.error)return auth.error;
  await asegurarDirectorio(env);
  const [users,audit]=await Promise.all([
    env.AUTH_DB.prepare('SELECT email,display_name,role,status,session_version,created_at,updated_at,last_login_at FROM admiranext_users ORDER BY status,role,email').all(),
    env.AUTH_DB.prepare('SELECT actor_email,target_email,action,detail,created_at FROM admiranext_user_audit ORDER BY created_at DESC LIMIT 80').all()
  ]);
  return json({ok:true,current:{email:auth.current.email,role:auth.current.role,csrf:auth.current.csrf},users:users.results||[],audit:audit.results||[]});
}

export async function onRequestPost({request,env}) {
  const auth=await admin(request,env,true); if(auth.error)return auth.error;
  let body; try{body=await request.json()}catch{return json({ok:false,error:'JSON no válido'},400)}
  const target=email(body.email), role=String(body.role||'viewer');
  if(!target||!ROLES.has(role))return json({ok:false,error:'email o rol no válidos'},422);
  const exists=await env.AUTH_DB.prepare('SELECT email FROM admiranext_users WHERE email=?').bind(target).first();
  if(exists)return json({ok:false,error:'el usuario ya existe'},409);
  const now=Date.now(), name=String(body.display_name||'').trim().slice(0,100);
  await env.AUTH_DB.prepare("INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at) VALUES(?,?,?,'active',1,?,?)")
    .bind(target,name,role,now,now).run();
  await auditar(env,auth.current.email,target,'user_created',role);
  return json({ok:true,email:target,role},201);
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
  const changed=role!==user.role||status!==user.status;
  const name=body.display_name==null?user.display_name:String(body.display_name).trim().slice(0,100);
  const result=await env.AUTH_DB.prepare(`UPDATE admiranext_users SET display_name=?,role=?,status=?,session_version=session_version+?,updated_at=?
    WHERE email=? AND (?=0 OR EXISTS(SELECT 1 FROM admiranext_users other WHERE other.email<>? AND other.role='admin' AND other.status='active'))`)
    .bind(name,role,status,changed?1:0,Date.now(),target,removesAdmin?1:0,target).run();
  if(!result||!result.meta||Number(result.meta.changes)!==1)return json({ok:false,error:'no se puede retirar el último administrador activo'},409);
  await auditar(env,auth.current.email,target,'user_updated',JSON.stringify({from:{role:user.role,status:user.status},to:{role,status}}));
  return json({ok:true,email:target,role,status,sessions_revoked:changed});
}
