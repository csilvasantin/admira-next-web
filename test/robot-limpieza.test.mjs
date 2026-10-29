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
