// #7189 (28-10-2026): el detalle del roadmap abre por ítem con enlace directo (?c=…#item-…).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cada ítem del combo lleva ancla propia y enlace directo', async () => {
  const js = await readFile(new URL('../assets/roadmap-combo.js', import.meta.url), 'utf8');
  assert.match(js, /function itemAncla\(p,h,i,n\)\{return 'item-'/);
  assert.match(js, /<li id="'\+esc\(aid\)\+'"/);
  assert.match(js, /class="rmc-enl" href="'\+esc\(location\.pathname\+location\.search\+'#'\+aid\)/);
});

test('al entrar por el enlace se abre el ítem, su detalle y se resalta', async () => {
  const js = await readFile(new URL('../assets/roadmap-combo.js', import.meta.url), 'utf8');
  assert.match(js, /render\(\);abrirItem\(\);/);
  assert.match(js, /addEventListener\('hashchange',abrirItem\)/);
  assert.match(js, /a\.tagName==='DETAILS'\)a\.open=true/);
  const html = await readFile(new URL('../roadmap.html', import.meta.url), 'utf8');
  assert.match(html, /roadmap-combo\.js\?v=20261028-item-1/);
  assert.match(html, /li\.rmc-foco\{/);
});
