// /demo dooh <cliente> y /vision general <cliente> en las cuatro patas (Carlos, 16-oct-2026 · DCL-97f84ae3e5b2cb2311c55101).
// Fuera de admira.biz la suite navega al Tour DooH de admira.biz con la marca del cliente; en biz
// (y donde la pata ya registró su /demo dooh) no intercepta y manda el expert-commands.js local.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../suite/experto.js'), 'utf8');

function el(tag) {
  return {
    tagName: String(tag).toUpperCase(), children: [], attrs: {}, style: {}, dataset: {}, textContent: '', className: '',
    classList: {add() {}, contains: () => false, toggle() {}, remove() {}},
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { c.parentNode = this; this.children.push(c); }, removeChild(c) { this.children = this.children.filter(x => x !== c); },
    insertBefore() {}, addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  };
}

function suite(hostname, lang = 'es') {
  const keydown = [];
  const assigned = [];
  const documentElement = {lang, dataset: {}, setAttribute() {}, getAttribute() { return null; }, classList: {contains: () => false, add() {}, toggle() {}}};
  const document = {
    documentElement, currentScript: {dataset: {catalog: 'offline'}}, readyState: 'complete',
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: el,
    addEventListener(type, fn) { if (type === 'keydown') keydown.push(fn); }, removeEventListener() {},
    head: el('head'), body: el('body'), dispatchEvent() {},
  };
  const location = {hostname, host: hostname, href: 'https://' + hostname + '/', pathname: '/', search: '', hash: '', origin: 'https://' + hostname,
    assign(u) { assigned.push(String(u)); }};
  const storage = {_m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; }};
  const timers = [];
  const sandbox = {
    document, location, localStorage: storage, sessionStorage: storage, URL, URLSearchParams,
    fetch: async () => ({ok: false, json: async () => ({})}),
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
    MutationObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
    Event: class { constructor(t) { this.type = t; } },
    dispatchEvent() {}, addEventListener() {},
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, {filename: 'experto.js'});
  const api = sandbox.AdmiraExperto;
  const log = el('ol');
  const lines = () => log.children.map(li => li.textContent);
  const flush = () => { while (timers.length) timers.shift()(); };
  const run = (text) => { const r = api.exec(text, log); flush(); return r; };
  const tab = (value) => {
    const e = {key: 'Tab', target: {value}, prevented: false, preventDefault() { this.prevented = true; }};
    keydown.forEach(fn => fn(e));
    return e.target.value;
  };
  return {api, log, lines, run, tab, assigned};
}

const PATAS = ['www.admira.studio', 'admira.studio', 'www.pixeria.com', 'www.admira.store', 'www.xpaceos.com', 'www.admira.app', 'www.yokup.com', 'www.admiranext.com', 'admira.tv'];

test('fuera de biz /demo dooh starbucks lleva al Tour DooH de Starbucks México en admira.biz con su marca', () => {
  for (const h of PATAS) {
    const {api} = suite(h);
    for (const t of ['/demo dooh starbucks', '/demo dooh sbux', '/demo dooh starbucks mexico', '/demo dooh Starbucks México', '/demo dooh alsea', '/demo dooh alsea-mexico', 'demo dooh STARBUCKS']) {
      const p = api.parseDemo(t);
      assert.ok(p, h + ' · ' + t);
      assert.equal(p.id, 'dooh-starbucks', h + ' · ' + t);
      const u = new URL(p.url);
      assert.equal(u.origin, 'https://www.admira.biz');
      assert.equal(u.pathname, '/');
      assert.equal(u.searchParams.get('ax_cmd'), 'demo-dooh-starbucks');
      assert.equal(u.searchParams.get('marca'), 'starbucks');
      assert.equal(u.searchParams.get('lang'), 'es');
    }
  }
});

test('fuera de biz /demo dooh altadis lleva al Tour DooH de Altadis España con marca=altadis', () => {
  for (const h of PATAS) {
    const {api} = suite(h);
    for (const t of ['/demo dooh altadis', '/demo dooh xtancos altadis', '/demo dooh Altadis España']) {
      const p = api.parseDemo(t), u = new URL(p.url);
      assert.equal(p.id, 'dooh-altadis', h + ' · ' + t);
      assert.equal(u.searchParams.get('ax_cmd'), 'demo-dooh-altadis');
      assert.equal(u.searchParams.get('marca'), 'altadis');
    }
  }
});

test('la orden navega en la misma pestaña y avisa en el registro del Experto', () => {
  const s = suite('www.admira.studio');
  const r = s.run('/demo dooh starbucks');
  assert.equal(r.id, 'dooh-starbucks');
  assert.ok(s.lines().includes('Abriendo el Tour DooH de Starbucks México en admira.biz…'), s.lines().join('\n'));
  assert.equal(s.assigned.length, 1);
  assert.equal(s.assigned[0], 'https://www.admira.biz/?ax_cmd=demo-dooh-starbucks&marca=starbucks&lang=es');
  const a = suite('www.admira.store');
  a.run('/demo dooh altadis');
  assert.ok(a.lines().includes('Abriendo el Tour DooH de Altadis España en admira.biz…'));
  assert.equal(a.assigned[0], 'https://www.admira.biz/?ax_cmd=demo-dooh-altadis&marca=altadis&lang=es');
  const en = suite('www.admira.app', 'en');
  en.run('/demo dooh starbucks');
  assert.ok(en.lines().includes('Opening the Starbucks Mexico DooH Tour on admira.biz…'));
  assert.equal(new URL(en.assigned[0]).searchParams.get('lang'), 'en');
});

