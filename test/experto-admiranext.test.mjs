// ⌘ Experto en admiranext.com + marca 365 en el catálogo (06-10-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validarMarca, normalizarMarca } from '../marcablanca/marca.js';

const raiz = new URL('..', import.meta.url).pathname;
const leer = (p) => readFileSync(join(raiz, p), 'utf8');

test('el armazón inyecta el cargador del Experto de admiranext.com', () => {
  const frame = leer('assets/admira-frame.js');
  assert.match(frame, /\/assets\/experto-admiranext\.js\?v=/);
  assert.match(frame, /tiene: function/);
  const home = leer('index.html');
  assert.match(home, /<script defer src="\/assets\/experto-admiranext\.js\?v=/);
});

test('el cargador usa la piel común de la suite y la marca blanca de las plataformas', () => {
  const js = leer('assets/experto-admiranext.js');
  const stamp = js.match(/STAMP = '([^']+)'/)[1];
  assert.ok(leer('assets/admira-frame.js').includes('experto-admiranext.js?v=' + stamp), 'mismo sello en el armazón');
  assert.ok(leer('index.html').includes('experto-admiranext.js?v=' + stamp), 'mismo sello en la home');
  for (const s of ['/suite/experto.js', '/suite/experto.css', '/assets/marca-blanca.js', "'mb:marca'", 'ykExpertRail', 'cmdInput', 'parseLangCommand', "name: 'marca'"]) assert.ok(js.includes(s), s);
  const mb = leer('assets/marca-blanca.js');
  assert.ok(mb.includes("'/marcablanca/'") && mb.includes("'api/marcas/'"), 'consulta el catálogo único');
  assert.ok(mb.includes("'mb:marca'"), 'misma clave que las plataformas');
  assert.ok(existsSync(join(raiz, 'assets/marca-blanca.css')));
});

test('las páginas con armazón cargan la misma versión del armazón', () => {
  const sello = leer('assets/experto-admiranext.js').match(/STAMP = '([^']+)'/)[1];
  const malas = [];
  const recorrer = (d) => {
    for (const n of readdirSync(join(raiz, d))) {
      if (['.git', 'node_modules', 'old'].includes(n)) continue;
      const p = join(d, n);
      if (statSync(join(raiz, p)).isDirectory()) recorrer(p);
      else if (n.endsWith('.html')) {
        const m = leer(p).match(/admira-frame\.js\?v=([^"']+)/);
        if (m && m[1] !== sello) malas.push(p + ' → ' + m[1]);
      }
    }
  };
  recorrer('.');
  assert.deepEqual(malas, []);
});

test('365 Obrador es marca real del catálogo con su logo oficial, monocroma', () => {
  const m = JSON.parse(leer('marcablanca/clientes/365.json'));
  assert.deepEqual(validarMarca(m), []);
  assert.equal(m.id, '365');
  assert.equal(m.nombre, '365 Obrador');
  assert.equal(m.ejemplo, false);
  assert.equal(m.logo.svg, '../logos/365.svg');
  const svg = leer('marcablanca/logos/365.svg');
  assert.match(svg, /currentColor/, 'el logo hereda el color: se lee en claro y en oscuro');
  assert.ok(existsSync(join(raiz, 'marcablanca/logos/365-favicon.png')));
  assert.equal(m.colores.claro.primario, '#111111');
  const n = normalizarMarca(m);
  assert.equal(n.logo.svg, '/marcablanca/logos/365.svg');
  assert.equal(n.demo.tiendas[0].dir, 'Plaça de Tetuan, 3 · Barcelona');
  const indice = JSON.parse(leer('marcablanca/clientes/index.json'));
  assert.ok(indice.clientes.some((c) => c.id === '365' && c.ejemplo === false));
});
