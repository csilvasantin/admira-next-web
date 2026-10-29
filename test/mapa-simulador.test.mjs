import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../pruebas/mapa/simulador.js',import.meta.url),'utf8');
const editorCode = await readFile(new URL('../pruebas/mapa/editor-zonas.js',import.meta.url),'utf8');
const browserCode = await readFile(new URL('../pruebas/mapa/ubicacion-dispositivo.js',import.meta.url),'utf8');
const fixtureCatalog = {items:[{type:'image',tags:['retail']},{type:'video',tags:['tecnología','technology']},{type:'video',tags:['creatividad','publicidad']},{type:'link',tags:['pendiente']}]};
const flush = async () => {await new Promise(setImmediate);};
const lukaFix=(extra={})=>({equipo:'luka',tipo:'smarttag2',nombre:'Luka',fuente:'smartthings-find',lat:41.4043,lon:2.1582,precision_m:10,ts:new Date().toISOString(),...extra});

test('la explicación comparte ganador, prioridades y distancias a ambos lados del límite',()=>{
  const {api}=mount(),config={zones:[{id:'alfa',name:'Alfa',tag:'retail',lat:0,lon:0,radius:100}],outside:{tag:'publicidad'}};
  const north=metres=>({lat:metres/6371000*180/Math.PI,lng:0});
  const inside=api.decisionFor(north(99.99),config),outside=api.decisionFor(north(100.01),config);
  assert.equal(inside.zone.id,api.zoneFor(north(99.99),config).id);assert.equal(inside.priority,1);assert.ok(Math.abs(inside.margin-.01)<.00001);
  assert.equal(outside.zone.id,'exterior');assert.ok(Math.abs(outside.nearest.metres-.01)<.00001);
  config.zones.push({...config.zones[0],id:'beta',name:'Beta',radius:200});
  const overlap=api.decisionFor(north(50),config);assert.equal(overlap.zone.id,'alfa');assert.equal(overlap.matches.length,2);
  config.zones.reverse();assert.equal(api.decisionFor(north(50),config).zone.id,'beta');
  assert.equal(api.decisionFor(north(250),config).nearest.zone.id,'beta');
  assert.equal(api.decisionFor(north(50),{zones:[],outside:{tag:'retail'}}).nearest,null);
  assert.equal(api.decisionFor({lat:NaN,lng:0},config),null);
});

test('el círculo de precisión debe quedar a un lado del límite para confirmar entrada o salida',()=>{
  const {api}=mount(),config={zones:[{id:'alfa',name:'Alfa',tag:'retail',lat:0,lon:0,radius:100}],outside:{tag:'publicidad'}},now=Date.now();
  const fix=metres=>lukaFix({lat:metres/6371000*180/Math.PI,lon:0,precision_m:10});
  assert.equal(api.resolveReading(fix(89.99),config,now).status,'ready');
  assert.equal(api.resolveReading(fix(90.01),config,now).status,'ambiguous');
  assert.equal(api.resolveReading(fix(109.99),config,now).status,'ambiguous');
  const exit=api.resolveReading(fix(110.01),config,now);assert.equal(exit.status,'ready');assert.equal(exit.zone.id,'exterior');
});

test('la vista previa anuncia destino durante el arrastre y aplica el player sólo al soltar',()=>{
  const ui=mount(),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();const marker=ui.markers[0],first=ui.element('simulador-video').children[0];
  marker.point={lat:41.389,lng:2.1645};marker.events.drag();
  assert.match(ui.element('simulador-decision').textContent,/Al soltar: Eixample · Tecnología/);assert.equal(ui.element('simulador-decision').attributes['aria-live'],'off');
  assert.equal(ui.element('simulador-zona').textContent,'Gràcia');assert.equal(ui.element('simulador-video').children[0],first);
  sim.renderText();assert.match(ui.element('simulador-arrastre').textContent,/Suelta/);assert.match(ui.element('simulador-decision').textContent,/Al soltar/);
  marker.events.dragend();const second=ui.element('simulador-video').children[0];assert.notEqual(second,first);assert.equal(ui.element('simulador-decision').attributes['aria-live'],'polite');
  assert.match(ui.element('simulador-decision').textContent,/Dentro de Eixample/);assert.doesNotMatch(ui.element('simulador-decision').textContent,/Al soltar/);
  sim.move({lat:41.38901,lng:2.1645});assert.equal(ui.element('simulador-video').children[0],second);
  sim.move({lat:41.389+449.5/6371000*180/Math.PI,lng:2.1645});assert.equal(ui.element('simulador-video').children[0],second);assert.match(ui.element('simulador-decision').textContent,/menos de 1 m.*Cerca del límite/);
  sim.move({lat:0,lng:0});assert.match(ui.element('simulador-decision').textContent,/Fuera de las zonas.*La más cercana/);
  ui.document.documentElement.lang='en';sim.renderText();assert.match(ui.element('simulador-decision').textContent,/Outside the zones.*Nearest/);sim.stop();
});

test('una lectura real dudosa no muestra una oficina confirmada; repetir el mismo aviso fiable conserva el iframe',()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('luka');
  const fix=lukaFix();sim.updateLuka(fix,false);const frame=ui.element('simulador-video').children[0];
  assert.match(ui.element('simulador-decision').textContent,/Margen de precisión hasta el límite: 440 m/);
  sim.updateLuka(fix,false);assert.equal(ui.element('simulador-video').children[0],frame);
  sim.updateLuka({...fix,precision_m:500},false);assert.equal(ui.element('simulador-decision').hidden,true);assert.equal(ui.element('simulador-decision').textContent,'');assert.match(ui.element('simulador-lectura').textContent,/cruza un límite/);sim.stop();
});

test('las cinco oficinas tienen centros distintos, temas distintos y la misma selección manual y real',()=>{
  const ui=mount({editor:true}),config=ui.zonesApi.officePreset,now=Date.now();
  assert.ok(ui.zonesApi.validate(config));assert.equal(config.zones.length,5);
  assert.equal(new Set(config.zones.map(z=>z.tag)).size,5);
  assert.deepEqual(Array.from(config.zones,z=>z.id),['pixeria','university','garage','sneaker-store','la-nave']);
  for (const zone of config.zones) {
    assert.equal(zone.radius,50);assert.match(zone.address,/08012/);
    assert.equal(ui.api.zoneFor({lat:zone.lat,lng:zone.lon},config).id,zone.id);
    const fix=ui.api.resolveReading(lukaFix({lat:zone.lat,lon:zone.lon,precision_m:10}),config,now);
    assert.equal(fix.status,'ready');assert.equal(fix.zone.id,zone.id);
  }
  assert.equal(JSON.stringify(ui.zonesApi.parseTransfer(ui.zonesApi.serializeTransfer(config))),JSON.stringify(ui.zonesApi.validate(config)));
  const bad=JSON.parse(JSON.stringify(config));bad.zones[0].address={url:'https://evil.test'};assert.equal(ui.zonesApi.validate(bad),null);
});

test('cargar oficinas es reversible, no sobrescribe almacenamiento y arrastrar Luka cambia el contenido en las cinco',async()=>{
  const ui=await editorSession();ui.element('simulador-nombre').fire('input','Mi zona');ui.element('simulador-guardar').click();
  const original=ui.storage.get(ui.zonesApi.storageKey), oldFrame=ui.element('simulador-video').children[0];
  ui.element('simulador-oficinas').click();
  assert.equal(ui.storage.get(ui.zonesApi.storageKey),original);assert.notEqual(ui.element('simulador-video').children[0],oldFrame);
  assert.match(ui.element('simulador-guardado').textContent,/sin guardar/);assert.equal(ui.element('simulador-nombre').value,'Pixería');
  const marker=ui.markers.find(m=>m.options.alt==='Luka · manual');let frame=ui.element('simulador-video').children[0];
  for (const zone of ui.zonesApi.officePreset.zones) {
    marker.point={lat:zone.lat,lng:zone.lon};marker.events.drag();assert.equal(ui.element('simulador-video').children[0],frame);
    marker.events.dragend();frame=ui.element('simulador-video').children[0];
    assert.equal(new URL(frame.src).searchParams.get('tag'),zone.tag);assert.equal(ui.element('simulador-zona').textContent,zone.name);
  }
  ui.element('simulador-deshacer').click();assert.equal(ui.element('simulador-nombre').value,'Mi zona');
  ui.element('simulador-oficinas').click();ui.element('simulador-guardar').click();
  const restored=await editorSession({storage:ui.storage});assert.equal(restored.element('simulador-nombre').value,'Pixería');
  restored.element('simulador-exportar').click();const text=await restored.downloads[0].blob.text();
  const other=await editorSession();await importFile(other,fileOf(text));assert.equal(other.element('simulador-direccion').textContent,restored.element('simulador-direccion').textContent);
  ui.sim.stop();restored.sim.stop();other.sim.stop();
});

