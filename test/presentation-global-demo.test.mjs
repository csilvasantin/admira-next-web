import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizarDemoProject} from '../subdemos/presentacion.mjs';
import {demoGlobalHTML} from '../subdemos/demo-player.mjs';
import {onRequestGet as demo} from '../functions/presentaciones/[client]/demo.js';
import {onRequestGet as offline} from '../functions/presentaciones/[client]/offline.js';
import {onRequest as gate} from '../functions/presentaciones/_middleware.js';
import {makeIdentityToken} from '../functions/presentaciones/_access.js';

const origin = 'https://www.admiranext.test';
const parseData = html => JSON.parse(html.match(/<script type="application\/json" id="demo-data">([\s\S]*?)<\/script>/)[1]);
const playerSource = readFileSync(new URL('../subdemos/demo-player.js', import.meta.url), 'utf8');
let realFetch, calls;
beforeEach(() => {realFetch = globalThis.fetch; calls = []; globalThis.fetch = async input => {calls.push(String(input)); throw Error('Unexpected network');};});
afterEach(() => {globalThis.fetch = realFetch; assert.deepEqual(calls, [], 'recorrido y descarga no generan ni consultan proveedores');});

class KV {
  constructor(values = {}) {this.values = new Map(Object.entries(values).map(([k, v]) => [k, JSON.stringify(v)])); this.gets = [];}
  async get(key, options) {this.gets.push(key); const v = this.values.get(key); return v == null ? null : options?.type === 'json' ? JSON.parse(v) : v;}
  async put(key, value) {this.values.set(key, String(value));}
}
const studio = JSON.parse(readFileSync(new URL('../subdemos/studio.subdemos.json', import.meta.url), 'utf8'));
const alsea = () => normalizarDemoProject({...normalizarDemoProject(undefined, {slug: 'alsea', displayName: 'Alsea'}), catalogo: [studio]}, {slug: 'alsea', displayName: 'Alsea'});
const envFor = project => ({PRESENTATION_IDEAS: new KV({'presentation:alsea': {displayName: 'Alsea', passwordVerifier: 'PRIVATE-DEMO-VERIFIER', ownerEmail: 'private@test.invalid', demoProject: project}})});
const frozen = value => {if (value && typeof value === 'object') {Object.values(value).forEach(frozen); Object.freeze(value);} return value;};

class Element {
  constructor(tag = 'div') {this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.textContent = ''; this.disabled = false; this.attributes = {};}
  append(...children) {this.children.push(...children);}
  appendChild(child) {this.append(child);}
  replaceChildren(...children) {this.children = [...children];}
  addEventListener(name, fn) {this.listeners[name] = fn;}
  setAttribute(name, value) {this.attributes[name] = String(value); this[name] = String(value);}
  removeAttribute(name) {delete this.attributes[name]; delete this[name];}
  pause() {this.paused = true;}
  scrollIntoView() {}
}
function descendants(root) {return root.children.flatMap(child => [child, ...descendants(child)]);}
function runPlayer(data, hash = '') {
  const nodes = new Map();
  const get = id => {if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id);};
  get('demo-data').textContent = JSON.stringify(data);
  const navigations = [], requests = [], externalActions = [];
  const document = {getElementById: get, createElement: tag => new Element(tag),
    querySelectorAll: selector => [...nodes.values()].flatMap(descendants).filter(el => selector === 'audio,video' && ['AUDIO', 'VIDEO'].includes(el.tagName))};
  const sandbox = {document, location: {hash, assign: url => navigations.push(url)}, history: {replaceState() {}},
    fetch: (...args) => requests.push(args), AdmiraExperto: {exec: (...args) => externalActions.push(args)},
    URL, encodeURIComponent, decodeURIComponent, console};
  sandbox.window = sandbox;
  vm.runInNewContext(playerSource, sandbox, {filename: 'demo-player.js'});
  return {nodes, get, navigations, requests, externalActions,
    click(id) {get(id).listeners.click?.();},
    select(index) {get('demo-select').value = String(index); get('demo-select').listeners.change();}};
}

