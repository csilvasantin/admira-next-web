import {safeReferrer} from './_visitor-details.js';
import { PROYECTOS } from './_proyectos.js';
export const canonicalHost = host => String(host || '').toLowerCase().replace(/^www\./, '');
export function period(days, now = new Date()) {
  if (![0,1,7,30].includes(days)) throw new Error('Periodo no válido');
  // Últimos N días naturales UTC, incluyendo el día en curso.
  const end = now.toISOString();
  if (days === 0) return {start:new Date(now.getTime()-3600000).toISOString(),end,days,timezone:'UTC',resolution:'minute'};
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days-1)*86400000).toISOString();
  return {start,end,days,timezone:'UTC'};
}
export const audienceFilter = value => value === 'carbono' ? ',bot:0' : value === 'silicio' ? ',bot:1' : '';
// Partes de la consulta RUM (FLT-101380, 2-oct-2026). La carga inicial de /analitics sólo
// pide el RESUMEN (KPIs, cobertura, globo y pulso digital); el DETALLE (procedencia,
// dispositivos, navegadores y sistemas) va en otra consulta que sólo se lanza cuando
// alguien despliega «Cómo llegan y con qué se conectan».
export const PARTES_RUM = {
  resumen: ['hosts','coverageWeek','coverageMonth','geography','daily'],
  detalle: ['referrers','devices','browsers','systems']
};
export function buildQuery(account, range, host = '', audience = 'carbono', parte = 'resumen') {
  if (!PARTES_RUM[parte]) throw new Error('Parte no válida');
  const f = `datetime_geq:${JSON.stringify(range.start)},datetime_lt:${JSON.stringify(range.end)}${audienceFilter(audience)}`;
  const end=new Date(range.end);
  const coverageFilter=n=>`datetime_geq:${JSON.stringify(period(n,end).start)},datetime_lt:${JSON.stringify(range.end)}${audienceFilter(audience)}`;
  const filter = host ? `${f},requestHost_in:${JSON.stringify([host, 'www.'+host])}` : f;
  const node = (alias,dimensions,limit=1000,nodeFilter=filter) => `${alias}:rumPageloadEventsAdaptiveGroups(limit:${limit},filter:{${nodeFilter}},orderBy:[${alias==='referrers'?'sum_visits_DESC':'count_DESC'}]){count sum{visits} dimensions{${dimensions}}}`;
  const nodes = {
    hosts:()=>node('hosts','requestHost',1000,f),
    coverageWeek:()=>node('coverageWeek','requestHost',1000,coverageFilter(7)),
    coverageMonth:()=>node('coverageMonth','requestHost',1000,coverageFilter(30)),
    geography:()=>node('geography','countryName requestHost',1000),
    daily:()=>node('daily',range.resolution==='minute'?'datetimeMinute requestHost':'date requestHost'),
    referrers:()=>node('referrers','refererHost refererPath refererScheme requestHost',1000),
    devices:()=>node('devices','deviceType requestHost',1000),
    browsers:()=>node('browsers','userAgentBrowser requestHost',1000),
    systems:()=>node('systems','userAgentOS requestHost',1000)
  };
  const parts = PARTES_RUM[parte].map(alias=>nodes[alias]());
  // Con un site elegido, el resumen trae también sus páginas y países (bloque «Detalle del site»).
  if (host && parte==='resumen') parts.push(node('paths','requestPath',10),node('countries','countryName',10));
  return `{viewer{accounts(filter:{accountTag:${JSON.stringify(account)}}){${parts.join(' ')}}}}`;
}
async function cloudflare(env, path, body, fetchImpl) {
  const r = await fetchImpl('https://api.cloudflare.com/client/v4'+path, {
    method:body?'POST':'GET', headers:{Authorization:`Bearer ${env.CF_ANALYTICS_API_TOKEN || env.CF_API_TOKEN}`,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error(`Cloudflare respondió ${r.status}`);
  const data = await r.json();
  if (data.success === false || data.errors?.length) throw new Error('Cloudflare no permite consultar estos datos. Revisa los permisos de Analytics.');
  return data;
}
export function catalogue(pages = [], rum = [], observed = []) {
  const entries = new Map();
  const add = (host, label, configured = false) => {
    host = canonicalHost(host);
    if (!host || host.endsWith('.pages.dev') || host.endsWith('.workers.dev')) return;
    const old = entries.get(host);
    entries.set(host,{host,name:old?.name || label || host, configured:!!(old?.configured || configured)});
  };
  PROYECTOS.filter(p=>p.url && p.tipo !== 'worker').forEach(p=>{try{add(new URL(p.url).hostname)}catch{}});
  // Dominio estratégico que aún no forma parte del censo de software.
  add('digitalsignage.ai');
  pages.forEach(p=>(p.domains || []).forEach(host=>add(host,host,!!p.build_config?.web_analytics_tag)));
  rum.forEach(r=>add(r.ruleset?.zone_name || r.host, null, r.ruleset ? r.ruleset.enabled : true));
  observed.forEach(r=>add(r.dimensions.requestHost,null,true));
  return [...entries.values()].sort((a,b)=>a.host.localeCompare(b.host));
}
export function summarise(rows) {
  const hosts = new Map();
  for (const r of rows) {
    const host=canonicalHost(r.dimensions.requestHost);
    // No sumar las URLs de preview al tráfico de producción.
    if (!host || host.endsWith('.pages.dev') || host.endsWith('.workers.dev')) continue;
    const item=hosts.get(host) || {host,visits:0,pageviews:0};
    item.visits += Number(r.sum?.visits || 0); item.pageviews += Number(r.count || 0); hosts.set(host,item);
  }
  return hosts;
}
export function aggregateGeography(rows) {
  const countries = new Map();
  for (const row of rows) {
    const host = canonicalHost(row.dimensions?.requestHost);
    if (!host || host.endsWith('.pages.dev') || host.endsWith('.workers.dev')) continue;
    const country = String(row.dimensions?.countryName || '');
    const entry = countries.get(country) || {country,visits:0,pageviews:0};
    entry.visits += Number(row.sum?.visits || 0);
    entry.pageviews += Number(row.count || 0);
    countries.set(country,entry);
  }
  return [...countries.values()].sort((a,b)=>b.visits-a.visits);
}
export function trafficBreakdown(rows, type) {
  const grouped = new Map();
  for (const row of rows || []) {
    const d=row.dimensions || {},host=canonicalHost(d.requestHost);
    if(!host || host.endsWith('.pages.dev') || host.endsWith('.workers.dev'))continue;
    const label=type==='referrers'?(d.refererHost && safeReferrer(`${d.refererScheme || 'https'}://${d.refererHost || ''}${d.refererPath || '/'}`) || 'Directo / referencia no disponible'):String(d[type==='devices'?'deviceType':type==='browsers'?'userAgentBrowser':'userAgentOS'] || 'No disponible');
    const entry=grouped.get(label) || {label,visits:0,pageviews:0};
    entry.visits+=Number(row.sum?.visits || 0);entry.pageviews+=Number(row.count || 0);grouped.set(label,entry);
  }
  return [...grouped.values()].sort((a,b)=>b.visits-a.visits || b.pageviews-a.pageviews).slice(0,50);
}
export async function readAnalytics(env, days, host = '', fetchImpl = fetch, now = new Date(), audience = 'carbono') {
  if (!env.CF_ACCOUNT_ID || !(env.CF_ANALYTICS_API_TOKEN || env.CF_API_TOKEN)) throw new Error('Falta configurar el acceso de servidor a Cloudflare.');
  const range = period(days,now);
  const [stats, projects, measurement] = await Promise.all([
    cloudflare(env,'/graphql',{query:buildQuery(env.CF_ACCOUNT_ID,range,host,audience,'resumen')},fetchImpl),
    cloudflare(env,`/accounts/${env.CF_ACCOUNT_ID}/pages/projects`,null,fetchImpl).catch(()=>null),
    cloudflare(env,`/accounts/${env.CF_ACCOUNT_ID}/rum/site_info/list`,null,fetchImpl).catch(()=>null)
  ]);
  const account = stats.data?.viewer?.accounts?.[0];
  if (!account || !Array.isArray(account.hosts) || !Array.isArray(account.daily)) throw new Error('Cloudflare no devolvió un resultado válido.');
  const allHosts=summarise(account.hosts);
  const map=host ? new Map([...allHosts].filter(([key])=>key===host)) : allHosts;
  const sites = catalogue(projects?.result, measurement?.result,[...account.hosts,...(account.coverageWeek || []),...(account.coverageMonth || [])]).map(s=>{
    const metrics=allHosts.get(s.host);
    return {...s,visits:s.configured ? metrics?.visits || 0 : null,pageviews:s.configured ? metrics?.pageviews || 0 : null,status:metrics ? 'measuring' : s.configured ? 'no_activity' : 'unknown'};
  });
  const series=[];
  const minute=range.resolution==='minute', step=minute?60000:86400000;
  const first=minute?new Date(Math.floor(new Date(range.start).getTime()/60000)*60000):new Date(range.start);
  for(let d=first; (minute?d<now:d<=now); d=new Date(d.getTime()+step)) {
    const date=minute?d.toISOString():d.toISOString().slice(0,10), rows=account.daily.filter(r=>minute ? new Date(r.dimensions.datetimeMinute).getTime()===d.getTime() : r.dimensions.date===date);
    const totals=[...summarise(rows).values()];
    series.push({date,visits:totals.reduce((n,x)=>n+x.visits,0),pageviews:totals.reduce((n,x)=>n+x.pageviews,0)});
  }
  return {ok:true,audience,source:'Cloudflare Web Analytics',updatedAt:now.toISOString(),range,selected:host || null,
    totals:{visits:[...map.values()].reduce((n,x)=>n+x.visits,0),pageviews:[...map.values()].reduce((n,x)=>n+x.pageviews,0),configured:sites.filter(s=>s.configured).length,sites:sites.length},
    sites,series,geography:aggregateGeography(account.geography || []),geographyTruncated:(account.geography || []).length>=1000,detail:host?{paths:account.paths || [],countries:account.countries || []}:null,
    truncated:account.hosts.length>=1000 || account.daily.length>=1000,
    coverageComplete:!!(projects && measurement),
    note:'Visitas según Cloudflare: entradas desde otro dominio o acceso directo. No son personas únicas. Datos UTC, con muestreo y latencia; previews excluidos. '+(audience==='carbono'?'Carbono: navegación no clasificada como bot por Cloudflare.':audience==='silicio'?'Silicio: bots detectados en la medición de navegación.':'Carbono y Silicio: toda la navegación medida.')+' Los rastreadores sin JavaScript aparecen en el bloque de peticiones HTTP, con unidades independientes.'};
}
// Parte «detalle»: una sola consulta GraphQL y ninguna llamada de inventario.
export async function readTrafficDetail(env, days, host = '', fetchImpl = fetch, now = new Date(), audience = 'carbono') {
  if (!env.CF_ACCOUNT_ID || !(env.CF_ANALYTICS_API_TOKEN || env.CF_API_TOKEN)) throw new Error('Falta configurar el acceso de servidor a Cloudflare.');
  const range = period(days,now);
  const stats = await cloudflare(env,'/graphql',{query:buildQuery(env.CF_ACCOUNT_ID,range,host,audience,'detalle')},fetchImpl);
  const account = stats.data?.viewer?.accounts?.[0];
  if (!account || PARTES_RUM.detalle.some(key=>!Array.isArray(account[key]))) throw new Error('Cloudflare no devolvió un resultado válido.');
  return {ok:true,parte:'detalle',audience,source:'Cloudflare Web Analytics',updatedAt:now.toISOString(),range,selected:host || null,
    traffic:Object.fromEntries(PARTES_RUM.detalle.map(key=>[key,trafficBreakdown(account[key],key)])),
    trafficTruncated:PARTES_RUM.detalle.some(key=>account[key].length>=1000)};
}
