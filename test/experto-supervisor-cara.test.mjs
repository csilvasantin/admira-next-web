// La cara del Supervisor (18-oct-2026): la tercera mascota del ⌘ Experto (Admirito con gorra de vigilante y ojo de
// cámara, digitalavatar.ai nube.html?personaje=supervisor) sale en el panel del avatar al ejecutar /supervisor y
// /supervisor estado, sin quitar la cámara de Admira Live. Contrato: mcp/SUPERVISOR.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const experto = readFileSync(new URL('../suite/experto.js', import.meta.url), 'utf8');
const avatar = readFileSync(new URL('../assets/avatar.js', import.meta.url), 'utf8');
const doc = readFileSync(new URL('../mcp/SUPERVISOR.md', import.meta.url), 'utf8');
const existing = readFileSync(new URL('./experto-bugito.test.mjs', import.meta.url), 'utf8');
const base = existing.slice(existing.indexOf('function consola('), existing.indexOf("test('/bugito está"));

// Una lectura del tablero como la de supervisor-core.mjs (leerTablero) y un lector de mentira con su misma forma.
const LECTURA = {estado: 'encendida', fresco: true, edadMs: 4000, ciclo: 26343, foto: '', capturada: 0,
  abiertas: [{id: 'INC-KOBKYX', url: 'https://www.admira.app/ticket?id=INC-KOBKYX', cuando: 0}]};
function lector(lectura = LECTURA) {
  const lecturas = [];
  return {lecturas, core: {
    leerSupervisor: async () => { lecturas.push(1); return lectura; },
    parteSupervisor: (l, lang) => [`Supervisor · MBP16 (GDG51-PAN-07)`, (lang === 'en' ? 'state ' : 'estado ') + l.estado, ...l.abiertas.map((i) => 'Incidencia abierta: ' + i.id)],
    textoEstado: (e, lang) => ({encendida: ['Pantalla encendida', 'Screen on'], 'sin-senal': ['Sin señal del Supervisor', 'No signal from Supervisor']}[e] || ['?', '?'])[lang === 'en' ? 1 : 0]
  }};
}
// El avatar de la página: sólo lo que la suite usa (cara), y lo que la cara recibe.
function avatarFalso({conCara = true} = {}) {
  const caras = [], enviados = [];
  const A = {floatingCharacters: true, handle: async () => '', personaje: () => null};
  if (conCara) A.cara = (id, opts) => { caras.push({id, opts}); return {enviar: (m) => { enviados.push(m); return true; }, cerrar() {}}; };
  return {A, caras, enviados};
}
function consola({hostname = 'www.admira.store', lang = 'es', core = lector().core, avatar: av = avatarFalso(), search = ''} = {}) {
  const calls = {open: 0, reveal: 0}; let camera, hidden = true;
  const toggle = {getAttribute: () => (hidden ? 'false' : 'true'), click() { hidden = false; calls.reveal++; }};
  const entry = {click() { calls.open++; camera = {querySelector: () => toggle}; }};
  const query = (s) => (s === '#analizar-webcam' ? camera : s === 'button[data-verb="analizar"]' ? entry : null);
  const fixture = base.replace('hostname: host', 'hostname: testHost').replace("search: ''", 'search: testSearch')
    .replace('querySelector: () => null, querySelectorAll: () => [],\n    createElement', 'querySelector: testQuery, querySelectorAll: () => [],\n    createElement')
    .replace('sandbox.window = sandbox;', 'sandbox.AdmiraWebcam={mount(){}};if(testCore)sandbox.AdmiraSupervisorCore=testCore;sandbox.window = sandbox;');
  const context = {experto, vm, URL, URLSearchParams, testHost: hostname, testSearch: search, testQuery: query, testCore: core, testAvatar: av.A};
  vm.runInNewContext(fixture + ';result=consola({lang:' + JSON.stringify(lang) + ', AdmiraAvatar: testAvatar});', context);
  return {...context.result, calls, ...av};
}
const espera = () => new Promise((r) => setImmediate(r));

