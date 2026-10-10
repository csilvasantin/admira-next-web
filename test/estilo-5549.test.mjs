// Encargo #5549 · libro de estilo: variantes de logo, tamaños, aviso WCAG y el idioma de las tres páginas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {contraste} from '../marcablanca/marca.js';

const leer = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('el acento de JTI sobre blanco se queda bajo 4.5:1 y el libro avisa', () => {
  const m = JSON.parse(leer('marcablanca/clientes/jti.json'));
  const ratio = contraste(m.colores.claro.acento, m.colores.claro.fondo);
  assert.ok(ratio < 4.5, ratio.toFixed(2));
  assert.ok(ratio < 3, 'el aviso tiene que decir que tampoco llega a 3:1');
  const js = leer('marcablanca/estilo/estilo.js');
  assert.match(js, /Aviso WCAG/);
  assert.match(js, /no alcanza 4\.5:1 para texto normal/);
  assert.match(js, /class="wcag"/);
});

test('las versiones negativa y monocroma y los tres tamaños viven en el libro, sin nombrar marcas', () => {
  const js = leer('marcablanca/estilo/estilo.js');
  assert.match(js, /Variante negativa/);
  assert.match(js, /Variante monocroma/);
  assert.match(js, /const marco = \(px, logo\) =>/);
  assert.doesNotMatch(js, /altadis|jti|starbucks/i);
  const css = leer('marcablanca/estilo/estilo.css');
  assert.match(css, /\.minimos \.marco \.logo svg,\.minimos \.marco \.logo img\{height:100%/);
  assert.match(css, /\.logo\.logo-neg img\{filter:brightness\(0\) invert\(1\)\}/);
  assert.match(css, /\.logo\.logo-mono img\{filter:brightness\(0\)\}/);
});

test('JTI, Starbucks y Altadis tienen ilustración de cabecera como las pieles de cine', () => {
  for (const id of ['jti', 'starbucks', 'altadis']) {
    const m = JSON.parse(leer(`marcablanca/clientes/${id}.json`));
    assert.equal(m.fondos.escena.svg, `../escenas/${id}.svg`);
    assert.ok(m.fondos.escena.alt.length > 20);
    const svg = leer(`marcablanca/escenas/${id}.svg`);
    assert.ok(existsSync(new URL(`../marcablanca/escenas/${id}.svg`, import.meta.url)));
    assert.match(svg, /viewBox="0 0 1600 900"/);
    assert.match(svg, /role="img"/);
    assert.match(svg, /original de Admira/);
    assert.doesNotMatch(svg, /<text|<image|<script/i);
  }
  const jti = leer('marcablanca/clientes/jti.json') + leer('marcablanca/escenas/jti.svg');
  assert.doesNotMatch(jti, /altadis|imperial/i);
  const altadis = leer('marcablanca/clientes/altadis.json') + leer('marcablanca/escenas/altadis.svg');
  assert.doesNotMatch(altadis, /\bJTI\b|winston|camel/i);
});

test('estilo.js, marcablanca.js y demo.js oyen ?lang= y admira:languagechange, y el html no se queda mudo', () => {
  for (const f of ['marcablanca/estilo/estilo.js', 'marcablanca/marcablanca.js', 'marcablanca/demo.js']) {
    const js = leer(f);
    assert.match(js, /admira:languagechange/, f);
    assert.match(js, /get\('lang'\)/, f);
  }
  for (const f of ['marcablanca/index.html', 'marcablanca/estilo/index.html', 'marcablanca/propuesta/index.html']) {
    const html = leer(f);
    assert.match(html, /get\('lang'\)/, f);
    assert.match(html, /admira:languagechange/, f);
    assert.match(html, /documentElement\.lang/, f);
  }
});
