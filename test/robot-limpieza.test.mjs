import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import vm from 'node:vm';

const pageCode = await readFile(new URL('../robot/limpieza/limpieza.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../robot/limpieza/index.html', import.meta.url), 'utf8');
const idioma = await readFile(new URL('../robot/limpieza/idioma.js', import.meta.url), 'utf8');

function load(lang) {
  const context = {document: {documentElement: {getAttribute() {return lang;}}}};
  context.window = context;
  const ctx = vm.createContext(context);
  vm.runInContext(pageCode, ctx);
  return ctx.AdmiraLimpieza;
}

test('la página enseña Mapa1, el banner y la cámara desconectada', async () => {
  assert.match(html, /SIMULACIÓN \/ SIN CONEXIÓN/);
  assert.match(html, /Cámara no conectada/);
  assert.match(html, /mapa1\.jpg/);
  assert.match(html, /Sin conexión\. No hay pose leída\./);
  assert.match(html, /Cocina/);
  assert.match(html, /Terraza/);
  assert.match(html, /Pasillo/);
  assert.doesNotMatch(html, /Yendo a/);
  assert.doesNotMatch(html, /Sneaker Store/);
  assert.doesNotMatch(html, /La Nave/);
  assert.match(html, /disabled/);
  assert.match(html, /lang="es"/);
  assert.doesNotMatch(pageCode, /Yendo a/);
  assert.doesNotMatch(idioma, /Yendo a/);
  const image = await stat(new URL('../robot/limpieza/mapa1.jpg', import.meta.url));
  assert.ok(image.size > 10000);
});

test('sin pose no hay movimiento ni robot dibujado', () => {
  const api = load('es');
  const off = api.create({connected: false});
  assert.equal(off.goToRoom('cocina'), false);
  assert.equal(off.goToRoom('terraza'), false);
  assert.equal(off.view().connected, false);
  assert.equal(off.view().pose, null);
  assert.equal(api.statusMessage(off.view()), 'Sin conexión. No hay pose leída.');
  assert.equal(api.bannerMessage(off.view()), 'SIMULACIÓN / SIN CONEXIÓN');
  assert.equal(api.cameraMessage(off.view()), 'Cámara no conectada');
  assert.doesNotMatch(api.statusMessage(off.view()), /Yendo/);
  const en = load('en');
  const offEn = en.create();
  assert.equal(en.bannerMessage(offEn.view()), 'SIMULATION / NO CONNECTION');
  assert.equal(en.cameraMessage(offEn.view()), 'Camera not connected');
  assert.equal(en.statusMessage(offEn.view()), 'No connection. No pose has been read.');
});

function fakePage() {
  const nodes = {};
  function make(id) {
    const node = {
      id,
      disabled: false,
      textContent: '',
      listeners: {},
      addEventListener(type, fn) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(fn);
      },
      getAttribute() {return null;}
    };
    nodes[id] = node;
    return node;
  }
  ['limpieza-banner', 'limpieza-estado', 'limpieza-senal', 'limpieza-salir', 'limpieza-base', 'limpieza-salir-estado', 'limpieza-base-estado'].forEach(make);
  return {
    nodes,
    root: {
      querySelector(sel) {return nodes[sel.slice(1)] || null;},
      querySelectorAll() {return [];}
    }
  };
}

test('los dos botones están encima de la cámara y nacen sin conexión', () => {
  const salir = html.indexOf('id="limpieza-salir"');
  const base = html.indexOf('id="limpieza-base"');
  const camara = html.indexOf('id="limpieza-camara"');
  assert.ok(salir > 0 && base > salir && camara > base);
  assert.match(html, /Salir · sin conexión/);
  assert.match(html, /Volver a la base · sin conexión/);
  assert.doesNotMatch(html, /Saliendo|Volviendo/);
  assert.doesNotMatch(pageCode, /Saliendo|Volviendo|Yendo a/);
  assert.doesNotMatch(idioma, /Saliendo|Volviendo|Yendo a/);
  assert.match(idioma, /Salir · sin conexión/);
  assert.match(idioma, /Estado leído: /);
  const api = load('es');
  assert.equal(api.buttonLabel('start', null), 'Salir · sin conexión');
  assert.equal(api.buttonLabel('charge', null), 'Volver a la base · sin conexión');
  assert.equal(api.failureStatus('start'), 'Sin conexión. Salir no se ha enviado.');
  assert.equal(api.failureStatus('charge'), 'Sin conexión. Volver a la base no se ha enviado.');
  assert.equal(api.readOutcome('start', null), null);
  assert.equal(api.readOutcome('start', {status: 503, body: {ok: false, error: 'boveda_sin_credenciales'}}), null);
  assert.equal(api.readOutcome('start', {status: 200, body: {ok: true, command: 'app_charge', state: 'charging'}}), null);
  assert.equal(api.readOutcome('start', {status: 200, body: {ok: true, command: 'app_start', state: '<script>'}}), null);
  assert.equal(api.readOutcome('charge', {status: 200, body: {ok: true, command: 'app_start', state: 'cleaning'}}), null);
  const en = load('en');
  assert.equal(en.buttonLabel('start', null), 'Leave dock · no connection');
  assert.equal(en.failureStatus('charge'), 'No connection. Return to dock was not sent.');
});