test('/supervisor estado da el parte sin salir de la página y saca la cara con lo que ve', async () => {
  const {core, lecturas} = lector();
  const c = consola({core});
  const r = await c.run('/supervisor estado');
  assert.equal(r.ok, true);
  assert.deepEqual(Array.from(r.abiertas), ['INC-KOBKYX']);
  assert.deepEqual(Array.from(c.fuera), [], 'no navega: la cámara no se toca');
  assert.equal(lecturas.length, 1);
  assert.match(c.texto(), /Supervisor: leyendo la cámara del MBP16…/);
  assert.match(c.texto(), /Incidencia abierta: INC-KOBKYX/);
  assert.deepEqual(c.caras.map((x) => x.id), ['supervisor']);
  assert.deepEqual(JSON.parse(JSON.stringify(c.enviados)), [
    {estado: 'enfocando', silencio: true},
    {estado: 'encendida', ticket: 'INC-KOBKYX', lang: 'es', texto: 'Pantalla encendida · incidencia INC-KOBKYX abierta.'}
  ], 'primero enfoca y luego dice lo que ve el tablero, tal cual');
  const en = consola({lang: 'en'});
  await en.run('/supervisor status');
  assert.equal(en.enviados.at(-1).texto, 'Screen on · incident INC-KOBKYX open.');
});

test('sin señal el parte no es un éxito y la cara lo dice', async () => {
  const c = consola({core: lector({...LECTURA, estado: 'sin-senal', fresco: false, abiertas: []}).core});
  const r = await c.run('/supervisor estado');
  assert.equal(r.ok, false);
  assert.deepEqual(JSON.parse(JSON.stringify(c.enviados.at(-1))), {estado: 'sin-senal', ticket: '', lang: 'es', texto: 'Sin señal del Supervisor.'});
});

test('el parte sale aunque el avatar de la página no sepa sacar caras (cargador anterior)', async () => {
  const c = consola({avatar: avatarFalso({conCara: false})});
  const r = await c.run('/supervisor estado');
  assert.equal(r.ok, true);
  assert.match(c.texto(), /Incidencia abierta: INC-KOBKYX/);
});

test('si el lector de admira.biz no carga, lo dice y no inventa una lectura', async () => {
  const c = consola({core: null});
  const r = await c.run('/supervisor estado');
  assert.equal(r.ok, false);
  assert.match(c.texto(), /No se pudo cargar el lector del Supervisor \(admira\.biz\/supervisor-core\.mjs\)/);
  assert.equal(c.enviados.at(-1).estado, 'sin-senal');
});

test('en Admira Live, /supervisor abre la cámara y además la cara, con lo que ve', async () => {
  const c = consola({hostname: 'www.admira.live'});
  assert.equal((await c.run('/supervisor')).ok, true);
  await espera();
  assert.deepEqual(c.calls, {open: 1, reveal: 1}, 'la cámara, como siempre');
  assert.deepEqual(Array.from(c.fuera), []);
  assert.deepEqual(c.caras.map((x) => x.id), ['supervisor']);
  assert.equal(c.enviados.at(-1).estado, 'encendida');
  assert.doesNotMatch(c.texto(), /Incidencia abierta/, 'el parte no ensucia la consola: es para la cara');
});

test('fuera de Admira Live, /supervisor va a la cámara como siempre; la cara sale al llegar', async () => {
  const c = consola();
  assert.equal((await c.run('/supervisor')).ok, true);
  await espera();
  assert.deepEqual(Array.from(c.fuera), ['https://www.admira.live/analizar?supervisor=1&lang=es']);
  assert.deepEqual(c.caras, [], 'la página se va: no tiene sentido abrirla aquí');
  const llegada = consola({hostname: 'admira.live', search: '?supervisor=1'});
  await espera();
  assert.deepEqual(llegada.calls, {open: 1, reveal: 1});
  assert.deepEqual(llegada.caras.map((x) => x.id), ['supervisor'], 'al llegar a la cámara sale la cara');
});

test('las órdenes de la cara son las del verbo: «¿qué ves?» da el parte y «abre la cámara» va a la cámara', async () => {
  const {core, lecturas} = lector();
  const c = consola({core});
  await c.run('/supervisor estado');
  const orden = c.caras[0].opts.orden;
  orden({orden: 'estado', texto: '¿Qué ves?', lang: 'es'});
  await espera(); await espera();
  assert.equal(lecturas.length, 2, 'vuelve a leer el tablero');
  orden({orden: 'camara', texto: 'Abre la cámara', lang: 'es'});
  assert.deepEqual(Array.from(c.fuera), ['https://www.admira.live/analizar?supervisor=1&lang=es']);
});

test('los argumentos siguen sin ejecutar nada más que estado', async () => {
  const c = consola();
  for (const t of ['/supervisor rotation-90', '/supervisor estado; rm -rf', '/supervisor cara']) {
    assert.equal((await c.run(t)).ok, false, t);
  }
  assert.deepEqual(Array.from(c.fuera), []);
  assert.deepEqual(c.caras, []);
});

