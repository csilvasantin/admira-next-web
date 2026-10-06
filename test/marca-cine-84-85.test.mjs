// Pieles de cine 84 y 85 (06-10-2026 · FLT-101666 a, petición #5253 de Carlos).
// /marca 84 · ciencia ficción de 1984 (acero, negro, rojo infrarrojo) · /marca 85 · viajes en el tiempo
// de 1985 (noche violeta, llamarada naranja-amarilla, chispa azul). Estética propia: sin logos, fotogramas,
// carteles ni títulos de terceros. Contraste AA (≥ 4,5:1) calculado aquí para texto/fondo y botones.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validarMarca, normalizarMarca, variablesMarca} from '../marcablanca/marca.js';
import {onRequestGet as una} from '../functions/marcablanca/api/marcas/[id]/index.js';
import {onRequestGet as estilo, conMarca} from '../functions/marcablanca/estilo/index.js';

const ROOT = new URL('../', import.meta.url);
const leer = (p) => readFileSync(new URL(p, ROOT), 'utf8');
// assets/marca-blanca.js es un script de navegador con salida CommonJS para pruebas (package.json es type=module).
const MB = (() => { const module = {exports: {}}; vm.runInNewContext(leer('assets/marca-blanca.js'), {module, URLSearchParams, URL}); return module.exports; })();
const marca = (id) => JSON.parse(leer(`marcablanca/clientes/${id}.json`));
const PIELES = ['84', '85'];
const plano = (x) => JSON.parse(JSON.stringify(x));   // objetos del contexto vm → del realm de la prueba
const AA = 4.5;

function assets(){
  return {async fetch(input){
    const url = new URL(typeof input === 'string' ? input : input.url || input.href);
    const ruta = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    try { return new Response(await readFile(new URL('.' + ruta, ROOT)), {headers: {'content-type': ruta.endsWith('.html') ? 'text/html' : 'application/json'}}); }
    catch (_) { return new Response('404', {status: 404}); }
  }};
}
const mezcla = (fondo, color, alfa) => {
  const a = MB.parseColor(fondo), b = MB.parseColor(color);
  const c = (x, y) => Math.round(x * (1 - alfa) + y * alfa);
  return '#' + [c(a.r, b.r), c(a.g, b.g), c(a.b, b.b)].map((v) => v.toString(16).padStart(2, '0')).join('');
};

test('84 y 85 son pieles del catálogo, válidas, de ejemplo y con su libro de estilo', () => {
  const indice = JSON.parse(leer('marcablanca/clientes/index.json'));
  for (const id of PIELES) {
    const m = marca(id);
    assert.deepEqual(validarMarca(m), [], id);
    assert.equal(m.id, id);
    assert.equal(m.modo, 'oscuro', 'admiranext.com es oscuro de serie');
    assert.equal(m.ejemplo, true, 'no es un cliente real');
    assert.ok(indice.clientes.some((c) => c.id === id && c.ejemplo === true), `${id} en el índice`);
    assert.ok(MB.ID_RE.test(id), 'id aceptado por el cargador');
    for (const f of [m.logo.svg, m.favicon]) assert.ok(existsSync(new URL(f, new URL('marcablanca/clientes/', ROOT))), f);
    assert.match(leer(`marcablanca/logos/${id}.svg`), /currentColor/, 'el logo hereda el color del texto');
    for (const f of m.tipografia.fuentes) assert.ok(existsSync(new URL(f.url, new URL('marcablanca/clientes/', ROOT))), 'fuente libre ya servida: ' + f.url);
    assert.equal(normalizarMarca(m).logo.svg, `/marcablanca/logos/${id}.svg`);
  }
});

