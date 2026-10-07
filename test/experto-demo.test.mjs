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

function withLang(initial, hostname = 'www.admiranext.com', savedManifests = null) {
  const documentElement = { lang: initial, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const document = {
    documentElement,
    currentScript: { dataset: {} },
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: String(tag).toUpperCase(),
      classList: { add() {}, contains: () => false, toggle() {} },
      setAttribute() {}, getAttribute: () => null, appendChild() {}, style: {},
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      textContent: '', children: [], insertBefore() {}, removeAttribute() {},
    }),
    addEventListener() {},
    head: { appendChild() {} },
    body: { appendChild() {} },
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
    URL, fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout, clearTimeout,
  };
  const sandbox = {
    ...root, window: null, globalThis: null, document, location,
    localStorage: storage, sessionStorage: storage, URL,
    fetch: root.fetch, setTimeout, clearTimeout,
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
