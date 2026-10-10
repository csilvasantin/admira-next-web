/*
 * Frontier (Carlos, 10-10-2026): sección de lo más avanzado de Admira (gafas Meta, el vaso,
 * tinta electrónica MagSafe, robotics). Regla DMZ: toda novedad va a /pruebas, detrás del login; nada cambia en público.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { onRequest as pruebas } from '../functions/pruebas/_middleware.js';

const PAGINAS = ['pruebas/frontier/index.html', 'pruebas/frontier/gafas-meta/index.html', 'pruebas/frontier/vaso/index.html', 'pruebas/frontier/tinta-electronica/index.html', 'pruebas/frontier/robotics/index.html'];
const leer = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('Frontier vive solo en /pruebas: sin sesión, 401 en cada página y en sus assets', async () => {
  const env = { WEBMASTER_SIGNING_KEY: 'k', AUTH_DB: { prepare() { return { bind() { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) }; } } };
  for (const ruta of ['/pruebas/frontier/', '/pruebas/frontier/gafas-meta/', '/pruebas/frontier/vaso/', '/pruebas/frontier/tinta-electronica/', '/pruebas/frontier/robotics/', '/pruebas/frontier/assets/frontier.css', '/pruebas/frontier/assets/mj-bad-32x16.gif', '/pruebas/frontier/assets/eink-capsula-tinta-electronica.png']) {
    const res = await pruebas({ request: new Request('https://www.admiranext.com' + ruta), env, next: async () => new Response('FRONTIER') });
    assert.equal(res.status, 401, ruta);
    assert.doesNotMatch(await res.text(), /FRONTIER/, ruta);
  }
});

test('cada página: noindex, bilingüe ES/EN, armazón cuadrático y «Acceso privado»', () => {
  for (const rel of PAGINAS) {
    assert.ok(existsSync(new URL('../' + rel, import.meta.url)), rel);
    const html = leer(rel);
    assert.match(html, /<meta name="robots" content="noindex,nofollow/, rel);
    assert.match(html, /data-l="es"/, rel);
    assert.match(html, /data-l="en"/, rel);
    assert.match(html, /data-yk-frame="cabecera" data-yk-auto="on"/, rel);
    assert.match(html, /Acceso privado/, rel);
    assert.match(html, /frontier\.js\?v=/, rel);
  }
  const js = leer('pruebas/frontier/assets/frontier.js');
  assert.match(js, /admira:languagechange/);
  assert.match(js, /get\('lang'\)/);
  assert.match(js, /window\.setLanguage/, '/idioma y /language llegan por setLanguage');
  assert.match(js, /fx-cli-min/, '⌘ Experto minimizado siempre visible');
  for (const rel of PAGINAS) assert.doesNotMatch(leer(rel), /data-fx-lang-btn|>ESP<\/button>|>ENG<\/button>/, rel + ': sin botones ESP/ENG');
});

test('cada tarjeta lleva estado y evidencia; la maqueta de las gafas se declara maqueta', () => {
  const idx = leer('pruebas/frontier/index.html');
  for (const ruta of ['/pruebas/frontier/gafas-meta/', '/pruebas/frontier/vaso/', '/pruebas/frontier/tinta-electronica/', '/pruebas/frontier/robotics/']) assert.match(idx, new RegExp('href="' + ruta + '"'));
  assert.equal((idx.match(/<article class="fx-card">/g) || []).length, 4);
  assert.equal((idx.match(/<article class="fx-card">[\s\S]*?class="fx-estado /g) || []).length, 4);
  const gafas = leer('pruebas/frontier/gafas-meta/index.html');
  assert.match(gafas, /Maqueta, no es una captura real/);
  assert.match(gafas, /Mock-up, not a real capture/);
  assert.match(gafas, /wearables\.developer\.meta\.com\/docs\/develop\/dat\/display-overview/);
  const rob = leer('pruebas/frontier/robotics/index.html');
  assert.match(rob, /en exploración/);
  const tinta = leer('pruebas/frontier/tinta-electronica/index.html');
  assert.match(tinta, /SY11-ab/);
  assert.match(tinta, /15:23 Madrid/);
  assert.match(tinta, /Nemotron 3 Ultra/);
  assert.match(tinta, /eink-capsula-tinta-electronica\.png/);
  assert.match(tinta, /eink-fold-15-after\.jpg/);
  assert.match(tinta, /prototipo/);
  assert.match(tinta, /FLT-101847/);
  assert.match(tinta, /Hoja de ruta sin móvil|Roadmap without a phone/);
  assert.ok(existsSync(new URL('../pruebas/frontier/assets/eink-capsula-tinta-electronica.png', import.meta.url)));
  assert.ok(existsSync(new URL('../pruebas/frontier/assets/eink-fold-15-after.jpg', import.meta.url)));
});

test('la web pública no enlaza Frontier', () => {
  for (const rel of ['index.html', 'sitemap.xml', 'pruebas/index.html']) assert.doesNotMatch(leer(rel), /frontier/i, rel);
});
