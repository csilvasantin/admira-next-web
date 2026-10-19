// Carlos, 19-10-2026: cara (imagotipo) de cada consejero y agente y bloque «Hoy · quién hace qué».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const js = await readFile(new URL('../assets/roadmap-combo.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
const COLOR = JSON.parse(js.match(/var COLOR=(\{[^}]+\});/)[1]);
const CARA = Object.keys(Object.fromEntries([...js.match(/var CARA=\{([^}]+)\}/)[1].matchAll(/(\w+):1/g)].map((m) => [m[1], 1])));

test('cada cara declarada existe como fichero en /assets/avatares', async () => {
  assert.ok(CARA.length >= 20);
  for (const id of CARA) await access(new URL(`../assets/avatares/${id}.jpg`, import.meta.url));
});

test('toda persona con color tiene cara (o caería a iniciales)', () => {
  const sinCara = Object.keys(COLOR).filter((id) => !CARA.includes(id));
  assert.deepEqual(sinCara, []);
  assert.match(js, /rmc-ini/);
});

test('cabecera del plan, sello y tarjetas de Hoy llevan la cara; colores siguen siendo los de #6552', () => {
  assert.match(js, /function chipQuien\(v,txt\)\{[^\n]*cara\(v,txt\)/);
  assert.match(js, /'✗ rechazado · '\)\+cara\(/);
  assert.match(js, /function hoyPanel\(\)/);
  assert.match(js, /rmc-hoy-c[^\n]*COLOR\[quienId\(g\.id\)\]/);
  assert.match(html, /id="rmc-hoy"/);
  assert.doesNotMatch(js, /COLOR_PERSONA/);
});