test('el cargador: Supervisor es sólo cara (el verbo es de la suite) y su mensaje sale acotado', () => {
  const module = {exports: {}};
  vm.runInNewContext(avatar, {module, globalThis: {}, window: undefined});
  const A = module.exports;
  assert.equal(A.decide('/supervisor'), null, 'avatar.js no le quita /supervisor a la suite');
  assert.equal(A.decide('/supervisor estado'), null);
  assert.equal(A.decide('/bugito'), 'bugito');
  assert.equal(A.decide('/arquitecto'), 'arquitecto');
  assert.equal(A.PERSONAJES.supervisor.soloCara, true);
  assert.match(A.personajeUrl('supervisor', {lang: 'en'}), /^https:\/\/digitalavatar\.ai\/nube\.html\?dock=1&.*personaje=supervisor&lang=en&tier=good$/);
  assert.equal('supervisor' in A.LEVELS, false, 'nunca pasa a ser la cara por defecto de un sitio');
  const plano = (x) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(plano(A.caraMensaje('supervisor', {estado: 'apagada', incidencia: {id: 'INC-7K2Q9', url: 'x'}, texto: '  Pantalla a oscuras.  ', espera: 'apagada', lang: 'es', foto: 'https://evil', silencio: 'si'})),
    {type: 'da-supervisor', estado: 'apagada', espera: 'apagada', ticket: 'INC-7K2Q9', texto: 'Pantalla a oscuras.', lang: 'es'});
  assert.equal(A.caraMensaje('supervisor', {estado: '<img onerror>'}), null);
  assert.equal(A.caraMensaje('supervisor', {estado: '__proto__'}), null);
  assert.equal(A.caraMensaje('pirata', {estado: 'vigilando'}), null);
  assert.equal(A.caraMensaje('supervisor', {estado: 'vigilando', ticket: 'DROP TABLE'}).ticket, undefined);
  assert.equal(A.caraMensaje('supervisor', {estado: 'vigilando', texto: 'x'.repeat(999)}).texto.length, 240);
  assert.deepEqual(plano(A.caraOrden('supervisor', {type: 'da-supervisor-orden', orden: 'estado', texto: '¿Qué ves?', lang: 'en'})), {orden: 'estado', texto: '¿Qué ves?', lang: 'en'});
  assert.equal(A.caraOrden('supervisor', {type: 'da-bugito-orden', orden: 'estado'}), null, 'otra cara: nada');
  assert.equal(A.caraOrden('supervisor', {type: 'da-supervisor-orden', orden: 'rm -rf'}), null);
  assert.equal(A.caraOrden('supervisor', {type: 'da-supervisor-orden', orden: 'estado', texto: 'y'.repeat(900)}).texto.length, 500);
});

test('el cargador sólo habla con su propio iframe y con el origen de digitalavatar.ai', () => {
  const i = avatar.indexOf('function escucharCaras()');
  const listener = avatar.slice(i, avatar.indexOf('function handle(text)', i));
  assert.match(listener, /ev\.origin !== CARA_ORIGIN/);
  assert.match(listener, /ev\.source !== frame\.contentWindow/);
  assert.match(avatar, /var CARA_ORIGIN = 'https:\/\/digitalavatar\.ai';/);
  assert.match(avatar, /frame\.contentWindow\.postMessage\(m, CARA_ORIGIN\)/, 'nunca a «*»');
  assert.match(avatar, /if\(!A\.cara\)A\.cara=cara;/, 'también al mejorar un cargador anterior');
});

test('el contrato está escrito: mcp/SUPERVISOR.md y la ayuda del verbo', async () => {
  for (const s of ['/supervisor estado', 'da-supervisor-listo', 'da-supervisor-orden', 'AdmiraAvatar.cara', 'supervisor-core.mjs', 'admira.live', 'soloCara', 'INC-'])
    assert.ok(doc.includes(s), s);
  const c = consola();
  await c.run('/help');
  assert.match(c.texto(), /estado da su parte/);
});

test('el arranque del cargador no pliega un panel que ya se abrió (la cara del Supervisor no se esconde sola)', () => {
  const boot = avatar.slice(avatar.indexOf('function boot() {'), avatar.indexOf("if (doc.readyState === 'loading')"));
  assert.match(boot, /if \(override\(\) !== null\) return;[\s\S]*if \(visible\(\)\) return;[\s\S]*show\(false\)/);
});