test('cargar oficinas mientras sigue Luka conserva la fuente real y cancela importaciones anteriores pendientes',async()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('luka');
  ui.element('simulador-editar').click();await flush();
  const firstOffice=ui.zonesApi.officePreset.zones[0];sim.updateLuka(lukaFix({lat:firstOffice.lat,lon:firstOffice.lon}),false);
  let finish;const pending=importFile(ui,{size:200,text:()=>new Promise(resolve=>finish=resolve)});
  ui.element('simulador-oficinas').click();assert.equal(sim.isFollowing(),true);
  assert.equal(ui.element('simulador-zona').textContent,firstOffice.name);
  finish(JSON.stringify(ui.zonesApi.defaults));await pending;
  assert.equal(ui.element('simulador-zona').textContent,firstOffice.name);assert.equal(ui.element('simulador-importar').disabled,false);sim.stop();
});

test('una lectura real y el arrastre usan la misma zona, con precisión completa y prioridad de solapamiento',()=>{
  const ui=mount({editor:true}), config=JSON.parse(JSON.stringify(ui.zonesApi.defaults)), now=Date.now();
  for (const point of [{lat:41.4043,lng:2.1582},{lat:41.389,lng:2.1645},{lat:0,lng:0}]) {
    const reading=ui.api.resolveReading(lukaFix({lat:point.lat,lon:point.lng}),config,now);
    assert.equal(reading.status,'ready');assert.equal(reading.zone.id,ui.api.zoneFor(point,config).id);
  }
  config.zones[1]={...config.zones[1],lat:config.zones[0].lat,lon:config.zones[0].lon};
  assert.equal(ui.api.resolveReading(lukaFix(),config,now).zone.id,'gracia');
  config.zones.reverse();assert.equal(ui.api.resolveReading(lukaFix(),config,now).zone.id,'eixample');
  // The higher priority circle intersects the accuracy area without containing it.
  config.zones[0].lat+=440/6371000*180/Math.PI;
  assert.equal(ui.api.resolveReading(lukaFix({precision_m:20}),config,now).status,'ambiguous');
});

test('seguimiento no decide oficina con lectura antigua, futura, sintética, de otro equipo o sin precisión',()=>{
  const ui=mount({editor:true}), config=ui.zonesApi.defaults, now=Date.now();
  for (const [extra,status] of [[{ts:new Date(now-300001).toISOString()},'stale'],[{ts:new Date(now+60001).toISOString()},'stale'],[{ts:'ayer'},'stale'],[{precision_m:null},'accuracy'],[{precision_m:'10'},'accuracy'],[{precision_m:-1},'accuracy'],[{es_prueba:true},'test'],[{nombre:'Luka mock'},'test'],[{fuente:'demo-smartthings-find'},'missing'],[{equipo:'iphone-carlos'},'missing'],[{tipo:'movil'},'missing'],[{lat:null},'missing']]) assert.equal(ui.api.resolveReading(lukaFix(extra),config,now).status,status);
  const edge=450/6371000*180/Math.PI;
  assert.equal(ui.api.resolveReading(lukaFix({lat:41.4043+edge,precision_m:10}),config,now).status,'ambiguous');
});

test('seguir Luka espera sin coordenadas, aplica avisos fiables y retira el player ante duda o fallo de consulta',()=>{
  const ui=mount({editor:true}), sim=ui.api.create({map:ui.map,L:ui.L});sim.start('luka');
  assert.equal(sim.isFollowing(),true);assert.equal(ui.element('simulador-video').children.length,0);
  assert.match(ui.element('simulador-lectura').textContent,/Esperando coordenadas/);
  assert.equal(ui.markers.length,0);assert.equal(ui.mapEvents.click,undefined);
  sim.updateLuka(lukaFix(),false);
  const first=ui.element('simulador-video').children[0];assert.equal(new URL(first.src).searchParams.get('tag'),'retail');
  assert.equal(ui.element('simulador-ir-gracia').disabled,true);
  sim.move({lat:0,lng:0});ui.element('simulador-ir-eixample').click();assert.equal(ui.element('simulador-video').children[0],first);
  sim.updateLuka(lukaFix({lat:41.40431}),false);assert.equal(ui.element('simulador-video').children[0],first);
  sim.updateLuka(lukaFix({lat:41.389,lon:2.1645}),false);assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'tecnologia');
  sim.updateLuka(lukaFix({precision_m:null}),false);assert.equal(ui.element('simulador-video').children.length,0);assert.match(ui.element('simulador-lectura').textContent,/Precisión no disponible/);
  sim.updateLuka(lukaFix(),false);assert.equal(ui.element('simulador-video').children.length,1);
  sim.updateLuka(lukaFix(),true);assert.equal(ui.element('simulador-video').children.length,0);assert.match(ui.element('simulador-lectura').textContent,/No se puede actualizar/);
  ui.document.documentElement.lang='en';sim.renderText();assert.match(ui.element('simulador-lectura').textContent,/cannot be refreshed/);
  sim.stop();sim.updateLuka(lukaFix(),false);assert.equal(ui.element('simulador-video').children.length,0);
  sim.start();assert.equal(sim.isFollowing(),false);assert.equal(ui.markers.at(-1).options.draggable,true);sim.stop();
});
function mount({editor=false,storage=new Map(),fetcher=async()=>({ok:true,json:async()=>fixtureCatalog}),storageError=false,browser=false}={}) {
  const elements = new Map(), messages = [], markers = [], timers = new Map(), timerDelays = new Map(), mapEvents = {}, requests=[], downloads=[], blobs=new Map();
  let serial=0,clockNow=Date.now();
  const intervals=new Map(),lifecycle={},docEvents={},geo={calls:0,cleared:[],watchPosition(success,error,options){this.calls++;this.success=success;this.error=error;this.options=options;return 7;},clearWatch(id){this.cleared.push(id);}};
  class Clock extends Date {constructor(...args){super(...(args.length?args:[clockNow]));}static now(){return clockNow;}}
  function node() {
    const el={hidden:true,textContent:'',value:'',attributes:{},children:[],listeners:{},classList:{add(){},remove(){}},contentWindow:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this[k];delete this.attributes[k];},appendChild(child){if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);this.children.push(child);child.parent=this;return child;},replaceChildren(...children){this.children=[];children.forEach(child=>this.appendChild(child));},remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);},addEventListener(k,fn){this.listeners[k]=fn;},fire(k,value){if(value!==undefined)this.value=value;return this.listeners[k]?.({target:this});},click(){if(this.disabled)return;if(this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});return this.fire('click');}};
    Object.defineProperty(el,'id',{get(){return this.nodeId;},set(value){this.nodeId=value;elements.set(value,this);}});
    return el;
  }
  const element=id=>{if(!elements.has(id)){const el=node();el.id=id;}return elements.get(id);};
  const document = {documentElement:{lang:'es'},getElementById:element,createElement:node,body:node(),addEventListener:(k,fn)=>{const old=docEvents[k];docEvents[k]=(...args)=>{if(old)old(...args);fn(...args);};}};
  const map = {on:(k,fn)=>mapEvents[k]=fn,off:k=>delete mapEvents[k],removeLayer(){},setView(){},panTo(){},getCenter:()=>({lat:41.396,lng:2.164})};
  const toPoint=p=>Array.isArray(p)?{lat:p[0],lng:p[1]}:{...p};
  const L = {layerGroup:()=>({addTo(){return this;},clearLayers(){}}),circle:()=>({addTo(){return this;},bindTooltip(value){this.tooltip=value;return this;},setLatLng(){return this;},setRadius(){return this;}}),divIcon:options=>options,marker:(point,options)=>{
    const marker={point:toPoint(point),options,events:{},addTo(){markers.push(this);return this;},setLatLng(point){this.point=toPoint(point);return this;},getLatLng(){return this.point;},on(k,fn){this.events[k]=fn;return this;}};return marker;
  }};
  class FixtureURL extends URL {static createObjectURL(blob){const key='blob:fixture-'+blobs.size;blobs.set(key,blob);return key;}static revokeObjectURL(key){blobs.delete(key);}}
  const context = vm.createContext({document,URL:FixtureURL,Blob,TextEncoder,console,AbortController,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(storageError)throw new Error('quota');storage.set(key,value);}},fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},addEventListener:(event,fn)=>{if(event==='message')messages.push(fn);else {const old=lifecycle[event];lifecycle[event]=(...args)=>{if(old)old(...args);fn(...args);};}},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,fn);timerDelays.set(id,ms);return id;},clearTimeout:id=>{timers.delete(id);timerDelays.delete(id);}});
  if(browser)Object.assign(context,{navigator:{geolocation:geo},isSecureContext:true,Date:Clock,setInterval:fn=>{const id=++serial;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)});
  context.window=context;if(browser)vm.runInContext(browserCode,context);if(editor)vm.runInContext(editorCode,context);vm.runInContext(code,context);
  return {geo,intervals,lifecycle,hide:()=>{document.hidden=true;docEvents.visibilitychange();},advance:ms=>clockNow+=ms,api:context.AdmiraMapaSimulador,zonesApi:context.AdmiraMapaZonas,element,document,map,L,markers,timers,timerDelays,mapEvents,storage,requests,downloads,message:event=>messages.forEach(fn=>fn(event))};
}

