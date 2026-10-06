// Pieles de cine 81–89 (06-10-2026 · FLT-101666 a y b, petición #5253 de Carlos; 81–83 en la ampliación #5256).
// #5256) /marca 81 · aventura en el desierto de 1981 (arena, cuero, mapas) · /marca 82 · neón bajo la lluvia de 1982
//    (magenta y cian sobre negro mojado) · /marca 83 · noche de barrio (luna, azul de silueta, rojo cálido).
// a) /marca 84 · ciencia ficción de 1984 (acero, negro, rojo infrarrojo) · /marca 85 · viajes en el tiempo
//    de 1985 (noche violeta, llamarada naranja-amarilla, chispa azul).
// b) /marca 86 · aviación de 1986 (atardecer, dorado de aviador) · /marca 87 · ciencia ficción policial de 1987
//    (cromo, azul patrulla, HUD) · /marca 88 · cine negro y animación de 1988 (sepia, rojo de dibujo) ·
//    /marca 89 · gótico urbano de 1989 (negro, amarillo de reflector).
// Estética propia: sin logos, fotogramas, carteles, títulos ni personajes de terceros.
// Contraste AA (≥ 4,5:1) calculado aquí para texto/fondo y botones.
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
const PIELES = ['81', '82', '83', '84', '85', '86', '87', '88', '89'];
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