test('/demo dooh sin cliente lista los disponibles; un cliente desconocido no navega', () => {
  const s = suite('www.admira.app');
  s.run('/demo dooh');
  const txt = s.lines().join('\n');
  assert.match(txt, /\/demo dooh starbucks · Starbucks México/);
  assert.match(txt, /\/demo dooh altadis · Altadis España/);
  assert.match(txt, /\/vision general <cliente>/);
  assert.equal(s.assigned.length, 0);
  const u = suite('www.admira.app');
  u.run('/demo dooh pepsi');
  assert.match(u.lines().join('\n'), /Cliente DooH desconocido: pepsi/);
  assert.equal(u.assigned.length, 0);
  assert.equal(u.api.parseDemo('/demo dooh').lista, true);
});

test('/demo alsea sigue siendo la presentación web y /demo store sigue abriendo su solución', () => {
  const {api} = suite('www.admira.app');
  assert.equal(api.parseDemo('/demo alsea').presentation, true);
  assert.equal(api.parseDemo('/demo store').id, 'store');
});

test('/vision general <cliente> abre la visión general en admira.biz', () => {
  const s = suite('www.admira.studio');
  s.run('/vision general altadis');
  assert.equal(s.assigned[0], 'https://www.admira.biz/?ax_cmd=vision-general-altadis&marca=altadis&lang=es');
  assert.ok(s.lines().includes('Abriendo la visión general de Altadis España en admira.biz…'));
  const t = suite('www.admira.store');
  t.run('/vision starbucks');
  assert.equal(t.assigned[0], 'https://www.admira.biz/?ax_cmd=vision-general-starbucks&marca=starbucks&lang=es');
  const v = suite('www.admira.app');
  v.run('/vision general');
  assert.equal(v.assigned.length, 0);
  assert.match(v.lines().join('\n'), /\/vision general <cliente> · starbucks · altadis/);
});

test('en admira.biz y clearchannel.tv la suite no intercepta: manda el expert-commands.js local', () => {
  for (const h of ['www.admira.biz', 'admira.biz', 'www.clearchannel.tv']) {
    const s = suite(h);
    // Sin tocar lo que biz ya resolvía (el alias local «dooh» del manifiesto de biz): nada de salto a biz.
    const p = s.api.parseDemo('/demo dooh starbucks');
    assert.ok(!p || (!p.dooh && !String(p.url || '').includes('ax_cmd=')), h);
    assert.equal(s.api.parseDemo('/demo dooh').id, 'biz/circuito', h);
    assert.equal(s.api.has('vision'), false, h);
    // Con el adaptador de biz, /demo dooh lo atiende la pata y la suite no navega.
    const got = [];
    s.api.registerAdapter({id: 'biz-map-demo', demos: [{name: 'dooh', run: (args) => { got.push(args.join(' ')); return {ok: true}; }}],
      verbs: [{name: 'vision', run: (args) => { got.push('vision ' + args.join(' ')); return {ok: true}; }}]});
    s.run('/demo dooh starbucks');
    s.run('/vision general alsea');
    assert.deepEqual(got, ['starbucks', 'vision general alsea'], h);
    assert.equal(s.assigned.length, 0, h);
    assert.equal(s.tab('/demo dooh st'), '/demo dooh st', h + ': sin autocompletado de la suite');
  }
});

test('si otra pata registra su propio /demo dooh, la suite le cede la orden', () => {
  const s = suite('www.admira.app');
  const got = [];
  s.api.registerAdapter({id: 'local-dooh', demos: [{name: 'dooh', run: (args) => { got.push(args.join(' ')); }}]});
  assert.ok(!(s.api.parseDemo('/demo dooh starbucks') || {}).dooh);
  s.run('/demo dooh starbucks');
  assert.deepEqual(got, ['starbucks']);
  assert.equal(s.assigned.length, 0);
});

test('autocompletado y ayuda incluyen los Tours DooH', () => {
  const s = suite('www.admira.studio');
  assert.equal(s.tab('/demo do'), '/demo dooh ');
  assert.equal(s.tab('/demo dooh st'), '/demo dooh starbucks ');
  assert.equal(s.tab('/demo dooh al'), '/demo dooh altadis ');
  assert.equal(s.tab('/visi'), '/vision general ');
  assert.equal(s.tab('/vision general alt'), '/vision general altadis ');
  assert.equal(s.tab('/demo dooh zz'), '/demo dooh zz');
  s.run('/demo');
  const ayuda = s.lines().join('\n');
  assert.match(ayuda, /\/demo dooh starbucks/);
  assert.match(ayuda, /\/demo dooh altadis/);
  const verbo = s.api.list().find(v => v.name === 'demo');
  assert.match(verbo.args, /dooh \[starbucks\|altadis\]/);
  assert.ok(s.api.list().some(v => v.name === 'vision'));
});
