// /bugito (Carlos, 14-oct-2026, DCL-5da4653d859552490fd5ae1d): Bugito es Admirito con piel de diablillo, el
// creador de incidencias del banco de pruebas de admira.biz. Mismo cargador (assets/avatar.js) y mismo camino
// que /admirito (avatarRun) desde el ⌘ Experto de las cinco patas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const experto = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const avatar = readFileSync(join(dir, '../assets/avatar.js'), 'utf8');

function cargador() {
  const module = { exports: {} };
  vm.runInNewContext(avatar, { module, globalThis: {}, window: undefined });
  return module.exports;
}
const A = cargador();

test('el cargador reconoce /bugito y su argumento, sin tocar /admirito', () => {
  assert.equal(A.decide('/bugito'), 'bugito');
  assert.equal(A.decide('/Bugito popup'), 'bugito');
  assert.equal(A.decide('bugito girar'), 'bugito');
  assert.equal(A.decide('/admirito'), 'mascota');
  assert.equal(A.decide('/bugitos'), null);
  assert.equal(A.bugitoArg('/bugito'), '');
  assert.equal(A.bugitoArg('/bugito Ábrela a medias'), 'abrela-a-medias');
  assert.equal(A.bugitoArg('/bugito popup-encima'), 'popup-encima');
  assert.equal(A.bugitoArg('/bugito <script>alert(1)</script>'), 'script-alert-1-script');
  assert.equal(A.bugitoArg('/admirito'), null);
});