test('81–89 son pieles del catálogo, válidas, de ejemplo y con su libro de estilo', () => {
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
  const PROHIBIDO = new RegExp([
    // 81 · aventura en el desierto
    'indiana', '\\bjones\\b', 'raiders', 'lost ark', '\\bark\\b', 'arca perdida', 'busca del arca', 'marion ravenwood', 'belloq', 'sallah', 'harrison ford',
    // 82 · neón bajo la lluvia
    'blade ?runner', 'deckard', 'replicant', 'replicante', 'tyrell', 'nexus', 'voight', 'kampff', 'roy batty', 'rachael', '\\bgaff\\b', 'tears in rain', 'lágrimas en la lluvia', 'ridley scott', 'philip k',
    // 83 · noche de barrio
    'elliott', 'extraterrestre', '\\be\\.?t\\.(?=\\s|$|[^a-z])', 'phone home', 'mi casa', 'reese', 'spielberg', 'lucasfilm',
    // 84 · 85
    'terminator', 'skynet', 'cyberdyne', 'sarah connor', 'kyle reese', 't-?800', 'back to the future', 'regreso al futuro', 'volver al futuro',
    'delorean', 'mcfly', 'doc brown', 'hill valley', 'flux', 'fluzo', 'condensador', '88 ?mph', '1\\.21', 'gigawatt',
    // 86 · aviación
    'top ?gun', '\\bmaverick', '\\bgoose\\b', '\\biceman', 'miramar', 'viper\\b', 'charlie blackwood', 'peligro en las alturas', 'highway to the danger', 'danger zone', 'take my breath',
    // 87 · ciencia ficción policial
    'robo-?cop', 'alex murphy', '\\bocp\\b', 'omni ?consumer', 'ed-?209', 'clarence boddicker', 'delta city', 'anne lewis',
    // 88 · cine negro y animación
    'roger', 'rabbit', 'conejo', 'jessica', 'toontown', 'dibujolandia', 'judge doom', 'juez doom', 'eddie valiant', 'acme', 'baby herman', 'quién engañó', 'quien engaño',
    // 89 · gótico urbano
    'batman', 'bat-?signal', 'bati', 'murci[eé]lago', '\\bbat\\b', 'bruce wayne', '\\bwayne\\b', 'joker', 'jack napier', 'gotham', 'alfred', 'vicki vale', 'tim burton', 'gordon',
    // estudios
    'paramount', 'orion pictures', 'tri-?star', 'warner', 'disney', 'amblin', 'touchstone', 'carolco', 'universal pictures',
  ].join('|'), 'i');
  // La lista funciona: detecta los nombres pedidos y no salta con palabras normales.
  for (const x of ['Indiana Jones', 'Blade Runner', 'Deckard', 'un replicante', 'Elliott', 'E.T.', 'el extraterrestre', 'Spielberg', 'Lucasfilm', 'Amblin', 'Top Gun', 'Batman', 'Gotham', 'RoboCop', 'Roger Rabbit'])
    assert.match(x, PROHIBIDO, x);
  for (const x of ['dark', 'park', 'etc.', 'Desert', 'neón', 'luna llena', 'Sal a mirar la luna', 'estrellas'])
    assert.doesNotMatch(x, PROHIBIDO, x);
  const css = leer('assets/marca-blanca.css');
  const bloque = css.slice(css.indexOf('Pieles de cine'));
  for (const id of PIELES) {
    for (const t of [leer(`marcablanca/clientes/${id}.json`), leer(`marcablanca/logos/${id}.svg`), leer(`marcablanca/logos/${id}-favicon.svg`)]) assert.doesNotMatch(t, PROHIBIDO, id);
    assert.doesNotMatch(leer(`marcablanca/logos/${id}.svg`), /<image|href=/, 'el logo es solo tipografía y formas propias');
  }
  assert.doesNotMatch(bloque, PROHIBIDO);
  assert.doesNotMatch(bloque, /url\(/, 'los fondos son degradados, no imágenes');
});

test('contraste AA (≥ 4,5:1): texto/fondo, superficies, velo del fondo y botones de 81–89', (t) => {
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

test('/marca 81…89 y los atajos /81…/89 del Experto; /marca off vuelve a Admira', () => {
  assert.deepEqual(plano(MB.parseArg('84')), {kind: 'id', id: '84'});
  for (const id of PIELES) assert.deepEqual(plano(MB.parseArg(id)), {kind: 'id', id});
  assert.equal(MB.parseArg('off').kind, 'off');
  assert.deepEqual(plano(MB.decide('?marca=84', null)), {id: '84', remember: true});
  assert.deepEqual(plano(MB.decide('?marca=off', {getItem: () => '85'})), {id: null, forget: true});
  assert.deepEqual(plano(MB.decide('', {getItem: () => '85'})), {id: '85'}, 'se recuerda en la pestaña');
  const js = leer('assets/experto-admiranext.js');
  assert.match(js, new RegExp('PIELES_CINE = \\[\\s*' + PIELES.map((id) => `\\{id: '${id}'`).join('[\\s\\S]*')), 'las nueve pieles, en orden');
  assert.match(js, /X\.verb\(\{name: p\.id[\s\S]*runMarca\(\[p\.id\], escribirEn\(log\)\)/, '/84 y /85 = /marca 84 y /marca 85');
  assert.ok(js.includes('/^\\/8[1-9]$/.test(v)'), 'el terminal de la home reenvía /81…/89');
  for (const id of PIELES) assert.ok(new RegExp('^\\/8[1-9]$').test('/' + id));
  assert.ok(!/^\/8[1-9]$/.test('/80') && !/^\/8[1-9]$/.test('/90'), 'ni /80 ni /90');
  // El CLI del armazón delega en la piel cualquier verbo que no tenga: /84 y /85 también allí.
  assert.match(js, /X\.list\(\)\.forEach\(function \(v\) \{/);
  // El armazón y la piel admiten verbos numéricos (se buscan por nombre exacto tras quitar la barra).
  assert.match(leer('suite/experto.js'), /t\.replace\(\/\^\\\/\/, ''\)\.split/);
  const mb = leer('assets/marca-blanca.js');
  assert.match(mb, /function desactivar\(\)[\s\S]*store\.del\(SESSION_KEY\)[\s\S]*cleanup\(\)/, '/marca off borra la marca y limpia el armazón');
});

test('terminal de la home con piel de cine: texto normal y tenue ≥ 7:1 sobre la ventana (antes gris violeta sobre azul marino)', (t) => {
  // Lo que se veía antes: app.css sin tocar (#8888aa sobre #252540) se lee, pero no llega a 7:1.
  const app = leer('assets/app.css');
  const v = (k) => app.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`))[1];
  assert.ok(MB.contrast(v('text-dim'), v('bg-window')) < 7, 'el terminal de serie no llegaba a 7:1');
  const css = leer('assets/marca-blanca.css');
  const bloque = css.slice(css.indexOf('Terminal de la home con las pieles de cine'));
  for (const id of PIELES) assert.ok(bloque.includes(`[data-mb-marca="${id}"]`), `${id} en el bloque del terminal`);
  for (const [k, token] of [['bg-window', 'mb-superficie'], ['bg-darker', 'mb-fondo-alt'], ['text', 'mb-texto'], ['text-dim', 'mb-texto-suave'], ['text-muted', 'mb-texto-suave']]) {
    assert.match(bloque, new RegExp(`--${k}:var\\(--${token}\\)`), `--${k} → --${token}`);
  }
  assert.match(bloque, /:is\(body,\.terminal-window\)/, 'gana también a los temas de la home (en body)');
  const informe = [];
  for (const id of PIELES) {
    const p = marca(id).colores.oscuro;
    for (const [nombre, a, b] of [['texto/ventana', p.texto, p.superficie], ['tenue/ventana', p.textoSuave, p.superficie], ['texto/barra', p.texto, p.fondoAlt], ['tenue/barra', p.textoSuave, p.fondoAlt], ['tenue/fondo', p.textoSuave, p.fondo]]) {
      const r = MB.contrast(a, b);
      informe.push(`${id} terminal ${nombre} ${a}/${b} = ${r.toFixed(2)}:1`);
      assert.ok(r >= 7, `${id} terminal ${nombre}: ${r.toFixed(2)}:1 < 7`);
    }
  }
  t.diagnostic(informe.join('\n'));
});

test('las pieles tienen sus detalles CSS propios (fondo, titulares, foco) solo con su marca activa', () => {
  const css = leer('assets/marca-blanca.css');
  for (const id of PIELES) {
    assert.match(css, new RegExp(`:root\\[data-mb-marca="${id}"\\]\\[data-mb-plataforma="store"\\] body`));
    assert.match(css, new RegExp(`\\[data-mb-marca="${id}"\\][^{]*:focus-visible`));
  }
  const ver = leer('assets/marca-blanca.js').match(/marca-blanca\.css\?v=([^']+)'/)[1];
  assert.equal(ver, '20261006-escenas-1', 'sello nuevo para la hoja con las pieles y sus escenas');
});

test('la API del catálogo sirve 81–89 y /marcablanca/estilo?marca= los nombra con 200 y sin salto 308', async () => {
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
