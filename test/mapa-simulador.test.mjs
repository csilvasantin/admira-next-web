import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../pruebas/mapa/simulador.js',import.meta.url),'utf8');
const editorCode = await readFile(new URL('../pruebas/mapa/editor-zonas.js',import.meta.url),'utf8');
const fixtureCatalog = {items:[{type:'image',tags:['retail']},{type:'video',tags:['tecnología','technology']},{type:'video',tags:['creatividad','publicidad']},{type:'link',tags:['pendiente']}]};
const flush = async () => {await new Promise(setImmediate);};
const lukaFix=(extra={})=>({equipo:'luka',tipo:'smarttag2',nombre:'Luka',fuente:'smartthings-find',lat:41.4043,lon:2.1582,precision_m:10,ts:new Date().toISOString(),...extra});

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
function mount({editor=false,storage=new Map(),fetcher=async()=>({ok:true,json:async()=>fixtureCatalog}),storageError=false}={}) {
  const elements = new Map(), messages = [], markers = [], timers = new Map(), mapEvents = {}, requests=[], downloads=[], blobs=new Map();
  let serial=0;
  function node() {
    const el={hidden:true,textContent:'',value:'',attributes:{},children:[],listeners:{},classList:{add(){},remove(){}},contentWindow:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this[k];delete this.attributes[k];},appendChild(child){if(child.parent)child.parent.children=child.parent.children.filter(item=>item!==child);this.children.push(child);child.parent=this;return child;},replaceChildren(...children){this.children=[];children.forEach(child=>this.appendChild(child));},remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);},addEventListener(k,fn){this.listeners[k]=fn;},fire(k,value){if(value!==undefined)this.value=value;return this.listeners[k]?.({target:this});},click(){if(this.disabled)return;if(this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});return this.fire('click');}};
    Object.defineProperty(el,'id',{get(){return this.nodeId;},set(value){this.nodeId=value;elements.set(value,this);}});
    return el;
  }
  const element=id=>{if(!elements.has(id)){const el=node();el.id=id;}return elements.get(id);};
  const document = {documentElement:{lang:'es'},getElementById:element,createElement:node,body:node()};
  const map = {on:(k,fn)=>mapEvents[k]=fn,off:k=>delete mapEvents[k],removeLayer(){},setView(){},panTo(){},getCenter:()=>({lat:41.396,lng:2.164})};
  const toPoint=p=>Array.isArray(p)?{lat:p[0],lng:p[1]}:{...p};
  const L = {layerGroup:()=>({addTo(){return this;},clearLayers(){}}),circle:()=>({addTo(){return this;},bindTooltip(value){this.tooltip=value;return this;},setLatLng(){return this;},setRadius(){return this;}}),divIcon:options=>options,marker:(point,options)=>{
    const marker={point:toPoint(point),options,events:{},addTo(){markers.push(this);return this;},setLatLng(point){this.point=toPoint(point);return this;},getLatLng(){return this.point;},on(k,fn){this.events[k]=fn;return this;}};return marker;
  }};
  class FixtureURL extends URL {static createObjectURL(blob){const key='blob:fixture-'+blobs.size;blobs.set(key,blob);return key;}static revokeObjectURL(key){blobs.delete(key);}}
  const context = vm.createContext({document,URL:FixtureURL,Blob,TextEncoder,console,AbortController,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(storageError)throw new Error('quota');storage.set(key,value);}},fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},addEventListener:(event,fn)=>{if(event==='message')messages.push(fn);},setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  context.window=context;if(editor)vm.runInContext(editorCode,context);vm.runInContext(code,context);
  return {api:context.AdmiraMapaSimulador,zonesApi:context.AdmiraMapaZonas,element,document,map,L,markers,timers,mapEvents,storage,requests,downloads,message:event=>messages.forEach(fn=>fn(event))};
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
