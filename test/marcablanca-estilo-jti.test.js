import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const leer = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('JTI es marca fija del catálogo con logo oficial y colores de marca', () => {
  const m = JSON.parse(leer('marcablanca/clientes/jti.json'));
  assert.equal(m.id, 'jti');
  assert.equal(m.logo.svg, '../logos/jti.svg');
  assert.ok(existsSync(new URL('../marcablanca/logos/jti.svg', import.meta.url)));
  assert.equal(m.colores.claro.acento, '#00BB31');
  assert.equal(m.colores.claro.secundario, '#101111');
  const indice = JSON.parse(leer('marcablanca/clientes/index.json'));
  assert.ok(indice.clientes.some((c) => c.id === 'jti' && c.ejemplo === false));
});

test('Altadis y JTI no se mezclan nunca', () => {
  const jti = leer('marcablanca/clientes/jti.json') + leer('marcablanca/logos/jti.svg') + leer('marcablanca/logos/jti-favicon.svg');
  assert.doesNotMatch(jti, /altadis|imperial/i);
  const altadis = leer('marcablanca/clientes/altadis.json');
  assert.doesNotMatch(altadis, /\bJTI\b|winston|camel/i);
});

test('el libro de estilo es genérico: lee la marca del catálogo y no lista otras marcas', () => {
  const js = leer('marcablanca/estilo/estilo.js');
  assert.match(js, /\/marcablanca\/api\/marcas\/\$\{encodeURIComponent\(id\)\}/);
  assert.doesNotMatch(js, /altadis|jti|starbucks/i);
  for (const s of ['zona de protección', 'Colores', 'Tipografía', 'Usos correctos e incorrectos', 'cinco patas']) assert.ok(js.includes(s), s);
  assert.ok(leer('marcablanca/estilo/index.html').includes('/marcablanca/estilo/estilo.js'));
});
