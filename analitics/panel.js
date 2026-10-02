function trafficGlobeUpdate(snapshot){window.trafficSnapshot=snapshot;window.dispatchEvent(new CustomEvent('traffic-geography',{detail:snapshot}));}
const $=id=>document.getElementById(id), number=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(n);
let days=7,selected='',data=null,sequence=0,lastLoad=0,round=0,sites=null,showAllSites=false;
// FLT-101380: la carga inicial sólo pide el resumen; detalle, http y sites esperan a que se despliegue su bloque.
const PARTES={detalle:'trafficDetails',http:'httpTraffic',sites:'comparison'};
const filterKey=()=>`${days}|${selected}|${audience()}|${round}`;
const apiUrl=parte=>`/api/analitics?parte=${parte}&days=${days}&site=${encodeURIComponent(selected)}&audience=${audience()}`;
async function getJson(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.headers.get('content-type')?.includes('application/json'))throw Error('La conexión con Cloudflare no está disponible. Reintenta en unos minutos.');const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'No se pudieron cargar las estadísticas.');return result}
// «Ver todas»: muestra las primeras filas y el resto se despliega en la propia página, sin scroll interno.
function seeAll(box,rows,limit,noun,holder=box){
  rows.forEach((row,i)=>{row.hidden=i>=limit});
  if(rows.length<=limit)return;
  const button=el('button',`Ver ${noun} (${number(rows.length)})`,'see-all');button.type='button';button.setAttribute('aria-expanded','false');if(box.id)button.setAttribute('aria-controls',box.id);
  button.onclick=()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));rows.forEach((row,i)=>{row.hidden=!open && i>=limit});button.textContent=open?'Ver menos':`Ver ${noun} (${number(rows.length)})`;if(open)rows[limit].querySelector('button,a')?.focus()};
  holder.append(button);
}
const text=(id,value)=>$(id).textContent=value;
const el=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e};
function audience(){return $('carbono').checked?($('silicio').checked?'ambos':'carbono'):($('silicio').checked?'silicio':'ninguno')}
function draw(series){
  $('chart').replaceChildren();
  if(!series.length)return;
  const w=800,h=190,p=30,max=Math.max(1,...series.map(x=>x.pageviews),...series.map(x=>x.visits));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Evolución de visitas y páginas vistas en ${series.length} ${days===0?'minutos':'días'}`);
  const add=(tag,attrs)=>{const e=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));svg.append(e);return e};
  for(let i=0;i<4;i++){const y=p+(h-p*2)*i/3;add('line',{x1:p,y1:y,x2:w-8,y2:y,stroke:'#253042','stroke-dasharray':'3 5'});add('text',{x:0,y:y+4}).textContent=number(Math.round(max*(1-i/3)));}
  const point=(r,i,key)=>[series.length===1?w/2:p+(w-p-8)*i/(series.length-1),h-p-(h-p*2)*r[key]/max];
  for(const [key,color] of [['pageviews','#aaa0ff'],['visits','#4ae3d1']]){
    const pts=series.map((r,i)=>point(r,i,key));add('polyline',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round'});
    pts.forEach(([x,y],i)=>{const dot=add('circle',{cx:x,cy:y,r:series.length<10?3:1.5,fill:color});const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${series[i].date}: ${number(series[i][key])} ${key==='visits'?'visitas':'páginas vistas'}`;dot.append(title)});
  }
  [0,Math.floor((series.length-1)/2),series.length-1].filter((n,i,a)=>a.indexOf(n)===i).forEach(i=>add('text',{x:point(series[i],i,'visits')[0],y:h-4,'text-anchor':'middle'}).textContent=days===0?series[i].date.slice(11,16):series[i].date.slice(5));
  $('chart').append(svg);
}
function table(){
  $('rows').replaceChildren();$('rowsMore').replaceChildren();if(!sites)return;
  const list=sites.filter(s=>s.host.includes($('search').value.toLowerCase())).sort((a,b)=>(b.visits ?? -1)-(a.visits ?? -1));
  if(!list.length){const tr=el('tr'),td=el('td','Ningún site coincide con la búsqueda.','status');td.colSpan=5;tr.append(td);$('rows').append(tr)}
  for(const s of list){const tr=el('tr');const td=el('td'),button=el('button',s.host,'sitebutton');button.onclick=()=>{$('site').value=s.host;selected=s.host;load()};td.append(button);tr.append(td,el('td',s.visits===null?'—':number(s.visits)),el('td',s.pageviews===null?'—':number(s.pageviews)));
    const status=el('td');status.append(el('span',({measuring:'● Con actividad',no_activity:'● Sin actividad en el periodo',not_configured:'○ Medición por activar',unknown:'○ Sin configuración confirmada'})[s.status],'status '+s.status));tr.append(status);const more=el('td'),btn=el('button','↗');btn.setAttribute('aria-label','Ver detalle de '+s.host);btn.onclick=button.onclick;more.append(btn);tr.append(more);$('rows').append(tr);
  }
  seeAll($('rows'),[...$('rows').children],15,'todos los sites',$('rowsMore'));
}
function breakdown(id,rows,dim,visits=false){$(id).replaceChildren();if(!rows?.length){$(id).append(el('p','Sin actividad medida en este periodo.','status'));return}for(const r of rows){const row=el('div',undefined,'breakdown');let label=r.dimensions[dim] || (dim==='refererHost'?'Directo / sin referencia':'Sin clasificar');if(dim==='countryName'&&label.length===2){try{label=new Intl.DisplayNames(['es'],{type:'region'}).of(label)}catch{}}row.append(el('span',label),el('b',number(visits?r.sum.visits:r.count)));$(id).append(row)}}
function trafficRows(id,rows){$(id).replaceChildren();for(const r of rows || []){const row=el('div',undefined,'breakdown');const labels={desktop:'Ordenador',mobile:'Móvil',tablet:'Tableta',Unknown:'No disponible',MacOSX:'macOS',ChromeMobile:'Chrome móvil',MobileSafari:'Safari móvil',ChromeDerivative:'Basado en Chrome'};row.append(el('span',labels[r.label] || r.label),el('b',number(r.visits)+' visitas · '+number(r.pageviews)+' páginas'));$(id).append(row)}if(!rows?.length)$(id).append(el('p','Sin datos medidos en este periodo.','status'));else seeAll($(id),[...$(id).children],8,'todas')}
const TRAFFIC_LABELS={desktop:'Ordenador',mobile:'Móvil',tablet:'Tableta',Unknown:'No disponible',MacOSX:'macOS',ChromeMobile:'Chrome móvil',MobileSafari:'Safari móvil',ChromeDerivative:'Basado en Chrome'};
const TRAFFIC_NOUNS={referrers:['procedencia','procedencias'],devices:['dispositivo','dispositivos'],browsers:['navegador','navegadores'],systems:['sistema','sistemas']};
function renderDetalle(d){
  for(const key of ['referrers','devices','browsers','systems']){
    const rows=d.traffic?.[key] || [];trafficRows('traffic-'+key,rows);
    const total=rows.reduce((n,r)=>n+r.visits,0),top=rows[0];
    text('q-'+key+'Summary',top?`${TRAFFIC_LABELS[top.label] || top.label}${total?' · '+Math.round(top.visits*100/total)+' %':''}`:'Sin datos');
  }
  text('trafficNote',(d.note?d.note+' ':'')+'Procedencia según la referencia enviada por el navegador; puede incluir sólo el dominio. Sin referencia no significa necesariamente acceso directo.'+(d.trafficTruncated?' Resultados parciales: límite de consulta alcanzado.':''));
}
function detalleSummary(d){return ['referrers','devices','browsers','systems'].map(k=>{const n=d.traffic?.[k]?.length || 0;return number(n)+' '+TRAFFIC_NOUNS[k][n===1?0:1]}).join(' · ')}
function renderHttp(part){
 $('httpGroups').replaceChildren();const h=part.http;
 if(!h?.ok){text('httpSummary','Registros HTTP no disponibles');text('httpNote',h?.note || 'No hay respuesta de Cloudflare.');return}
 text('httpSummary',`${number(h.total)} peticiones · ${number(h.verified)} bots verificados · ${number(h.declared)} agentes declarados · ${number(h.unknown)} sin clasificar`);
 for(const g of h.groups){const row=el('div',undefined,'breakdown');row.append(el('span',g.host+' · '+g.label),el('b',number(g.requests)+' peticiones'));$('httpGroups').append(row)}
 if(!h.groups.length)$('httpGroups').append(el('p','Sin peticiones registradas para este filtro.','status'));else seeAll($('httpGroups'),[...$('httpGroups').children],10,'todos los hosts');
 text('httpNote',h.start.slice(0,16).replace('T',' ')+' → '+h.end.slice(0,16).replace('T',' ')+' UTC. '+h.note+(h.truncated?' Lista parcial por límite de resultados.':'')+(h.failed?' Cobertura parcial: '+h.failed+' zonas sin respuesta.':'')+(audience()==='carbono'?' Carbono: en registros HTTP se muestra el tráfico sin clasificación; no acredita que sea humano.':''));
}
function render(){
  trafficGlobeUpdate({mode:"history",geography:data.geography,geographyTruncated:data.geographyTruncated,scope:selected || "Todo el grupo"});
  text('visits',number(data.totals.visits));text('views',number(data.totals.pageviews));text('depth',data.totals.visits?number(data.totals.pageviews/data.totals.visits):'—');text('coverage',`${data.totals.configured} / ${data.totals.sites}`);text('coverageNote','Sites con configuración o datos históricos');
  text('scope',selected || (days===0?'Actividad reciente del grupo':'Actividad del grupo'));text('refreshNote',days===0?'Cada minuto':'Al abrir · cada 5 min');text('timeNote',days===0?'UTC · datos con latencia de Cloudflare':'UTC · hoy en curso');text('range',days===0?`${data.range.start.slice(11,16)} → ${data.range.end.slice(11,16)} UTC`:`${data.range.start.slice(0,10)} → ${data.range.end.slice(0,10)}`);text('connection','Conectado');text('freshness','Datos consultados a las '+new Date(data.updatedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+'.');text('note',data.note);
  draw(data.series);
  if(data.detail){breakdown('paths',data.detail.paths,'requestPath');breakdown('countries',data.detail.countries,'countryName');}
  const old=$('site').value;$('site').replaceChildren(new Option('Todo el grupo',''));(data.siteHosts || []).forEach(host=>$('site').add(new Option(host,host)));$('site').value=old;
  text('message',data.truncated?'La consulta alcanzó el límite de resultados. Reduce el periodo.':!data.coverageComplete?'Datos disponibles; inventario de medición parcial.':data.selectedStatus==='not_configured'?'Este site necesita activar Cloudflare Web Analytics. No dispone de cifras medidas.':days===0?'Últimos 60 minutos · refresco cada minuto · no representa personas conectadas · datos con latencia de Cloudflare':'Navegación medida · '+({ambos:'Carbono + Silicio',carbono:'Carbono',silicio:'Silicio',ninguno:'Sin selección'})[audience()]+' · actualización cada 5 minutos');
  if(data.selectedStatus==='not_configured'){['visits','views','depth'].forEach(id=>text(id,'—'));}
}
// Bloques plegables (FLT-101380): nacen plegados y su parte de la API sólo se pide al desplegarlos.
const RENDER={detalle:renderDetalle,http:renderHttp,sites:part=>{sites=part.sites;table()}};
const SUMMARY={detalle:detalleSummary,http:part=>part.http?.ok?number(part.http.total)+' peticiones':'Registros HTTP no disponibles',sites:part=>number(part.sites.length)+' sites'};
const folds=window.AnaliticsPlegables.crear({
  clave:filterKey,
  pedir:parte=>getJson(apiUrl(parte)),
  visible:parte=>days!==-1 && !$(PARTES[parte]).hidden,
  estado:(parte,p)=>{
    const id=PARTES[parte],state=$(id+'State'),summary=$(id+'Summary');
    $(id+'Toggle').setAttribute('aria-expanded',String(p.abierta));$(id+'Body').hidden=!p.abierta;$(id).classList.toggle('open',p.abierta);
    summary.className='fold-summary'+(p.estado==='desactualizada'?' stale':p.estado==='error'?' failed':'');
    state.replaceChildren();state.className='fold-state';
    if(p.estado==='cargando'){state.append(el('p','Cargando…','status loading'));summary.textContent='Cargando…';$(id).setAttribute('aria-busy','true');return}
    $(id).removeAttribute('aria-busy');
    if(p.estado==='ok'){RENDER[parte](p.datos);summary.textContent=SUMMARY[parte](p.datos);return}
    if(p.estado==='error'){state.className='fold-state error';state.append(el('p','No se pudo cargar: '+p.error));const retry=el('button','↻ Reintentar','retry');retry.type='button';retry.onclick=()=>folds.cargar(parte,true).catch(()=>{});state.append(retry);summary.textContent='Error al cargar · despliega para reintentar';return}
    if(p.estado==='desactualizada'){summary.textContent=p.datos?SUMMARY[parte](p.datos)+' · desactualizado, se recarga al abrir':'Desactualizado · se recarga al abrir';return}
    summary.textContent='Plegado · se carga al desplegar';
  }
});
window.analiticsPartes=folds;
for(const [parte,id] of Object.entries(PARTES)){folds.parte(parte);$(id+'Toggle').onclick=()=>{if($(id+'Toggle').getAttribute('aria-expanded')==='true')folds.plegar(parte);else folds.abrir(parte)}}
// Cuadrantes de «Cómo llegan…»: cada uno se pliega por separado (son sólo vista; los datos llegan juntos).
document.querySelectorAll('.quadrant .fold-toggle').forEach(button=>button.onclick=()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));$(button.getAttribute('aria-controls')).hidden=!open;button.closest('.quadrant').classList.toggle('open',open)});
// «Ir a» (▤) a un bloque plegado lo despliega.
document.addEventListener('click',event=>{const link=event.target.closest?.('a[href^="#"]');const parte=link && Object.keys(PARTES).find(k=>'#'+PARTES[k]===link.getAttribute('href'));if(parte && !$(PARTES[parte]).hidden)folds.abrir(parte)});
async function load(){trafficGlobeUpdate({mode:days===-1?"live":"history",scope:selected || "Todo el grupo",loading:true});lastLoad=Date.now();const seq=++sequence;if(days===-1){await loadPresence();return;}
  $('live').hidden=true;document.querySelector('.activity').hidden=false;$('trafficDetails').hidden=false;$('httpTraffic').hidden=false;$('comparison').hidden=!!selected;$('detail').hidden=!selected;
  for(const [id,title,subtitle] of [['visits','VISITAS','Entradas desde otro dominio o directas'],['views','PÁGINAS VISTAS','Navegación medida en el periodo'],['depth','PÁGINAS / VISITA','Relación entre páginas vistas y visitas'],['coverage','COBERTURA DEL GRUPO','Revisando medición']]){$(id).closest('article').querySelector('p').textContent=title;$(id).closest('article').querySelector('small').textContent=subtitle;}
  // Sólo los bloques desplegados vuelven a pedir su parte; los plegados quedan desactualizados.
  folds.filtrosCambiados();
  $('refresh').disabled=true;$('message').className='';text('message','Consultando Cloudflare…');
  try{const result=await getJson(apiUrl('resumen'));if(seq!==sequence)return;data=result;render();}catch(e){if(seq!==sequence)return;trafficGlobeUpdate({mode:'history',scope:selected || 'Todo el grupo',error:true});$('message').className='error';text('message',e.message);text('connection','Sin conexión');text('freshness','No se han recibido datos actualizados.');['visits','views','depth','coverage'].forEach(id=>text(id,'—'));$('chart').replaceChildren();['paths','countries'].forEach(id=>$(id).replaceChildren());}finally{if(seq===sequence)$('refresh').disabled=false}}
const refreshRound=()=>{round++;load()};
$('site').onchange=()=>{selected=$('site').value;load()};$('search').oninput=table;$('refresh').onclick=refreshRound;document.querySelectorAll('[data-days]').forEach(button=>button.onclick=()=>{days=Number(button.dataset.days);document.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('selected',b===button));load()});setInterval(()=>{if(!document.hidden && days!==-1 && Date.now()-lastLoad>=(days===0?60000:300000))refreshRound()},15000);load();

for(const id of ['carbono','silicio'])$(id).onchange=load;