test('un fallo de puente no dice que la orden salió', async () => {
  const api = load('es');
  const page = fakePage();
  api.mount(page.root, {connected: false, fetch: async () => {throw new Error('sin puente');}});
  assert.equal(page.nodes['limpieza-salir'].textContent, 'Salir · sin conexión');
  assert.equal(page.nodes['limpieza-base'].textContent, 'Volver a la base · sin conexión');
  assert.equal(page.nodes['limpieza-banner'].textContent, 'SIMULACIÓN / SIN CONEXIÓN');
  page.nodes['limpieza-salir'].listeners.click[0]({preventDefault() {}});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(page.nodes['limpieza-salir'].textContent, 'Salir · sin conexión');
  assert.equal(page.nodes['limpieza-salir-estado'].textContent, 'Sin conexión. Salir no se ha enviado.');
  assert.equal(page.nodes['limpieza-banner'].textContent, 'SIMULACIÓN / SIN CONEXIÓN');
  assert.doesNotMatch(page.nodes['limpieza-salir'].textContent + page.nodes['limpieza-salir-estado'].textContent, /Saliendo|Yendo/);
});

test('una respuesta real enseña el estado leído y no lo traduce', async () => {
  const api = load('es');
  const seen = [];
  const outcome = await api.ask('start', async (url) => {
    seen.push(url);
    return {status: 200, json: async () => ({ok: true, command: 'app_start', state: 'cleaning', battery: 80})};
  });
  assert.deepEqual(seen, ['http://127.0.0.1:8765/start']);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.command, 'app_start');
  assert.equal(outcome.state, 'cleaning');
  assert.equal(outcome.battery, 80);
  assert.equal(api.outcomeStatus(outcome), 'Estado leído: cleaning. Batería: 80');
  assert.equal(api.buttonLabel('start', outcome), 'Salir');
  assert.doesNotMatch(api.outcomeStatus(outcome), /Yendo|Saliendo|Volviendo/);
  const page = fakePage();
  api.mount(page.root, {
    fetch: async (url) => {
      assert.equal(url, 'http://127.0.0.1:8765/charge');
      return {status: 200, json: async () => ({ok: true, command: 'app_charge', state: 'charging', battery: '80'})};
    }
  });
  page.nodes['limpieza-base'].listeners.click[0]({preventDefault() {}});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(page.nodes['limpieza-base'].textContent, 'Volver a la base');
  assert.equal(page.nodes['limpieza-base-estado'].textContent, 'Estado leído: charging');
  assert.equal(page.nodes['limpieza-banner'].textContent, 'RESPUESTA LEÍDA / SIN POSE');
  assert.equal(page.nodes['limpieza-senal'].textContent, 'Cámara no conectada');
  assert.doesNotMatch(page.nodes['limpieza-base-estado'].textContent, /base|Yendo/);
});

test('lidar, cámara y brazo se declaran imposibles y no se inventan', () => {
  const plano = html.indexOf('id="limpieza-plano"');
  const lidar = html.indexOf('id="limpieza-lidar"');
  const senal = html.indexOf('id="limpieza-senal"');
  const visor = html.indexOf('id="limpieza-visor"');
  const brazo = html.indexOf('id="limpieza-brazo"');
  assert.ok(plano > 0 && lidar > plano);
  assert.ok(senal > 0 && visor > senal && brazo > visor);
  assert.match(html, /Capa de lidar: no disponible/);
  assert.match(html, /No hay visor de cámara/);
  assert.match(html, /Brazo: la librería no trae una orden para moverlo/);
  assert.doesNotMatch(html, /<video|<canvas|getUserMedia/);
  assert.doesNotMatch(pageCode, /getUserMedia|<video|nube de puntos/);
  assert.match(idioma, /Capa de lidar: no disponible/);
  assert.match(idioma, /No hay visor de cámara/);
  assert.doesNotMatch(html, /Yendo a/);
});

test('una pose solo se muestra si viene marcada como conectada', () => {
  const api = load('es');
  const lied = api.create({connected: false, pose: {x: 1, y: 2}});
  assert.equal(lied.view().pose, null);
  const live = api.create({connected: true, pose: {x: 1200, y: 800}});
  assert.equal(live.view().connected, true);
  assert.equal(live.view().pose.x, 1200);
  assert.equal(api.statusMessage(live.view()), 'Pose leída.');
  assert.equal(live.goToRoom('cocina'), false);
  assert.equal(api.cameraMessage(live.view()), 'Cámara no conectada');
});
