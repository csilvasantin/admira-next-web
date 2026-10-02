import {canonicalHost} from './_analytics.js';
export function classifyAgent(d){
 if(d.verifiedBotCategory)return {type:'silicio',label:'Verificado · '+d.verifiedBotCategory};
 const ua=String(d.userAgent || '');
 if(/bot|crawler|spider|headless|curl|wget|python|scrapy|gptbot|claudebot|anthropic|facebookexternalhit|bytespider|chatgpt-user|perplexity/i.test(ua))return {type:'silicio',label:'Agente declarado · '+ua.slice(0,100)};
 return {type:'unknown',label:'Sin clasificar'};
}
export function aggregateHttp(rows,audience){
 const groups=new Map();let total=0,verified=0,declared=0,unknown=0;
 for(const r of rows){const d=r.dimensions || {},host=canonicalHost(String(d.clientRequestHTTPHost || '').replace(/:\d+$/,''));if(!host || host.endsWith('.pages.dev') || host.endsWith('.workers.dev'))continue;
 const c=classifyAgent(d),n=Number(r.count || 0);if(audience==='ninguno' || audience==='carbono' && c.type==='silicio' || audience==='silicio' && c.type!=='silicio')continue;
 total+=n;if(d.verifiedBotCategory)verified+=n;else if(c.type==='silicio')declared+=n;else unknown+=n;
 const key=host+'|'+c.label;const g=groups.get(key)||{host,label:c.label,type:c.type,requests:0};g.requests+=n;groups.set(key,g);
 }return {total,verified,declared,unknown,groups:[...groups.values()].sort((a,b)=>b.requests-a.requests).slice(0,50)};
}
export async function readHttpTraffic(env,range,host,audience,fetchImpl=fetch){
 const headers={Authorization:`Bearer ${env.CF_ANALYTICS_API_TOKEN || env.CF_API_TOKEN}`,'Content-Type':'application/json'};
 const call=async(path,body)=>{const r=await fetchImpl('https://api.cloudflare.com/client/v4'+path,{headers,method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok || d.success===false || d.errors?.length)throw Error('Registros HTTP no disponibles para este permiso o periodo.');return d};
 try{
 const zones=await call('/zones?account.id='+encodeURIComponent(env.CF_ACCOUNT_ID)+'&per_page=50');
 const selected=(zones.result || []).filter(z=>!host || host===z.name || host.endsWith('.'+z.name));
 if(!selected.length)return {ok:false,note:'No se encontró la zona del site en esta cuenta.'};
 const end=range.end,start=new Date(Math.max(new Date(range.start).getTime(),new Date(end).getTime()-86400000)).toISOString();
 let rows=[],truncated=false,failed=0;
 for(let i=0;i<selected.length;i+=5){await Promise.all(selected.slice(i,i+5).map(async z=>{try{
 const filter=`datetime_geq:${JSON.stringify(start)},datetime_lt:${JSON.stringify(end)}`+(host?`,clientRequestHTTPHost_in:${JSON.stringify([host,'www.'+host])}`:'');
 const query=`{viewer{zones(filter:{zoneTag:${JSON.stringify(z.id)}}){httpRequestsAdaptiveGroups(limit:1000,filter:{${filter}},orderBy:[count_DESC]){count dimensions{clientRequestHTTPHost verifiedBotCategory userAgent}}}}}`;
 const d=await call('/graphql',{query}),r=d.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;if(!Array.isArray(r))throw Error();rows.push(...r);truncated ||= r.length>=1000;
 }catch{failed++}}))}
 if(failed===selected.length)return {ok:false,note:'Cloudflare no permite consultar registros HTTP para este periodo o credencial.'};
 return {ok:true,...aggregateHttp(rows,audience),start,end,truncated,failed,zones:selected.length,note:'Peticiones HTTP, no visitas ni personas. Últimas 24 horas como máximo; incluye recursos, verificaciones y peticiones bloqueadas. Categoría verificada de Cloudflare o identificación declarada por el agente. Sin Bot Score, el resto permanece sin clasificar. Datos con muestreo y latencia.'};
 }catch{return {ok:false,note:'Registros HTTP no disponibles: comprueba Zone Analytics Read en la credencial del servidor.'}}
}
