// Encargo #5466: el editor nace oscuro, con contraste AA, y se cae si el fondo
// deja de ser oscuro o si el texto baja de 4,5:1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXTO } from '../demos/editor/modelo.mjs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const css = leer('../demos/editor/editor.css');
const html = leer('../demos/editor/index.html');
const marco = leer('../assets/admira-frame.css');

function canal(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function luminancia(hex) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((d) => d + d).join('') : n;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function contraste(a, b) {
  const hi = Math.max(luminancia(a), luminancia(b));
  const lo = Math.min(luminancia(a), luminancia(b));
  return (hi + 0.05) / (lo + 0.05);
}
function token(nombre) {
  const m = marco.match(new RegExp(`--${nombre}:\\s*var\\([^,]+,\\s*(#[0-9a-fA-F]{3,8})\\)`));
  assert.ok(m, nombre);
  return m[1];
}

test('el fondo del marco es oscuro y el texto del editor aguanta AA', () => {
  const fondo = marco.match(/body\[data-yk-frame="cabecera"\]\{\s*background:\s*(#[0-9a-fA-F]{3,8})/);
  assert.ok(fondo, 'el marco sigue pintando el fondo de la cabecera');
  const bg = fondo[1];
  assert.ok(luminancia(bg) < 0.15, 'el fondo de la página tiene que seguir oscuro');
  const tinta = token('yk-ink');
  const suave = token('yk-mut');
  const marca = token('yk-brand');
  const fondoBoton = token('yk-bg2');
  assert.ok(contraste(tinta, bg) >= 4.5, 'tinta sobre el fondo');
  assert.ok(contraste(suave, bg) >= 4.5, 'texto secundario sobre el fondo');
  assert.ok(contraste(fondoBoton, marca) >= 4.5, 'Publicar: texto oscuro sobre la marca');
  assert.match(css, /color:\s*var\(--yk-ink\)/);
  assert.match(css, /background:\s*var\(--yk-bg\)/);
  assert.match(css, /#publicar\s*\{[^}]*background:\s*var\(--editor-publicar,\s*var\(--yk-brand\)\)/);
  assert.match(css, /data-mb-marca="84"[^{]*\{[^}]*background:\s*var\(--yk-brand\)/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/, 'editor.css no lleva hex sueltos');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /Chakra/);
  assert.match(css, /font:\s*16px\/1\.45\s*var\(--yk-mono\)/);
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /grid-template-columns:\s*280px minmax\(0,\s*1fr\) 320px/);
  assert.match(css, /gap:\s*16px/);
  assert.match(css, /max-width:\s*800px/);
  assert.match(css, /font-size:\s*30px/);
  assert.match(css, /border-radius:\s*14px/);
  assert.match(css, /border-radius:\s*12px/);
  assert.match(html, /data-yk-frame="cabecera"/);
  assert.match(html, /header class="yk-head"/);
  assert.match(html, /data-yk-main/);
  assert.match(html, /role="switch"/);
  assert.match(html, /Voz al probar/);
  assert.equal(TEXTO.en.voz, 'Voice when trying');
  assert.match(TEXTO.es.guiaMacro, /biz×3 \+ app×2/);
  assert.match(TEXTO.en.guiaMacro, /biz×3 \+ app×2/);
  assert.match(TEXTO.es.sinSubdemo, /Sin subdemo/);
  assert.match(TEXTO.en.sinPaso, /No steps/);
  assert.match(TEXTO.es.sinSubdemos, /\{sitio\}/);
  assert.match(TEXTO.en.sinResultados, /No results/);
  for (const clave of ['guiaMacro', 'sinSubdemo', 'sinPaso', 'sinSubdemos', 'sinResultados', 'voz']) {
    assert.notEqual(TEXTO.es[clave], TEXTO.en[clave], clave);
  }
});
