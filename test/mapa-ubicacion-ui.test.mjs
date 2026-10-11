import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../pruebas/mapa/mapa.js',import.meta.url),'utf8');
const NOW = Date.parse('2026-10-10T20:00:00Z');
const iso = (minutes = 0) => new Date(NOW - minutes * 60000).toISOString();
const phone = (extra = {}) => ({equipo:'iphone-carlos',nombre:'iPhone 17 Pro Max de Carlos',tipo:'movil',lat:41.39,lon:2.16,precision_m:14,bateria:78,fuente:'atajo-ios',ts:iso(5),ultimo_aviso:iso(5),...extra});
const mini = (extra = {}) => ({equipo:'mac-mini',nombre:'Mac mini',tipo:'fijo',direccion:'Gran de Gràcia 51, Barcelona',lat:41.3993419,lon:2.1559172,precision_m:null,bateria:null,fuente:'manual',ts:null,ultimo_aviso:null,...extra});
const answer = (devices, status = 200) => ({ok:status === 200,status,json:async () => ({ok:true,equipos:devices})});
const flush = async () => {await new Promise(setImmediate);await new Promise(setImmediate);};

class Element {
  constructor() {this.attributes = {};this.hidden = false;this.disabled = false;this.innerHTML = '';this.textContent = '';this.listeners = {};this.classes = new Set();this.classList = {toggle:(key,on) => on ? this.classes.add(key) : this.classes.delete(key)};}
  setAttribute(key,value) {this.attributes[key] = String(value);}
  getAttribute(key) {return this.attributes[key] ?? null;}
  addEventListener(event,callback) {(this.listeners[event] ||= []).push(callback);}
  click() {if (!this.disabled) (this.listeners.click || []).forEach((callback) => callback({target:this}));}
}

function mount(fetcher = async () => answer([phone(),mini()])) {
  const elements = new Map(), observers = [], intervals = [], requests = [], pins = [];
  const element = (id) => {if (!elements.has(id)) elements.set(id,new Element());return elements.get(id);};
  const html = new Element();html.lang = 'es';
  const document = {documentElement:html,getElementById:element,createElement:() => new Element(),addEventListener:() => {}};
  const circles = [];
  const map = {setView() {return this;},fitBounds() {},getZoom() {return 14;},on() {}};
  const group = {addTo() {return this;},clearLayers() {pins.length = 0;circles.length = 0;}};
  const L = {
    map:() => map,tileLayer:() => ({addTo() {return this;}}),circle:(latlon,options) => ({latlon,options,setRadius(value) {this.options.radius = value;},addTo() {circles.push(this);return this;}}),layerGroup:() => group,latLngBounds:(points) => points,divIcon:(options) => options,
    marker:(latlon,options) => ({latlon,options,bindPopup(popup) {this.popup = popup;return this;},addTo() {pins.push(this);return this;}})
  };
  class Clock extends Date {constructor(...args) {super(...(args.length ? args : [NOW]));} static now() {return NOW;}}
  const context = vm.createContext({document,L,Date:Clock,Intl,Map,console,AbortController,MutationObserver:class {constructor(callback) {observers.push(callback);} observe() {}},setInterval:(callback,ms) => intervals.push({callback,ms}),fetch:async (url,options) => {requests.push({url,options});return fetcher(url,options);}});
  context.window = context;
  vm.runInContext(code,context);
  return {element,requests,pins,circles,intervals,language:(lang) => {html.lang = lang;observers.forEach((callback) => callback());}};
}

