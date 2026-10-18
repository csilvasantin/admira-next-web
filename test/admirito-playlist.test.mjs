// /admirito playlist #musica #1980 (Carlos, 18-oct-2026): las piezas del Stock de Pixeria y admira.studio que
// llevan todos esos hashtags, encadenadas en un reproductor flotante.
import test from 'node:test'; import assert from 'node:assert/strict'; import vm from 'node:vm'; import { readFileSync } from 'node:fs';
import { installAdmirito } from '../suite/admirito.mjs';
import { tagKey, decadaDe, parsear, construir, esJugable, reproducir, olvidarStock, IMAGEN_MS, STOCK_INDEX_URL } from '../suite/admirito-playlist.mjs';

const fuente = readFileSync(new URL('../suite/admirito-playlist.mjs', import.meta.url), 'utf8');
const experto = readFileSync(new URL('../suite/experto.js', import.meta.url), 'utf8'), bugito = readFileSync(new URL('./experto-bugito.test.mjs', import.meta.url), 'utf8');
const fixture = bugito.slice(bugito.indexOf('function consola('), bugito.indexOf("test('/bugito está")).replace('return { api: sandbox.AdmiraExperto', 'return { root:sandbox,api: sandbox.AdmiraExperto');

const S = 'https://stock.admira.store/stock/';
const pieza = (id, type, tags, extra = {}) => ({ id, num: 0, type, title: 'Pieza ' + id, tags,
  mime: { video: 'video/mp4', image: 'image/jpeg', audio: 'audio/mpeg', music: 'audio/mpeg', locucion: 'audio/mpeg', link: 'text/uri-list', furni: 'model/gltf-binary' }[type],
  url: S + id + '/asset.bin?v=1', ...extra });
// Etiquetas como están de verdad en el Stock: minúsculas, con tildes, sin «#» y los 80 escritos de mil formas.
const INDICE = { items: [
  pieza('a', 'video', ['música', 'años 80', 'good']),
  pieza('b', 'video', ['music', '1986']),
  pieza('c', 'image', ['musica', '80smusic']),
  pieza('d', 'audio', ['música', 'ochentas'], { thumbnail: S + 'd/poster.jpg' }),
  pieza('e', 'video', ['música', 'años 90']),
  pieza('f', 'video', ['1980s']),
  pieza('g', 'link', ['música', '80s'], { url: 'https://www.youtube.com/watch?v=x' }),
  pieza('h', 'furni', ['música', '80s']),
  pieza('a', 'video', ['música', 'años 80']),                       // mismo id, otra vez
  pieza('i', 'video', ['música', '80s'], { url: S + 'a/asset.bin?v=2' }), // mismo fichero que «a»
] };

test('las etiquetas se comparan como en Pixeria: sin tildes, sin «#», sin separadores y con sinónimos', () => {
  for (const t of ['#Música', 'musica', 'music', 'MÚSICA', 'muscia']) assert.equal(tagKey(t), tagKey('música'), t);
  for (const t of ['#años80', 'años 80', 'anos_80', 'AÑOS-80']) assert.equal(tagKey(t), 'anos80', t);
  assert.notEqual(tagKey('música'), tagKey('músico'));
});

test('#1980 vale por los 80 (como #80s, #años80 o #ochentas); #1986 o #80 son esa etiqueta y nada más', () => {
  for (const h of ['#1980', '#1980s', '#80s', '#años80', '#anos80', '#ochentas', '#losochenta']) assert.equal(decadaDe(h), 1980, h);
  assert.equal(decadaDe('#00s'), 2000); assert.equal(decadaDe('#2010'), 2010); assert.equal(decadaDe('#noventas'), 1990);
  for (const h of ['#1986', '#80', '#10', '#top10', '#musica', '#2026']) assert.equal(decadaDe(h), null, h);
});