test('las zonas usan distancia en metros y un exterior explícito; nunca aceptan coordenadas inválidas',()=>{
  const {api}=mount();
  assert.equal(api.zoneFor({lat:41.4043,lng:2.1582}).id,'gracia');
  assert.equal(api.zoneFor({lat:41.389,lng:2.1645}).id,'eixample');
  assert.equal(api.zoneFor({lat:0,lng:0}).id,'exterior');
  const edge=450/6371000*180/Math.PI;
  assert.equal(api.zoneFor({lat:41.4043+edge-0.00000001,lng:2.1582}).id,'gracia');
  assert.equal(api.zoneFor({lat:41.4043+edge+0.00000001,lng:2.1582}).id,'exterior');
  for(const point of [null,{lat:'41',lng:2},{lat:91,lng:0},{lat:0,lng:181},{lat:NaN,lng:0}]) assert.equal(api.zoneFor(point),null);
});

test('el player usa el contrato oficial, una identidad virtual y sólo una etiqueta; no transmite coordenadas',()=>{
  const {api}=mount();
  const url=new URL(api.playerURL(api.zones[0],'virtual-mapa-12345678'));
  assert.equal(url.origin,'https://admira.tv');assert.equal(url.pathname,'/canal.html');
  assert.equal(url.searchParams.get('tag'),'retail');assert.equal(url.searchParams.get('playerType'),'virtual');
  assert.equal(url.searchParams.get('screen'),url.searchParams.get('circuit'));
  assert.equal(url.searchParams.get('modeLock'),'1');assert.equal(url.searchParams.get('muted'),'1');
  for(const key of ['lat','lng','latitude','longitude','machine','token']) assert.equal(url.searchParams.has(key),false);
  assert.throws(()=>api.playerURL(api.zones[0],'iphone17-mupi'));
  assert.throws(()=>api.playerURL({tag:'injected'},'virtual-mapa-12345678'));
});

test('soltar en otra zona cambia el iframe, moverse dentro de la misma lo conserva y los mensajes se verifican',()=>{
  const ui=mount(), sim=ui.api.create({map:ui.map,L:ui.L});
  sim.start();
  const marker=ui.markers[0], first=ui.element('simulador-video').children[0];
  assert.equal(marker.options.draggable,true);
  marker.point={lat:41.389,lng:2.1645};marker.events.drag();
  assert.equal(ui.element('simulador-video').children[0],first);
  marker.events.dragend();
  const second=ui.element('simulador-video').children[0];
  assert.notEqual(second,first);assert.equal(new URL(second.src).searchParams.get('tag'),'tecnologia');
  sim.move({lat:41.3891,lng:2.1645});assert.equal(ui.element('simulador-video').children[0],second);
  const data={source:'admira-tv-canal',event:'media-state',id:'stock-123'};
  ui.message({origin:'https://evil.example',source:second.contentWindow,data});
  ui.message({origin:'https://admira.tv',source:first.contentWindow,data});
  assert.notEqual(ui.element('simulador-estado').textContent,'Player conectado');
  ui.message({origin:'https://admira.tv',source:second.contentWindow,data});
  assert.equal(ui.element('simulador-estado').textContent,'Player conectado');
  assert.equal(second.attributes['data-media-id'],'stock-123');
  ui.document.documentElement.lang='en';sim.renderText();assert.equal(ui.element('simulador-contenido').textContent,'Technology');
  ui.mapEvents.click({latlng:{lat:0,lng:0}});assert.equal(ui.element('simulador-contenido').textContent,'Creativity');
  sim.stop();assert.equal(ui.element('simulador-video').children.length,0);assert.equal(sim.isActive(),false);assert.equal(ui.mapEvents.click,undefined);assert.equal(ui.timers.size,0);
});

test('configuración guardada valida límites, tipos, IDs duplicados y etiquetas sin permitir otra URL',()=>{
  const {zonesApi:api}=mount({editor:true});
  const good=()=>JSON.parse(JSON.stringify(api.defaults));
  assert.ok(api.validate(good()));
  for(const change of [c=>c.version=2,c=>c.outside.tag=42,c=>c.outside.tag='https://evil.test',c=>c.zones[0].lat=86,c=>c.zones[0].radius='450',c=>c.zones[0].radius=5001,c=>c.zones[1].id=c.zones[0].id,c=>c.zones[0].name='',c=>c.zones=Array(9).fill(c.zones[0])]){
    const bad=good();change(bad);assert.equal(api.validate(bad),null);
  }
  const empty=good();empty.zones=[];assert.equal(api.validate(empty).zones.length,0);
  const edge=api.edge({lat:0,lon:0,radius:1000});assert.ok(Math.abs(edge.lat)<1e-9);assert.ok(Math.abs(edge.lng*Math.PI/180*6371000+1000)<0.001);
});

test('el catálogo sólo ofrece temas de piezas reproducibles, normaliza alias y no cuenta el mismo tema dos veces',()=>{
  const {zonesApi:api}=mount({editor:true});
  const rows=api.catalog(fixtureCatalog);
  assert.equal(rows.find(item=>item.tag==='tecnologia').count,1);
  assert.equal(rows.some(item=>item.tag==='pendiente'),false);
  assert.throws(()=>api.catalog({items:null}));
});

test('editar contenido de la zona actual recarga el player y guardar restaura el cambio tras recargar',async()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();
  ui.element('simulador-editar').click();await flush();
  assert.equal(ui.requests[0].options.method,'GET');assert.equal(ui.requests[0].options.credentials,'omit');
  const first=ui.element('simulador-video').children[0];
  ui.element('simulador-tema').fire('change','tecnologia');
  const next=ui.element('simulador-video').children[0];
  assert.notEqual(next,first);assert.equal(new URL(next.src).searchParams.get('tag'),'tecnologia');
  ui.element('simulador-radio').fire('input','650');ui.element('simulador-nombre').fire('input','Mi zona');
  assert.equal(ui.storage.size,0);assert.match(ui.element('simulador-guardado').textContent,/sin guardar/);
  ui.element('simulador-guardar').click();
  assert.match(ui.element('simulador-guardado').textContent,/Guardado en este navegador/);
  const saved=JSON.parse(ui.storage.get(ui.zonesApi.storageKey));assert.equal(saved.zones[0].radius,650);assert.equal(saved.zones[0].name,'Mi zona');
  const restored=mount({editor:true,storage:ui.storage}),second=restored.api.create({map:restored.map,L:restored.L});second.start();
  assert.equal(new URL(restored.element('simulador-video').children[0].src).searchParams.get('tag'),'tecnologia');
  sim.stop();second.stop();
});

test('arrastrar centro y borde cambia la geocerca y el player; deshacer recupera la configuración',async()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();await flush();
  let centre=ui.markers.filter(m=>m.options.alt?.startsWith('Centro')).at(-1);
  centre.events.dragstart();centre.point={lat:41.42,lng:2.16};centre.events.drag();centre.events.dragend();
  assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'creatividad');
  let border=ui.markers.filter(m=>m.options.alt?.startsWith('Borde')).at(-1);
  border.events.dragstart();border.point={lat:41.42,lng:2.171};border.events.drag();border.events.dragend();
  assert.ok(Number(ui.element('simulador-radio').value)>900);
  ui.element('simulador-deshacer').click();assert.equal(Number(ui.element('simulador-radio').value),450);
  ui.element('simulador-deshacer').click();assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'retail');
  sim.stop();
});

