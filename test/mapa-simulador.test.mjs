import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../pruebas/mapa/simulador.js',import.meta.url),'utf8');
const editorCode = await readFile(new URL('../pruebas/mapa/editor-zonas.js',import.meta.url),'utf8');
const fixtureCatalog = {items:[{type:'image',tags:['retail']},{type:'video',tags:['tecnología','technology']},{type:'video',tags:['creatividad','publicidad']},{type:'link',tags:['pendiente']}]};
const flush = async () => {await new Promise(setImmediate);};
function mount({editor=false,storage=new Map(),fetcher=async()=>({ok:true,json:async()=>fixtureCatalog}),storageError=false}={}) {
  const elements = new Map(), messages = [], markers = [], timers = new Map(), mapEvents = {}, requests=[];
  let serial=0;
  function node() {
    const el={hidden:true,textContent:'',value:'',attributes:{},children:[],listeners:{},classList:{add(){},remove(){}},contentWindow:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this[k];delete this.attributes[k];},appendChild(child){this.children.push(child);child.parent=this;return child;},replaceChildren(...children){this.children=[];children.forEach(child=>this.appendChild(child));},remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);},addEventListener(k,fn){this.listeners[k]=fn;},fire(k,value){if(value!==undefined)this.value=value;return this.listeners[k]?.({target:this});},click(){if(!this.disabled)return this.fire('click');}};
    Object.defineProperty(el,'id',{get(){return this.nodeId;},set(value){this.nodeId=value;elements.set(value,this);}});
    return el;
  }
  const element=id=>{if(!elements.has(id)){const el=node();el.id=id;}return elements.get(id);};
  const document = {documentElement:{lang:'es'},getElementById:element,createElement:node};
  const map = {on:(k,fn)=>mapEvents[k]=fn,off:k=>delete mapEvents[k],removeLayer(){},setView(){},panTo(){},getCenter:()=>({lat:41.396,lng:2.164})};
  const toPoint=p=>Array.isArray(p)?{lat:p[0],lng:p[1]}:{...p};
  const L = {layerGroup:()=>({addTo(){return this;},clearLayers(){}}),circle:()=>({addTo(){return this;},bindTooltip(value){this.tooltip=value;return this;},setLatLng(){return this;},setRadius(){return this;}}),divIcon:options=>options,marker:(point,options)=>{
    const marker={point:toPoint(point),options,events:{},addTo(){markers.push(this);return this;},setLatLng(point){this.point=toPoint(point);return this;},getLatLng(){return this.point;},on(k,fn){this.events[k]=fn;return this;}};return marker;
  }};
  const context = vm.createContext({document,URL,console,AbortController,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(storageError)throw new Error('quota');storage.set(key,value);}},fetch:async(url,options)=>{requests.push({url,options});return fetcher(url,options);},crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},addEventListener:(event,fn)=>{if(event==='message')messages.push(fn);},setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  context.window=context;if(editor)vm.runInContext(editorCode,context);vm.runInContext(code,context);
  return {api:context.AdmiraMapaSimulador,zonesApi:context.AdmiraMapaZonas,element,document,map,L,markers,timers,mapEvents,storage,requests,message:event=>messages.forEach(fn=>fn(event))};
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
