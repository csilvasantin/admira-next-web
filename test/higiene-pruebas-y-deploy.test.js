// FLT-100773 b (Morfeo, 21-sep-2026) · lo que se prueba y con qué se publica no se deja al azar.
//
// 1) `npm test` corría sólo test/*.test.js: los 25 tests de directorio, MCP, ritmo de
//    publicación y Telegram (ficheros .mjs) no los ejecutaba nadie, aunque pasaban.
// 2) deploy.sh publicaba con `npx --yes wrangler@latest`: cada deploy compilaba las
//    Functions con la CLI que npm sirviera ese día, así que el mismo HEAD podía dar un
//    worker distinto sin que nadie lo decidiera.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

const raiz = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', raiz), 'utf8'));
const deploy = await readFile(new URL('deploy.sh', raiz), 'utf8');
const acceso = await readFile(new URL('scripts/set-presentation-access.sh', raiz), 'utf8');

// Glob de shell de un nivel (lo que expande `sh` al correr el script de npm) → RegExp.
const aRegex = glob => new RegExp('^' + glob.split('/').map(parte => parte.split('*').map(t => t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('/') + '$');

// Opt-in a propósito: NotebookLM necesita jszip/sharp/pdf-lib instalados en su carpeta.
const FUERA = [/^node_modules\//, /^\.git\//, /^\.claude\//, /^\.wrangler\//, /^tools\/notebooklm-local\//];

test('npm test ejecuta TODOS los tests del repo salvo los de NotebookLM, que van aparte', async () => {
  const globs = pkg.scripts.test.replace(/^node --test\s+/, '').split(/\s+/);
  const patrones = globs.map(aRegex);
  const ficheros = (await readdir(raiz, {recursive:true}))
    .map(ruta => ruta.split('\\').join('/'))
    .filter(ruta => /\.test\.m?js$/.test(ruta) && !FUERA.some(fuera => fuera.test(ruta)));
  assert.ok(ficheros.length > 100, `se esperaban >100 ficheros de test, hay ${ficheros.length}`);
  const huerfanos = ficheros.filter(ruta => !patrones.some(patron => patron.test(ruta)));
  assert.deepEqual(huerfanos, [], 'estos tests existen pero npm test no los ejecuta');
  assert.doesNotMatch(pkg.scripts.test, /notebooklm/);
  assert.match(pkg.scripts['test:notebooklm'], /tools\/notebooklm-local\/test\/\*\.test\.js/);
});

test('deploy y secretos usan la MISMA versión fijada de wrangler, nunca @latest', () => {
  assert.doesNotMatch(deploy, /wrangler@latest/);
  assert.doesNotMatch(acceso, /wrangler@latest/);
  const version = texto => texto.match(/^WRANGLER_VERSION="(\d+\.\d+\.\d+)"$/m)?.[1];
  assert.ok(version(deploy), 'deploy.sh declara WRANGLER_VERSION="x.y.z"');
  assert.equal(version(acceso), version(deploy), 'las dos puertas a Cloudflare van con la misma CLI');
  assert.match(deploy, /npx --yes "wrangler@\$\{WRANGLER_VERSION\}" pages deploy/);
  assert.match(acceso, /WR="npx --yes wrangler@\$\{WRANGLER_VERSION\}"/);
});