test('añadir, eliminar, deshacer y asignar el exterior conservan reglas y respetan un máximo de ocho zonas',async()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();await flush();
  ui.element('simulador-eliminar').click();assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'creatividad');
  ui.element('simulador-deshacer').click();assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'retail');
  for(let i=0;i<10;i++)ui.element('simulador-anadir').click();
  ui.element('simulador-guardar').click();assert.equal(JSON.parse(ui.storage.get(ui.zonesApi.storageKey)).zones.length,8);
  ui.element('simulador-zona-elegida').fire('change','exterior');assert.equal(ui.element('simulador-radio').disabled,true);
  ui.element('simulador-tema').fire('change','tecnologia');sim.move({lat:0,lng:0});
  assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'tecnologia');
  sim.stop();
});

test('errores de almacenamiento y catálogo no fingen guardado ni impiden editar los temas existentes',async()=>{
  const ui=mount({editor:true,storageError:true,fetcher:async()=>({ok:false})}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();await flush();
  assert.match(ui.element('simulador-catalogo-estado').textContent,/no disponible/);
  ui.element('simulador-tema').fire('change','tecnologia');ui.element('simulador-guardar').click();
  assert.match(ui.element('simulador-guardado').textContent,/No se pudo guardar/);assert.equal(ui.storage.size,0);
  sim.stop();
});

test('guardar un campo incompleto o un radio fuera de límites no sobrescribe la configuración guardada',async()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();await flush();
  ui.element('simulador-radio').fire('input','5');ui.element('simulador-guardar').click();
  assert.equal(ui.storage.size,0);assert.match(ui.element('simulador-guardado').textContent,/Revisa/);
  ui.element('simulador-nombre').fire('input','');ui.element('simulador-guardar').click();assert.equal(ui.storage.size,0);
  sim.stop();
});

test('configuración corrupta vuelve al ejemplo, los solapamientos tienen prioridad estable y editar no pierde el texto enfocado',async()=>{
  const key='admiranext:mapa:zonas:v1',ui=mount({editor:true,storage:new Map([[key,'{invalid']])}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();await flush();
  assert.match(ui.element('simulador-guardado').textContent,/no era válida/);
  ui.document.activeElement=ui.element('simulador-nombre');ui.document.activeElement.value='Borrador sin terminar';sim.renderText();
  assert.equal(ui.element('simulador-nombre').value,'Borrador sin terminar');ui.document.activeElement=null;
  ui.element('simulador-zona-elegida').fire('change','eixample');ui.element('simulador-centro-aqui').click();
  assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'retail');
  sim.stop();
});

async function editorSession(options) {
  const ui=mount({editor:true,...options}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();await flush();
  return {...ui,sim};
}
function fileOf(text) {return {size:new TextEncoder().encode(text).length,text:async()=>text};}
async function importFile(ui,file) {ui.element('simulador-archivo').files=[file];await ui.element('simulador-archivo').fire('change');}

test('subir y bajar prioridad cambia el ganador de un solapamiento y conserva el orden al guardar y transferir',async()=>{
  const ui=await editorSession();assert.equal(ui.element('simulador-subir').disabled,true);
  ui.element('simulador-zona-elegida').fire('change','eixample');ui.element('simulador-centro-aqui').click();
  assert.equal(ui.element('simulador-zona').textContent,'Gràcia');assert.equal(ui.element('simulador-bajar').disabled,true);
  const first=ui.element('simulador-video').children[0];ui.element('simulador-subir').click();
  assert.equal(ui.element('simulador-zona').textContent,'Eixample');assert.notEqual(ui.element('simulador-video').children[0],first);
  assert.match(ui.element('simulador-decision').textContent,/Coinciden: Eixample, Gràcia. Gana Eixample por prioridad 1/);
  assert.equal(ui.element('simulador-zona-elegida').value,'eixample');assert.match(ui.element('simulador-prioridad').textContent,/Prioridad 1 de 2/);
  assert.deepEqual(ui.element('simulador-zonas').children.map(b=>b.id),['simulador-ir-eixample','simulador-ir-gracia','simulador-ir-exterior']);
  assert.deepEqual(ui.element('simulador-zona-elegida').children.map(o=>o.value),['eixample','gracia','exterior']);
  const promoted=ui.element('simulador-video').children[0];ui.element('simulador-subir').click();assert.equal(ui.element('simulador-video').children[0],promoted);
  ui.element('simulador-bajar').click();assert.equal(ui.element('simulador-zona').textContent,'Gràcia');
  ui.element('simulador-deshacer').click();assert.equal(ui.element('simulador-zona').textContent,'Eixample');assert.equal(ui.storage.size,0);
  ui.element('simulador-guardar').click();ui.element('simulador-exportar').click();const exported=await ui.downloads[0].blob.text();
  const restored=await editorSession({storage:ui.storage});assert.equal(restored.element('simulador-zona').textContent,'Eixample');
  const target=await editorSession();await importFile(target,fileOf(exported));assert.equal(target.element('simulador-zona').textContent,'Eixample');
  assert.deepEqual(target.element('simulador-zonas').children.map(b=>b.id),['simulador-ir-eixample','simulador-ir-gracia','simulador-ir-exterior']);
  target.element('simulador-zona-elegida').fire('change','exterior');assert.equal(target.element('simulador-subir').disabled,true);assert.equal(target.element('simulador-bajar').disabled,true);
  ui.sim.stop();restored.sim.stop();target.sim.stop();
});

test('reordenar oficinas ajenas a la ubicación conserva la reproducción, direcciones y geometrías',async()=>{
  const ui=await editorSession();ui.element('simulador-oficinas').click();
  const frame=ui.element('simulador-video').children[0];ui.element('simulador-zona-elegida').fire('change','la-nave');ui.element('simulador-subir').click();
  assert.equal(ui.element('simulador-video').children[0],frame);assert.equal(ui.element('simulador-zona').textContent,'Pixería');
  ui.element('simulador-guardar').click();const saved=JSON.parse(ui.storage.get(ui.zonesApi.storageKey));
  assert.deepEqual(saved.zones.map(z=>z.id),['pixeria','university','garage','la-nave','sneaker-store']);
  for (const zone of saved.zones) assert.deepEqual(zone,JSON.parse(JSON.stringify(ui.zonesApi.officePreset.zones.find(z=>z.id===zone.id))));
  ui.document.documentElement.lang='en';ui.sim.renderText();assert.match(ui.element('simulador-prioridad').textContent,/Priority 4 of 5/);
  ui.sim.stop();
});

test('la prioridad elegida también cambia el contenido al seguir una lectura real fiable',async()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('luka');sim.updateLuka(lukaFix(),false);ui.element('simulador-editar').click();await flush();
  ui.element('simulador-zona-elegida').fire('change','eixample');ui.element('simulador-centro-aqui').click();
  assert.equal(ui.element('simulador-zona').textContent,'Gràcia');ui.element('simulador-subir').click();
  assert.equal(ui.element('simulador-zona').textContent,'Eixample');assert.equal(sim.isFollowing(),true);assert.equal(ui.element('simulador-badge').textContent,'SEGUIR LUKA');sim.stop();
});

test('importar otro orden sincroniza accesos del mapa y prioridad sin recrear botones en cada lectura',async()=>{
  const ui=await editorSession(),config=JSON.parse(JSON.stringify(ui.zonesApi.defaults));
  const first=ui.element('simulador-zonas').children.slice();config.zones.reverse();
  await importFile(ui,fileOf(JSON.stringify(config)));
  const controls=ui.element('simulador-zonas');assert.deepEqual(controls.children.map(node=>node.id),['simulador-ir-eixample','simulador-ir-gracia','simulador-ir-exterior']);
  const reordered=controls.children;ui.sim.renderText();assert.equal(controls.children,reordered);
  assert.ok(first.every(node=>controls.children.includes(node)));ui.sim.stop();
});

test('el archivo portable conserva orden, geometría y temas, acepta UTF-8 con BOM y limita bytes antes de parsear',()=>{
  const {zonesApi:api}=mount({editor:true}),config=JSON.parse(JSON.stringify(api.defaults));
  config.zones.reverse();config.zones[0].name='Zona à · 日本';config.outside.tag='publicidad';config.zones[0].unknown='descartar';
  const text=api.serializeTransfer(config),expected=api.validate(config);
  assert.equal(JSON.stringify(api.parseTransfer('\ufeff'+text)),JSON.stringify(expected));
  assert.equal(text.includes('unknown'),false);
  const padded=text+' '.repeat(api.maxFileBytes-new TextEncoder().encode(text).length);
  assert.ok(api.parseTransfer(padded));assert.throws(()=>api.parseTransfer(padded+' '),/demasiado_grande/);
  for(const value of ['{invalid','null','[]','{"version":2,"zones":[],"outside":{"tag":"retail"}}',JSON.stringify({...config,outside:{tag:'https://evil.example'}})])assert.throws(()=>api.parseTransfer(value),/invalido/);
});

