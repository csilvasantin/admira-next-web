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
    const el = {tagName:String(tag).toUpperCase(),children:[],attrs:{},style:{},textContent:'',paused:true,
      classList:{add(){},contains:()=>false,toggle(){},remove(){}},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k] ?? null;},removeAttribute(k){delete this.attrs[k];},
      appendChild(child){child.parentNode=this;this.children.push(child);},removeChild(child){this.children=this.children.filter(c=>c!==child);child.parentNode=null;},insertBefore(){},addEventListener(){},
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
    localStorage: storage, sessionStorage: storage, URL,
    fetch: root.fetch, setTimeout:root.setTimeout, clearTimeout:root.clearTimeout,
    MutationObserver: root.MutationObserver, CustomEvent: root.CustomEvent, Event: root.Event,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'experto.js' });
  return { api: sandbox.AdmiraExperto, documentElement, setLang: sandbox.AdmiraSetLanguage, sandbox, storage, location };
}


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
    api.demo('/demo auto',log);assert.equal(api.demoEstado().total,5);assert.equal(api.demoEstado().fase,1);
    const firstModal=sandbox.document.getElementById('ax-demo-muestra');assert.ok(firstModal);assert.equal(firstModal.querySelectorAll('audio,video').every(el=>el.paused),true,'media does not play in preparation phase');
    clock.advance(1000);api.demo('/demo pausa',log);const paused=snap(api.demoEstado());clock.advance(120000);assert.deepEqual(snap(api.demoEstado()),paused);
    api.demo('/demo reanudar',log);const interval=Math.max(1800,Math.min(30000,(Number(canonical.subdemos[0].duracion)||40)*1000/canonical.subdemos[0].guion.length));
    clock.advance(interval-1001);assert.equal(api.demoEstado().fase,1);clock.advance(1);assert.equal(api.demoEstado().fase,2,'resume preserves remaining phase time');
    const media=firstModal.querySelectorAll('audio,video');assert.equal(media.every(el=>el.muted),true,'default keeps samples silent while the presenter speaks');
    if(platform==='store')assert.equal(media.every(el=>!el.paused),true,'Store listening/result phase starts silent playback');
    if(platform==='studio'){
      assert.equal(media.every(el=>el.paused),true,'Studio does not reveal a generated sample early');
      while(api.demoEstado().fase<api.demoEstado().fases)api.demo('/demo siguiente',log);
      assert.equal(media.every(el=>!el.paused),true,'Studio reveals its prepared result in the final phase');
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
  const modal=sandbox.document.getElementById('ax-demo-muestra'),media=modal.querySelectorAll('video'),sound=modal.querySelector('input');
  assert.equal(media.length,4);assert.equal(media.every(el=>el.muted),true);
  sound.checked=true;sound.onchange();assert.deepEqual(media.map(el=>el.muted),[false,true,true,true]);
  api.demo('/demo pausa');api.demo('/demo reanudar');assert.equal(sound.checked,true);assert.deepEqual(media.map(el=>el.muted),[false,true,true,true]);
  sound.checked=false;sound.onchange();assert.equal(media.every(el=>el.muted),true);api.demo('/demo stop');
});
