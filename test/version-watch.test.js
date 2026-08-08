import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';

const source = await readFile(new URL('../assets/admira-version-watch.js', import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
  }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  get firstChild() { return this.children[0] || null; }
}

function response(body, {status = 200, etag = 'asset-a'} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: (name) => name === 'etag' ? etag : null},
    json: async () => body
  };
}

function textTree(node) {
  return [node.textContent, ...node.children.flatMap(textTree)].filter(Boolean).join(' ');
}

function fixture(manifests, meta = 'AdmiraNeXT v.08.08.2026.r1.12:26') {
  const head = new Element('head');
  const body = new Element('body');
  const metaNode = new Element('meta');
  metaNode.setAttribute('content', meta);
  let index = 0;
  const document = {
    currentScript: {src: 'https://www.admiranext.com/assets/admira-version-watch.js'},
    hidden: false,
    head,
    body,
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => selector === 'meta[name="admiranext-version"]' ? metaNode : null,
    addEventListener() {}
  };
  const context = vm.createContext({
    document,
    window: {},
    location: {reload() {}},
    setInterval() {},
    Intl,
    Date,
    isNaN,
    Promise,
    fetch: async (url) => {
      if (String(url).includes('version.json')) return manifests[Math.min(index++, manifests.length - 1)];
      return response(null, {etag: 'asset-a'});
    }
  });
  vm.runInContext(source, context);
  return {context, body};
}

test('muestra la versión vigente, fecha humana y hash desde el manifiesto', async () => {
  const manifest = response({
    version: 'v.08.08.2026.r1.12:26',
    deployedAt: '2026-08-08T10:26:00Z',
    gitShort: '2d6226b'
  });
  const {context, body} = fixture([manifest]);
  await context.window.AdmiraVersionWatch.ready;
  const visible = textTree(body);
  assert.match(visible, /Versión vigente/i);
  assert.match(visible, /v\.08\.08\.2026\.r1\.12:26/);
  assert.match(visible, /publicada 8 ago 2026, 12:26/i);
  assert.match(visible, /2d6226b/);
});

test('distingue la release de esta pestaña de una nueva release disponible', async () => {
  const oldRelease = response({version: 'v.08.08.2026.r1.12:26', deployedAt: '2026-08-08T10:26:00Z', gitShort: '2d6226b'});
  const newRelease = response({version: 'v.08.08.2026.r2.13:40', deployedAt: '2026-08-08T11:40:00Z', gitShort: 'abcdef1'});
  const {context, body} = fixture([oldRelease, newRelease]);
  await context.window.AdmiraVersionWatch.ready;
  await context.window.AdmiraVersionWatch.check();
  const visible = textTree(body);
  assert.match(visible, /Versión nueva · recargar/i);
  assert.match(visible, /En esta pestaña.*v\.08\.08\.2026\.r1\.12:26/i);
  assert.match(visible, /Disponible.*v\.08\.08\.2026\.r2\.13:40/i);
  assert.match(visible, /2d6226b.*abcdef1/);
});

test('declara honestamente la ausencia de versión y orienta la próxima publicación', async () => {
  const {context, body} = fixture([response({deployedAt: '2026-08-08T10:26:00Z', gitShort: 'abcdef1'})], 'sin sello');
  await context.window.AdmiraVersionWatch.ready;
  const visible = textTree(body);
  assert.match(visible, /Versión no declarada/i);
  assert.match(visible, /Registra una versión de producto/i);
  assert.doesNotMatch(visible, /v\.\d{2}\.\d{2}\.\d{4}\.r\d+/);
});

test('todas las páginas que cargan el verificador fijan la huella de su contenido', async () => {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      if (entry.name.startsWith('.') || ['node_modules', 'old', 'backups'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.html')) files.push(full);
    }
  }
  await walk(root.pathname);
  const references = [];
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    references.push(...html.matchAll(/\/assets\/admira-version-watch\.js([^"']*)/g));
  }
  assert.ok(references.length >= 12, 'la guardia debe cubrir todas las superficies que montan el verificador');
  assert.ok(references.every((match) => match[1] === '?build=8081345'),
    'un verificador cacheado ocultaría el nuevo contexto de release hasta cuatro horas');
});

test('el verificador dice quién publicó la versión, no sólo cuál es', async () => {
  const js = await readFile(new URL('../assets/admira-version-watch.js', import.meta.url), 'utf8');

  // Carlos, 08-08-2026: «solo le falta decir quién ha sido el responsable de la
  // nueva versión». La firma ya viajaba en version.json desde el 3-ago; la
  // tarjeta la ignoraba. Una versión sin responsable a la vista dice QUÉ corre
  // pero no QUIÉN lo puso ahí, que es lo primero que se pregunta cuando algo
  // sale mal — lo que no está controlado, está descontrolado.
  assert.match(js, /signature/, 'debe leer la firma del manifiesto');
  assert.match(js, /d\.deployer/, 'debe reconstruirla desde deployer + machine si no viene compuesta');
  assert.match(js, /admira-version__by/, 'la firma necesita su propio hueco en la tarjeta');
  assert.match(js, /responsable no declarado/, 'un sello antiguo sin firma se dice, no se inventa');
  assert.match(js, /firma: /, 'la trazabilidad técnica también la lleva');
});

test('sólo se monta un verificador por pestaña, y el botón siempre responde', async () => {
  const js = await readFile(new URL('../assets/admira-version-watch.js', import.meta.url), 'utf8');

  // Carlos, 08-08-2026: vio DOS tarjetas superpuestas diciendo cosas contrarias
  // -una "versión nueva", otra "versión vigente"- porque el script se evaluó dos
  // veces y cada instancia tenía su propio panel de closure. Ningún botón podía
  // resolver al otro: por eso "Comprobar" parecía no hacer nada.
  assert.match(js, /if \(window\.AdmiraVersionWatch\) return;/,
    'una segunda evaluación no debe montar otra instancia');
  assert.match(js, /querySelector\(["']\.admira-version["']\)/,
    'y si ya hay panel en el DOM -instancia antigua sin guardia- se adopta, no se apila otro');
  assert.match(js, /Al día ✓/,
    'comprobar y no cambiar nada debe decirse; un botón mudo parece averiado');
  assert.match(js, /function ronda\(manual\)/,
    'el sondeo automático no debe parpadear como si lo hubiera pulsado alguien');
});