test('exportar genera una descarga local con los cambios sin guardar y otro navegador restaura todas las asignaciones',async()=>{
  const source=await editorSession();source.element('simulador-nombre').fire('input','Zona compartida');source.element('simulador-radio').fire('input','800');source.element('simulador-tema').fire('change','tecnologia');
  source.element('simulador-zona-elegida').fire('change','exterior');source.element('simulador-tema').fire('change','publicidad');
  source.element('simulador-exportar').click();assert.equal(source.downloads.length,1);assert.equal(source.downloads[0].name,'admira-zonas.json');assert.equal(source.storage.size,0);
  const text=await source.downloads[0].blob.text();assert.match(source.element('simulador-intercambio-estado').textContent,/Descarga iniciada/);
  const target=await editorSession();await importFile(target,fileOf(text));assert.equal(target.storage.size,0);
  assert.equal(target.element('simulador-nombre').value,'Zona compartida');assert.equal(Number(target.element('simulador-radio').value),800);
  assert.equal(new URL(target.element('simulador-video').children[0].src).searchParams.get('tag'),'tecnologia');
  target.sim.move({lat:0,lng:0});assert.equal(new URL(target.element('simulador-video').children[0].src).searchParams.get('tag'),'publicidad');
  target.element('simulador-guardar').click();assert.match(target.element('simulador-intercambio-estado').textContent,/Guardado en este navegador/);
  const restored=await editorSession({storage:target.storage});restored.element('simulador-exportar').click();
  assert.equal(await restored.downloads[0].blob.text(),text);
  assert.ok([...source.requests,...target.requests,...restored.requests].every(r=>r.options.method==='GET'&&!r.options.body));
  source.sim.stop();target.sim.stop();restored.sim.stop();
});

test('un archivo inválido, grande o ilegible conserva configuración, player, historial y almacenamiento',async()=>{
  const ui=await editorSession();ui.element('simulador-guardar').click();const before=ui.storage.get(ui.zonesApi.storageKey),frame=ui.element('simulador-video').children[0];
  let reads=0;
  for(const file of [fileOf('{bad'),fileOf(JSON.stringify({version:1,zones:[],outside:{tag:'javascript:alert(1)'}})),{size:16385,text:async()=>{reads++;return '{}';}},{size:20,text:async()=>{throw new Error('read failed');}}]) {
    await importFile(ui,file);assert.equal(ui.element('simulador-video').children[0],frame);assert.equal(ui.storage.get(ui.zonesApi.storageKey),before);assert.equal(ui.element('simulador-deshacer').disabled,true);
    assert.match(ui.element('simulador-intercambio-estado').textContent,/configuración actual se conserva/);
  }
  assert.equal(reads,0);ui.sim.stop();
});

test('importar permite deshacer y un error al guardar no anuncia persistencia',async()=>{
  const ui=await editorSession({storageError:true}),other=JSON.parse(JSON.stringify(ui.zonesApi.defaults));other.zones[0].tag='tecnologia';
  await importFile(ui,fileOf(JSON.stringify(other)));assert.match(ui.element('simulador-intercambio-estado').textContent,/pulsa Guardar zonas/);
  ui.element('simulador-guardar').click();assert.match(ui.element('simulador-guardado').textContent,/No se pudo guardar/);assert.doesNotMatch(ui.element('simulador-intercambio-estado').textContent,/Guardado en este navegador/);
  ui.element('simulador-deshacer').click();assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),'retail');assert.equal(ui.element('simulador-intercambio-estado').textContent,'');ui.sim.stop();
});

test('exportar un campo incompleto no descarga una configuración antigua',async()=>{
  const ui=await editorSession();ui.element('simulador-radio').fire('input','5');ui.element('simulador-exportar').click();assert.equal(ui.downloads.length,0);assert.match(ui.element('simulador-guardado').textContent,/Revisa/);ui.sim.stop();
});

test('una lectura de archivo anterior no sobrescribe una importación más reciente',async()=>{
  const ui=await editorSession();let finish;
  const pending=importFile(ui,{size:200,text:()=>new Promise(resolve=>finish=resolve)});
  const newer=JSON.parse(JSON.stringify(ui.zonesApi.defaults));newer.zones[0].name='Más reciente';
  await importFile(ui,fileOf(JSON.stringify(newer)));finish(JSON.stringify(ui.zonesApi.defaults));await pending;
  assert.equal(ui.element('simulador-nombre').value,'Más reciente');ui.sim.stop();
});

test('cerrar la simulación durante la lectura impide una importación tardía',async()=>{
  const ui=await editorSession();let finish;
  const pending=importFile(ui,{size:200,text:()=>new Promise(resolve=>finish=resolve)});
  ui.sim.stop();const changed=JSON.parse(JSON.stringify(ui.zonesApi.defaults));changed.zones[0].name='No debe aplicarse';finish(JSON.stringify(changed));await pending;
  ui.sim.start();ui.element('simulador-editar').click();assert.equal(ui.element('simulador-nombre').value,'Gràcia');ui.sim.stop();
});


test('ubicación del dispositivo optativa: cinco sedes, precisión, parada y recarga sin reactivar',async()=>{
  const ui=mount({editor:true,browser:true}),sim=ui.api.create({map:ui.map,L:ui.L});
  assert.equal(ui.geo.calls,0);sim.start();ui.element('simulador-oficinas').click();ui.element('simulador-guardar').click();sim.stop();
  assert.equal(ui.geo.calls,0,'manual and office imports do not acquire a device location');
  sim.start('browser');assert.equal(ui.geo.calls,1);assert.equal(sim.isBrowser(),true);assert.equal(sim.isFollowing(),false);
  assert.equal(ui.element('simulador-video').children.length,0);assert.equal(ui.element('simulador-badge').textContent,'MI UBICACIÓN');
  let stamp=Date.now(),frame;
  for(const zone of ui.zonesApi.officePreset.zones){
    stamp+=1;const fix={timestamp:stamp,coords:{latitude:zone.lat,longitude:zone.lon,accuracy:10}};
    ui.geo.success(fix);frame=ui.element('simulador-video').children[0];
    assert.equal(new URL(frame.src).searchParams.get('tag'),zone.tag);assert.equal(ui.element('simulador-zona').textContent,zone.name);
    assert.match(frame.attributes.allow,/geolocation 'none'/);assert.doesNotMatch(frame.src,/latitude|longitude|precision|41\./);
    ui.geo.success({...fix,coords:{latitude:0,longitude:0,accuracy:10}});assert.equal(ui.element('simulador-video').children[0],frame,'same timestamp cannot move the player');
    assert.equal(ui.markers.at(-1).options.draggable,false);assert.equal(ui.markers.at(-1).options.alt,'Mi dispositivo');
  }
  ui.geo.success({timestamp:++stamp,coords:{latitude:41.40134534,longitude:2.1558339,accuracy:100}});
  assert.equal(ui.element('simulador-video').children.length,0);assert.match(ui.element('simulador-lectura').textContent,/cruza un límite/);
  ui.geo.success({timestamp:++stamp,coords:{latitude:41.40134534,longitude:2.1558339,accuracy:10}});
  ui.advance(300100);for(const tick of ui.intervals.values())tick();
  assert.equal(ui.element('simulador-video').children.length,0);assert.match(ui.element('simulador-lectura').textContent,/menos de cinco minutos/);
  sim.stop();assert.deepEqual(ui.geo.cleared,[7]);assert.equal(ui.intervals.size,0);
  ui.geo.success({timestamp:++stamp,coords:{latitude:0,longitude:0,accuracy:1}});assert.equal(ui.element('simulador-video').children.length,0);
  const reloaded=mount({editor:true,browser:true,storage:ui.storage});reloaded.api.create({map:reloaded.map,L:reloaded.L});assert.equal(reloaded.geo.calls,0);
  assert.ok(ui.requests.every(r=>!r.options.method||r.options.method==='GET'));
});

