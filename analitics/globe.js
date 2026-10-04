import {globeLocations,rayHeight,closestAngle,countryBars} from './globe-model.mjs?v=04.10.2026.r2.13:28';

const canvas=document.getElementById('trafficGlobe'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id), reduced=matchMedia('(prefers-reduced-motion: reduce)');
const fmt=n=>new Intl.NumberFormat('es-ES').format(n);
const names=new Intl.DisplayNames(['es'],{type:'region'});
let land,centres,locations=[],mode='history',focus=-1,rotation=[-10,-20,0],zoom=1;
let width=0,height=0,radius=0,auto=!reduced.matches,animation=null,frame=0,lastFrame=0,lastTour=0,drag=null,drawn=[];
let ready=false,inView=true,pending=window.trafficSnapshot,liveTour=[],tourIndex=-1,barsOpen=false;
// Procedencia en barras: se ven los BAR_LIMIT primeros; «Ver todos» despliega el resto en la página.
const BAR_LIMIT=8;
function barsVisibility() {
  const current=locations[focus]?.key,items=[...$('globeCountries').querySelectorAll('li')];
  for(const item of items)item.hidden=!barsOpen && Number(item.dataset.rank)>=BAR_LIMIT && item.dataset.key!==current;
  const toggle=$('globeCountriesMore');
  if(toggle){toggle.setAttribute('aria-expanded',String(barsOpen));toggle.textContent=barsOpen?'Ver menos':`Ver todos (${fmt(items.length)} ${mode==='live'?'ubicaciones':'países'})`;}
}
function nextVisit(delta){
  if(mode==='live' && liveTour.length){tourIndex=(tourIndex+delta+liveTour.length)%liveTour.length;select(locations.findIndex(p=>p.key===liveTour[tourIndex].key));}
  else select(focus+delta);
}
const projection=d3.geoOrthographic().clipAngle(90), path=d3.geoPath(projection,ctx);
const label=p=>p.city || names.of(p.code) || p.name;
function setAuto(value) {
  auto=value;lastTour=performance.now();
  $('globeTour').textContent=auto?'Pausar recorrido':'Recorrer tráfico';
  $('globeTour').setAttribute('aria-pressed',String(auto));
  animate();
}
function resize() {
  const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;
  const ratio=Math.min(devicePixelRatio || 1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);radius=Math.min(width,height)*.31*zoom;
  projection.translate([width/2,height/2]).scale(radius).rotate(rotation);paint();
}
function selection() {
  const point=locations[focus];
  $('globeCountry').textContent=point?label(point):'Sin tráfico geolocalizado';
  $('globeValue').textContent=point?fmt(point.visits):'—';
  $('globeUnit').textContent=mode==='live'?'sesiones activas':'visitas en el periodo';
  $('globePages').replaceChildren();
  if(point) {
    const visitor=mode==='live' && liveTour[tourIndex]?.key===point.key?liveTour[tourIndex]:null;
    const lines=mode==='live'?(visitor?[visitor.visitor,visitor.host+visitor.path,'Desde: '+(visitor.referrer || 'Directo / referencia no disponible'),[visitor.device,visitor.browser,visitor.os].filter(Boolean).join(' · ')]:point.pages):[`${fmt(point.pageviews)} páginas vistas`];
    if(mode==='live')lines.push([point.region,names.of(point.code)].filter(Boolean).join(' · '),point.geoSource==='Cloudflare IP'?`Cloudflare IP: ${point.lat}, ${point.lng}`:'Ubicación disponible: sólo país');
    for(const line of lines){const p=document.createElement('p');p.textContent=line;$('globePages').append(p)}
  }
  for(const button of $('globeCountries').querySelectorAll('button[data-key]')){if(button.dataset.key===point?.key)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current')}
  barsVisibility();
  $('globePosition').textContent=point?mode==='live' && tourIndex>=0?`${tourIndex+1} / ${liveTour.length} sesiones`:`${focus+1} / ${locations.length} ${mode==='live'?'ubicaciones':'países'}`:'0 países';
}
function select(index,motion=true) {
  if(!locations.length)return;
  focus=(index+locations.length)%locations.length;
  const point=locations[focus],target=[closestAngle(rotation[0],-point.lng+24),Math.max(-70,Math.min(70,-point.lat+8)),0];
  if(motion && !reduced.matches)animation={from:[...rotation],to:target,start:performance.now()};
  else{rotation=target;projection.rotate(rotation);animation=null;paint()}
  lastTour=performance.now();selection();animate();
}
function paint() {
  if(!ready || !width)return;
  ctx.clearRect(0,0,width,height);
  const x=width/2,y=height/2;
  const halo=ctx.createRadialGradient(x,y,radius*.95,x,y,radius*1.2);
  halo.addColorStop(0,'#4ae3d124');halo.addColorStop(.5,'#4ae3d10b');halo.addColorStop(1,'#4ae3d100');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,radius*1.2,0,Math.PI*2);ctx.fill();
  const ocean=ctx.createRadialGradient(x-radius*.35,y-radius*.4,0,x,y,radius);
  ocean.addColorStop(0,'#1b405a');ocean.addColorStop(.75,'#0c2335');ocean.addColorStop(1,'#061320');
  ctx.beginPath();path({type:'Sphere'});ctx.fillStyle=ocean;ctx.fill();ctx.strokeStyle='#4ae3d168';ctx.lineWidth=1;ctx.stroke();
  ctx.save();ctx.beginPath();path({type:'Sphere'});ctx.clip();
  ctx.beginPath();path(land);ctx.fillStyle='#2f6771';ctx.fill();ctx.strokeStyle='#6badb366';ctx.lineWidth=.5;ctx.stroke();
  ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle='#8bb5d222';ctx.lineWidth=.65;ctx.stroke();
  const shadow=ctx.createLinearGradient(x-radius,y-radius,x+radius,y+radius);
  shadow.addColorStop(0,'#06132000');shadow.addColorStop(.55,'#06132010');shadow.addColorStop(1,'#020911b8');ctx.fillStyle=shadow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);ctx.restore();
  drawn=[];const maximum=Math.max(1,...locations.map(p=>p.visits));
  for(let i=0;i<locations.length;i++) {
    const point=locations[i],coords=[point.lng,point.lat],front=d3.geoDistance(coords,[-rotation[0],-rotation[1]])<Math.PI/2;
    if(!front)continue;
    const start=projection(coords), length=rayHeight(point.visits,maximum,radius);
    const end=[x+(start[0]-x)*(1+length/radius),y+(start[1]-y)*(1+length/radius)];
    const active=i===focus,color=active?'#d9c2ff':'#4ae3d1';
    ctx.strokeStyle=color;ctx.lineWidth=active?3:1.5;ctx.shadowColor=color;ctx.shadowBlur=active?15:7;
    ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();
    ctx.beginPath();ctx.arc(...start,active?4:2.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
    ctx.beginPath();ctx.arc(...end,active?5:3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(active){ctx.beginPath();ctx.arc(...start,10,0,Math.PI*2);ctx.strokeStyle='#d9c2ff77';ctx.lineWidth=1;ctx.stroke();ctx.font='600 12px system-ui';ctx.fillStyle='#ecf5ff';ctx.textAlign=end[0]>=x?'left':'right';ctx.fillText(`${label(point)} · ${fmt(point.visits)}`,end[0]+(end[0]>=x?12:-12),end[1]-10)}
    drawn.push({i,start,end});
  }
}
function tick(time) {
  frame=0;if(document.hidden || !inView)return;
  if(animation){const p=Math.min(1,(time-animation.start)/1200),ease=1-Math.pow(1-p,3);rotation=animation.from.map((n,i)=>n+(animation.to[i]-n)*ease);projection.rotate(rotation);if(p===1)animation=null;}
  if(auto && !drag && locations.length && time-lastTour>4500)nextVisit(1);
  if(time-lastFrame>30){paint();lastFrame=time;}
  if(!frame && (animation || (auto && locations.length>0)))frame=requestAnimationFrame(tick);
}
function animate(){if(!frame && !document.hidden && inView)frame=requestAnimationFrame(tick)}
function update(snapshot) {
  pending=snapshot;if(!ready)return;
  const previous=locations[focus]?.key,previousSession=liveTour[tourIndex]?liveTour[tourIndex].host+':'+liveTour[tourIndex].visitor:'';mode=snapshot.mode;
  const result=globeLocations(snapshot,centres);locations=result.locations;
  const visited=new Set();liveTour=mode==='live'?(snapshot.visitors || []).flatMap(v=>{const code=v.country,pointKey=Number.isFinite(v.latitude)&&Number.isFinite(v.longitude)?`${code}:${v.latitude},${v.longitude}`:code,key=v.host+':'+v.visitor;if(!locations.some(p=>p.key===pointKey) || visited.has(key))return [];visited.add(key);return [{...v,code,key:pointKey}]}):[];
  tourIndex=liveTour.findIndex(v=>v.host+':'+v.visitor===previousSession);if(tourIndex<0 && liveTour.length)tourIndex=0;
  $('globeMode').textContent=mode==='live'?'TRÁFICO EN DIRECTO':'TRÁFICO ACUMULADO';
  $('globeScope').textContent=snapshot.scope || 'Todo el grupo';
  $('globeCaption').textContent=snapshot.error?'No se han recibido datos actualizados.':snapshot.loading?'Consultando tráfico…':`${mode==='live'?'Sesiones visibles, últimos 45 s.':'Rayos en escala lineal: más visitas, más altura.'} ${mode==='live'?'Ciudad y región de Cloudflare IP cuando disponibles; aproximadas, no GPS.':'Histórico RUM: ubicación disponible por país.'}${result.unknown?` ${fmt(result.unknown)} ${mode==='live'?'sesiones':'visitas'} sin país representable.`:''}${snapshot.geographyTruncated?' La consulta geográfica alcanzó su límite.':''}`;
  canvas.setAttribute('aria-label',`Globo del tráfico de ${snapshot.scope || 'todo el grupo'}: ${locations.length} ${mode==='live'?'ubicaciones':'países'}. ${locations.slice(0,8).map(p=>label(p)+' '+fmt(p.visits)).join(', ')}`);
  const box=$('globeCountries'),list=document.createElement('ol'),unit=mode==='live'?'sesiones':'visitas',hadFocus=box.contains(document.activeElement)?document.activeElement.dataset.key || document.activeElement.id:null;
  list.id='globeCountryList';list.className='globe-bar-list';box.replaceChildren(list);
  for(const bar of countryBars(locations)){
    const i=locations.findIndex(p=>p.key===bar.key),point=locations[i],item=document.createElement('li'),button=document.createElement('button'),track=document.createElement('span'),fill=document.createElement('i');
    item.dataset.rank=bar.rank;item.dataset.key=point.key;button.type='button';button.dataset.key=point.key;
    const rank=document.createElement('small'),name=document.createElement('span'),value=document.createElement('b');
    rank.textContent=bar.rank+1;rank.setAttribute('aria-hidden','true');name.textContent=label(point);value.textContent=fmt(point.visits);
    track.className='globe-bar';track.setAttribute('aria-hidden','true');fill.style.width=(bar.width*100).toFixed(1)+'%';track.append(fill);
    button.setAttribute('aria-label',`${label(point)}: ${fmt(point.visits)} ${unit}, ${Math.round(bar.share*1000)/10} % del total`);
    button.append(rank,name,value,track);button.onclick=()=>{setAuto(false);tourIndex=-1;select(i)};
    item.append(button);list.append(item);
  }
  if(locations.length>BAR_LIMIT){
    const more=document.createElement('button');more.type='button';more.id='globeCountriesMore';more.className='globe-bars-more';more.setAttribute('aria-controls','globeCountryList');
    more.onclick=()=>{barsOpen=!barsOpen;barsVisibility();if(document.activeElement?.closest?.('li[hidden]'))more.focus()};
    box.append(more);
  }
  barsVisibility();
  if(hadFocus)(box.querySelector(`button[data-key="${CSS.escape(hadFocus)}"]`) || $(hadFocus))?.focus();
  for(const id of ['globePrev','globeNext','globeTour'])$(id).disabled=!locations.length;
  focus=locations.findIndex(p=>p.key===previous);
  if(focus<0 && locations.length)select(0);else{selection();paint();animate()}
}
window.addEventListener('traffic-geography',event=>update(event.detail));
$('globeTour').onclick=()=>setAuto(!auto);
$('globePrev').onclick=()=>{setAuto(false);nextVisit(-1)};
$('globeNext').onclick=()=>{setAuto(false);nextVisit(1)};
$('globeReset').onclick=()=>{zoom=1;resize();if(locations.length)select(0);else{rotation=[-10,-20,0];projection.rotate(rotation);paint()}};
for(const [id,delta] of [['globeZoomIn',.15],['globeZoomOut',-.15]])$(id).onclick=()=>{zoom=Math.max(.7,Math.min(4,zoom+delta));resize()};
canvas.addEventListener('pointerdown',event=>{setAuto(false);animation=null;drag={x:event.clientX,y:event.clientY,rotation:[...rotation],moved:false};canvas.setPointerCapture(event.pointerId)});
canvas.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.moved ||= Math.abs(dx)+Math.abs(dy)>5;rotation=[drag.rotation[0]+dx*.3,Math.max(-80,Math.min(80,drag.rotation[1]-dy*.3)),0];projection.rotate(rotation);paint()});
canvas.addEventListener('pointerup',event=>{if(drag && !drag.moved){const box=canvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;const hit=drawn.find(p=>Math.hypot(p.end[0]-x,p.end[1]-y)<18 || Math.hypot(p.start[0]-x,p.start[1]-y)<18);if(hit)select(hit.i)}drag=null});
canvas.addEventListener('pointercancel',()=>{drag=null});
canvas.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setAuto(false);animation=null;rotation[0]+=event.key==='ArrowLeft'?-10:event.key==='ArrowRight'?10:0;rotation[1]=Math.max(-80,Math.min(80,rotation[1]+(event.key==='ArrowUp'?10:event.key==='ArrowDown'?-10:0)));projection.rotate(rotation);paint()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastTour=performance.now();animate()}});
reduced.addEventListener('change',()=>setAuto(!reduced.matches));
new ResizeObserver(resize).observe(canvas);
new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView){lastTour=performance.now();animate()}},{threshold:.05}).observe(canvas);
Promise.all([fetch('/analitics/world-land.geojson').then(r=>{if(!r.ok)throw Error();return r.json()}),fetch('/analitics/country-centres.json').then(r=>{if(!r.ok)throw Error();return r.json()})]).then(([world,countries])=>{land=world;centres=countries;ready=true;setAuto(auto);resize();if(pending)update(pending);else selection()}).catch(()=>{$('globeCaption').textContent='No se pudo cargar el mapa. Las cifras y listas del panel siguen disponibles.'});