test('sin material de terceros: ni títulos, ni personajes, ni marcas registradas de las películas', () => {
  const PROHIBIDO = /terminator|skynet|cyberdyne|sarah connor|kyle reese|t-?800|back to the future|regreso al futuro|volver al futuro|delorean|mcfly|doc brown|hill valley|flux|fluzo|condensador|88 ?mph|1\.21|gigawatt/i;
  const css = leer('assets/marca-blanca.css');
  const bloque = css.slice(css.indexOf('Pieles de cine'));
  for (const id of PIELES) {
    for (const t of [leer(`marcablanca/clientes/${id}.json`), leer(`marcablanca/logos/${id}.svg`), leer(`marcablanca/logos/${id}-favicon.svg`)]) assert.doesNotMatch(t, PROHIBIDO, id);
    assert.doesNotMatch(leer(`marcablanca/logos/${id}.svg`), /<image|href=/, 'el logo es solo tipografía y formas propias');
  }
  assert.doesNotMatch(bloque, PROHIBIDO);
  assert.doesNotMatch(bloque, /url\(/, 'los fondos son degradados, no imágenes');
});

test('contraste AA (≥ 4,5:1): texto/fondo, superficies, velo del fondo y botones de 84 y 85', (t) => {
  const informe = [];
  for (const id of PIELES) {
    const m = marca(id);
    for (const modo of ['oscuro', 'claro']) {
      const p = m.colores[modo];
      const pares = [
        ['texto/fondo', p.texto, p.fondo], ['texto/fondoAlt', p.texto, p.fondoAlt],
        ['texto/superficie', p.texto, p.superficie], ['texto/superficieAlt', p.texto, p.superficieAlt],
        ['textoSuave/fondo', p.textoSuave, p.fondo], ['textoSuave/superficie', p.textoSuave, p.superficie],
        ['textoTenue/fondo', p.textoTenue, p.fondo],
        ['botón primario', p.primarioTexto, p.primario], ['botón secundario', p.secundarioTexto, p.secundario],
        ['botón acento', p.acentoTexto, p.acento],
        ['primario/fondo (enlaces)', p.primario, p.fondo], ['acento/fondo', p.acento, p.fondo],
      ];
      // El velo decorativo del fondo (assets/marca-blanca.css) en su opacidad máxima, en el modo de la piel.
      if (modo === m.modo && m.fondos?.velo) {
        const velo = mezcla(p.fondo, m.fondos.velo.color, m.fondos.velo.alfaMax);
        pares.push(['texto/fondo+velo', p.texto, velo], ['textoSuave/fondo+velo', p.textoSuave, velo]);
      }
      for (const [nombre, a, b] of pares) {
        const r = MB.contrast(a, b);
        informe.push(`${id} ${modo} ${nombre} ${a}/${b} = ${r.toFixed(2)}:1`);
        assert.ok(r >= AA, `${id}/${modo} ${nombre}: ${r.toFixed(2)}:1 < 4.5`);
      }
    }
    // Lo que de verdad pinta el armazón: los tokens --mbx-* que calcula marca-blanca.js no caen al
    // negro/blanco de emergencia, salen de la paleta de la piel.
    const vars = variablesMarca(normalizarMarca(m), 'oscuro');
    const x = MB.shellTokens(vars, 'oscuro');
    const p = m.colores.oscuro;
    assert.equal(x['--mbx-ink'], p.texto, `${id}: tinta del armazón = texto de la piel`);
    assert.equal(x['--mbx-brand'], p.primario, `${id}: color de marca = primario`);
    assert.equal(x['--mbx-on-brand'], p.primarioTexto, `${id}: texto sobre botón = primarioTexto`);
    assert.ok(MB.contrast(x['--mbx-on-brand'], x['--mbx-brand']) >= AA);
  }
  t.diagnostic(informe.join('\n'));
});

test('/marca 84, /marca 85 y los atajos /84 y /85 del Experto; /marca off vuelve a Admira', () => {
  assert.deepEqual(plano(MB.parseArg('84')), {kind: 'id', id: '84'});
  assert.deepEqual(plano(MB.parseArg('85')), {kind: 'id', id: '85'});
  assert.equal(MB.parseArg('off').kind, 'off');
  assert.deepEqual(plano(MB.decide('?marca=84', null)), {id: '84', remember: true});
  assert.deepEqual(plano(MB.decide('?marca=off', {getItem: () => '85'})), {id: null, forget: true});
  assert.deepEqual(plano(MB.decide('', {getItem: () => '85'})), {id: '85'}, 'se recuerda en la pestaña');
  const js = leer('assets/experto-admiranext.js');
  assert.match(js, /PIELES_CINE = \[\s*\{id: '84'[\s\S]*\{id: '85'/);
  assert.match(js, /X\.verb\(\{name: p\.id[\s\S]*runMarca\(\[p\.id\], escribirEn\(log\)\)/, '/84 y /85 = /marca 84 y /marca 85');
  assert.match(js, /\/\^\\\/\(84\|85\)\$\/\.test\(v\)/, 'el terminal de la home reenvía /84 y /85');
  // El CLI del armazón delega en la piel cualquier verbo que no tenga: /84 y /85 también allí.
  assert.match(js, /X\.list\(\)\.forEach\(function \(v\) \{/);
  // El armazón y la piel admiten verbos numéricos (se buscan por nombre exacto tras quitar la barra).
  assert.match(leer('suite/experto.js'), /t\.replace\(\/\^\\\/\/, ''\)\.split/);
  const mb = leer('assets/marca-blanca.js');
  assert.match(mb, /function desactivar\(\)[\s\S]*store\.del\(SESSION_KEY\)[\s\S]*cleanup\(\)/, '/marca off borra la marca y limpia el armazón');
});

test('las pieles tienen sus detalles CSS propios (fondo, titulares, foco) solo con su marca activa', () => {
  const css = leer('assets/marca-blanca.css');
  for (const id of PIELES) {
    assert.match(css, new RegExp(`:root\\[data-mb-marca="${id}"\\]\\[data-mb-plataforma="store"\\] body`));
    assert.match(css, new RegExp(`:root\\[data-mb-marca="${id}"\\][^{]*:focus-visible`));
  }
  const ver = leer('assets/marca-blanca.js').match(/marca-blanca\.css\?v=([^']+)'/)[1];
  assert.equal(ver, '20261006-cine-84-85', 'sello nuevo para la hoja con las pieles');
});

test('la API del catálogo sirve 84 y 85 y /marcablanca/estilo?marca= los nombra con 200 y sin salto 308', async () => {
  const env = {ASSETS: assets()};
  for (const id of PIELES) {
    const res = await una({request: new Request(`https://www.admiranext.com/marcablanca/api/marcas/${id}`), env, params: {id}});
    assert.equal(res.status, 200);
    const m = await res.json();
    assert.equal(m.id, id);
    assert.equal(m.logo.svg, `/marcablanca/logos/${id}.svg`);
    assert.equal(m.catalogo.tipo, 'ejemplo');
    for (const url of [`https://www.admiranext.com/marcablanca/estilo?marca=${id}`, `https://www.admiranext.com/marcablanca/estilo/?marca=${id}`]) {
      const r = await estilo({request: new Request(url), env});
      assert.equal(r.status, 200, url);
      const html = await r.text();
      assert.match(html, new RegExp(`<title>Libro de estilo · ${m.nombre} · `));
      assert.match(html, new RegExp(`data-libro-marca="${id}"`));
      assert.ok(html.includes(m.colores.oscuro.primario), 'colores principales en la ficha mínima');
      assert.ok(html.includes('/marcablanca/estilo/estilo.js'), 'el libro completo lo sigue pintando estilo.js');
    }
  }
  const generico = await (await estilo({request: new Request('https://www.admiranext.com/marcablanca/estilo?marca=no-existe'), env})).text();
  assert.match(generico, /<title>Libro de estilo de marca · Marca blanca AdmiraNeXT<\/title>/, 'sin marca conocida, el HTML de siempre');
  assert.match(conMarca('<html><title>x</title><p class="cargando">…</p>', {id: 'x', nombre: '<b>$&</b>', colores: {}}), /&lt;b&gt;\$&amp;&lt;\/b&gt;/, 'escapa el nombre');
});
