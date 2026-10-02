import { sesionCompleta } from '../_webmaster-gate.js';
import { canonicalHost, readAnalytics } from '../_analytics.js';
import {readHttpTraffic} from '../_http-traffic.js';
const memo = new Map();
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','vary':'Cookie','x-robots-tag':'noindex'}});
export async function onRequestGet({request,env}) {
  const current = await sesionCompleta(request,env);
  if (!current) return json({ok:false,error:'Inicia sesión en AdmiraNeXT para consultar las analíticas.'},401);
  // La vista del grupo cruza proyectos: sólo administradores del directorio.
  if (current.role !== 'admin') return json({ok:false,error:'La vista del grupo requiere un administrador de AdmiraNeXT.'},403);
  const params=new URL(request.url).searchParams, days=Number(params.get('days') || 7), host=canonicalHost(params.get('site') || ''), audience=params.get('audience') || 'ambos';
  if (!['ambos','carbono','silicio','ninguno'].includes(audience) || ![0,1,7,30].includes(days) || host && !/^[a-z0-9.-]{1,253}$/.test(host)) return json({ok:false,error:'Filtro no válido.'},400);
  const key=`${env.CF_ACCOUNT_ID}:${days}:${host}:${audience}`, cached=memo.get(key);
  if(cached && Date.now()-cached.at<(days===0?30000:300000)) return json({...cached.data,cached:true});
  try {
    const data=await readAnalytics(env,days,host,fetch,new Date(),audience==='ninguno'?'ambos':audience);
    data.http=await readHttpTraffic(env,data.range,host,audience);
    if(audience==='ninguno'){data.totals.visits=0;data.totals.pageviews=0;data.series=data.series.map(x=>({...x,visits:0,pageviews:0}));data.sites=data.sites.map(x=>({...x,visits:x.visits===null?null:0,pageviews:x.pageviews===null?null:0}));data.geography=[];data.traffic={};data.detail=null;data.note='Selecciona Carbono o Silicio para ver actividad.';}
    if (memo.size>100) memo.clear();
    memo.set(key,{at:Date.now(),data});
    return json(data);
  } catch (error) {
    // Mensajes internos controlados: nunca transmitir respuestas externas o tokens.
    return json({ok:false,error:/^(Cloudflare|Falta)/.test(error.message) ? error.message : 'No se pudieron consultar las estadísticas de Cloudflare. Reintenta en unos minutos.'},424);
  }
}