test('Bugito es la cara de Admirito con ?personaje=bugito, y no un nivel más', () => {
  assert.equal(A.BUGITO, 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito');
  assert.equal(A.bugitoUrl({ lang: 'en', loc: 'x' }), 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito&lang=en&tier=good');
  assert.equal(A.bugitoUrl({}), 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito&tier=good');
  assert.equal('bugito' in A.LEVELS, false, 'nunca pasa a ser la cara por defecto de un sitio');
  assert.equal(A.pickLevel('bugito', '', ''), 'good');
});

test('el banco de pruebas de admira.biz, con la incidencia sólo preseleccionada', () => {
  assert.equal(A.BUGITO_BANCO, 'https://www.admira.biz/bugito.html');
  assert.equal(A.bugitoBanco('', 'es'), 'https://www.admira.biz/bugito.html?lang=es');
  assert.equal(A.bugitoBanco('popup', 'en'), 'https://www.admira.biz/bugito.html?lang=en&incidencia=popup');
  assert.equal(A.bugitoBanco('mal&x=1', 'xx'), 'https://www.admira.biz/bugito.html');
  assert.match(A.message('bugito-ir', false), /banco de pruebas en admira\.biz/);
  assert.match(A.message('bugito-ir', true), /test bench on admira\.biz/);
  // run(): /<personaje> va por personajeRun → en su página, el gancho (AdmiraBugito); fuera, su página.
  assert.match(avatar, /if \(Object\.prototype\.hasOwnProperty\.call\(PERSONAJES, mode\)\) return personajeRun\(mode, personajeArg\(mode, text\) \|\| ''\);/);
  assert.match(avatar, /var B = root\[PERSONAJES\[id\]\.gancho\]/);
  assert.match(avatar, /if \(B && typeof B\.toggle === 'function' && typeof B\.lanzar === 'function'\) \{\n      try \{ return arg \? B\.lanzar\(arg\) : B\.toggle\(\); \}/);
  assert.match(avatar, /root\.location\.assign\(personajePagina\(id, arg, english \? 'en' : 'es'\)\);/);
});

// ── El verbo en el ⌘ Experto compartido ──
function consola({ AdmiraAvatar = null, AdmiraBugito = null, lang = 'es' } = {}) {
  const documentElement = { lang, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const fuera = [];
  const document = {
    documentElement, currentScript: { dataset: {} }, readyState: 'complete',
    querySelector: () => null, querySelectorAll: () => [],
    createElement: (tag) => ({ tagName: String(tag).toUpperCase(), classList: { add() {}, contains: () => false, toggle() {} }, setAttribute() {}, getAttribute: () => null,
      appendChild() {}, style: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', children: [], insertBefore() {}, removeAttribute() {} }),
    addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} }, dispatchEvent() {},
  };
  const location = { hostname: 'www.admira.store', host: 'www.admira.store', href: 'https://www.admira.store/', pathname: '/', search: '', hash: '', origin: 'https://www.admira.store', assign: (u) => fuera.push(u) };
  const storage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    dispatchEvent() {}, addEventListener() {}, MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } }, Event: class { constructor(t) { this.type = t; } },
    fetch: async () => ({ ok: false, json: async () => ({}) }), setTimeout: (f) => { f(); return 0; }, clearTimeout() {},
  };
  if (AdmiraAvatar) sandbox.AdmiraAvatar = AdmiraAvatar;
  if (AdmiraBugito) sandbox.AdmiraBugito = AdmiraBugito;
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(experto, sandbox, { filename: 'experto.js' });
  const log = { children: [], tagName: 'OL', querySelector: () => null, insertBefore(x) { this.children.unshift(x); }, appendChild(x) { this.children.push(x); }, removeChild() {}, get firstChild() { return this.children[0]; }, scrollTop: 0, scrollHeight: 0 };
  return { api: sandbox.AdmiraExperto, fuera, run: (t) => sandbox.AdmiraExperto.exec(t, log, { echo: false }), texto: () => log.children.map((li) => li.textContent).join('\n') };
}

test('/bugito está en el ⌘ Experto y en /help, en castellano y en inglés', async () => {
  const c = consola();
  assert.equal(c.api.has('bugito'), true);
  await c.run('/help');
  assert.match(c.texto(), /\/bugito/);
  assert.match(c.texto(), /banco de pruebas/);
  const en = consola({ lang: 'en' });
  await en.run('/help');
  assert.match(en.texto(), /Bugito's test bench/);
});

test('/bugito va por el mismo camino que /admirito: el cargador avatar.js', async () => {
  const llamadas = [];
  const AdmiraAvatar = { floatingCharacters:true,handle: (t) => { llamadas.push(t); return Promise.resolve(t === '/bugito popup' ? 'Bugito: ¡Popup va!' : 'ok'); }, personaje: (id) => (id === 'bugito' ? { url() {} } : null) };
  const c = consola({ AdmiraAvatar });
  await c.run('/bugito popup');
  await c.run('/admirito');
  assert.deepEqual(llamadas, ['/bugito popup', '/admirito']);
  assert.match(c.texto(), /¡Popup va!/);
  assert.match(experto, /var AVATAR_SRC = 'https:\/\/www\.admiranext\.com\/assets\/avatar\.js\?v=20261014-floating-bugito-2';/, 'carga el avatar.js que actualiza cargadores antiguos sin duplicar el dock');
});

test('con un avatar.js anterior (sin Bugito): en el banco usa la página; fuera, abre el banco', async () => {
  const viejo = { handle: () => Promise.resolve('Usa /avatar avatar…') };
  const pedidos = [];
  const enBanco = consola({ AdmiraAvatar: viejo, AdmiraBugito: { toggle: () => 'Bugito oculto', lanzar: (x) => { pedidos.push(x); return 'Lanzado ' + x; } } });
  await enBanco.run('/bugito');
  await enBanco.run('/bugito popup');
  assert.deepEqual(pedidos, ['popup']);
  assert.match(enBanco.texto(), /Recarga/);
  const fuera = consola({ AdmiraAvatar: viejo });
  await fuera.run('/bugito');
  assert.equal(fuera.fuera.length,0,'bare Bugito never navigates through an older loader');
  await fuera.run('/bugito full');
  await fuera.run('/bugito Ábrela a medias');
  assert.deepEqual(fuera.fuera, ['https://www.admira.biz/bugito.html?lang=es', 'https://www.admira.biz/bugito.html?lang=es&incidencia=abrela-a-medias'], 'la incidencia viaja preseleccionada');
  // Una página con toggle pero sin lanzar no es el banco: no se llama a lo que no existe, se abre el banco.
  const cojo = consola({ AdmiraAvatar: viejo, AdmiraBugito: { toggle: () => 'x' } });
  await cojo.run('/bugito popup');
  assert.deepEqual(cojo.fuera, ['https://www.admira.biz/bugito.html?lang=es&incidencia=popup']);
  assert.match(fuera.texto(), /abriendo su banco de pruebas/);
});

test('en piel (la pata conserva su CLI), la suite intercepta /bugito igual que /demo e /idioma', () => {
  const i = experto.indexOf('function sharedCommand(');
  const cuerpo = experto.slice(i, experto.indexOf('\n  }', i));
  assert.match(cuerpo, /PERSONAJE_RE\.test\(t\)/);
  assert.match(experto, /var PERSONAJE_RE = new RegExp\('\^\\\\\/\(' \+ PERSONAJES_SUITE\.map/);
  assert.match(experto, /if \(!val \|\| \(!adapterOwnsInput && !cfg\.mount && !sharedCommand\(val\)\)\) return;/);
});

test('personajes: una tabla en el cargador y otra en la suite; añadir el Arquitecto es una entrada', () => {
  assert.deepEqual(Object.keys(A.PERSONAJES), ['bugito', 'arquitecto'], 'el Arquitecto llegó con su entrada (DCL-66d9ae0d5e756d0067127f24)');
  assert.equal(A.PERSONAJES.bugito.gancho, 'AdmiraBugito');
  assert.equal(A.personajeUrl('bugito', { lang: 'es' }), 'https://digitalavatar.ai/nube.html?dock=1&personaje=bugito&lang=es&tier=good');
  assert.equal(A.personajeUrl('pirata', {}), '', 'un personaje sin entrada no tiene cara');
  assert.equal(A.personajeArg('bugito', '/bugito Gira'), 'gira');
  assert.equal(A.personajeArg('bugito', '/admirito gira'), null);
  assert.equal(A.decide('/pirata'), null);
  assert.match(experto, /var PERSONAJES_SUITE = \[\n    \{name: 'bugito', gancho: 'AdmiraBugito', pagina: 'https:\/\/www\.admira\.biz\/bugito\.html'/);
  assert.match(experto, /PERSONAJES_SUITE\.forEach\(function \(p\) \{\n    verb\(\{name: p\.name, args: p\.args, desc: p\.desc, run: function \(a, log\) \{ return personajeRun\(p, a, log\); \}\}\);/);
});

// ── avatar.js con DOM: run() síncrono y sin promesas sueltas; handle() con el texto final ──
function cargadorConDom(AdmiraBugito) {
  const navegacion = [];
  const document = { readyState: 'loading', currentScript: null, documentElement: { lang: 'es' }, getElementById: () => null, addEventListener() {}, createElement: () => ({}) };
  const window = { document, location: { host: 'www.admira.biz', origin: 'https://www.admira.biz', assign: (u) => navegacion.push(u) }, addEventListener() {} };
  if (AdmiraBugito) window.AdmiraBugito = AdmiraBugito;
  vm.runInNewContext(avatar, { window, document, URL, Promise, WeakMap, Map });
  return { A: window.AdmiraAvatar, navegacion };
}
test('AdmiraAvatar.run(/bugito x) no devuelve una promesa sin manejar; handle() da el texto final', async () => {
  const sueltas = [];
  const oyente = (e) => sueltas.push(e);
  process.on('unhandledRejection', oyente);
  try {
    const falla = cargadorConDom({ toggle: () => 'Bugito a la vista.', lanzar: () => Promise.reject(new Error('mando caído')) });
    const r = falla.A.run('/bugito popup');
    assert.equal(typeof r, 'string', 'run() es síncrono');
    assert.equal(r, 'Bugito: lanzando «popup» en el banco…');
    assert.equal(await falla.A.handle('/bugito popup'), 'Bugito no ha podido hacerlo: mira el estado del banco.');
    assert.match(falla.A.run('/bugito avanzado'), /abriendo su banco de pruebas/);
    const bien = cargadorConDom({ toggle: () => 'Bugito escondido.', lanzar: (x) => Promise.resolve('Bugito lanza «' + x + '».') });
    assert.equal(await bien.A.handle('/bugito medias'), 'Bugito lanza «medias».');
    assert.match(await bien.A.handle('/bugito full'), /abriendo su banco de pruebas/);
    const lanzaRompe = cargadorConDom({ toggle: () => '', lanzar: () => { throw new Error('x'); } });
    assert.equal(lanzaRompe.A.run('/bugito popup'), 'Bugito no ha podido hacerlo: mira el estado del banco.');
    const fuera = cargadorConDom(null);
    assert.match(fuera.A.run('/bugito resolución'), /abriendo su banco/);
    assert.deepEqual(fuera.navegacion, ['https://www.admira.biz/bugito.html?lang=es&incidencia=resolucion']);
    await new Promise((ok) => setImmediate(ok));
    assert.equal(sueltas.length, 0, 'ningún rechazo sin manejar');
  } finally { process.off('unhandledRejection', oyente); }
});

test('bare Bugito is floating; full and avanzado select the bench explicitly',()=>{for(const arg of ['', 'on','off'])assert.equal(A.personajeMode('bugito',arg),'floating');for(const arg of ['full','avanzado','advanced'])assert.equal(A.personajeMode('bugito',arg),'full');assert.equal(A.personajeMode('bugito','popup'),'action');assert.equal(A.personajeMode('arquitecto',''),'action');});

test('floating Bugito changes the mascot in place, toggles, and restores Admirito without navigation',async()=>{
 const navigations=[],nodes=new Map();
 const node=()=>({style:{},attrs:{},classList:{values:new Set(),add(x){this.values.add(x);},remove(x){this.values.delete(x);},contains(x){return this.values.has(x);}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},querySelector(){return null;}});
 const wrap=node(),bubble=node(),frame=node(),panel=node();wrap.querySelector=()=>frame;
 for(const [id,n]of [['da-suite',wrap],['da-suite-bubble',bubble],['da-suite-frame',frame],['da-suite-panel',panel]])nodes.set(id,n);
 const document={readyState:'loading',currentScript:null,documentElement:{lang:'es',style:{setProperty(){},getPropertyValue(){return '';}}},getElementById:id=>nodes.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const window={document,innerWidth:1280,innerHeight:800,location:{host:'admira.studio',origin:'https://admira.studio',assign:u=>navigations.push(u)},addEventListener(){}};
 vm.runInNewContext(avatar,{window,document,URL,Promise,WeakMap,Map});
 assert.match(await window.AdmiraAvatar.handle('/bugito'),/flotando/);assert.equal(wrap.attrs['data-personaje'],'bugito');assert.match(bubble.innerHTML,/#ee3434/);assert.equal(wrap.style.display,'');assert.equal(wrap.classList.contains('open'),false);assert.deepEqual(navigations,[]);
 assert.match(await window.AdmiraAvatar.handle('/bugito'),/oculto/);assert.equal(wrap.style.display,'none');
 await window.AdmiraAvatar.handle('/bugito on');await window.AdmiraAvatar.handle('/admirito');assert.equal(wrap.attrs['data-personaje'],'');assert.match(bubble.innerHTML,/#689840/);assert.deepEqual(navigations,[]);
 await window.AdmiraAvatar.handle('/bugito avanzado');assert.deepEqual(navigations,['https://www.admira.biz/bugito.html?lang=es']);
});
test('shared dock height starts at a writable minimum and clamps manual resizing to the viewport',()=>{const c=consola();assert.equal(c.api.height(),52);assert.equal(c.api.resize(0),52);assert.equal(c.api.resize(300),300);assert.equal(c.api.resize(100000),680);assert.equal(c.api.resize(-100),52);});

test('a cached avatar is upgraded in place without another dock or demo listener',async()=>{
 const navigations=[],delegated=[],events=[],nodes=new Map();
 const node=()=>({style:{},attrs:{},listeners:{},classList:{values:new Set(),add(x){this.values.add(x);},remove(x){this.values.delete(x);},contains(x){return this.values.has(x);}},setAttribute(k,v){this.attrs[k]=v;},hasAttribute(k){return k in this.attrs;},removeAttribute(k){delete this.attrs[k];},addEventListener(k,fn){this.listeners[k]=fn;},querySelector(){return null;}});
 const wrap=node(),bubble=node(),frame=node(),panel=node();wrap.querySelector=()=>frame;
 for(const [id,n]of [['da-suite',wrap],['da-suite-bubble',bubble],['da-suite-frame',frame],['da-suite-panel',panel]])nodes.set(id,n);
 const document={readyState:'complete',currentScript:null,documentElement:{lang:'es',style:{setProperty(){},getPropertyValue(){return '';}}},getElementById:id=>nodes.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){throw Error('No new boot listener');},createElement(){throw Error('No new dock or styles');}};
 const original={handle:t=>{delegated.push(t);return Promise.resolve('legacy:'+t);},run:t=>'legacy:'+t,show(){wrap.style.display='';wrap.classList.remove('open');},hide(){wrap.style.display='none';wrap.classList.remove('open');},context:()=>({lang:'es',brand:'starbucks'}),personaje:id=>id==='arquitecto'?{legacy:true}:null,level:'best'};
 const window={AdmiraAvatar:original,AvatarDigital:{handle:original.handle},document,innerWidth:1280,innerHeight:800,location:{host:'admira.store',origin:'https://admira.store',assign:u=>navigations.push(u)},addEventListener:name=>events.push(name)};
 vm.runInNewContext(avatar,{window,document,URL,Promise,WeakMap,Map});
 assert.equal(window.AdmiraAvatar,original);assert.equal(original.floatingCharacters,true);assert.deepEqual(events,['admira:expert-resize']);assert.equal(original.level,'best');
 assert.match(await original.handle('/bugito'),/flotando/);assert.equal(wrap.attrs['data-personaje'],'bugito');assert.deepEqual(navigations,[]);
 let stopped=false;bubble.listeners.click({preventDefault(){},stopImmediatePropagation(){stopped=true;}});assert.equal(stopped,true);assert.match(frame.src,/personaje=bugito/);assert.equal(original.context().brand,'starbucks');
 await original.handle('/admirito');assert.equal(wrap.attrs['data-personaje'],'');assert.match(bubble.innerHTML,/#689840/);
 assert.equal(await original.handle('/avatar'), 'legacy:/avatar');assert.deepEqual(delegated,['/avatar']);assert.equal(original.personaje('arquitecto').legacy,true);assert.equal(window.AvatarDigital.handle,original.handle);
 await original.handle('/bugito full');assert.deepEqual(navigations,['https://www.admira.biz/bugito.html?lang=es']);
 vm.runInNewContext(avatar,{window,document,URL,Promise,WeakMap,Map});assert.deepEqual(events,['admira:expert-resize'],'reloading the new asset does not upgrade twice');
});
