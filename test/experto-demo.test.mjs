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

function withLang(initial, hostname = 'www.admiranext.com') {
  const documentElement = { lang: initial, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: { contains: () => false, add() {}, toggle() {} } };
  const document = {
    documentElement,
    currentScript: { dataset: {} },
    readyState: 'complete',
    querySelector: () => null,
    querySelectorAll: () => [],
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

test('demos: cinco soluciones en orden y URL en inglés', () => {
  const { api, documentElement } = withLang('en');
  const list = api.demos();
  assert.deepEqual(snap(list.map((d) => d.id)), ['studio', 'store', 'tv', 'app', 'biz']);
  assert.match(list[0].url, /\/en\/anonimizador/);
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

// Números LOCALES de la plataforma (Carlos, 7-oct-2026): en admira.studio y pixeria.com, /demo 1…5
// son voz, música, imagen, vídeo y adaptar; las cinco soluciones siguen entrando por nombre.
for (const hostname of ['www.admira.studio', 'www.pixeria.com', 'pixeria.com']) {
  test('subdemos locales en ' + hostname + ': números, nombres con y sin tilde y alias', () => {
    const { api } = withLang('es', hostname);
    const origen = 'https://' + hostname;
    assert.deepEqual(snap([1, 2, 3, 4, 5].map((n) => api.parseDemo('/demo ' + n).id)), ['studio/voz', 'studio/musica', 'studio/imagen', 'studio/video', 'studio/adaptar']);
    assert.equal(api.parseDemo('/demo 2').url, origen + '/musica.html');
    assert.equal(api.parseDemo('/demo 2').modo, 'muestra');
    for (const [orden, id] of [['locucion', 'voz'], ['locución', 'voz'], ['voz', 'voz'], ['LOCUCIÓN', 'voz'], ['musica', 'musica'], ['música', 'musica'],
      ['imagen', 'imagen'], ['video', 'video'], ['vídeo', 'video'], ['adaptar', 'adaptar'], ['formatos', 'adaptar']]) {
      assert.equal(api.parseDemo('/demo ' + orden).id, 'studio/' + id, orden);
    }
    assert.equal(api.parseDemo('/demo 5').url, origen + '/adaptaciones/');
  });
}
test('/demo help y /demo a secas listan SOLO las cinco de la plataforma', () => {
  const { api } = withLang('es', 'www.pixeria.com');
  for (const orden of ['/demo', '/demo help', '/demo ayuda', '/demo lista']) {
    const p = snap(api.parseDemo(orden));
    assert.equal(p.ayuda, true, orden);
    assert.equal(p.plataforma, 'studio');
    assert.deepEqual(p.opciones.map((o) => o.numero + ':' + o.id), ['1:voz', '2:musica', '3:imagen', '4:video', '5:adaptar']);
  }
  const lines = [];
  const log = { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 };
  api.exec('/demo help', log);
  const texto = lines.join('\n');
  assert.match(texto, /1 \/demo locucion · Crear locución/);
  assert.match(texto, /5 \/demo adaptar · Adaptar formatos/);
  assert.doesNotMatch(texto, /\/demo store|admira\.tv|admira\.biz/);
});
test('en una plataforma con subdemos: soluciones por nombre, lo desconocido se avisa y stop es de la pata', () => {
  const { api } = withLang('es', 'www.admira.studio');
  assert.equal(api.parseDemo('/demo store').id, 'store');
  assert.equal(api.parseDemo('/demo biz').id, 'biz');
  assert.deepEqual(snap(api.parseDemo('/demo soluciones')), { lista: true });
  assert.equal(api.parseDemo('/demo 6').desconocida, true);
  assert.equal(api.parseDemo('/demo nada').desconocida, true);
  assert.equal(api.parseDemo('/demo stop'), null);
});
test('fuera de una plataforma con subdemos nada cambia: /demo 2 sigue siendo admira.store', () => {
  assert.equal(withLang('es').api.parseDemo('/demo 2').id, 'store');
  const store = withLang('es', 'www.admira.store').api;
  assert.equal(store.parseDemo('/demo 2').id, 'store');
  assert.equal(store.parseDemo('/demo tpv'), null);
  assert.equal(store.parseDemo('/demo help'), null);
});
test('/demo 2 en pixeria abre música en el mismo host y avisa con admira:demo en modo muestra', async () => {
  const { api, location, sandbox } = withLang('es', 'www.pixeria.com');
  const lines = [], eventos = [];
  const log = { appendChild: (li) => lines.push(li.textContent), children: [], scrollTop: 0, scrollHeight: 0 };
  sandbox.document.dispatchEvent = (e) => { eventos.push(e); };
  let went = '';
  location.assign = (u) => { went = u; };
  api.exec('/demo 2', log);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(went, 'https://www.pixeria.com/musica.html');
  assert.deepEqual(snap(eventos.filter((e) => e.type === 'admira:demo').map((e) => e.detail)), [{ id: 'studio/musica', url: 'https://www.pixeria.com/musica.html', modo: 'muestra' }]);
  assert.ok(lines.some((l) => /Demo 2\/5 · Crear música — muestra/.test(l)));
});
