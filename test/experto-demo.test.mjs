// /demo · las cinco soluciones de la suite.
// Parse de /idioma · /language (Carlos, 5-oct-2026): toggle, ESP/ENG, typos y pegados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../suite/experto.js'), 'utf8');
const snap = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function withLang(initial, hostname = 'www.admiranext.com', savedManifests = null, clock = null, mockedFetch = null) {
  const makeElement = tag => {
    const el = {tagName:String(tag).toUpperCase(),children:[],attrs:{},style:{},textContent:'',paused:true,ended:false,listeners:{},
      classList:{add(){},contains:()=>false,toggle(){},remove(){}},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k] ?? null;},removeAttribute(k){delete this.attrs[k];},
      appendChild(child){if(child.parentNode)child.parentNode.removeChild(child);child.parentNode=this;this.children.push(child);},removeChild(child){this.children=this.children.filter(c=>c!==child);child.parentNode=null;},insertBefore(){},addEventListener(type,fn){this.listeners[type]=fn;},load(){this.ended=false;this.loads=(this.loads||0)+1;},
      play(){this.plays=(this.plays||0)+1;this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
      querySelectorAll(selector){const tags=selector.split(',').map(t=>t.trim().toUpperCase()),all=[];const walk=node=>node.children.forEach(c=>{if(tags.includes(c.tagName))all.push(c);walk(c);});walk(this);return all;},
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    };return el;
  };
  const body=makeElement('body'),head=makeElement('head');
  const documentElement = { lang: initial, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const document = {
    documentElement,
    currentScript: { dataset: {} },
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: id => {const find=node=>node.id===id?node:node.children.map(find).find(Boolean);return find(body)||find(head)||null;},
    createElement: makeElement,
    addEventListener() {},
    removeEventListener() {},
    head,body,
    dispatchEvent() {},
  };
  const location = { hostname, host: hostname, href: 'https://' + hostname + '/', pathname: '/', search: '', hash: '', origin: 'https://' + hostname, assign() {} };
  const storage = { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
  if (savedManifests) storage.setItem('ax-subdemos-manifiestos', JSON.stringify(savedManifests));
  const root = {
    document, location,
    localStorage: storage, sessionStorage: storage,
    dispatchEvent() {}, addEventListener() {},
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class CustomEvent { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
    Event: class Event { constructor(t) { this.type = t; } },
    URL, fetch: mockedFetch || (async () => ({ ok: false, json: async () => ({}) })),
    setTimeout:clock?.setTimeout || ((fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;}), clearTimeout:clock?.clearTimeout || clearTimeout,
    Date:clock ? class extends Date {static now(){return clock.now();}} : Date,
  };
  const sandbox = {
    ...root, window: null, globalThis: null, document, location,
    localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    fetch: root.fetch, setTimeout:root.setTimeout, clearTimeout:root.clearTimeout,
    MutationObserver: root.MutationObserver, CustomEvent: root.CustomEvent, Event: root.Event,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, documentElement, setLang: sandbox.AdmiraSetLanguage, sandbox, storage, location };
}

test('Pixeria novedades se abre en ES/EN sin desplazar las cinco demos existentes', () => {
  for (const hostname of ['www.admiranext.com','www.pixeria.com','admira.studio','www.admira.store']) {
    const {api} = withLang('es', hostname);
    const es=api.parseDemo('/demo pixeria novedades'), en=api.parseDemo('/demo pixeria updates');
    assert.equal(es.id,'pixeria-novedades-20261009');
    assert.equal(new URL(es.url).pathname,'/demo/pixeria-novedades/');
    assert.equal(new URL(es.url).searchParams.get('lang'),'es');
    assert.equal(new URL(en.url).searchParams.get('lang'),'en');
    assert.equal(api.parseDemo('/demo studio novedades').id,es.id);
    assert.equal(api.parseDemo('/demo pixeria').id,'studio');
    assert.notEqual(api.parseDemo('/demo 1').id,es.id);
  }
});


// /demo de las cinco soluciones (Carlos, 7-oct-2026, demo Alsea · Starbucks).
test('parseDemo: lista, soluciones, alias, números y siguiente', () => {
  const { api } = withLang('es');
  assert.deepEqual(snap(api.parseDemo('/demo')), { lista: true });
  assert.deepEqual(snap(api.parseDemo('/demo lista')), { lista: true });
  assert.equal(api.parseDemo('/demo store').id, 'store');
  assert.equal(api.parseDemo('/demo admira.studio').id, 'studio');
  assert.equal(api.parseDemo('/demo yokup').id, 'app');
  assert.equal(api.parseDemo('/demo 5').id, 'biz');
  assert.equal(api.parseDemo('/demo TV').id, 'tv');
  // admiranext.com no es ninguna de las cinco: siguiente = la primera.
  assert.equal(api.parseDemo('/demo siguiente').id, 'studio');
  // Lo que no es de la suite sigue siendo de la pata (/demo tpv, /demo off).
  assert.equal(api.parseDemo('/demo tpv'), null);
  assert.equal(api.parseDemo('/demo off'), null);
  assert.equal(api.parseDemo('/demos'), null);
  assert.match(api.parseDemo('/demo store').url, /admira-xp\/.*loc=alsea-sbux-021.*demo=tpv/);
});

test('Store importado desde editor: manifiesto mínimo mantiene activación y solo sus funciones personalizadas', async () => {
  const canonical = JSON.parse(readFileSync(join(dir, '../subdemos/store.subdemos.json'), 'utf8'));
  const original = JSON.stringify(canonical);
  const imported = {version: 1, plataforma: 'store', subdemos: [{id: 'promocion', nombre: 'Promoción personalizada', url: 'https://www.admira.store/admira-xp/?demo=promocion'}]};
  const {api, storage} = withLang('es', 'www.admira.store', {store: imported});
  await api.listo();
  assert.equal(api.plataforma(), 'store');
  assert.deepEqual(snap(api.subdemos().activacion.hosts), canonical.activacion.hosts);
  assert.equal(api.subdemos().default_mode, 'recorrido');
  assert.deepEqual(snap(api.subdemos().subdemos.map(d => d.id)), ['promocion']);
  assert.equal(api.parseDemo('/demo 1').id, 'store/promocion');
  assert.equal(api.parseDemo('/demo promocion').id, 'store/promocion');
  assert.deepEqual(snap(api.parseDemo('/demo 2')), {desconocida: '2'});
  assert.deepEqual(snap(api.parseDemo('/demo voz')), {desconocida: 'voz'});
  const lines = [];
  api.exec('/demo help', {appendChild: li => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0});
  assert.match(lines.join('\n'), /\/demo 1 · \/demo promocion — Promoción personalizada/);
  assert.doesNotMatch(lines.join('\n'), /Gestión de locuciones|Gestión del TPV/);
  assert.deepEqual(JSON.parse(storage.getItem('ax-subdemos-manifiestos')), {store: imported}, 'no añade metadatos ni alias al objeto guardado');
  assert.equal(JSON.stringify(canonical), original);
  assert.deepEqual(snap(withLang('es', 'www.admira.store').api.subdemos()), canonical, 'una sesión sin override conserva el catálogo publicado');
});

test('Store importado vacío: permanece vacío sin resucitar el fallback ni números globales', async () => {
  const imported = {version: 1, plataforma: 'store', subdemos: []};
  const {api, storage} = withLang('es', 'admira.store', {store: imported});
  await api.listo();
  assert.deepEqual(snap(api.subdemos().subdemos), []);
  for (let repeat = 0; repeat < 2; repeat++) {
    await api.listo();
    assert.deepEqual(snap(api.parseDemo('/demo help')), {lista: true, local: true});
    for (const arg of ['1', '5', 'voz']) assert.deepEqual(snap(api.parseDemo('/demo ' + arg)), {desconocida: arg});
    assert.equal(api.parseDemo('/demo tpv'), null, 'el comando nativo no depende del catálogo local');
    assert.equal(api.parseDemo('/demo studio').id, 'studio');
    const lines = [];
    api.exec('/demo help', {appendChild: li => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0});
    assert.match(lines.join('\n'), /Demos de admira\.store/);
    assert.doesNotMatch(lines.join('\n'), /\/demo [1-5] ·/);
  }
  assert.deepEqual(JSON.parse(storage.getItem('ax-subdemos-manifiestos')), {store: imported});
});

test('demos: cinco soluciones en orden y URL en inglés', () => {
  const { api, documentElement } = withLang('en');
  const list = api.demos();
  assert.deepEqual(snap(list.map((d) => d.id)), ['studio', 'store', 'tv', 'app', 'biz']);
  assert.equal(list[0].url, 'https://www.admira.studio/');
  assert.match(list[1].url, /lang=en/);
  documentElement.lang = 'es';
  assert.match(api.demos()[1].url, /lang=es/);
});

test('/demo como verbo: lista y navegación', async () => {
  const { api, location } = withLang('es');
  const lines = [];
  const log = { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 };
  let went = '';
  location.assign = (u) => { went = u; };
  api.exec('/demo', log);
  assert.ok(lines.some((l) => /1 \/demo studio/.test(l)) && lines.some((l) => /5 \/demo biz/.test(l)));
  api.exec('/demo 2', log);
  await new Promise((r) => setTimeout(r, 700));
  assert.match(went, /admira\.store\/admira-xp\//);
});

// Subdemos locales de admira.studio / pixeria.com (encargos de Trinity: /demo 1…5 de la plataforma, no globales).
const manifest = JSON.parse(readFileSync(join(dir, '../subdemos/studio.subdemos.json'), 'utf8'));
const HOSTS = ['admira.studio', 'www.admira.studio', 'pixeria.com', 'www.pixeria.com'];

test('resolverDemo: batería de verificar-studio-comandos.mjs (Trinity) contra la copia de experto.js', () => {
  const { api } = withLang('es');
  const resolverDemo = api.resolverDemo;
  for (const host of HOSTS) {
    for (const [index, demo] of manifest.subdemos.entries()) {
      for (const command of [demo.cmd, ...demo.aliases.map((alias) => '/demo ' + alias)]) {
        const result = resolverDemo(command, manifest, host);
        assert.equal(result.clave, 'studio/' + demo.id);
        assert.equal(result.modo, 'muestra');
        assert.equal(result.demo, demo);
      }
      assert.equal(resolverDemo('/demo ' + (index + 1), manifest, host).demo, demo);
    }
    for (const text of ['/demo help', ' /DEMO HELP ', '/demo']) {
      const help = resolverDemo(text, manifest, host);
      assert.equal(help.tipo, 'ayuda');
      assert.deepEqual(snap(help.opciones.map((o) => o.id)), ['voz', 'musica', 'imagen', 'video', 'adaptar']);
    }
    for (const [text, id] of [[' /DEMO LOCUCIÓN ', 'voz'], ['/demo MÚSICA', 'musica'], ['/demo VÍDEO', 'video']]) {
      assert.equal(resolverDemo(text, manifest, host).demo.id, id);
    }
    for (const text of ['/demo 0', '/demo 6', '/demo 01', '/demo 1 extra', '/demo anonymizer', '/demo toString']) {
      assert.equal(resolverDemo(text, manifest, host).tipo, 'desconocido');
    }
  }
  assert.equal(resolverDemo('/demo help', manifest, 'www.admira.tv').tipo, 'otra_plataforma');
  assert.equal(resolverDemo('/demo 1', manifest, 'pixeria.com.ejemplo.com').tipo, 'otra_plataforma');
  assert.equal(resolverDemo('/demografia', manifest, HOSTS[0]).tipo, 'no_demo');
  assert.equal(resolverDemo('hola', manifest, HOSTS[0]).tipo, 'no_demo');
});

test('admira.studio y pixeria.com: /demo 1…5 son locales, help solo lista Studio, nombres globales siguen', () => {
  for (const host of HOSTS) {
    const { api } = withLang('es', host);
    assert.equal(api.plataforma(), 'studio');
    assert.deepEqual(snap(api.parseDemo('/demo help')), { lista: true, local: true });
    assert.deepEqual(snap(api.parseDemo('/demo')), { lista: true, local: true });
    assert.deepEqual(snap(api.parseDemo('/demo ayuda')), { lista: true, local: true });
    const ids = ['voz', 'musica', 'imagen', 'video', 'adaptar'];
    ids.forEach((id, k) => assert.equal(api.parseDemo('/demo ' + (k + 1)).id, 'studio/' + id));
    assert.equal(api.parseDemo('/demo locución').id, 'studio/voz');
    assert.equal(api.parseDemo('/demo Voz').id, 'studio/voz');
    assert.equal(api.parseDemo('/demo formatos').id, 'studio/adaptar');
    assert.equal(api.parseDemo('/demo 5').local, true);
    assert.deepEqual(snap(api.parseDemo('/demo 6')), { desconocida: '6' });
    assert.equal(api.parseDemo('/demo store').id, 'store');
    assert.equal(api.parseDemo('/demo biz').id, 'biz');
  }
  const pix = withLang('es', 'pixeria.com').api;
  assert.equal(pix.parseDemo('/demo 1').url, 'https://www.pixeria.com/audio.html');
  assert.equal(withLang('es', 'www.admira.studio').api.parseDemo('/demo 1').url, 'https://www.admira.studio/audio.html');
  // En las plataformas sin manifiesto, los números siguen siendo las cinco soluciones.
  assert.equal(withLang('es', 'www.admira.tv').api.plataforma(), null);
  assert.equal(withLang('es', 'www.admira.tv').api.parseDemo('/demo 1').id, 'studio');
});

for (const plataforma of ['store', 'biz']) {
  const negocio = JSON.parse(readFileSync(join(dir, '../subdemos/' + plataforma + '.subdemos.json'), 'utf8'));
  test(plataforma + ': números y alias locales, ayuda y salida a otras plataformas', () => {
    for (const host of negocio.activacion.hosts) {
      const {api} = withLang('es', host);
      assert.equal(api.plataforma(), plataforma);
      assert.deepEqual(snap(api.subdemos()), negocio, 'fallback incorporado igual al manifiesto');
      for (const arg of ['', 'help', 'ayuda', '?', 'lista', 'list']) {
        assert.deepEqual(snap(api.parseDemo('/demo ' + arg)), {lista: true, local: true});
      }
      for (const [i, demo] of negocio.subdemos.entries()) {
        for (const command of [demo.cmd, ...demo.aliases.map(a => '/demo ' + a)]) {
          const parsed = api.parseDemo(command);
          if (plataforma === 'store' && command === '/demo tpv') {
            assert.equal(parsed, null, 'tpv se delega al motor físico');
          } else {
            assert.equal(parsed.id, plataforma + '/' + demo.id);
            assert.equal(parsed.i, i);
            assert.equal(parsed.local, true);
          }
          const resolved = api.resolverDemo(command, negocio, host);
          assert.equal(resolved.clave, plataforma + '/' + demo.id);
          assert.equal(resolved.modo, 'recorrido');
        }
      }
      for (const other of ['studio', 'store', 'biz', 'tv', 'app']) {
        assert.equal(api.parseDemo('/demo ' + other).id, other);
      }
      if (plataforma === 'store') {
        for (const native of ['tpv', 'off', 'stop', 'estado', 'status', 'tpv off', 'tpv stop', 'tpv estado', 'tpv status']) {
          assert.equal(api.parseDemo('/demo ' + native), null, 'el control nativo del TPV sigue disponible: ' + native);
        }
        assert.equal(api.parseDemo('/demo 5').id, 'store/tpv');
        assert.equal(api.parseDemo('/demo caja').id, 'store/tpv');
        assert.match(api.parseDemo('/demo caja').url, /[?&]demo=tpv#tpv$/);
      }
      for (const arg of ['0', '6', '01', '1 extra', 'toString']) {
        assert.deepEqual(snap(api.parseDemo('/demo ' + arg)), {desconocida: arg.toLowerCase()});
      }
      assert.equal(api.resolverDemo('/demo 1', negocio, host + '.ejemplo.com').tipo, 'otra_plataforma');
    }
  });
  test(plataforma + ': ayuda explica solo sus recorridos y demo muestra sin navegar', () => {
    const {api, location} = withLang('es', negocio.activacion.hosts[0]);
    const lines = [];
    const log = {appendChild: li => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0};
    const navigation = [];
    location.assign = u => navigation.push(u);
    api.exec('/demo help', log);
    assert.match(lines.join('\n'), new RegExp('Demos de admira\\.' + plataforma));
    for (const [i, d] of negocio.subdemos.entries()) {
      assert.ok(lines.join('\n').includes('/demo ' + (i + 1) + ' · /demo ' + d.aliases[0] + ' — ' + d.nombre));
    }
    const result = api.demo('/demo 5', log);
    assert.equal(result.id, plataforma + '/' + negocio.subdemos[4].id);
    assert.ok(lines.some(l => l.includes('Recorrido preparado')));
    assert.deepEqual(navigation, []);
  });
}

test('XpaceOS con y sin www ofrece los cinco recorridos Store y conserva el TPV físico', () => {
  for (const host of ['xpaceos.com', 'www.xpaceos.com']) {
    const {api} = withLang('es', host);
    assert.equal(api.plataforma(), 'store');
    assert.deepEqual(snap(api.parseDemo('/demo help')), {lista: true, local: true});
    assert.deepEqual([1, 2, 3, 4, 5].map(n => api.parseDemo('/demo ' + n).id), ['store/voz', 'store/musica', 'store/imagenes', 'store/video', 'store/tpv']);
    assert.equal(api.parseDemo('/demo tpv'), null);
    assert.equal(api.parseDemo('/demo caja').id, 'store/tpv');
    const lines = [];
    api.exec('/demo help', {appendChild: li => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0});
    assert.match(lines.join('\n'), /\/demo 5 · \/demo caja — Gestión del TPV/);
    assert.doesNotMatch(lines.join('\n'), /\/demo 5 · \/demo tpv/);
  }
});

test('/demo help en admira.studio lista solo las cinco de Studio; el texto común devuelve qué se enseña', () => {
  const { api } = withLang('es', 'www.admira.studio');
  const lines = [];
  const log = { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 };
  api.exec('/demo help', log);
  const txt = lines.join('\n');
  assert.match(txt, /\/demo 1 · \/demo locucion — Crear locución/);
  assert.match(txt, /\/demo 5 · \/demo adaptar — Adaptar formatos/);
  assert.doesNotMatch(txt, /\/demo tv|admira\.tv/);
  const r = api.demo('/demo 3', log);
  assert.equal(r.id, 'studio/imagen');
  assert.equal(api.demo('hola', log), null);
});

test('manifiesto incorporado = pack de Trinity (ids, alias, muestra como objeto)', () => {
  const { api } = withLang('es', 'admira.studio');
  const m = api.subdemos();
  assert.deepEqual(snap(m.activacion.hosts), manifest.activacion.hosts);
  m.subdemos.forEach((d, k) => {
    const t = manifest.subdemos[k];
    assert.equal(d.id, t.id); assert.equal(d.url, t.url);
    assert.deepEqual(snap(d.aliases), t.aliases);
    assert.equal(typeof d.muestra, 'object');
    assert.equal(d.muestra.url, t.muestra.url);
    assert.match(d.muestra.url, /^https:\/\/www\.pixeria\.com\/assets\/demos\/studio-v1\//);
    assert.equal(d.muestra.variantes.length, t.muestra.variantes.length);
  });
});

test('manifiesto publicado con muestras en admira.studio: se reescriben a www.pixeria.com (allí dan 404)', async () => {
  const pub = JSON.parse(JSON.stringify(manifest).replaceAll('https://www.pixeria.com/assets/demos/', 'https://www.admira.studio/assets/demos/'));
  const h = withLang('es', 'www.admira.studio');
  h.sandbox.fetch = undefined;
  const { api } = (() => {
    const src2 = src.replace("typeof fetch !== 'function'", "false");
    const sb = h.sandbox; sb.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(pub)) });
    vm.runInNewContext(src2, sb, { filename: 'experto.js' });
    return { api: sb.AdmiraExperto };
  })();
  await api.listo();
  const m = api.subdemos();
  const urls = m.subdemos.flatMap((d) => [d.muestra.url, d.muestra.poster, ...(d.muestra.variantes || []).flatMap((v) => [v.url, v.poster])]).filter(Boolean);
  assert.ok(urls.length >= 10);
  assert.ok(urls.every((u) => !/admira\.studio\/assets\/demos/.test(u)), urls.join('\n'));
});

function rehearsalClock() {
  let now=0,id=0;const pending=new Map(),cancelled=[];
  return {now:()=>now,setTimeout:(fn,ms)=>{const key=++id;pending.set(key,{fn,at:now+ms});return key;},clearTimeout:key=>{if(pending.has(key))cancelled.push(pending.get(key).fn);pending.delete(key);},
    advance(ms){const end=now+ms;let count=0;for(;;){const due=[...pending.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;assert.ok(++count<1000,'finite rehearsal');now=due[1].at;pending.delete(due[0]);due[1].fn();}now=end;},
    flushCancelled(){cancelled.splice(0).forEach(fn=>fn());},pending:()=>pending.size};
}

for (const [platform,host] of [['store','www.admira.store'],['biz','www.admira.biz'],['studio','www.admira.studio']]) {
  test(platform+': native auto walks all five, pauses with remaining time, stops stale callbacks and keeps backend untouched', async()=>{
    const canonical=JSON.parse(readFileSync(join(dir,'../subdemos/'+platform+'.subdemos.json'),'utf8'));
    const clock=rehearsalClock(),requests=[];
    const {api,sandbox,location}=withLang('es',host,null,clock,async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>structuredClone(canonical)};});
    await api.listo();
    assert.equal(requests.length,1);assert.equal(requests[0].url,'https://www.admiranext.com/subdemos/'+platform+'.subdemos.json');assert.equal(requests[0].options.cache,'no-store');
    assert.ok(api.subdemos().subdemos.every(d=>d.guion.length>1),'full manifest scripts load on each native host');
    const navigation=[];location.assign=url=>navigation.push(url);
    const lines=[],log={appendChild:li=>lines.push(li.textContent),children:[]};
    assert.deepEqual(snap(api.parseDemo('/demo auto')),{auto:true,local:true});
    api.demo('/demo auto',log);await Promise.resolve();assert.equal(api.demoEstado().total,5);assert.equal(api.demoEstado().fase,1);
    const firstModal=sandbox.document.getElementById('ax-demo-muestra');assert.ok(firstModal);assert.equal(firstModal.querySelectorAll('audio,video').every(el=>el.paused),true,'media does not play in preparation phase');
    clock.advance(1000);api.demo('/demo pausa',log);const paused=snap(api.demoEstado());clock.advance(120000);assert.deepEqual(snap(api.demoEstado()),paused);
    api.demo('/demo reanudar',log);const interval=Math.max(1800,Math.min(30000,(Number(canonical.subdemos[0].duracion)||40)*1000/canonical.subdemos[0].guion.length));
    clock.advance(interval-1001);assert.equal(api.demoEstado().fase,1);clock.advance(1);assert.equal(api.demoEstado().fase,2,'resume preserves remaining phase time');
    const media=firstModal.querySelectorAll('audio,video'),clip=media.find(el=>el.src===canonical.subdemos[0].video.url),originals=media.filter(el=>el!==clip);assert.ok(clip);assert.equal(originals.every(el=>el.muted&&el.paused),true,'original samples remain manual and initially silent');assert.equal(clip.muted,false,'prepared function video sound is enabled by default');assert.equal(clip.paused,true,'clip does not start before final phase');
    if(platform==='studio'){
      assert.equal(media.every(el=>el.paused),true,'Studio does not play media early');
      while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente',log);
      assert.equal(clip.paused,false,'Studio plays the prepared function reel at the final phase');assert.equal(originals.every(el=>el.paused),true,'original results remain manual');
    }
    const keys=new Set([api.demoEstado().demo]);
    while(api.demoEstado().activo){api.demo('/demo siguiente',log);keys.add(api.demoEstado().demo);}
    assert.deepEqual([...keys],canonical.subdemos.map(d=>platform+'/'+d.id));assert.equal(api.demoEstado().numero,5);assert.equal(clock.pending(),0);
    assert.equal(sandbox.document.getElementById('ax-demo-muestra').querySelectorAll('audio,video').every(el=>el.paused),true,'completion stops media');
    api.demo('/demo todas',log);api.demo('/demo stop',log);clock.flushCancelled();clock.advance(600000);assert.deepEqual(snap(api.demoEstado()),{activo:false});assert.equal(sandbox.document.getElementById('ax-demo-muestra'),null);
    assert.equal(requests.length,1,'rehearsal adds no network calls');assert.deepEqual(navigation,[]);
    if(platform==='store'){assert.equal(api.parseDemo('/demo tpv'),null);assert.equal(api.parseDemo('/demo stop'),null,'inactive stop returns to native TPV');assert.equal(api.parseDemo('/demo estado'),null);}
  });
}

test('paused next crosses demo boundary without restarting, and an empty custom catalog stays empty',()=>{
  const clock=rehearsalClock(),{api}=withLang('es','www.admira.store',null,clock);
  api.demo('/demo auto');api.demo('/demo pausa');for(let i=0;i<4;i++)api.demo('/demo siguiente');
  assert.equal(api.demoEstado().numero,2);assert.equal(api.demoEstado().pausado,true);assert.equal(api.demoEstado().fase,1);
  clock.advance(600000);assert.equal(api.demoEstado().fase,1);api.demo('/demo resume');clock.advance(14999);assert.equal(api.demoEstado().fase,1);clock.advance(1);assert.equal(api.demoEstado().fase,2);api.demo('/demo stop');
  const empty=withLang('es','www.admira.biz',{biz:{version:1,plataforma:'biz',subdemos:[]}},rehearsalClock()).api;
  assert.equal(empty.demo('/demo auto'),null);assert.deepEqual(snap(empty.demoEstado()),{activo:false});
});

test('listening unmutes only the first adaptation variant and remains selected across pause/resume',()=>{
  const clock=rehearsalClock(),{api,sandbox}=withLang('es','www.admira.studio',null,clock);
  api.demo('/demo 5');while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente');
  const modal=sandbox.document.getElementById('ax-demo-muestra'),media=modal.querySelectorAll('video').filter(el=>!/assets\/demos\/suite-v1\//.test(el.src)),sound=modal.querySelector('input');
  assert.equal(media.length,4);assert.equal(media.every(el=>el.muted),true);
  sound.checked=true;sound.onchange();assert.deepEqual(media.map(el=>el.muted),[false,true,true,true]);
  api.demo('/demo pausa');api.demo('/demo reanudar');assert.equal(sound.checked,true);assert.deepEqual(media.map(el=>el.muted),[false,true,true,true]);
  sound.checked=false;sound.onchange();assert.equal(media.every(el=>el.muted),true);api.demo('/demo stop');
});

for(const platform of ['store','biz','studio'])test(platform+': all five native function clips reuse one element and actual ended owns final advance',async()=>{
 const m=JSON.parse(readFileSync(join(dir,'../subdemos/'+platform+'.subdemos.json'),'utf8')),clock=rehearsalClock(),{api,sandbox}=withLang('es','www.admira.'+platform,{[platform]:m},clock);
 const modal=()=>sandbox.document.getElementById('ax-demo-muestra'),movie=()=>modal().querySelectorAll('video').find(el=>/assets\/demos\/suite-v1\//.test(el.src));api.demo('/demo auto');await Promise.resolve();const persistent=movie();assert.ok(persistent);assert.equal(persistent.paused,true);
 const ids=[];for(let i=0;i<5;i++){
  const d=m.subdemos[i],interval=Math.max(1800,Math.min(30000,(Number(d.duracion)||40)*1000/d.guion.length));assert.equal(movie(),persistent);assert.equal(movie().src,d.video.url);ids.push(api.demoEstado().demo);
  clock.advance(interval*(d.guion.length-1)+1);assert.equal(api.demoEstado().fase,d.guion.length);assert.equal(persistent.paused,false);assert.equal(persistent.muted,false);
  const ended=persistent.onended;clock.advance(120000);assert.equal(api.demoEstado().numero,i+1,'timer does not complete unfinished video');assert.equal(api.demoEstado().activo,true);
  persistent.ended=true;ended();if(i<4){assert.equal(api.demoEstado().numero,i+2);assert.equal(persistent.ended,false);ended();assert.equal(api.demoEstado().numero,i+2,'old video callback cannot skip new function');}else{assert.equal(api.demoEstado().activo,false);ended();assert.equal(api.demoEstado().numero,5);}
 }
 assert.deepEqual(ids,m.subdemos.map(d=>platform+'/'+d.id));assert.equal(clock.pending(),0);api.demo('/demo stop');if(platform==='store')assert.equal(api.parseDemo('/demo tpv'),null);
});
test('native video pause/resume retains position, stop rejects stale errors and mute persists without playing original samples',async()=>{
 const m=JSON.parse(readFileSync(join(dir,'../subdemos/store.subdemos.json'),'utf8')),clock=rehearsalClock(),{api,sandbox,storage}=withLang('es','www.admira.store',{store:m},clock);
 api.demo('/demo auto');await Promise.resolve();while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente');const modal=sandbox.document.getElementById('ax-demo-muestra'),media=modal.querySelectorAll('audio,video'),clip=media.find(el=>el.src===m.subdemos[0].video.url),ended=clip.onended,error=clip.onerror;clip.currentTime=11;
 api.demo('/demo pausa');assert.equal(clip.paused,true);clip.ended=true;ended();assert.equal(api.demoEstado().numero,1);assert.equal(api.demoEstado().pausado,true);clip.ended=false;api.demo('/demo reanudar');assert.equal(clip.currentTime,11);assert.equal(clip.paused,false);
 const mute=modal.querySelectorAll('button').find(el=>el.textContent==='Silenciar todo');mute.onclick();assert.equal(clip.muted,true);assert.equal(JSON.parse(storage.getItem('admira-demo-audio-v1')).muted,true);clip.muted=false;clip.onvolumechange();assert.equal(clip.muted,true);
 assert.equal(media.filter(el=>el!==clip).every(el=>el.paused),true);api.demo('/demo stop');ended();error();assert.deepEqual(snap(api.demoEstado()),{activo:false});api.demo('/demo auto');await Promise.resolve();ended();error();assert.equal(api.demoEstado().numero,1);assert.equal(api.demoEstado().fase,1);api.demo('/demo stop');
});
test('native invalid video and format failure stay incomplete and offer explicit retry',async()=>{
 const canonical=JSON.parse(readFileSync(join(dir,'../subdemos/store.subdemos.json'),'utf8'));
 for(const invalid of [false,true]){
  const m=structuredClone(canonical);if(invalid)m.subdemos[0].video.url='javascript:alert(1)';const clock=rehearsalClock(),{api,sandbox}=withLang('es','www.admira.store',{store:m},clock);api.demo('/demo auto');await Promise.resolve();
  while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente');const modal=sandbox.document.getElementById('ax-demo-muestra');if(!invalid)modal.querySelectorAll('video').find(el=>el.src===m.subdemos[0].video.url).onerror();
  assert.equal(api.demoEstado().activo,true);assert.equal(api.demoEstado().pausado,true);clock.advance(600000);assert.equal(api.demoEstado().numero,1);const paragraphs=modal.querySelectorAll('p').map(el=>el.textContent).join(' ');assert.match(paragraphs,invalid?/no válido/:/acceso o el formato/);api.demo('/demo stop');
 }
});
test('native persistent prime promise cannot rewind or pause a later active clip',async()=>{
 const m=JSON.parse(readFileSync(join(dir,'../subdemos/store.subdemos.json'),'utf8')),clock=rehearsalClock(),{api,sandbox}=withLang('es','www.admira.store',{store:m},clock),create=sandbox.document.createElement;let resolvePrime;
 sandbox.document.createElement=tag=>{const el=create(tag);if(tag==='video'&&!resolvePrime){const play=el.play.bind(el);el.play=()=>{el.play=play;el.paused=false;return new Promise(resolve=>{resolvePrime=resolve;});};}return el;};
 api.demo('/demo auto');while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente');const clip=sandbox.document.getElementById('ax-demo-muestra').querySelectorAll('video').find(el=>el.src===m.subdemos[0].video.url);clip.currentTime=14;resolvePrime();await Promise.resolve();assert.equal(clip.currentTime,14);assert.equal(clip.paused,false);api.demo('/demo stop');
});
test('persistent video replaces previous sound guard so a silent function cannot mute the next audible function',async()=>{
 const m=JSON.parse(readFileSync(join(dir,'../subdemos/store.subdemos.json'),'utf8'));m.subdemos[0].video.audio=false;const {api,sandbox}=withLang('es','www.admira.store',{store:m},rehearsalClock());api.demo('/demo auto');await Promise.resolve();const clip=sandbox.document.getElementById('ax-demo-muestra').querySelectorAll('video').find(el=>el.src===m.subdemos[0].video.url);assert.equal(clip.muted,true);
 while(api.demoEstado().numero===1)api.demo('/demo siguiente');assert.equal(clip.src,m.subdemos[1].video.url);clip.onvolumechange();assert.equal(clip.muted,false);api.demo('/demo stop');
});
for(const platform of ['store','biz','studio'])test(platform+': legacy local and fetched catalogs keep each canonical reel without changing saved rehearsal text',async()=>{
 const canonical=JSON.parse(readFileSync(join(dir,'../subdemos/'+platform+'.subdemos.json'),'utf8')),legacy=structuredClone(canonical);legacy.subdemos.forEach((d,i)=>{if(i%2)d.video=null;else delete d.video;});const before=JSON.stringify(legacy);
 for(const local of [true,false]){
  const {api,storage}=withLang('es','www.admira.'+platform,local?{[platform]:legacy}:null,rehearsalClock(),async()=>({ok:true,json:async()=>structuredClone(legacy)}));await api.listo();const actual=snap(api.subdemos());assert.equal(actual.subdemos.length,5);
  actual.subdemos.forEach((d,i)=>{assert.deepEqual(d.video,canonical.subdemos[i].video);assert.deepEqual(d.guion,legacy.subdemos[i].guion);assert.deepEqual(d.muestra,legacy.subdemos[i].muestra);});if(local)assert.equal(JSON.stringify(JSON.parse(storage.getItem('ax-subdemos-manifiestos'))[platform]),before);
 }assert.equal(JSON.stringify(legacy),before);
});
test('native catalog keeps explicit video overrides and never lends a core reel to an unknown function',async()=>{
 const m=JSON.parse(readFileSync(join(dir,'../subdemos/store.subdemos.json'),'utf8')),custom=structuredClone(m);custom.subdemos[0].video.url='https://www.pixeria.com/prepared/custom.mp4';custom.subdemos[1].video.url='javascript:alert(1)';custom.subdemos[2].video=false;custom.subdemos.push({id:'unknown',nombre:'Unknown prepared function',url:'https://www.admira.store/unknown',aliases:['unknown'],guion:[{texto:'Generic phase'}]});
 const {api}=withLang('es','www.admira.store',{store:custom},rehearsalClock());await api.listo();const actual=snap(api.subdemos());assert.deepEqual(actual.subdemos[0].video,custom.subdemos[0].video);assert.deepEqual(actual.subdemos[1].video,custom.subdemos[1].video);assert.equal(actual.subdemos[2].video,false);assert.equal(actual.subdemos.at(-1).video,undefined);
 api.demo('/demo 3');while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente');assert.equal(api.demoEstado().pausado,true,'unsupported explicit override remains blocked instead of borrowing canonical media');api.demo('/demo stop');
});
test('native prime waits for successful play before pausing and resets, while an old resolved prime cannot touch a restarted run',async()=>{
 const m=JSON.parse(readFileSync(join(dir,'../subdemos/store.subdemos.json'),'utf8')),clock=rehearsalClock(),{api,sandbox}=withLang('es','www.admira.store',{store:m},clock),create=sandbox.document.createElement;let resolvePrime;
 sandbox.document.createElement=tag=>{const el=create(tag);if(tag==='video'&&!resolvePrime){const play=el.play.bind(el);el.play=()=>{el.play=play;el.paused=false;return new Promise(resolve=>{resolvePrime=resolve;});};}return el;};api.demo('/demo auto');const clip=sandbox.document.getElementById('ax-demo-muestra').querySelectorAll('video').find(el=>el.src===m.subdemos[0].video.url);assert.equal(clip.paused,false,'pending priming playback must not be aborted by immediate pause');assert.equal(clip.volume,0);clip.currentTime=1;resolvePrime();await Promise.resolve();assert.equal(clip.paused,true);assert.equal(clip.currentTime,0);assert.equal(clip.volume,1);api.demo('/demo stop');
});

test('/demo global has a distinct destination on each platform while old demos remain available',()=>{for(const host of ['www.admira.store','www.admira.biz','www.pixeria.com','www.admira.tv','www.admiranext.com']){const {api}=withLang('es',host);assert.deepEqual(snap(api.parseDemo('/demo global')),{id:'global',url:'https://www.admira.biz/demo/'});assert.equal(api.parseDemo('/demo tv').id,'tv');}});

test('/demo hoy y /demo today abren el organigrama sin pisar las demos de la pata', async () => {
  for (const host of ['www.admiranext.com', 'www.admira.biz', 'www.admira.store', 'www.xpaceos.com']) {
    const es = withLang('es', host);
    const hoy = es.api.parseDemo('/demo hoy');
    assert.equal(hoy.id, 'hoy');
    assert.equal(hoy.lang, 'es');
    assert.equal(hoy.funcion, 'hoy');
    const url = new URL(hoy.url);
    assert.equal(url.hostname, 'www.admiranext.com');
    assert.equal(url.pathname, '/arquitectura');
    assert.equal(url.searchParams.get('ax_demo'), 'hoy');
    assert.equal(url.searchParams.get('lang'), 'es');
    if (host === 'www.admira.store' || host === 'www.xpaceos.com') assert.equal(es.api.parseDemo('/demo tpv'), null);
    if (host === 'www.admiranext.com') assert.equal(es.api.parseDemo('/demo off'), null);
    const en = withLang('en', host);
    const today = en.api.parseDemo('/demo today');
    assert.equal(today.lang, 'en');
    assert.equal(new URL(today.url).searchParams.get('lang'), 'en');
    assert.equal(en.api.parseDemo('/demo store').id, 'store');
  }
  const { api, location, documentElement } = withLang('es', 'www.admiranext.com');
  let went = '';
  location.assign = (u) => { went = u; };
  const lines = [];
  api.exec('/demo today', { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 });
  assert.equal(documentElement.lang, 'en');
  await new Promise((r) => setTimeout(r, 700));
  const dest = new URL(went);
  assert.equal(dest.pathname, '/arquitectura');
  assert.equal(dest.searchParams.get('lang'), 'en');
  assert.equal(dest.searchParams.get('ax_demo'), 'hoy');
  assert.match(lines.join('\n'), /Demo today/);
  const biz = withLang('es', 'www.admira.biz');
  assert.equal(biz.api.arquitecturaUrl('en'), 'https://www.admiranext.com/arquitectura?lang=en');
});

test('/demo proyectos, idioma, marcas y roadmap abren su página y /demo help las nombra', () => {
  const casos = [
    ['/demo proyectos', 'proyectos', 'es', '/proyectos/'],
    ['/demo projects', 'proyectos', 'en', '/proyectos/'],
    ['/demo idioma', 'idioma', 'es', '/'],
    ['/demo language', 'idioma', 'en', '/'],
    ['/demo marcas', 'marcas', 'es', '/marcablanca/'],
    ['/demo brands', 'marcas', 'en', '/marcablanca/'],
    ['/demo roadmap', 'roadmap', 'es', '/roadmap'],
  ];
  for (const [cmd, id, idioma, path] of casos) {
    const ctx = withLang('es', 'www.admiranext.com');
    const p = ctx.api.parseDemo(cmd);
    assert.equal(p.funcion, id, cmd);
    assert.equal(p.lang, idioma, cmd);
    const u = new URL(p.url);
    assert.equal(u.hostname, 'www.admiranext.com', cmd);
    assert.equal(u.pathname, path, cmd);
    assert.equal(u.searchParams.get('ax_demo'), id, cmd);
    assert.equal(u.searchParams.get('lang'), idioma, cmd);
  }
  const enPage = withLang('en', 'www.admiranext.com');
  const road = enPage.api.parseDemo('/demo roadmap');
  assert.equal(road.lang, 'en');
  assert.equal(new URL(road.url).pathname, '/roadmap');
  const viva = withLang('es', 'www.admiranext.com');
  viva.location.search = '?ax_demo=hoy';
  assert.deepEqual(snap(viva.api.parseDemo('/demo idioma')), {idiomaDemo: true});
  assert.deepEqual(snap(viva.api.parseDemo('/demo language')), {idiomaDemo: true});
  const lines = [];
  const log = { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 };
  withLang('es', 'www.admiranext.com').api.exec('/demo help', log);
  const help = lines.join('\n');
  for (const nombre of ['/demo proyectos', '/demo idioma', '/demo marcas', '/demo roadmap', '/demo projects', '/demo language', '/demo brands']) {
    assert.match(help, new RegExp(nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const pata = withLang('es', 'www.admira.biz');
  const desdePata = pata.api.parseDemo('/demo proyectos');
  assert.equal(desdePata.funcion, 'proyectos');
  assert.equal(new URL(desdePata.url).hostname, 'www.admiranext.com');
  const helpPata = [];
  pata.api.exec('/demo help', { appendChild: (li) => helpPata.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 });
  assert.match(helpPata.join('\n'), /\/demo proyectos/);
});

test('/demo editor abre el editor de demos en admiranext.com', () => {
  const ctx = withLang('es', 'www.admiranext.com');
  const p = ctx.api.parseDemo('/demo editor');
  assert.equal(p.funcion, 'editor');
  assert.equal(p.lang, 'es');
  const u = new URL(p.url);
  assert.equal(u.hostname, 'www.admiranext.com');
  assert.equal(u.pathname, '/demos/editor/');
  assert.equal(u.searchParams.get('ax_demo'), 'editor');
  const en = withLang('en', 'www.admira.biz');
  const desde = en.api.parseDemo('/demo editor');
  assert.equal(desde.funcion, 'editor');
  assert.equal(desde.lang, 'en');
  assert.equal(new URL(desde.url).pathname, '/demos/editor/');
});
