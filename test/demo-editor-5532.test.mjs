// Encargo #5532: tira, pieza, nombre y aviso en vivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoPasos } from '../demos/editor/modelo.mjs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const css = leer('../demos/editor/editor.css');
const js = leer('../demos/editor/editor.js');
const html = leer('../demos/editor/index.html');
const motor = leer('../suite/demo-control.js');

test('la tira funde 32 px a la derecha y cuenta las piezas', () => {
  assert.match(css, /#macrodemo\.rebosa::after\s*\{[^}]*width:\s*32px/);
  assert.match(css, /linear-gradient\(to right, transparent, var\(--yk-bg\)\)/);
  assert.match(html, /id="fila-cuenta"/);
  assert.match(js, / de /);
  assert.match(js, / of /);
  assert.match(js, / · →/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/);
});

test('la pieza dice los pasos, esconde la × y marca la elegida', () => {
  assert.equal(textoPasos(8, 'es'), '8 pasos');
  assert.equal(textoPasos(1, 'es'), '1 paso');
  assert.equal(textoPasos(8, 'en'), '8 steps');
  assert.match(js, /textoPasos\(sub \? sub\.steps\.length : 0, estado\.lang\)/);
  assert.match(css, /\.tarjeta \.quitar\s*\{[^}]*width:\s*20px[^}]*height:\s*20px[^}]*opacity:\s*0/);
  assert.match(css, /\.tarjeta:hover \.quitar/);
  assert.match(css, /\.tarjeta\.sel\s*\{[^}]*box-shadow:\s*inset 0 0 0 2px var\(--yk-ink\)/);
  assert.match(js, /elegida/);
});

test('el nombre muestra etiqueta, vista previa y pista', () => {
  assert.match(js, /nombreDemo/);
  assert.match(js, /pistaNombre/);
  assert.match(js, /vista\.textContent = '\/demo ' \+/);
  assert.match(leer('../demos/editor/modelo.mjs'), /Nombre para \/demo/);
  assert.match(leer('../demos/editor/modelo.mjs'), /Name for \/demo/);
  assert.match(leer('../demos/editor/modelo.mjs'), /Enter guarda · Esc cancela/);
  assert.match(leer('../demos/editor/modelo.mjs'), /Enter saves · Esc cancels/);
});

test('el aviso en vivo nombra la macro, el paso y los que faltan, una sola vez', () => {
  assert.match(motor, /EN VIVO · ' \+ slug \+ ' · paso ' \+ paso \+ ' de ' \+ total/);
  assert.match(motor, /LIVE · ' \+ slug \+ ' · step ' \+ paso \+ ' of ' \+ total/);
  assert.match(motor, /macroState\.total - bien - mal/);
  assert.match(motor, /list-style:none/);
  assert.match(motor, /function macroPrepararCuenta/);
  assert.match(js, /demo-control\.js\?v=20261010-en-vivo-5532/);
});