test('el dispositivo se detiene al ocultar la página, no se reactiva ni confunde avisos Samsung',()=>{
  const ui=mount({browser:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('browser');
  ui.geo.success({timestamp:Date.now(),coords:{latitude:41.4043,longitude:2.1582,accuracy:10}});
  const frame=ui.element('simulador-video').children[0];sim.updateLuka(lukaFix({lat:0,lon:0}),false);assert.equal(ui.element('simulador-video').children[0],frame);
  ui.hide();assert.equal(sim.isActive(),false);assert.equal(ui.geo.calls,1);assert.equal(ui.element('simulador-video').children.length,0);
  sim.start('luka');assert.equal(ui.geo.calls,1);assert.equal(ui.element('simulador-video').children.length,0);sim.stop();
});

test('la posición del navegador usa la misma fecha y círculo de precisión que Samsung',()=>{
  const ui=mount({editor:true}),config=ui.zonesApi.officePreset,now=Date.now();
  for(const [accuracy,stamp] of [[10,now],[100,now],[null,now],[10,now-300001],[10,now+60001]]){
    const z=config.zones[0],browser=ui.api.resolveBrowserReading({timestamp:stamp,coords:{latitude:z.lat,longitude:z.lon,accuracy}},config,now);
    const samsung=ui.api.resolveReading(lukaFix({lat:z.lat,lon:z.lon,precision_m:accuracy,ts:new Date(stamp).toISOString()}),config,now);
    assert.equal(browser.status,samsung.status);assert.equal(browser.zone?.id,samsung.zone?.id);
  }
});

test('importar zonas durante ubicación de dispositivo conserva la fuente y no inicia otra adquisición',async()=>{
  const ui=mount({editor:true,browser:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('browser');
  ui.element('simulador-editar').click();await flush();
  ui.geo.success({timestamp:Date.now(),coords:{latitude:41.40300208,longitude:2.15095625,accuracy:10}});
  await importFile(ui,fileOf(ui.zonesApi.serializeTransfer(ui.zonesApi.officePreset)));
  assert.equal(ui.geo.calls,1);assert.equal(sim.isBrowser(),true);assert.equal(ui.element('simulador-zona').textContent,'Pixería');
  assert.equal(ui.storage.size,0,'device coordinates are not saved automatically');
  ui.element('simulador-exportar').click();const saved=JSON.parse(await ui.downloads[0].blob.text());
  assert.deepEqual(Object.keys(saved).sort(),['outside','version','zones']);assert.equal(saved.zones.length,5);sim.stop();
});

const historyRows=ui=>ui.element('simulador-historial-lista').children;
const historyTitle=row=>row.children[1].textContent;
const historyReason=row=>row.children[2].textContent;
const historySource=row=>row.children[0].children[1].textContent;

test('historial manual: sólo al soltar, sin duplicar la misma oficina ni reiniciar el player',()=>{
  const ui=mount(),sim=ui.api.create({map:ui.map,L:ui.L});sim.renderText();assert.equal(ui.element('simulador-historial').hidden,true);sim.start();
  assert.equal(historyRows(ui).length,1);assert.match(historyTitle(historyRows(ui)[0]),/Gràcia.*Comercio/);assert.match(historySource(historyRows(ui)[0]),/Manual.*simulado/);
  assert.match(historyRows(ui)[0].children[0].children[0].attributes.datetime,/^\d{4}-\d\d-\d\dT/);
  const marker=ui.markers[0],first=ui.element('simulador-video').children[0];marker.point={lat:41.389,lng:2.1645};marker.events.drag();sim.renderText();
  assert.equal(historyRows(ui).length,1);assert.equal(ui.element('simulador-video').children[0],first);
  marker.events.dragend();assert.equal(historyRows(ui).length,2);assert.match(historyTitle(historyRows(ui)[0]),/Eixample/);assert.match(historyReason(historyRows(ui)[0]),/cambiado de oficina/);
  const next=ui.element('simulador-video').children[0];sim.move({lat:41.38901,lng:2.1645});sim.renderText();assert.equal(historyRows(ui).length,2);assert.equal(ui.element('simulador-video').children[0],next);
  sim.move({lat:0,lng:0});assert.equal(historyRows(ui).length,3);assert.match(historyReason(historyRows(ui)[0]),/salido de las zonas/);
  ui.element('simulador-historial-toggle').click();assert.equal(ui.element('simulador-historial-body').hidden,false);
  sim.stop();assert.equal(ui.element('simulador-historial').hidden,false);assert.equal(historyRows(ui).length,4);assert.equal(historyRows(ui)[0].attributes['data-status'],'stopped');
  ui.document.documentElement.lang='en';sim.renderText();assert.equal(historyTitle(historyRows(ui)[0]),'Player stopped');assert.equal(historySource(historyRows(ui)[1]),'Manual · simulated');
});

test('historial Samsung: polling idéntico, espera, recuperación, precisión y caducidad',()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('luka');assert.equal(historyRows(ui).length,1);
  assert.match(historySource(historyRows(ui)[0]),/Luka.*Samsung/);assert.match(historyReason(historyRows(ui)[0]),/puente aún no/);
  sim.updateLuka(null,false);assert.equal(historyRows(ui).length,1);
  const fix=lukaFix();sim.updateLuka(fix,false);const frame=ui.element('simulador-video').children[0];
  for(let i=0;i<5;i++){sim.updateLuka(fix,false);sim.renderText();}assert.equal(historyRows(ui).length,2);assert.equal(ui.element('simulador-video').children[0],frame);
  sim.updateLuka(fix,true);sim.updateLuka(fix,true);assert.equal(historyRows(ui).length,3);assert.match(historyReason(historyRows(ui)[0]),/No se puede actualizar/);assert.equal(ui.element('simulador-video').children.length,0);
  sim.updateLuka(fix,false);assert.equal(historyRows(ui).length,4);assert.match(historyReason(historyRows(ui)[0]),/Ubicación confirmada/);
  sim.updateLuka({...fix,precision_m:null},false);assert.equal(historyRows(ui).length,5);assert.match(historyReason(historyRows(ui)[0]),/Precisión no disponible/);
  sim.updateLuka({...fix,precision_m:500},false);assert.equal(historyRows(ui).length,6);assert.match(historyReason(historyRows(ui)[0]),/cruza un límite/);
  sim.updateLuka({...fix,ts:new Date(Date.now()-300100).toISOString()},false);assert.equal(historyRows(ui).length,7);assert.match(historyReason(historyRows(ui)[0]),/cinco minutos/);
  sim.stop();
});

test('historial del dispositivo: los callbacks repetidos no suman y la espera se identifica por su fuente',()=>{
  const ui=mount({browser:true}),sim=ui.api.create({map:ui.map,L:ui.L});assert.equal(ui.geo.calls,0);sim.start('browser');
  const stamp=Date.now(),fix={timestamp:stamp,coords:{latitude:41.4043,longitude:2.1582,accuracy:10}};
  assert.equal(historyRows(ui).length,1);assert.equal(historySource(historyRows(ui)[0]),'Mi dispositivo');
  ui.geo.success(fix);const n=historyRows(ui).length,frame=ui.element('simulador-video').children[0];
  ui.geo.success(fix);for(const tick of ui.intervals.values())tick();assert.equal(historyRows(ui).length,n);assert.equal(ui.element('simulador-video').children[0],frame);
  ui.geo.error({code:3});for(const tick of ui.intervals.values())tick();assert.equal(historyRows(ui).length,n+1);assert.match(historyReason(historyRows(ui)[0]),/a tiempo/);assert.equal(historySource(historyRows(ui)[0]),'Mi dispositivo');
  ui.advance(300100);ui.geo.success({timestamp:stamp+1,coords:fix.coords});assert.match(historyReason(historyRows(ui)[0]),/cinco minutos/);sim.stop();
});

test('el historial limita a 20, vaciar no recrea el estado actual y recargar empieza vacío',()=>{
  const ui=mount({editor:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start('luka');const fix=lukaFix();
  for(let i=0;i<25;i++)sim.updateLuka({...fix,ts:new Date(Date.now()+i).toISOString(),lat:i%2?0:41.4043,lon:i%2?0:2.1582},false);
  assert.equal(historyRows(ui).length,20);assert.match(historyTitle(historyRows(ui)[0]),/Gràcia/);
  ui.element('simulador-historial-vaciar').click();assert.equal(historyRows(ui).length,0);assert.equal(ui.element('simulador-historial-vaciar').disabled,true);
  sim.renderText();sim.updateLuka(fix,false);assert.equal(historyRows(ui).length,0);assert.equal(ui.element('simulador-historial-vacio').hidden,false);
  sim.updateLuka({...fix,lat:0,lon:0},false);assert.equal(historyRows(ui).length,1);
  const fresh=mount({editor:true,storage:ui.storage}),other=fresh.api.create({map:fresh.map,L:fresh.L});other.renderText();assert.equal(fresh.element('simulador-historial').hidden,true);assert.equal(historyRows(fresh).length,0);sim.stop();
});

test('historial de edición e importación: conserva nombres previos, indica configuración y no exporta lecturas',async()=>{
  const ui=await editorSession(),initialFrame=ui.element('simulador-video').children[0];
  ui.element('simulador-nombre').fire('input','<b>Mi oficina</b>');assert.equal(historyRows(ui).length,1,'typing a name does not change office or content');assert.equal(ui.element('simulador-video').children[0],initialFrame);
  ui.element('simulador-tema').fire('change','creatividad');assert.match(historyTitle(historyRows(ui)[0]),/<b>Mi oficina<\/b>/);assert.match(historyReason(historyRows(ui)[0]),/configuración/);
  assert.match(historyTitle(historyRows(ui).at(-1)),/Gràcia/);assert.notEqual(ui.element('simulador-video').children[0],initialFrame);
  await importFile(ui,fileOf(ui.zonesApi.serializeTransfer(ui.zonesApi.officePreset)));assert.match(historyTitle(historyRows(ui)[0]),/Fuera de las zonas/);assert.match(historyReason(historyRows(ui)[0]),/configuración/);
  ui.element('simulador-exportar').click();const serialized=await ui.downloads[0].blob.text(),transfer=JSON.parse(serialized);
  assert.deepEqual(Object.keys(transfer).sort(),['outside','version','zones']);assert.doesNotMatch(serialized,/history|historial|smartthings-find|timestamp/);assert.equal(ui.storage.size,0);ui.sim.stop();
});

const tourTimeout=ui=>Array.from(ui.timers).find(([id])=>ui.timerDelays.get(id)>0&&ui.timerDelays.get(id)<=12000);
const tickTour=ui=>{const pair=tourTimeout(ui);assert.ok(pair,'a tour step should be scheduled');ui.timers.delete(pair[0]);ui.timerDelays.delete(pair[0]);pair[1]();};
function tourSession(){const ui=mount({editor:true,browser:true}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-oficinas').click();return {...ui,sim};}

test('el recorrido Demo visita las cinco zonas por la misma selección, completa y conserva la configuración',()=>{
  const ui=tourSession();ui.element('simulador-guardar').click();const original=ui.storage.get(ui.zonesApi.storageKey),first=ui.element('simulador-video').children[0];
  assert.equal(tourTimeout(ui),undefined,'loading a preset never starts a tour');ui.element('simulador-recorrer').click();
  assert.equal(ui.element('simulador-video').children[0],first,'starting at the same office preserves playback');
  for(const [i,zone] of ui.zonesApi.officePreset.zones.entries()){
    assert.match(ui.element('simulador-badge').textContent,/DEMO/);assert.equal(ui.element('simulador-zona').textContent,zone.name);
    assert.match(ui.element('simulador-recorrido-estado').textContent,new RegExp((i+1)+' / 5'));assert.equal(new URL(ui.element('simulador-video').children[0].src).searchParams.get('tag'),zone.tag);
    tickTour(ui);
  }
  assert.match(ui.element('simulador-recorrido-estado').textContent,/completado.*5 \/ 5/);assert.equal(tourTimeout(ui),undefined);
  assert.equal(ui.element('simulador-recorrido-pausa').hidden,true);assert.equal(ui.element('simulador-recorrer').disabled,false);
  assert.equal(ui.storage.get(ui.zonesApi.storageKey),original);assert.equal(ui.geo.calls,0);
  ui.sim.stop();
});

test('pausar conserva paso y vídeo; reanudar espera lo que faltaba y descarta callbacks antiguos',()=>{
  const ui=tourSession();ui.element('simulador-recorrer').click();const frame=ui.element('simulador-video').children[0],late=tourTimeout(ui)[1];
  ui.advance(4000);ui.element('simulador-recorrido-pausa').click();ui.advance(20000);
  assert.match(ui.element('simulador-recorrido-estado').textContent,/pausa.*1 \/ 5/);assert.equal(tourTimeout(ui),undefined);late();assert.equal(ui.element('simulador-video').children[0],frame);
  ui.element('simulador-recorrido-pausa').click();assert.equal(ui.timerDelays.get(tourTimeout(ui)[0]),8000);assert.equal(ui.element('simulador-video').children[0],frame);
  tickTour(ui);assert.equal(ui.element('simulador-zona').textContent,'Admira University');const next=ui.element('simulador-video').children[0],lateNext=tourTimeout(ui)[1];
  ui.element('simulador-recorrido-detener').click();assert.equal(tourTimeout(ui),undefined);lateNext();assert.equal(ui.element('simulador-video').children[0],next);assert.match(ui.element('simulador-recorrido-estado').textContent,/Parada solicitada/);ui.sim.stop();
});

test('tomar el control por arrastre, mapa o acceso de zona cancela el recorrido sin reaparición tardía',()=>{
  for(const action of ['drag','map','jump','move']){
    const ui=tourSession();ui.element('simulador-recorrer').click();const late=tourTimeout(ui)[1];
    if(action==='drag'){const marker=ui.markers.find(x=>x.options.alt==='Luka · manual');marker.point={lat:41.4023751,lng:2.1519882};marker.events.drag();assert.equal(tourTimeout(ui),undefined);marker.events.dragend();}
    if(action==='map')ui.mapEvents.click({latlng:{lat:41.4023751,lng:2.1519882}});
    if(action==='jump')ui.element('simulador-ir-university').click();
    if(action==='move')ui.sim.move({lat:41.4023751,lng:2.1519882});
    assert.equal(tourTimeout(ui),undefined);assert.equal(ui.element('simulador-zona').textContent,'Admira University');late();assert.equal(ui.element('simulador-zona').textContent,'Admira University');assert.match(ui.element('simulador-recorrido-estado').textContent,/Movimiento manual/);ui.sim.stop();
  }
});

test('editar e importar detiene antes de esperar el archivo y nunca reinicia automáticamente',async()=>{
  const ui=tourSession();ui.element('simulador-recorrer').click();ui.element('simulador-editar').click();await flush();
  assert.equal(tourTimeout(ui),undefined);assert.equal(ui.element('simulador-recorrer').disabled,true);
  ui.element('simulador-editar').click();assert.equal(ui.element('simulador-recorrer').disabled,false);assert.equal(tourTimeout(ui),undefined);
  ui.element('simulador-recorrer').click();let finish;const pending=importFile(ui,{size:100,text:()=>new Promise(resolve=>finish=resolve)});
  assert.equal(tourTimeout(ui),undefined);assert.equal(ui.element('simulador-recorrer').disabled,true);
  finish(ui.zonesApi.serializeTransfer(ui.zonesApi.officePreset));await pending;assert.equal(tourTimeout(ui),undefined);assert.equal(ui.element('simulador-recorrer').disabled,false);
  ui.element('simulador-editar').click();await flush();ui.element('simulador-exportar').click();const config=JSON.parse(await ui.downloads[0].blob.text());assert.deepEqual(Object.keys(config).sort(),['outside','version','zones']);assert.doesNotMatch(JSON.stringify(config),/tour|recorrido|running|paused/);ui.sim.stop();
});

test('ocultar, abandonar o cambiar fuente cancela; volver o recargar no reanuda ni pide ubicación',()=>{
  for(const action of ['hidden','pagehide','source']){
    const ui=tourSession();ui.element('simulador-recorrer').click();const late=tourTimeout(ui)[1];
    if(action==='hidden')ui.hide();if(action==='pagehide')ui.lifecycle.pagehide();if(action==='source'){ui.sim.stop();ui.sim.start('luka');}
    assert.equal(tourTimeout(ui),undefined);ui.document.hidden=false;late();ui.sim.renderText();assert.equal(tourTimeout(ui),undefined);assert.equal(ui.geo.calls,0);
    if(action==='source'){assert.equal(ui.element('simulador-recorrer').disabled,true);ui.element('simulador-recorrer').click();assert.equal(tourTimeout(ui),undefined);}
    const fresh=mount({editor:true,browser:true,storage:ui.storage}),sim=fresh.api.create({map:fresh.map,L:fresh.L});sim.start();assert.equal(tourTimeout(fresh),undefined);assert.equal(fresh.geo.calls,0);sim.stop();ui.sim.stop();
  }
});

test('el recorrido respeta la prioridad de solapamientos y no fuerza el contenido de la zona visitada',async()=>{
  const ui=tourSession(),config=JSON.parse(JSON.stringify(ui.zonesApi.officePreset));config.zones=[config.zones[0],{...config.zones[1],lat:config.zones[0].lat,lon:config.zones[0].lon}];
  await importFile(ui,fileOf(ui.zonesApi.serializeTransfer(config)));ui.element('simulador-recorrer').click();const frame=ui.element('simulador-video').children[0];tickTour(ui);
  assert.match(ui.element('simulador-recorrido-estado').textContent,/2 \/ 2.*Admira University.*Gana Pixería por prioridad/);assert.equal(ui.element('simulador-video').children[0],frame);ui.sim.stop();
  const empty=mount({editor:true,browser:true}),sim=empty.api.create({map:empty.map,L:empty.L});sim.start();await importFile(empty,fileOf(JSON.stringify({version:1,zones:[],outside:{tag:'publicidad'}})));
  assert.equal(empty.element('simulador-recorrer').disabled,true);empty.element('simulador-recorrer').click();assert.equal(tourTimeout(empty),undefined);sim.stop();
});

const pieceRows=ui=>ui.element('simulador-piezas-lista').children;
const pieceTitle=row=>row.children[0].textContent;

test('los metadatos del catálogo son texto acotado sin enlaces, IDs ni etiquetas duplicadas',()=>{
  const ui=mount({editor:true}),rows=ui.zonesApi.catalogItems({items:[{id:'private-id',url:'javascript:alert(1)',type:'video',title:'  <img src=x>\n '+ 'a'.repeat(200),tags:['Tech','tecnología','technology',null]},{type:'image',title:{html:'bad'},tags:['retail']},{type:'link',title:'no',tags:['retail']},{type:{toString:()=> 'video'},tags:['retail']}]});
  assert.equal(rows.length,2);assert.equal(rows[0].title.length,160);assert.equal(rows[0].tags.length,1);assert.equal(rows[0].tags[0],'tecnologia');assert.equal(rows[1].title,'');
  assert.deepEqual(Object.keys(rows[0]).sort(),['tags','title','type']);assert.doesNotMatch(JSON.stringify(rows),/javascript|private-id|url/);
  assert.throws(()=>ui.zonesApi.catalogItems({items:null}));
});

test('la oficina elegida muestra hasta cinco títulos/tipos y el alcance parcial sin modificar tema ni player',async()=>{
  const items=Array.from({length:8},(_,i)=>({type:i%2?'image':'video',title:i===0?'<img src=x onerror=alert(1)>':'Pieza '+i,tags:['retail']}));
  const ui=await editorSession({fetcher:async()=>({ok:true,json:async()=>({items})})}),frame=ui.element('simulador-video').children[0];
  assert.equal(pieceRows(ui).length,5);assert.equal(pieceTitle(pieceRows(ui)[0]),'<img src=x onerror=alert(1)>');assert.equal(pieceRows(ui)[0].children.length,2);assert.equal(pieceRows(ui)[0].children[1].textContent,'Vídeo');
  assert.match(ui.element('simulador-piezas-estado').textContent,/8 coincidencias.*5/);assert.match(ui.element('simulador-piezas-ayuda').textContent,/orientativa.*300.*cinco/);assert.equal(ui.element('simulador-tema').value,'retail');assert.equal(ui.storage.size,0);assert.equal(ui.element('simulador-video').children[0],frame);assert.equal(ui.requests.length,1);
  ui.document.documentElement.lang='en';ui.sim.renderText();assert.equal(pieceRows(ui)[0].children[1].textContent,'Video');assert.match(ui.element('simulador-piezas-estado').textContent,/8 matches/);ui.sim.stop();
});

test('una respuesta tardía se aplica a la zona seleccionada en ese momento, no a la de inicio',async()=>{
  let finish;const ui=mount({editor:true,fetcher:()=>new Promise(resolve=>finish=resolve)}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();
  assert.equal(pieceRows(ui).length,0);ui.element('simulador-zona-elegida').fire('change','eixample');const frame=ui.element('simulador-video').children[0];
  finish({ok:true,json:async()=>({items:[{type:'image',title:'Retail',tags:['retail']},{type:'video',title:'Tech',tags:['technology']}]})});await flush();
  assert.match(ui.element('simulador-piezas-titulo').textContent,/Eixample/);assert.equal(pieceRows(ui).length,1);assert.equal(pieceTitle(pieceRows(ui)[0]),'Tech');assert.equal(ui.element('simulador-video').children[0],frame);assert.equal(ui.requests.length,1);sim.stop();
});

test('importar durante la consulta conserva asignaciones y usa el tema nuevo para la lista',async()=>{
  let finish;const ui=mount({editor:true,fetcher:()=>new Promise(resolve=>finish=resolve)}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();
  await importFile(ui,fileOf(ui.zonesApi.serializeTransfer(ui.zonesApi.officePreset)));
  finish({ok:true,json:async()=>({items:[{type:'video',title:'Creativa',tags:['creativity']},{type:'image',title:'Retail',tags:['retail']}]})});await flush();
  assert.match(ui.element('simulador-piezas-titulo').textContent,/Pixería/);assert.equal(pieceTitle(pieceRows(ui)[0]),'Creativa');assert.equal(ui.element('simulador-tema').value,'creatividad');assert.equal(ui.storage.size,0);
  ui.element('simulador-exportar').click();const text=await ui.downloads[0].blob.text();assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['outside','version','zones']);assert.doesNotMatch(text,/Creativa|catalogItems|piece/);sim.stop();
});

test('errores y consulta vacía limpian la muestra sin atribuir contenido ni cambiar la configuración',async()=>{
  let answer={ok:true,json:async()=>({items:[{type:'image',title:'Inicial',tags:['retail']}]})};
  const ui=await editorSession({fetcher:async()=>answer}),frame=ui.element('simulador-video').children[0];ui.element('simulador-guardar').click();const saved=ui.storage.get(ui.zonesApi.storageKey);
  answer={ok:false};ui.element('simulador-catalogo').click();await flush();assert.equal(pieceRows(ui).length,0);assert.match(ui.element('simulador-piezas-estado').textContent,/No se pudo consultar/);
  answer={ok:true,json:async()=>({items:[]})};ui.element('simulador-catalogo').click();await flush();assert.equal(pieceRows(ui).length,0);assert.match(ui.element('simulador-piezas-estado').textContent,/Sin coincidencias en esta consulta/);assert.doesNotMatch(ui.element('simulador-catalogo-estado').textContent,/no disponible/);
  assert.equal(ui.element('simulador-tema').value,'retail');assert.equal(ui.storage.get(ui.zonesApi.storageKey),saved);assert.equal(ui.element('simulador-video').children[0],frame);assert.ok(ui.requests.every(x=>x.options.method==='GET'&&x.options.credentials==='omit'));ui.sim.stop();
});

test('un tema personalizado sin coincidencias se conserva al guardar y recargar',async()=>{
  const ui=await editorSession(),config=JSON.parse(JSON.stringify(ui.zonesApi.defaults));config.zones[0].tag='canal-personal';await importFile(ui,fileOf(JSON.stringify(config)));
  assert.equal(pieceRows(ui).length,0);assert.match(ui.element('simulador-piezas-estado').textContent,/se conserva/);assert.equal(ui.element('simulador-tema').value,'canal-personal');ui.element('simulador-guardar').click();
  const restored=await editorSession({storage:ui.storage});assert.equal(restored.element('simulador-tema').value,'canal-personal');assert.equal(pieceRows(restored).length,0);ui.sim.stop();restored.sim.stop();
});

test('cerrar cancela la consulta; una respuesta anterior no sobrescribe el catálogo de la reapertura',async()=>{
  const pending=[];const ui=mount({editor:true,fetcher:()=>new Promise(resolve=>pending.push(resolve))}),sim=ui.api.create({map:ui.map,L:ui.L});sim.start();ui.element('simulador-editar').click();sim.stop();assert.equal(ui.requests[0].options.signal.aborted,true);assert.equal(ui.timers.size,0);
  sim.start();ui.element('simulador-editar').click();assert.equal(pending.length,2);pending[1]({ok:true,json:async()=>({items:[{type:'video',title:'Actual',tags:['retail']}]})});await flush();
  pending[0]({ok:true,json:async()=>({items:[{type:'image',title:'Anterior',tags:['retail']}]})});await flush();assert.equal(pieceTitle(pieceRows(ui)[0]),'Actual');sim.stop();
});
