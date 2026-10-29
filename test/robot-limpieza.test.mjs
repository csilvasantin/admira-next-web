import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const robotCode = await readFile(new URL('../pruebas/mapa/robot.js', import.meta.url), 'utf8');
const pageCode = await readFile(new URL('../robot/limpieza/limpieza.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../robot/limpieza/index.html', import.meta.url), 'utf8');

function load(lang) {
  const timers = [];
  const context = {
    setTimeout(fn) {const id = timers.push(fn); return id;},
    clearTimeout(id) {timers[id - 1] = null;},
    document: {documentElement: {getAttribute() {return lang;}}}
  };
  context.window = context;
  const ctx = vm.createContext(context);
  vm.runInContext(robotCode, ctx);
  vm.runInContext(pageCode, ctx);
  function flush(limit = 30) {
    let guard = 0;
    while (timers.some(Boolean) && guard < limit) {
      const i = timers.findIndex(Boolean);
      const fn = timers[i];
      timers[i] = null;
      fn();
      guard += 1;
    }
    return guard;
  }
  return {api: ctx.AdmiraLimpieza, robot: ctx.AdmiraMapaRobot, flush};
}

test('la página muestra salas, parar y el aviso de cámara', () => {
  assert.match(html, /Ir a Cocina/);
  assert.match(html, /Ir a Terraza/);
  assert.match(html, /Ir a Pasillo/);
  assert.match(html, /Ir a Sneaker Store/);
  assert.match(html, /Ir a La Nave/);
  assert.match(html, /id="limpieza-parar"/);
  assert.match(html, /No hay señal de cámara/);
  assert.match(html, /lang="es"/);
});

test('ir a una sala mueve el simulado y parar lo deja a medias', () => {
  const {api, robot, flush} = load('es');
  const slow = api.create({driver: robot.createSimDriver({multiplier: () => 1})});
  // El driver de arriba usa los temporizadores del contexto porque no se los pasamos.
  assert.equal(slow.goToRoom('no-existe'), false);
  assert.equal(slow.view().status, 'idle');
  assert.equal(slow.goToRoom('cocina'), true);
  assert.equal(slow.view().status, 'driving');
  assert.equal(slow.view().roomName, 'Cocina');
  flush(1);
  const mid = slow.view().pose;
  slow.stop();
  const steps = flush(5);
  assert.equal(steps, 0);
  assert.equal(slow.view().status, 'stopped');
  assert.equal(slow.view().pose.lat, mid.lat);
  assert.equal(api.statusMessage(slow.view()), 'Robot parado');
  assert.equal(api.cameraMessage(slow.view()), 'No hay señal de cámara');
});

test('el simulado llega y la cámara avisa en el idioma de la página', () => {
  const es = load('es');
  const en = load('en');
  const fast = es.api.create({
    driver: es.robot.createSimDriver({
      multiplier: () => 10000,
      setTimeout(fn) {fn(); return 1;},
      clearTimeout() {}
    })
  });
  assert.equal(fast.goToRoom('la-nave'), true);
  const arrived = fast.view();
  assert.equal(arrived.status, 'arrived');
  assert.equal(arrived.roomName, 'La Nave');
  assert.ok(Math.abs(arrived.pose.lat - 41.39898) < 0.0002);
  assert.equal(arrived.camera.signal, false);
  assert.equal(es.api.cameraMessage(arrived), 'No hay señal de cámara');
  assert.equal(es.api.statusMessage(arrived), 'En La Nave');
  const withCamera = en.api.create({
    driver: {
      goTo() {},
      stop() {},
      onPose() {},
      onArrive() {},
      cameraURL() {return 'https://robot.local/camera.mjpg';}
    }
  });
  assert.equal(withCamera.view().camera.signal, true);
  assert.equal(en.api.cameraMessage(withCamera.view()), 'Live camera');
  withCamera.failCamera();
  assert.equal(withCamera.view().camera.signal, false);
  assert.equal(en.api.cameraMessage(withCamera.view()), 'No camera signal');
});