test('Alsea conserva 18 selecciones y proyecta sus 15 funciones con medios y variantes capturados', () => {
  const project = frozen(alsea()), before = JSON.stringify(project), data = parseData(demoGlobalHTML(project));
  assert.equal(project.demos.length, 18);
  assert.equal(project.documentacion.length, 18);
  assert.deepEqual(data.demos.map(d => d.clave), [
    'biz/proyecto', 'biz/circuito', 'biz/gemelo', 'biz/iot', 'biz/itil',
    'store/voz', 'store/musica', 'store/imagenes', 'store/video', 'store/tpv',
    'studio/voz', 'studio/musica', 'studio/imagen', 'studio/video', 'studio/adaptar',
  ]);
  assert.equal(data.demos.filter(d => d.muestra?.url).length, 9);
  const formats = data.demos.find(d => d.clave === 'studio/adaptar').muestra.variantes;
  assert.deepEqual(formats.map(v => v.formato), ['1920x1080', '1080x1920', '1080x1080', '1920x540']);
  for (const d of data.demos) {
    const snapshot = project.documentacion.find(s => s.clave === d.clave);
    assert.deepEqual(d.guion, snapshot.guion || []);
    assert.deepEqual(d.muestra, snapshot.muestra || null);
    assert.deepEqual(d.caso, snapshot.caso || null);
  }
  assert.equal(JSON.stringify(project), before, 'render no modifica el snapshot congelado');
});

test('render API usa el snapshot guardado y escapa HTML/JSON sin exponer verifier u otros campos', async () => {
  const project = alsea();
  project.nombre = '</script><script>pwn()</script> & Café';
  project.nota = 'Notas: </script><img src=x onerror=pwn()>';
  const firstFunction = project.documentacion.find(d => d.clave.includes('/'));
  firstFunction.guion = [{accion: 'clic', selector: '#danger', texto: '<button onclick=pwn()>Solo mostrar</button>'}];
  const response = await demo({params: {client: 'alsea'}, env: envFor(project)});
  assert.equal(response.status, 200);
  const html = await response.text();
  const data = parseData(html);
  assert.equal(data.nombre, project.nombre);
  assert.equal(data.nota, project.nota);
  assert.deepEqual(data.demos[0].guion, firstFunction.guion);
  assert.match(html, /&lt;\/script&gt;&lt;script&gt;pwn\(\)&lt;\/script&gt; &amp; Café/);
  assert.doesNotMatch(html, /<script>pwn|<img src=x|PRIVATE-DEMO-VERIFIER|passwordVerifier|ownerEmail/);
  assert.equal((html.match(/<script(?:\s|>)/g) || []).length, 2);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /frame-src 'none'/);
});

test('player presenta acciones como texto de solo lectura, navega pasos y no ejecuta la función online', () => {
  const data = {demos: [{clave: 'store/custom', titulo: 'Caso <img onerror=bad()>', desc: 'Sin alta', url: 'https://www.admira.store/', cmd: '/publish',
    guion: [{accion: 'clic', selector: '#publish', texto: 'Primero revisar'}, {accion: 'escribe', selector: '#form', texto: 'Segundo revisar'}],
    caso: {nombre: '<script>bad()</script>'}, muestra: {tipo: 'audio', url: 'https://media.test/prepared.mp3'}}]};
  const player = runPlayer(data);
  assert.equal(player.get('demo-title').textContent, data.demos[0].titulo);
  assert.equal(player.get('instruction').textContent, 'Primero revisar');
  assert.equal(player.get('previous-step').disabled, true);
  player.click('next-step');
  assert.equal(player.get('instruction').textContent, 'Segundo revisar');
  assert.equal(player.get('next-step').disabled, true);
  assert.equal(player.get('native').href, 'https://www.admira.store/');
  assert.ok(descendants(player.get('case-fields')).some(e => e.textContent.includes('<script>bad()</script>')));
  assert.ok(descendants(player.get('case-fields')).every(e => !['INPUT', 'FORM', 'BUTTON'].includes(e.tagName)));
  assert.deepEqual(player.navigations, []);
  assert.deepEqual(player.requests, []);
  assert.deepEqual(player.externalActions, []);
});

