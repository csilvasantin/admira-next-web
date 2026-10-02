import {sesionCompleta} from '../_webmaster-gate.js';
import {allowedOrigin,payload,record,snapshot,SITE_HOSTS} from '../_presence.js';
import {canonicalHost} from '../_analytics.js';
const rates=new Map();
function response(data,status=200,origin=null){return new Response(data===null?null:JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','vary':'Origin, Cookie',...(origin?{'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type'}:{})}})}
export async function onRequest({request,env}){
  if(request.method==='GET'){
    const current=await sesionCompleta(request,env);
    if(!current)return response({ok:false,error:'Inicia sesión para consultar la presencia.'},401);
    if(current.role!=='admin')return response({ok:false,error:'Acceso de administrador requerido.'},403);
    const host=canonicalHost(new URL(request.url).searchParams.get('site')||'');
    if(host && !SITE_HOSTS.has(host))return response({ok:false,error:'Site no reconocido.'},400);
    try{return response(await snapshot(env,host))}catch{return response({ok:false,error:'La presencia no está disponible.'},503)}
  }
  const origin=allowedOrigin(request.headers.get('Origin'));
  if(!origin)return response({ok:false},403);
  if(request.method==='OPTIONS')return response(null,204,origin);
  if(request.method!=='POST')return response({ok:false},405,origin);
  if(Number(request.headers.get('content-length')||0)>2048)return response({ok:false},413,origin);
  // Freno local por IP; sólo en memoria, no se almacena ni se devuelve la IP.
  const ip=request.headers.get('CF-Connecting-IP');if(ip){const key=ip+':'+Math.floor(Date.now()/60000),n=(rates.get(key)||0)+1;if(rates.size>2000)rates.clear();rates.set(key,n);if(n>240)return response({ok:false},429,origin)}
  if(/bot|crawler|spider|headless|curl|python/i.test(request.headers.get('user-agent')||''))return response(null,204,origin);
  try{const raw=await request.text();if(raw.length>2048)return response({ok:false},413,origin);const body=payload(JSON.parse(raw));await record(env,request,canonicalHost(new URL(origin).hostname),body);return response(null,204,origin)}catch{return response({ok:false},400,origin)}
}
