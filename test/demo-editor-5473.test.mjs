// Encargo #5473: última vuelta de Walt. Publicar en verde, la marca no cambia
// el idioma y la biblioteca puede bajarse por detrás de la barra Experto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const css = leer('../demos/editor/editor.css');
const html = leer('../demos/editor/index.html');
const js = leer('../demos/editor/editor.js');
const experto = leer('../assets/experto-admiranext.js');

function canal(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function luminancia(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

test('Publicar usa el verde de la paleta y la marca 84 conserva el suyo', () => {
  assert.match(html, /--editor-publicar:\s*#33FF99/);
  assert.match(html, /--editor-publicar-ink:\s*#070b12/);
  assert.match(css, /background:\s*var\(--editor-publicar,\s*var\(--yk-brand\)\)/);
  assert.match(css, /data-mb-marca="84"[^{]*#publicar\s*\{[^}]*background:\s*var\(--yk-brand\)/);
  assert.doesNotMatch(css, /#33FF99/i);
  const hi = Math.max(luminancia('#33FF99'), luminancia('#070b12'));
  const lo = Math.min(luminancia('#33FF99'), luminancia('#070b12'));
  assert.ok((hi + 0.05) / (lo + 0.05) >= 4.5);
});

test('?marca= no hereda el idioma guardado', () => {
  assert.match(experto, /get\('marca'\)/);
  assert.match(experto, /no se hereda una preferencia guardada/);
  assert.match(js, /marcaSinIdioma/);
  assert.match(js, /if \(marcaSinIdioma\) return 'es'/);
  assert.match(js, /if \(marcaSinIdioma && !idiomaExplicito\) return/);
});

test('la biblioteca reserva abajo la altura de la barra Experto', () => {
  assert.match(css, /\.biblioteca\s*\{\s*padding-bottom:\s*calc\(12px \+ var\(--editor-rail,\s*72px\)\)/);
  assert.match(js, /--editor-rail/);
  assert.match(js, /ykExpertRail/);
});
