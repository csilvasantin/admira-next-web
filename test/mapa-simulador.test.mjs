import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../pruebas/mapa/simulador.js',import.meta.url),'utf8');
function mount() {
  const elements = new Map(), messages = [], markers = [], timers = new Map(), mapEvents = {};
  const element = id => {
    if (!elements.has(id)) elements.set(id,{hidden:true,textContent:'',attributes:{},children:[],listeners:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this[k];delete this.attributes[k];},replaceChildren(...children){this.children=children;},addEventListener(k,fn){this.listeners[k]=fn;},click(){this.listeners.click?.();}});
    return elements.get(id);
  };
  const document = {documentElement:{lang:'es'},getElementById:element,createElement:()=>({...element('template'),attributes:{},contentWindow:{}})};
  const map = {on:(k,fn)=>mapEvents[k]=fn,off:k=>delete mapEvents[k],removeLayer(){},setView(){},panTo(){}};
  const L = {layerGroup:()=>({addTo(){return this;}}),circle:()=>({addTo(){return this;},bindTooltip(){return this;}}),divIcon:options=>options,marker:(point,options)=>{
    const marker={point:{lat:point[0],lng:point[1]},options,events:{},addTo(){markers.push(this);return this;},setLatLng(point){this.point=point;return this;},getLatLng(){return this.point;},on(k,fn){this.events[k]=fn;return this;}};return marker;
  }};
  const context = vm.createContext({document,URL,console,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789abc'},addEventListener:(event,fn)=>{if(event==='message')messages.push(fn);},setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  context.window=context;vm.runInContext(code,context);
  return {api:context.AdmiraMapaSimulador,element,document,map,L,markers,timers,mapEvents,message:event=>messages.forEach(fn=>fn(event))};
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
