import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('la preview repite todos los bindings y usa la base de login real', () => {
  const json = JSON.parse(leer('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));
  const preview = json.env.preview;
  assert.equal(preview.d1_databases[0].database_name, 'admiranext-auth');
  assert.equal(preview.d1_databases[0].database_id, json.d1_databases[0].database_id);
  assert.equal(preview.d1_databases[0].database_id, '1568f825-4dfb-40a9-ac40-c6776ee62b3e');
  const kv = new Set(preview.kv_namespaces.map((item) => item.binding));
  for (const binding of ['PRESENTATION_IDEAS', 'AVATAR_FLAGS', 'VISOR_LINKS', 'UBICACIONES']) assert.ok(kv.has(binding), binding);
  assert.equal(preview.r2_buckets[0].binding, 'PRESENTATION_MEDIA');
  assert.equal(preview.services[0].binding, 'PIXERIA_STOCK');
  assert.doesNotMatch(leer('wrangler.jsonc'), /admiranext-mapa-preview-auth/);
});

test('el mapa pinta calles sin iconos de servicios, marca el dato de prueba y no deja la pastilla duplicada', () => {
  const js = leer('pruebas/mapa/mapa.js');
  const html = leer('pruebas/mapa/index.html');
  assert.match(js, /World_Dark_Gray_Base/);
  assert.match(js, /World_Light_Gray_Base/);
  assert.match(js, /openstreetmap\.org\/copyright/);
  assert.doesNotMatch(js, /basemaps\.cartocdn\.com/);
  assert.match(js, /Dato de prueba/);
  assert.match(js, /iconSize:\[32,32\]/);
  assert.match(js, /L\.circle|G\.L\.circle/);
  assert.doesNotMatch(js, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(html, /id="mapa-origen"/);
  const canvas = html.slice(html.indexOf('mapa-canvas-wrap'), html.indexOf('equipos-titulo'));
  assert.match(canvas, /class="mapa-legend"/);
});

test('sin AUTH_DB una página de /pruebas responde 401 y no 503', async () => {
  const {onRequest} = await import('../functions/pruebas/_middleware.js');
  const next = async () => new Response('SECRETO');
  for (const ruta of ['/pruebas/', '/pruebas/mapa/', '/pruebas/visor/']) {
    const res = await onRequest({request: new Request('https://www.admiranext.com' + ruta), env: {WEBMASTER_SIGNING_KEY: 'clave-de-prueba'}, next});
    assert.notEqual(res.status, 503, ruta);
    assert.equal(res.status, 401, ruta);
    const body = await res.text();
    assert.match(body, /Zona de pruebas|Acceso interno/);
    assert.doesNotMatch(body, /SECRETO/);
  }
  const asset = await onRequest({request: new Request('https://www.admiranext.com/pruebas/mapa/mapa.js'), env: {WEBMASTER_SIGNING_KEY: 'clave-de-prueba'}, next});
  assert.equal(asset.status, 401);
  assert.match(await asset.text(), /Sin sesión/);
  const vacio = await onRequest({request: new Request('https://www.admiranext.com/pruebas/mapa/'), env: {}, next});
  assert.notEqual(vacio.status, 503);
  assert.equal(vacio.status, 401);
});
