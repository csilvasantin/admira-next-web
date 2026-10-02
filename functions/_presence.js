import {PROYECTOS} from './_proyectos.js';
import {canonicalHost} from './_analytics.js';
export const ACTIVE_MS=45000;
export const SITE_HOSTS=new Set(['digitalsignage.ai','admira.biz',...PROYECTOS.filter(p=>p.url).map(p=>{try{return canonicalHost(new URL(p.url).hostname)}catch{return ''}})].filter(Boolean));
export function allowedOrigin(origin){try{const u=new URL(origin);return u.protocol==='https:' && !u.port && SITE_HOSTS.has(canonicalHost(u.hostname)) && (u.hostname===canonicalHost(u.hostname) || u.hostname==='www.'+canonicalHost(u.hostname)) ? u.origin : null}catch{return null}}
export function payload(body){
  if(!body || !/^[a-f0-9-]{36}$/i.test(body.sid) || !/^[a-f0-9-]{36}$/i.test(body.page)) throw Error('Sesión no válida');
  if(body.action==='leave') return {sid:body.sid,page:body.page,action:'leave'};
  if(body.action!=='ping' || typeof body.path!=='string' || !body.path.startsWith('/') || body.path.startsWith('//') || body.path.length>500 || /[?#\u0000-\u001f]/.test(body.path)) throw Error('Página no válida');
  return {sid:body.sid,page:body.page,path:body.path,action:'ping'};
}
export async function record(env,request,host,body,now=Date.now()){
  const db=env.AUTH_DB;
  await db.prepare('DELETE FROM admiranext_presence WHERE seen_at<?').bind(now-ACTIVE_MS).run();
  if(body.action==='leave'){await db.prepare('DELETE FROM admiranext_presence WHERE host=? AND sid=? AND page_id=?').bind(host,body.sid,body.page).run();return}
  const country=/^[A-Z]{2}$/.test(request.cf?.country || '')?request.cf.country:'';
  const ua=request.headers.get('user-agent') || '', device=/mobile|android|iphone/i.test(ua)?'Móvil':'Ordenador';
  await db.prepare('INSERT INTO admiranext_presence(host,sid,page_id,path,country,device,started_at,seen_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(host,sid,page_id) DO UPDATE SET path=excluded.path,country=excluded.country,device=excluded.device,seen_at=excluded.seen_at').bind(host,body.sid,body.page,body.path,country,device,now,now).run();
}
export async function snapshot(env,host='',now=Date.now()){
  // Se elimina la presencia caducada al consultar; no se conserva historial.
  await env.AUTH_DB.prepare('DELETE FROM admiranext_presence WHERE seen_at<?').bind(now-ACTIVE_MS).run();
  const result=await env.AUTH_DB.prepare('SELECT host,sid,path,country,device,MIN(started_at) AS started_at,MAX(seen_at) AS seen_at FROM admiranext_presence WHERE seen_at>=? AND (?=\'\' OR host=?) GROUP BY host,sid,path,country,device ORDER BY seen_at DESC LIMIT 501').bind(now-ACTIVE_MS,host,host).all();
  const rows=result.results || [];
  const pages=new Map();
  for(const r of rows.slice(0,500)){const key=r.host+r.path;const p=pages.get(key)||{host:r.host,path:r.path,sessions:new Set()};p.sessions.add(r.sid);pages.set(key,p)}
  return {ok:true,updatedAt:new Date(now).toISOString(),activeWindowSeconds:45,heartbeatSeconds:15,refreshSeconds:5,online:new Set(rows.map(r=>r.host+':'+r.sid)).size,
    truncated:rows.length>500,visitors:rows.slice(0,500).map(({sid,...r})=>({...r,visitor:'Visitante '+sid.slice(0,8),ageSeconds:Math.max(0,Math.floor((now-r.seen_at)/1000))})),
    pages:[...pages.values()].map(p=>({host:p.host,path:p.path,online:p.sessions.size})).sort((a,b)=>b.online-a.online),
    note:'Sesiones anónimas con la página visible y señal recibida en los últimos 45 s. No identifica personas; una persona en distintos dominios puede contar varias veces.'};
}
