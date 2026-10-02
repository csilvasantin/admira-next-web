import { sesionCompleta } from '../_webmaster-gate.js';
import { canonicalHost, period, readAnalytics, readTrafficDetail } from '../_analytics.js';
import {readHttpTraffic} from '../_http-traffic.js';
// API por partes (FLT-101380, 2-oct-2026). /analitics pide al abrir sólo `parte=resumen`
// (KPIs, cobertura, globo, procedencia por países y pulso digital). Las otras tres partes
// sólo se piden cuando alguien despliega su bloque:
//   detalle → «Cómo llegan y con qué se conectan» (1 consulta GraphQL RUM)
//   http    → «Silicio más allá del navegador» (zonas + 1 consulta GraphQL por zona)
//   sites   → «Rendimiento por site» (la misma consulta del resumen: sale de su caché)
// Sin `parte` se entiende `resumen`: una llamada sin parámetros nunca dispara lo caro.
// Todas pasan por la misma puerta (sesión completa y rol admin) y la misma caché.
const PARTES = ['resumen','detalle','http','sites'];
const memo = new Map();
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','vary':'Cookie','x-robots-tag':'noindex'}});
const ttl = days => days===0 ? 30000 : 300000;
const configurado = env => !!(env.CF_ACCOUNT_ID && (env.CF_ANALYTICS_API_TOKEN || env.CF_API_TOKEN));
async function cached(key,days,produce){
  const hit=memo.get(key);
  if(hit && Date.now()-hit.at<ttl(days)) return {data:hit.data,cached:true};
  const data=await produce();
  if (memo.size>100) memo.clear();
  memo.set(key,{at:Date.now(),data});
  return {data,cached:false};
}
// El resumen completo (con la tabla de sites) se calcula y guarda una sola vez: la parte
// `resumen` lo entrega sin la tabla y la parte `sites` sólo con ella.
function summary(env,days,host,audience){
  return cached(`${env.CF_ACCOUNT_ID}:resumen:${days}:${host}:${audience}`,days,async()=>{
    const data=await readAnalytics(env,days,host,fetch,new Date(),audience==='ninguno'?'ambos':audience);
    if(audience==='ninguno'){data.totals.visits=0;data.totals.pageviews=0;data.series=data.series.map(x=>({...x,visits:0,pageviews:0}));data.sites=data.sites.map(x=>({...x,visits:x.visits===null?null:0,pageviews:x.pageviews===null?null:0}));data.geography=[];data.detail=null;data.note='Selecciona Carbono o Silicio para ver actividad.';}
    return data;
  });
}
export async function onRequestGet({request,env}) {
  const current = await sesionCompleta(request,env);
  if (!current) return json({ok:false,error:'Inicia sesión en AdmiraNeXT para consultar las analíticas.'},401);
  // La vista del grupo cruza proyectos: sólo administradores del directorio.
  if (current.role !== 'admin') return json({ok:false,error:'La vista del grupo requiere un administrador de AdmiraNeXT.'},403);
  const params=new URL(request.url).searchParams, days=Number(params.get('days') || 7), host=canonicalHost(params.get('site') || ''), audience=params.get('audience') || 'ambos', parte=params.get('parte') || 'resumen';
  if (!PARTES.includes(parte) || !['ambos','carbono','silicio','ninguno'].includes(audience) || ![0,1,7,30].includes(days) || host && !/^[a-z0-9.-]{1,253}$/.test(host)) return json({ok:false,error:'Filtro no válido.'},400);
  try {
    if (parte==='resumen' || parte==='sites') {
      const {data,cached:hit}=await summary(env,days,host,audience);
      const {sites,...rest}=data;
      if (parte==='sites') return json({ok:true,parte,audience:data.audience,updatedAt:data.updatedAt,range:data.range,selected:data.selected,sites,coverageComplete:data.coverageComplete,truncated:data.truncated,cached:hit});
      // El selector de sites y el estado del site elegido salen del resumen; la tabla, no.
      return json({...rest,parte,siteHosts:sites.map(s=>s.host),selectedStatus:sites.find(s=>s.host===host)?.status || null,cached:hit});
    }
    // Sin configuración: error explícito, nunca un cero.
    if (!configurado(env)) throw new Error('Falta configurar el acceso de servidor a Cloudflare.');
    if (parte==='detalle') {
      const {data,cached:hit}=await cached(`${env.CF_ACCOUNT_ID}:detalle:${days}:${host}:${audience}`,days,async()=>audience==='ninguno'
        ? {ok:true,parte,audience,updatedAt:new Date().toISOString(),range:period(days),selected:host || null,traffic:{referrers:[],devices:[],browsers:[],systems:[]},trafficTruncated:false,note:'Selecciona Carbono o Silicio para ver actividad.'}
        : readTrafficDetail(env,days,host,fetch,new Date(),audience));
      return json({...data,cached:hit});
    }
    // parte === 'http'
    const {data,cached:hit}=await cached(`${env.CF_ACCOUNT_ID}:http:${days}:${host}:${audience}`,days,async()=>{
      const range=period(days);
      return {ok:true,parte,audience,updatedAt:new Date().toISOString(),range,selected:host || null,http:await readHttpTraffic(env,range,host,audience)};
    });
    return json({...data,cached:hit});
  } catch (error) {
    // Mensajes internos controlados: nunca transmitir respuestas externas o tokens.
    return json({ok:false,error:/^(Cloudflare|Falta)/.test(error.message) ? error.message : 'No se pudieron consultar las estadísticas de Cloudflare. Reintenta en unos minutos.'},424);
  }
}
