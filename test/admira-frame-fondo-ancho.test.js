import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// FONDO COMÚN Y ANCHO DEL CUERPO EN LAS PÁGINAS CON LA BARRA DEL SITIO (3-oct-2026).
//
// Carlos: «vamos a utilizar el mismo fondo de digitalsignage.ai que se ilumina con el
// ratón en la intranet de admiranext.com, donde están proyectos, usuarios, webmaster,
// analitics, agentes y presentaciones, y asegurarnos de que la zona central donde está
// el cuerpo de la información siempre tiene la misma anchura y no varía de una
// categoría a otra».
//
// - El fondo lo pone el armazón (assets/admira-frame.js crea .yk-dots; los estilos van
//   en admira-frame.css) en toda página con <body data-yk-frame="cabecera">. Ninguna
//   de esas páginas pinta ya fondo propio: ni la lluvia Matrix, ni brillos, ni
//   degradados o rejillas en html/body.
// - El ancho lo fija el armazón: el contenedor principal lleva data-yk-main y mide
//   --yk-content-w (1200 px) con 16 px de margen en pantallas estrechas. La página no
//   declara otro ancho para ese contenedor.
// La geometría real (1440 y 390 px, paneles abiertos) la mide Playwright en la
// verificación de la entrega; aquí se cierra lo que se puede leer del código.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP = new Set(['node_modules', '.git', 'old', 'backups', 'webmaster-shots', 'tools', 'test']);
const leer = (rel) => readFile(path.join(ROOT, rel), 'utf8');

async function html(dir = '.', out = []) {
  for (const e of await readdir(path.join(ROOT, dir), {withFileTypes: true})) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) await html(rel, out);
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
async function conCabecera() {
  const out = [];
  for (const rel of await html()) if (/<body\b[^>]*data-yk-frame="cabecera"/.test(await leer(rel))) out.push(rel);
  return out.sort();
}

// Las páginas de la intranet (la navegación del grupo) y las de /mcp: el cuerpo mide
// --yk-content-w. Valor: qué elemento es su contenedor principal.
const ANCHO = {
  'proyectos/index.html': 'main.shell',
  'usuarios.html': 'main.shell',
  'webmaster.html': 'div.wrap',
  'analitics/index.html': 'main',
  'flota.html': 'main.shell',
  'presentaciones/generador.html': 'main.wrap',
  'presentaciones/index.html': 'main.wrap',
  'xpace/manage.html': 'main',
  'mcp/index.html': 'main',
  'mcp/generador.html': 'main',
  'organigrama.html': 'main',
  'roadmap.html': 'main',
  'arquitectura.html': 'main',
  'demos/editor/index.html': 'main.editor-pagina'
};
// Páginas con la barra del sitio que conservan su ancho de lectura, con su motivo.
const LECTURA = 'Página de lectura (doctrina, ayuda o informe): conserva su medida de línea de 60-90 caracteres; el encargo del ancho común es para las categorías de la intranet.';
const EXCEPCIONES_ANCHO = Object.fromEntries([
  'academia.html', 'consejero.html', 'filosofia.html', 'mandamientos.html', 'normativa.html', 'help/index.html',
  'informes/index.html', 'informes/handon-contenidos-2026-09-14.html', 'telegram/index.html', 'presentar.html', 'consejo/index.html'
].map((rel) => [rel, LECTURA]));

// Las hojas de una página: sus <style> y las hojas propias que enlaza (no el armazón).
async function hojas(rel) {
  const fuente = await leer(rel);
  const out = [...fuente.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  for (const [, href] of fuente.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/[^"?]+\.css)/g)) {
    if (href.startsWith('/assets/admira-frame')) continue;
    out.push(await leer(href.slice(1)).catch(() => ''));
  }
  return out.join('\n');
}
function reglas(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...limpio.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)].map((m) => ({selector: m[1].trim(), cuerpo: m[2]}));
}