test('live view has one marker per positioned device, fixed address and zero battery; names are escaped',async () => {
  const ui = mount(async () => answer([phone({nombre:'<img src=x onerror=alert(1)>',bateria:0,precision_m:0}),mini()]));
  await flush();
  assert.equal(ui.requests.length,1);
  assert.equal(ui.requests[0].url,'/api/ubicacion');
  assert.equal(ui.requests[0].options.cache,'no-store');
  assert.equal(ui.requests[0].options.credentials,'same-origin');
  assert.equal(ui.pins.length,2);
  const list = ui.element('equipos-lista').innerHTML;
  assert.match(list,/Gran de Gràcia 51, Barcelona/);
  assert.match(list,/0 %/);
  assert.match(list,/± 0 m/);
  assert.match(list,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(list,/<img/);
  assert.doesNotMatch(ui.pins[0].popup.innerHTML,/<img/);
  assert.equal(ui.element('demo-aviso').hidden,true);
});

test('over two hours is outdated, exactly two hours is fresh, no reports or coordinates create no invented point',async () => {
  const ui = mount(async () => answer([phone({ultimo_aviso:iso(121)}),mini({lat:null,lon:null})]));
  await flush();
  assert.match(ui.element('equipos-lista').innerHTML,/Desactualizado/);
  assert.match(ui.element('equipos-lista').innerHTML,/Sin coordenadas confirmadas/);
  assert.equal(ui.pins.length,1);
  assert.equal(ui.pins[0].options.icon.className,'mapa-marker is-movil is-stale');
  assert.equal(ui.circles[0].options.color,'#63e6d5');
  assert.ok(ui.circles[0].options.radius > 100);
  const exact = mount(async () => answer([phone({ultimo_aviso:iso(120)})]));
  await flush();
  assert.match(exact.element('equipos-lista').innerHTML,/Actualizado/);
  assert.doesNotMatch(exact.element('equipos-lista').innerHTML,/Desactualizado/);
  const empty = mount(async () => answer([phone({ultimo_aviso:null,ts:null,lat:null,lon:null})]));
  await flush();
  assert.match(empty.element('equipos-lista').innerHTML,/Pendiente del primer aviso/);
  assert.equal(empty.pins.length,0);
  assert.equal(empty.element('mapa-vacio').hidden,false);
});

test('demo cancels in-flight live response, makes no requests, labels every synthetic popup, and exits back to live',async () => {
  let resolveLive;
  const ui = mount(() => new Promise((resolve) => {resolveLive = resolve;}));
  ui.element('modo-demo').click();
  assert.equal(ui.requests[0].options.signal.aborted,true);
  assert.equal(ui.element('demo-aviso').hidden,false);
  assert.equal(ui.element('modo-demo').getAttribute('aria-pressed'),'true');
  assert.equal(ui.pins.length,2);
  assert.ok(ui.pins.every((pin) => /DEMO/.test(pin.popup.innerHTML)));
  resolveLive(answer([phone({nombre:'SECRET LIVE POSITION'})]));
  await flush();
  assert.doesNotMatch(ui.element('equipos-lista').innerHTML,/SECRET LIVE POSITION/);
  ui.element('refrescar').click();
  ui.intervals.find((item) => item.ms === 60000).callback();
  assert.equal(ui.requests.length,1,'demo refresh and timer do not request live positions');
  ui.element('modo-real').click();
  assert.equal(ui.requests.length,2);
  assert.equal(ui.element('demo-aviso').hidden,true);
  assert.equal(ui.pins.length,0,'synthetic pins are immediately cleared on returning to live');
  resolveLive(answer([mini()]));
  await flush();
  assert.equal(ui.pins.length,1);
  assert.match(ui.element('mapa-origen').textContent,/Datos reales/);
});

test('expired Google session clears previously loaded positions and offers the private sign-in route',async () => {
  let count = 0;
  const ui = mount(async () => ++count === 1 ? answer([phone(),mini()]) : answer([],401));
  await flush();
  assert.equal(ui.pins.length,2);
  ui.element('refrescar').click();
  await flush();
  assert.equal(ui.pins.length,0);
  assert.equal(ui.element('mapa-error').hidden,false);
  assert.match(ui.element('mapa-error').innerHTML,/href="\/pruebas\/mapa\/"/);
  assert.doesNotMatch(ui.element('equipos-lista').innerHTML,/iPhone 17/);
  assert.doesNotMatch(ui.element('equipos-lista').innerHTML,/Esperando datos/);
  assert.match(ui.element('equipos-lista').innerHTML,/Inicia sesión para ver los equipos/);
});

test('a fixture inside real data is labelled test data and does not raise a real stale warning',async () => {
  const ui = mount(async () => answer([phone({fuente:'fixture-no-iphone',ultimo_aviso:iso(400)})]));
  await flush();
  const list = ui.element('equipos-lista').innerHTML;
  assert.match(list,/Dato de prueba/);
  assert.doesNotMatch(list,/Desactualizado/);
  assert.equal(ui.pins[0].options.icon.iconSize[0],32);
  assert.equal(ui.pins[0].options.icon.className,'mapa-marker is-movil is-prueba');
  assert.match(ui.pins[0].popup.innerHTML,/Dato de prueba/);
  assert.match(ui.pins[0].options.icon.html,/mapa-pin-nombre/);
  assert.equal(ui.circles[0].options.color,'#ffbd69');
  assert.ok(ui.circles[0].options.radius > 100);
});

test('language changes rerender live metadata, device details, popup text and demo controls',async () => {
  const ui = mount(async () => answer([phone({ultimo_aviso:iso(130)}),mini()]));
  await flush();
  ui.language('en');
  assert.match(ui.element('equipos-lista').innerHTML,/Outdated/);
  assert.match(ui.element('equipos-lista').innerHTML,/Last report/);
  assert.match(ui.element('equipos-lista').innerHTML,/Fixed · manual address/);
  assert.match(ui.element('mapa-estado').textContent,/Last checked/);
  assert.match(ui.pins[0].popup.innerHTML,/Outdated/);
  ui.element('modo-demo').click();
  assert.match(ui.element('mapa-origen').textContent,/Synthetic/);
  assert.match(ui.element('equipos-lista').innerHTML,/Test data/);
  ui.language('es');
  assert.match(ui.element('mapa-origen').textContent,/Sintético/);
  assert.match(ui.element('equipos-lista').innerHTML,/Último aviso/);
});