test('construir: todas las etiquetas a la vez, solo lo que se reproduce, sin repetir pieza ni fichero y en el orden del índice', () => {
  const { piezas, porSeparado, decadas } = construir(INDICE.items, ['#musica', '#1980']);
  assert.deepEqual(piezas.map((p) => p.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(piezas.map((p) => p.tipo), ['video', 'video', 'imagen', 'audio']);
  assert.equal(piezas[3].poster, S + 'd/poster.jpg');
  assert.deepEqual(porSeparado, { '#musica': 5, '#1980': 5 }, 'piezas distintas, sin contar dos veces el mismo fichero');
  assert.deepEqual(decadas, [['#1980', 1980]]);
  assert.deepEqual(construir(INDICE.items, ['#musica', '#1986']).piezas.map((p) => p.id), ['b']);
  assert.deepEqual(construir(INDICE.items, ['#musica', '#xyzzy']).piezas, []);
  assert.equal(esJugable(INDICE.items[6]), false, 'un enlace a YouTube no se reproduce');
  assert.equal(esJugable(INDICE.items[7]), false, 'un mueble 3D no es una pieza de playlist');
});

test('parsear: ayuda, parar, hashtags con o sin «#», sin repetir y con tope', () => {
  assert.equal(parsear([]).accion, 'ayuda'); assert.equal(parsear(['help']).accion, 'ayuda');
  assert.equal(parsear(['parar']).accion, 'parar'); assert.equal(parsear(['stop']).accion, 'parar');
  assert.deepEqual(parsear(['#musica', '1980', '#Música']), { accion: 'buscar', hashtags: ['#musica', '#1980'] });
  assert.equal(parsear(['#rock&roll']).error, 'hashtag');
  assert.equal(parsear(Array.from({ length: 9 }, (_, i) => '#t' + i)).error, 'demasiados');
});

// ─── El verbo dentro del ⌘ Experto de verdad (suite/experto.js en una VM) ───
function boot({ lang = 'es', indice = INDICE, falla = false } = {}) {
  olvidarStock();
  const context = { experto, vm, URL, URLSearchParams };
  vm.runInNewContext(fixture + ';result=consola({lang:' + JSON.stringify(lang) + '});', context);
  const c = context.result, pedidos = [], pegados = [], eventos = [];
  // El motor también pide al arrancar sus manifiestos de demos: aquí solo se cuentan las lecturas del Stock.
  const fetchMotor = c.root.fetch;
  c.root.fetch = async (url, opts) => { if (!String(url).startsWith('https://stock.admira.store/')) return fetchMotor(url, opts);
    pedidos.push([url, opts]); if (falla) throw Error('sin red'); return { ok: true, json: async () => indice }; };
  c.root.document.body.appendChild = (x) => pegados.push(x);
  c.root.dispatchEvent = (e) => eventos.push(e);
  installAdmirito(c.api, c.root);
  return { ...c, pedidos, pegados, eventos };
}

test('/admirito playlist #musica #1980 lee el Stock una vez, cuenta lo que encuentra y abre el reproductor', async () => {
  const c = boot();
  const r = await c.run('/admirito playlist #musica #1980');
  assert.equal(r.ok, true); assert.equal(r.piezas, 4); assert.deepEqual(r.ids, ['a', 'b', 'c', 'd']);
  assert.deepEqual(c.pedidos.map(([u, o]) => [u, o.credentials]), [[STOCK_INDEX_URL, 'omit']], 'sin cookies: el índice es público');
  const texto = c.texto();
  assert.match(texto, /#1980 cuenta como los años 80/);
  assert.match(texto, /🎵 Playlist #musica #1980 · 4 piezas: 2 vídeos, 1 imagen, 1 audio\./);
  assert.match(texto, / 1\. Pieza a · vídeo/);
  assert.equal(c.pegados.filter((x) => x.className === 'adm-pl').length, 1, 'un reproductor flotante');
  assert.deepEqual(c.eventos.filter((e) => e.type === 'admira:playlist').map((e) => e.detail.ids), [['a', 'b', 'c', 'd']]);
  // /playlist a secas es el mismo verbo, y la segunda vez no vuelve a pedir el índice (caché de 60 s).
  assert.equal((await c.run('/playlist #musica #1986')).piezas, 1);
  assert.equal(c.pedidos.length, 1);
  assert.equal((await c.run('/admirito playlist parar')).cerrada, true);
});

test('sin resultados dice cuántas lleva cada hashtag por separado; sin red, lo dice sin abrir nada', async () => {
  const c = boot();
  const r = await c.run('/admirito playlist #musica #xyzzy');
  assert.equal(r.ok, false); assert.match(c.texto(), /lleva a la vez #musica y #xyzzy\. Por separado: #musica 5 · #xyzzy 0\./);
  assert.equal(c.pegados.length, 0);
  const sinRed = boot({ falla: true });
  assert.equal((await sinRed.run('/admirito playlist #musica')).ok, false);
  assert.match(sinRed.texto(), /No se pudo leer el Stock \(stock\.admira\.store\): sin red/);
  assert.equal(sinRed.pegados.length, 0);
});

test('la ayuda de Admirito trae la playlist, en castellano y en inglés', async () => {
  const es = boot(); es.run('/admirito help');
  assert.match(es.texto(), /\/admirito playlist — Playlist con las piezas de Pixeria y admira\.studio/);
  const en = boot({ lang: 'en' }); await en.run('/admirito playlist');
  assert.match(en.texto(), /plays, one after another, the Pixeria and admira\.studio pieces/);
  assert.match(en.texto(), /#1980 means the 80s/);
  assert.equal(en.pedidos.length, 0, 'la ayuda no lee el Stock');
});

// ─── El reproductor con un DOM mínimo ───
function dom() {
  const nodo = (tag) => { const n = { tagName: tag.toUpperCase(), children: [], attrs: {}, on: {}, style: {}, textContent: '',
    appendChild(c) { c.parentNode = n; n.children.push(c); return c; }, removeChild(c) { n.children = n.children.filter((x) => x !== c); },
    get firstChild() { return n.children[0]; }, setAttribute(k, v) { n.attrs[k] = v; }, addEventListener(t, f) { (n.on[t] ??= []).push(f); },
    querySelector(sel) { const want = sel.split(',').map((s) => s.trim().toUpperCase()); const walk = (x) => { for (const c of x.children) { if (want.includes(c.tagName)) return c; const r = walk(c); if (r) return r; } return null; }; return walk(n); },
    remove() { n.parentNode?.removeChild(n); }, fire(t) { for (const f of n.on[t] || []) f({ key: 'Escape' }); } }; return n; };
  const body = nodo('body'), head = nodo('head'), timers = [], guardado = {};
  const env = { document: { createElement: nodo, body, head, getElementById: () => null }, timers, guardado,
    setTimeout: (f, ms) => { const t = { f, ms }; timers.push(t); return t; }, clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    localStorage: { getItem: (k) => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } } };
  return env;
}
const titulo = (c) => c.caja.children[0].children[0].textContent;
const medio = (c) => c.caja.children[1].children.at(-1);
const botones = (c) => ({ mute: c.caja.children[0].children[1], cerrar: c.caja.children[0].children[2], prev: c.caja.children[2].children[0], next: c.caja.children[2].children[2] });

test('el reproductor encadena: el vídeo y el audio al acabar, la imagen a los 5 s, y al final dice «Fin»', () => {
  const env = dom(), { piezas } = construir(INDICE.items, ['#musica', '#1980']);
  const c = reproducir(piezas, env, { titulo: '#musica #1980' });
  assert.equal(env.document.body.children.length, 1);
  assert.match(titulo(c), /^▶ 1\/4 · Pieza a$/); assert.equal(medio(c).tagName, 'VIDEO'); assert.equal(botones(c).prev.disabled, true);
  medio(c).fire('ended'); assert.match(titulo(c), /^▶ 2\/4/);
  medio(c).fire('ended'); assert.equal(medio(c).tagName, 'IMG');
  assert.deepEqual(env.timers.map((t) => t.ms), [IMAGEN_MS]); env.timers.pop().f();
  assert.equal(medio(c).tagName, 'AUDIO'); assert.equal(c.caja.children[1].children[0].children[0].src, S + 'd/poster.jpg');
  assert.equal(botones(c).next.disabled, true);
  medio(c).fire('ended'); assert.match(titulo(c), /^✓ Fin · #musica #1980 · 4$/);
  botones(c).prev.fire('click'); assert.match(titulo(c), /^▶ 3\/4/);
  assert.equal(env.timers.length, 1, 'volver a la imagen arma su temporizador');
  botones(c).cerrar.fire('click'); assert.equal(env.document.body.children.length, 0); assert.equal(env.timers.length, 0);
});

test('el silencio es uno para toda la playlist, se recuerda, y si el navegador no deja sonar sigue en silencio', async () => {
  const env = dom(), { piezas } = construir(INDICE.items, ['#musica', '#1980']);
  env.document.createElement = ((crear) => (tag) => { const n = crear(tag); if (tag === 'video') n.play = () => Promise.reject(Error('NotAllowedError')); return n; })(env.document.createElement);
  const c = reproducir(piezas, env, { titulo: '#musica' });
  await new Promise((r) => setImmediate(r));
  assert.equal(medio(c).muted, true); assert.equal(botones(c).mute.textContent, '🔇');
  botones(c).mute.fire('click'); assert.equal(medio(c).muted, false); assert.equal(env.guardado.admirito_playlist_muted, '0');
  botones(c).mute.fire('click'); assert.equal(env.guardado.admirito_playlist_muted, '1');
  medio(c).fire('ended'); assert.equal(medio(c).muted, true, 'la siguiente pieza hereda el silencio');
  // Una playlist nueva cierra la anterior: nunca dos reproductores a la vez.
  reproducir(piezas, env, { titulo: '#otra' }); assert.equal(env.document.body.children.length, 1);
});

test('los títulos del Stock se pintan como texto, nunca como HTML', () => {
  assert.doesNotMatch(fuente, /innerHTML|insertAdjacentHTML|outerHTML/);
  const env = dom(), c = reproducir([{ id: 'x', titulo: '<img src=x onerror=alert(1)>', tipo: 'video', url: S + 'x/asset.mp4', poster: '' }], env, { titulo: '#x' });
  assert.match(titulo(c), /<img src=x onerror=alert\(1\)>/);
});