test('player reproduce adaptaciones MP4 con controles nativos y conserva los cuatro formatos', () => {
  const data = parseData(demoGlobalHTML(alsea()));
  const player = runPlayer(data, '#studio%2Fadaptar');
  const media = descendants(player.get('sample')).filter(e => ['VIDEO', 'AUDIO', 'IMG'].includes(e.tagName));
  assert.equal(media.filter(e => e.tagName === 'VIDEO').length, 5, 'máster y cuatro variantes de vídeo');
  assert.ok(media.filter(e => e.tagName === 'VIDEO').every(e => e.controls === true));
  assert.ok(!media.some(e => e.tagName === 'IMG' && /\.mp4(?:$|[?#])/.test(e.src || '')));
  const sample = data.demos.find(d => d.clave === 'studio/adaptar').muestra;
  for (const v of sample.variantes) assert.ok(media.some(e => e.src === v.url));
});

test('player bloquea enlaces ejecutables y medios inseguros, permitiendo rutas relativas del paquete offline', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>bad()</script>', 'http://unsafe.test/file', '//external.test/file']) {
    const player = runPlayer({demos: [{clave: 'store/custom', titulo: 'Test', url, guion: [], muestra: {tipo: 'video', url, poster: url, variantes: [{url, nombre: 'unsafe'}]}}]});
    assert.ok(!player.get('native').href || player.get('native').href === '#', 'no enlace ejecutable: ' + url);
    const media = descendants(player.get('sample')).filter(e => ['VIDEO', 'AUDIO', 'IMG'].includes(e.tagName));
    assert.ok(media.every(e => !e.src || e.src !== url));
  }
  const player = runPlayer({demos: [{clave: 'studio/video', titulo: 'Offline', url: 'https://www.admira.studio/video.html', guion: [], muestra: {tipo: 'video', url: 'media/1234567890abcdef.mp4', poster: 'media/1234567890abcdef.jpg'}}]});
  assert.ok(descendants(player.get('sample')).some(e => e.tagName === 'VIDEO' && e.src === 'media/1234567890abcdef.mp4' && e.poster === 'media/1234567890abcdef.jpg'));
});

test('proyecto vacío y ausencia de snapshot se muestran sin recuperar otro catálogo', async () => {
  const empty = normalizarDemoProject({demos: []}, {slug: 'alsea'}), data = parseData(demoGlobalHTML(empty));
  assert.deepEqual(data.demos, []);
  const player = runPlayer(data);
  assert.match(player.get('demo-title').textContent, /no tiene subdemos/);
  for (const id of ['previous-step', 'next-step', 'previous-demo', 'next-demo']) assert.equal(player.get(id).disabled, true);
  assert.equal((await demo({params: {client: 'alsea'}, env: envFor(null)})).status, 404);
  assert.equal((await demo({params: {client: 'missing'}, env: envFor(alsea())})).status, 404);
});

test('offline devuelve exactamente el objeto R2 autorizado con MIME, tamaño y nombre ZIP/PDF', async () => {
  for (const format of ['zip', 'pdf']) {
    const bytes = format === 'zip' ? new Uint8Array([0x50, 0x4b, 3, 4, 0, 255]) : new TextEncoder().encode('%PDF-1.7\nprepared');
    const gets = [], env = {PRESENTATION_MEDIA: {async get(key) {gets.push(key); return {body: bytes, size: bytes.length};}}};
    const response = await offline({params: {client: 'alsea'}, env, request: new Request(origin + '/presentaciones/alsea/offline?format=' + format + '&key=presentations/other/private')});
    assert.equal(response.status, 200);
    assert.deepEqual(gets, ['presentations/alsea/offline/paquete.' + format]);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.equal(response.headers.get('content-type'), format === 'zip' ? 'application/zip' : 'application/pdf');
    assert.equal(response.headers.get('content-length'), String(bytes.length));
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="alsea.' + format + '"');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
  }
});

test('offline limita el formato y el cliente antes de leer R2; ZIP por defecto y ausente 404', async () => {
  const gets = [], env = {PRESENTATION_MEDIA: {async get(key) {gets.push(key); return null;}}};
  for (const client of ['../other', 'alsea/other', 'alsea%2fother', 'alsea\r\nInjected', 'a'.repeat(64)]) {
    assert.equal((await offline({params: {client}, env, request: new Request(origin + '/presentaciones/test/offline')})).status, 400);
    assert.equal((await demo({params: {client}, env: envFor(alsea())})).status, 400);
  }
  for (const format of ['html', '../private', 'PDF', 'zip%2fother']) assert.equal((await offline({params: {client: 'alsea'}, env, request: new Request(origin + '/presentaciones/alsea/offline?format=' + encodeURIComponent(format))})).status, 400);
  assert.deepEqual(gets, []);
  assert.equal((await offline({params: {client: 'alsea'}, env, request: new Request(origin + '/presentaciones/alsea/offline')})).status, 404);
  assert.deepEqual(gets, ['presentations/alsea/offline/paquete.zip']);
});

test('middleware protege recorrido y offline con la sesión del cliente, también contra cookies de otro cliente', async () => {
  const key = 'global-demo-gate-test-key', exp = Math.floor(Date.now() / 1000) + 120;
  const token = async client => {
    const signing = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', signing, new TextEncoder().encode(client + ':' + exp))).toString('base64url');
    return exp + '.' + sig;
  };
  const identity = await makeIdentityToken(key, {name: 'Demo Viewer', email: 'viewer@test.invalid'});
  for (const endpoint of ['demo', 'offline?format=zip']) {
    const env = {...envFor(alsea()), PRES_SIGNING_KEY: key, PRES_ALSEA: 'fixture-password'};
    for (const cookie of ['', 'pres_other=' + await token('other') + '; pres_identity=' + identity]) {
      let passed = false;
      const response = await gate({env, data: {}, request: new Request(origin + '/presentaciones/alsea/' + endpoint, {headers: {Cookie: cookie, Accept: 'text/html'}}), waitUntil() {}, next() {passed = true; return new Response('PRIVATE CONTENT');}});
      assert.equal(response.status, 401);
      assert.equal(passed, false);
      assert.doesNotMatch(await response.text(), /PRIVATE CONTENT|PRIVATE-DEMO-VERIFIER/);
    }
    let passed = false;
    const pending = [];
    const response = await gate({env, data: {}, request: new Request(origin + '/presentaciones/alsea/' + endpoint, {headers: {Cookie: 'pres_alsea=' + await token('alsea') + '; pres_identity=' + identity, Accept: 'text/html'}}), waitUntil(p) {pending.push(p);}, next() {passed = true; return new Response('PRIVATE CONTENT');}});
    await Promise.all(pending);
    assert.equal(response.status, 200);
    assert.equal(passed, true);
    assert.equal(await response.text(), 'PRIVATE CONTENT');
  }
});

test('director recorre Biz → Studio → Store, conserva pausa y finaliza sin solicitudes externas', () => {
  let clock = 0, serial = 0; const timers = new Map();
  const nodes = new Map(); const get = id => {if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  get('auto-duration').value='5';
  get('demo-data').textContent=JSON.stringify({demos:[
    {clave:'store/tpv',titulo:'TPV',guion:['Caja','Resultado'],muestra:{tipo:'video',url:'media/1234567890abcdef.webm'}},
    {clave:'studio/voz',titulo:'Voz',guion:['Guion','Escuchar'],muestra:{tipo:'audio',url:'media/1234567890abcdef.mp3'}},
    {clave:'biz/proyecto',titulo:'Proyecto',guion:['Proyecto','Circuito']}
  ]});
  let plays = 0; Element.prototype.play=function(){this.paused=false;plays++;return Promise.resolve();};
  const events={},requests=[];
  const document={getElementById:get,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>events[name]=fn,
    querySelectorAll:()=>[...nodes.values()].flatMap(descendants).filter(el=>['AUDIO','VIDEO'].includes(el.tagName))};
  const sandbox={document,location:{hash:''},history:{replaceState(){}},URL,encodeURIComponent,decodeURIComponent,console,
    Date:{now:()=>clock},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id),fetch:(...a)=>requests.push(a)};
  sandbox.window=sandbox;vm.runInNewContext(playerSource,sandbox);
  const click=id=>get(id).listeners.click();
  const advance=ms=>{const target=clock+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();}clock=target;};
  click('auto-start');assert.equal(get('demo-title').textContent,'Proyecto');advance(20000);const progress=get('auto-progress').value;
  click('auto-pause');advance(70000);assert.equal(get('demo-title').textContent,'Proyecto');assert.equal(get('auto-progress').value,progress);
  click('auto-pause');advance(30000);assert.equal(get('instruction').textContent,'Circuito');
  advance(50000);assert.equal(get('demo-title').textContent,'Voz');assert.equal(plays,0,'muestra espera su fase de escucha');
  advance(50000);assert.ok(plays>0);assert.ok(document.querySelectorAll().every(el=>el.muted));
  click('auto-pause');assert.ok(document.querySelectorAll().every(el=>el.paused));click('auto-pause');
  advance(50000);assert.equal(get('demo-title').textContent,'TPV');advance(100000);
  assert.match(get('auto-status').textContent,/Recorrido completo/);assert.equal(get('auto-progress').value,100);assert.equal(timers.size,0);
  click('auto-start');advance(10000);click('auto-stop');advance(300000);assert.match(get('auto-status').textContent,/Detenido/);assert.equal(timers.size,0);
  click('auto-start');document.hidden=true;events.visibilitychange();assert.match(get('auto-status').textContent,/pausa/);assert.deepEqual(requests,[]);
  delete Element.prototype.play;
});
