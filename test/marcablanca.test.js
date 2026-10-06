import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';

// Marca blanca de la Galaxia Admira (2026-10-01): un marcablanca.css, un JSON por cliente
// y un cargador que comparten Admira.Studio, Admira.store, Admira.app y yokup.com.
const raiz = new URL('../marcablanca/', import.meta.url);
const leer = (rel) => readFile(new URL(rel, raiz), 'utf8');
const json = async (rel) => JSON.parse(await leer(rel));
const COLORES = ['primario', 'primarioTexto', 'secundario', 'secundarioTexto', 'acento', 'acentoTexto', 'fondo', 'fondoAlt',
  'superficie', 'superficieAlt', 'borde', 'texto', 'textoSuave', 'textoTenue', 'ok', 'aviso', 'error', 'info'];

function luminancia(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const [la, lb] = [luminancia(a), luminancia(b)];
  if (la == null || lb == null) return Infinity; // rgba(): no se puede medir aquí
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('el índice declara Admira por defecto, tres clientes de ejemplo y las nueve pieles de cine (81–89)', async () => {
  const indice = await json('clientes/index.json');
  assert.equal(indice.porDefecto, 'admira');
  assert.deepEqual(Object.keys(indice.plataformas), ['studio', 'store', 'app', 'yokup']);
  const ejemplos = indice.clientes.filter((c) => c.ejemplo).map((c) => c.id);
  assert.deepEqual(ejemplos, ['lumbre', 'brumelle', 'frescaria', '81', '82', '83', '84', '85', '86', '87', '88', '89']);
  for (const [dominio, id] of Object.entries(indice.dominios)) {
    assert.ok(indice.clientes.some((c) => c.id === id), `${dominio} apunta a un cliente que no existe`);
  }
});

test('cada cliente trae todos los tokens y sus ficheros existen', async () => {
  const indice = await json('clientes/index.json');
  for (const {id} of indice.clientes) {
    const m = await json(`clientes/${id}.json`);
    assert.equal(m.id, id);
    for (const clave of ['nombre', 'logo', 'favicon', 'modo', 'tipografia', 'radios', 'sombras', 'tono', 'colores']) {
      assert.ok(m[clave], `${id}: falta ${clave}`);
    }
    assert.ok(m.colores[m.modo], `${id}: no tiene paleta para su modo por defecto`);
    for (const [modo, paleta] of Object.entries(m.colores)) {
      for (const c of COLORES) assert.ok(paleta[c], `${id}/${modo}: falta el color ${c}`);
      assert.ok(contraste(paleta.texto, paleta.fondo) >= 7, `${id}/${modo}: texto sobre fondo no se lee`);
      assert.ok(contraste(paleta.primarioTexto, paleta.primario) >= 4.5, `${id}/${modo}: el botón principal no se lee`);
    }
    for (const f of ['cta', 'vacio', 'error', 'exito']) assert.ok(m.tono.frases[f], `${id}: falta la frase ${f}`);
    const desde = new URL(`clientes/${id}.json`, raiz);
    await access(new URL(m.logo.svg || m.logo.imagen, desde));
    await access(new URL(m.favicon, desde));
    for (const fuente of m.tipografia.fuentes || []) await access(new URL(fuente.url, desde));
    if (m.ejemplo) assert.match(m.descripcion, /marca ficticia/, `${id}: un cliente de ejemplo se anuncia como ficticio`);
  }
});

test('las paletas por plataforma de Admira también se leen', async () => {
  const m = await json('clientes/admira.json');
  for (const [plataforma, ajuste] of Object.entries(m.plataformas)) {
    for (const paleta of Object.values(ajuste.colores || {})) {
      assert.ok(contraste(paleta.primarioTexto, paleta.primario) >= 4.5, `admira/${plataforma}: botón principal`);
    }
  }
});

test('la hoja define los tokens por defecto y los puentes de las cuatro webs', async () => {
  const css = await leer('marcablanca.css');
  for (const t of ['--mb-primario', '--mb-fondo', '--mb-texto', '--mb-ok', '--mb-fuente-titulos', '--mb-radio-boton', '--mb-sombra-md']) {
    assert.match(css, new RegExp(`${t}:`), `falta ${t}`);
  }
  for (const p of ['studio', 'store', 'app', 'yokup']) assert.match(css, new RegExp(`data-mb-plataforma="${p}"`));
  const js = await leer('marcablanca.js');
  assert.match(js, /get\('marca'\)/, 'el cargador acepta ?marca=');
  assert.match(js, /marcaPorDominio/, 'y elige la marca por dominio');
});

test('la home sigue limpia: la marca blanca entra solo por comando', async () => {
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /marcablanca|marca blanca/i, 'Carlos quiere la home limpia: nada de secciones nuevas');
  const app = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
  assert.match(app, /registerHidden\('\/marcablanca', cmdMarcaBlanca\)/);
});

test('la página enseña las cuatro plataformas y los cuatro clientes', async () => {
  const html = await leer('index.html');
  for (const p of ['studio', 'store', 'app', 'yokup']) assert.match(html, new RegExp(`data-plataforma="${p}"`));
  for (const c of ['lumbre', 'brumelle', 'frescaria', 'admira']) assert.match(html, new RegExp(`data-elegir="${c}"`));
  assert.match(html, /marcas ficticias/);
});
