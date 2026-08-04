import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// GUARDIA DEL SELLO (normativa, regla 07).
//
// El 2 de agosto la migración «el sello lleva año» cambió el <meta> de /creditos
// a v.24.07.2026.r2.03:13 y dejó styles.css, kernel.js y app.js con la clave
// vieja ?v=26.07.24.r2. Producción publicaba créditos nuevos sirviendo el JS
// cacheado del 24 de julio, y los créditos son un entregable NATIVO del Generador
// de Presentaciones: eso se ve en la presentación del cliente. El acoplamiento
// solo lo comprobaba el test de la propia página de créditos, así que ninguna
// otra página del sitio tenía red debajo.
//
// Esta guardia sube la comprobación al SITIO ENTERO y no depende de que nadie se
// acuerde de añadir su página: recorre el repo. (NeoMBP16 · MacBook Pro 16,
// 4 de agosto de 2026.)

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.git', 'old', 'backups', 'webmaster-shots']);

// Sello de la regla 07: v.DD.MM.AAAA.rN.HH:MM. Puede ir precedido de una marca
// («AdmiraNeXT v.…», «cc-v.…»), que es lo único que la regla deja delante.
const SEAL = /v\.(\d{2})\.(\d{2})\.(\d{4})\.r(\d+)\.(\d{2}):(\d{2})/;
// Cualquier cosa con pinta de sello, incluidos los formatos que la regla 07
// declara inválidos (sin año, con el año delante, sin hora). Es lo que permite
// distinguir «esta clave de caché es un sello» de «esta es una clave opaca tipo
// ?v=20260723-2», que es otra convención y no se toca.
const SEAL_SHAPED = /v?\.?(\d{2,4}\.\d{2}\.\d{2,4}\.r\d+(?:\.\d{2}:\d{2})?)/;

async function htmlFiles(dir = ROOT, out = []) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await htmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function pages() {
  const files = await htmlFiles();
  return Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    const meta = source.match(/name="admiranext-version"\s+content="([^"]*)"/)?.[1] || '';
    const seal = meta.match(SEAL)?.[0] || '';
    // Solo las claves con forma de sello: las opacas (?v=20260723-2) son otra
    // convención legítima y quedan fuera.
    const keys = [...source.matchAll(/[?&]v=([^"'&\s>]+)/g)]
      .map((m) => m[1]).filter((key) => SEAL_SHAPED.test(key));
    return {rel: path.relative(ROOT, file), source, meta, seal, keys};
  }));
}

test('cada página que declara sello lo escribe como manda la regla 07', async () => {
  const declared = (await pages()).filter((page) => page.meta);
  assert.ok(declared.length >= 8, 'el barrido tiene que encontrar las páginas selladas del sitio');
  const rotas = declared.filter((page) => !page.seal)
    .map((page) => `${page.rel} → «${page.meta}»`);
  assert.deepEqual(rotas, [], 'el sello va como v.DD.MM.AAAA.rN.HH:MM (día, mes, año, release y hora)');
});

test('los assets de una página sellada se cache-bustean con SU sello, no con uno viejo', async () => {
  const declared = (await pages()).filter((page) => page.seal);
  const sueltas = [];
  for (const page of declared) {
    const esperado = page.seal.slice(2); // sin el «v.» que no viaja en la query
    for (const key of page.keys) {
      if (key !== esperado) sueltas.push(`${page.rel} → ?v=${key} pero su sello es ${page.seal}`);
    }
  }
  // Exactamente el fallo de /creditos del 2 de agosto: el <meta> avanzó y las
  // claves se quedaron atrás, así que el navegador siguió sirviendo el bundle viejo.
  assert.deepEqual(sueltas, [], 'una clave de caché con forma de sello tiene que ser el sello vivo de su página');
});

test('el sello del pie es el mismo que el del <meta>', async () => {
  const declared = (await pages()).filter((page) => page.seal);
  const discrepantes = [];
  for (const page of declared) {
    const pie = page.source.match(/<footer[\s\S]*?<\/footer>/i)?.[0];
    if (!pie) continue;
    const visible = pie.match(SEAL)?.[0];
    if (visible && visible !== page.seal) {
      discrepantes.push(`${page.rel} → pie ${visible} vs meta ${page.seal}`);
    }
  }
  assert.deepEqual(discrepantes, [], 'la regla 07 pide el sello en el pie Y en el meta: los dos dicen lo mismo o uno miente');
});

// Deuda DECLARADA, no silenciada. Estas páginas enseñan un sello pero no lo
// declaran en <meta>, que es justo por lo que la migración del 2 de agosto no las
// vio: el barrido buscaba el meta. Mientras estén aquí, ninguna guardia de arriba
// las cubre. La lista es exacta a propósito: si alguien arregla una, este test
// obliga a quitarla; si aparece una página NUEVA con el mismo defecto, falla.
const SIN_META = [
  'presentaciones/LaCaixa/index.html',              // caixa-v.17.07.2026.r3 (sin hora)
  'presentaciones/clearchannel/index.html',         // cc-v.16.07.2026.r8 (sin hora)
  'presentaciones/clearchannel/presentacion.html',  // cc-v.13.07.2026.r6 (sin hora)
  'presupuestos/index.html',                        // v.26.08.03.r3 (formato viejo, año delante)
];

test('la deuda de páginas selladas sin <meta> es exactamente la declarada', async () => {
  const huerfanas = (await pages())
    .filter((page) => !page.meta && (SEAL_SHAPED.test(page.source) && /v\.\d{2}\.\d{2}\.\d{2}/.test(page.source)))
    .map((page) => page.rel).sort();
  assert.deepEqual(huerfanas, [...SIN_META].sort(),
    'una página que enseña sello sin declararlo en <meta> es invisible para cualquier migración: decláralo o quita el sello');
});
