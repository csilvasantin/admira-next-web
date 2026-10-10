// Encargo #5552 · vista previa pública. La solicitud queda pendiente y no crea propuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestPost} from '../functions/marcablanca/api/solicitud.js';
import {SOLICITUDES_POR_DIA, PREFIJO_SOLICITUD} from '../functions/marcablanca/api/solicitud.js';

const ORIGEN = 'https://www.admiranext.com';

function kv() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async put(key, value) { values.set(key, String(value)); }
  };
}

function pedir(env, body, headers = {}) {
  return onRequestPost({
    request: new Request(ORIGEN + '/marcablanca/api/solicitud', {
      method: 'POST',
      headers: {'content-type': 'application/json', Origin: ORIGEN, 'CF-Connecting-IP': '203.0.113.55', ...headers},
      body: JSON.stringify(body)
    }),
    env
  });
}

test('la solicitud pública queda pendiente y no escribe una propuesta', async () => {
  const env = {PRESENTATION_IDEAS: kv()};
  const ajena = await onRequestPost({
    request: new Request(ORIGEN + '/marcablanca/api/solicitud', {method: 'POST', headers: {Origin: 'https://evil.example'}, body: '{}'}),
    env
  });
  assert.equal(ajena.status, 403);
  assert.equal((await pedir(env, {nombre: 'A', email: 'no'})).status, 400);

  const r = await pedir(env, {nombre: 'Café Norte', email: 'hola@cafenorte.example', web: 'https://cafenorte.example', idioma: 'en', nota: 'Quiero verla'});
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.estado, 'pendiente');
  assert.equal(body.propuesta, null);
  assert.match(body.id, /^sol-/);
  const claves = [...env.PRESENTATION_IDEAS.values.keys()];
  assert.equal(claves.length, 2);
  assert.ok(claves.some((k) => k.startsWith(PREFIJO_SOLICITUD)));
  assert.equal(claves.some((k) => k.startsWith('propuesta') || k.startsWith('marca:')), false);
  const guardada = JSON.parse(env.PRESENTATION_IDEAS.values.get(claves.find((k) => k.startsWith(PREFIJO_SOLICITUD))));
  assert.equal(guardada.estado, 'pendiente');
  assert.equal(guardada.email, 'hola@cafenorte.example');
  assert.equal(guardada.web, 'https://cafenorte.example/');
});

test('el límite de solicitudes por día responde 429', async () => {
  const env = {PRESENTATION_IDEAS: kv()};
  for (let i = 0; i < SOLICITUDES_POR_DIA; i += 1) {
    const r = await pedir(env, {nombre: 'Marca ' + i, email: `a${i}@marca.example`});
    assert.equal(r.status, 200, 'cabe la ' + i);
  }
  const tope = await pedir(env, {nombre: 'De más', email: 'mas@marca.example'});
  assert.equal(tope.status, 429);
  const body = await tope.json();
  assert.equal(body.propuesta, null);
  assert.equal(body.estado, 'limite');
  assert.ok(Number(tope.headers.get('retry-after')) > 0);
});

test('la página pública habla ES y EN, pinta studio y store, y no lista otros clientes', async () => {
  const html = await readFile(new URL('../marcablanca/vista/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../marcablanca/vista/vista.js', import.meta.url), 'utf8');
  const api = await readFile(new URL('../functions/marcablanca/api/solicitud.js', import.meta.url), 'utf8');
  assert.match(html, /data-en="Your brand, in the browser"/);
  assert.match(html, /data-es="Pide tu propuesta"/);
  assert.match(html, /admira:languagechange/);
  assert.match(html, /vista\.js\?v=20261010-vista-5552/);
  assert.match(js, /\/marcablanca\/api\/analizar/);
  assert.match(js, /\/marcablanca\/api\/solicitud/);
  assert.match(js, /id: 'studio'/);
  assert.match(js, /id: 'store'/);
  assert.match(js, /admira:languagechange/);
  assert.doesNotMatch(js, /\/marcablanca\/api\/marcas|\/api\/clientes/);
  assert.doesNotMatch(html + js, /altadis|jti|lenovo|bbva|mango|decathlon|liverpool|digitalsignage/i);
  assert.doesNotMatch(api, /from ['"][^'"]*_propuesta/);
  const demo = await readFile(new URL('../demo/index.html', import.meta.url), 'utf8');
  assert.match(demo, /href="\/marcablanca\/vista\/"/);
  assert.match(html, /href="\/demo\/"/);
});