test('el armazón trae el fondo común de digitalsignage.ai y el ancho del cuerpo', async () => {
  const css = await leer('assets/admira-frame.css');
  const js = await leer('assets/admira-frame.js');
  assert.match(css, /--yk-content-w:\s*1200px/, 'un único ancho de contenido: --yk-content-w');
  assert.match(css, /\[data-yk-main\]\{[^}]*width:\s*min\(var\(--yk-content-w\),\s*calc\(100% - 2 \* var\(--yk-content-gutter\)\)\)/, 'el contenedor principal mide --yk-content-w');
  assert.match(css, /\.yk-dots\{[^}]*position:\s*fixed;[^}]*z-index:\s*-1;[^}]*pointer-events:\s*none/, 'los puntos van detrás de todo y no reciben el ratón');
  for (const capa of ['base', 'idle', 'halo']) assert.match(css, new RegExp(`\\.yk-dots-${capa}`), `capa ${capa}`);
  assert.match(css, /prefers-reduced-motion: reduce\)\{ \.yk-dots-halo/, 'con movimiento reducido el halo se queda quieto');
  assert.match(css, /body\[data-yk-frame="cabecera"\]\{ background: #070b12 !important \}/, 'el fondo de la página es el común');
  assert.match(js, /el\('div', 'yk-dots'/, 'el armazón crea la capa');
  assert.match(js, /requestAnimationFrame\(pintar\)/, 'el halo sólo se recoloca en un requestAnimationFrame');
  assert.match(js, /e\.pointerType !== 'mouse'/, 'sólo sigue al ratón (no al dedo)');
  // La fórmula, a los dos anchos que mide la verificación: 1440 → 1200, 390 → 358.
  const ancho = (vw) => Math.min(1200, vw - 2 * 16);
  assert.equal(ancho(1440), 1200);
  assert.equal(ancho(390), 358);
});

test('ninguna página con la barra del sitio pinta un fondo propio', async () => {
  const fallos = [];
  for (const rel of await conCabecera()) {
    const fuente = await leer(rel);
    if (/<canvas id="rain"|class="glow [ab]"|Lluvia Matrix/.test(fuente)) fallos.push(`${rel}: lluvia o brillos propios`);
    for (const {selector, cuerpo} of reglas(await hojas(rel))) {
      const partes = selector.split(',').map((x) => x.trim());
      const raiz = partes.some((x) => /^(html|body|:root)$/.test(x));
      const pseudo = partes.some((x) => /^body::?(before|after)$/.test(x));
      if (raiz && /(^|;|\s)background(-color|-image)?\s*:/.test(cuerpo)) fallos.push(`${rel}: «${selector}» pinta fondo`);
      if (pseudo && /background/.test(cuerpo)) fallos.push(`${rel}: «${selector}» pinta fondo`);
    }
  }
  assert.deepEqual(fallos, [], 'el fondo es el común del armazón (.yk-dots sobre #070b12)');
});

test('cada página con la barra del sitio usa el ancho común o explica por qué no', async () => {
  const todas = await conCabecera();
  assert.deepEqual(todas.filter((rel) => !ANCHO[rel] && !EXCEPCIONES_ANCHO[rel]), [], 'una página nueva con la barra del sitio entra en ANCHO o en EXCEPCIONES_ANCHO');
  for (const rel of [...Object.keys(ANCHO), ...Object.keys(EXCEPCIONES_ANCHO)]) assert.ok(todas.includes(rel), `${rel} ya no lleva la barra del sitio`);
  for (const [rel, motivo] of Object.entries(EXCEPCIONES_ANCHO)) {
    assert.ok(motivo.length > 40, `${rel}: motivo`);
    assert.doesNotMatch(await leer(rel), /\bdata-yk-main\b/, `${rel} ya usa el ancho común: sácala de EXCEPCIONES_ANCHO`);
  }
});

for (const [rel, contenedor] of Object.entries(ANCHO)) {
  test(`${rel}: el cuerpo mide --yk-content-w y la página no le pone otro ancho`, async () => {
    const fuente = await leer(rel);
    const marcados = [...fuente.matchAll(/<(\w+)\b([^>]*)\bdata-yk-main\b[^>]*>/g)];
    assert.equal(marcados.length, 1, 'un solo contenedor principal (data-yk-main)');
    const [, tag, attrs] = marcados[0];
    const clases = ((attrs.match(/class="([^"]*)"/) || [])[1] || '').split(/\s+/).filter(Boolean);
    assert.equal(tag + (clases.length ? '.' + clases.join('.') : ''), contenedor);
    // Reglas de la página que apuntan a ese contenedor (su etiqueta o sus clases).
    const apunta = (sel) => {
      const ultimo = sel.split(/[\s>+~]+/).filter(Boolean).pop() || '';
      const m = ultimo.match(/^([a-z]+)?((?:\.[\w-]+)*)$/i);
      if (!m) return false;
      const [, t, cl] = m;
      const cs = cl ? cl.slice(1).split('.') : [];
      if (t && t.toLowerCase() !== tag) return false;
      if (!t && !cs.length) return false;
      return cs.every((c) => clases.includes(c)) && (t || cs.length);
    };
    const fallos = [];
    for (const {selector, cuerpo} of reglas(await hojas(rel))) {
      if (!selector.split(',').some((x) => apunta(x.trim()))) continue;
      for (const [, prop, valor] of cuerpo.matchAll(/(?:^|;)\s*((?:max-|min-)?width)\s*:\s*([^;]+)/g)) {
        if (!/var\(--yk-content-w\)/.test(valor)) fallos.push(`«${selector}» ${prop}: ${valor.trim()}`);
      }
    }
    assert.deepEqual(fallos, [], 'el ancho del cuerpo es el del armazón, no uno propio');
  });
}
