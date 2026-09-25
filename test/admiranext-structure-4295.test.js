import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIRANEXT_STRUCTURE_ID,
  admiranextBlueprint,
  normalizeStructureInput,
  structureIdeasSeed,
  normalizeFooter,
  BRIEF_MAX
} from '../functions/presentaciones/_admiranext-structure.js';
import {normalizeSequence, resolveDeckRef, DEFAULT_BEFORE_DECK} from '../functions/presentaciones/_deck-library.js';
import {assertKnownGenerateFields, onRequestPut} from '../functions/presentaciones/api/generate.js';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';
import {callTool, TOOLS, SERVER_INFO} from '../functions/mcp/_server.js';

function kv(seed = {}) {
  const values = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    values,
    async get(key, options) {
      const v = values.get(key);
      if (v == null) return null;
      return options?.type === 'json' ? JSON.parse(v) : v;
    },
    async put(key, value) { values.set(key, String(value)); },
    async list() { return { keys: [...values.keys()].map(name => ({ name })) }; }
  };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('estructura AdmiraNeXT: 3 actos × portada + a/b/c (12 láminas, 45 min de capítulos)', () => {
  const slides = admiranextBlueprint('Alsea');
  assert.equal(slides.length, 12);
  assert.deepEqual(slides.map(s => s.code), [
    'studio-cover', 'studio-a', 'studio-b', 'studio-c',
    'store-cover', 'store-a', 'store-b', 'store-c',
    'app-cover', 'app-a', 'app-b', 'app-c'
  ]);
  const chapterMinutes = slides.filter(s => s.role === 'chapter').reduce((sum, s) => sum + s.duration, 0);
  assert.equal(chapterMinutes, 45);
  const forced = normalizeStructureInput({ structure: 'admiranext', displayName: 'Alsea' });
  assert.equal(forced.id, ADMIRANEXT_STRUCTURE_ID);
  assert.equal(forced.slides.length, 12);
  const ideas = structureIdeasSeed(forced, { displayName: 'Alsea', website: 'https://www.alsea.net', problem: 'x'.repeat(2000) }, 'alsea-demo', ['es', 'en']);
  assert.equal(ideas.skeleton.length, 12);
  assert.equal(ideas.narrativeSource, 'admiranext-structure');
  assert.equal(ideas.skeleton[0].id, 'studio-cover');
  assert.equal(ideas.skeleton[1].minutes, 5);
});

test('slides personalizados exigen act válido y rechazan campos desconocidos', () => {
  assert.throws(() => normalizeStructureInput({ slides: [{ code: 'x', title: 't', message: 'm', act: 'nope' }] }), /act debe ser/);
  assert.throws(() => normalizeStructureInput({ slides: [{ code: 'x', title: 't', message: 'm', act: 'studio', foo: 1 }] }), /campos desconocidos/);
  assert.throws(() => normalizeStructureInput({ structure: 'otro' }), /structure desconocida/);
});

test('beforeDeck/afterDeck/insertDeck aceptan slug o pack y ya no descartan en silencio', () => {
  assert.deepEqual(resolveDeckRef(DEFAULT_BEFORE_DECK), { kind: 'pack', id: DEFAULT_BEFORE_DECK });
  assert.deepEqual(resolveDeckRef('alsea-starbucks-circuito'), { kind: 'presentation', id: 'alsea-starbucks-circuito' });
  assert.throws(() => resolveDeckRef('!!!'), /no es un pack/);
  assert.throws(() => normalizeSequence({ before: DEFAULT_BEFORE_DECK, after: 'invalid-pack-name!!' }), /afterDeck/);
  const seq = normalizeSequence({
    before: DEFAULT_BEFORE_DECK,
    after: 'jti-xtanco-circuito',
    insertDeck: { slug: 'alsea-starbucks-circuito', afterBlock: 'store-cover' }
  });
  assert.equal(seq.before, DEFAULT_BEFORE_DECK);
  assert.equal(seq.beforeKind, 'pack');
  assert.equal(seq.after, 'jti-xtanco-circuito');
  assert.equal(seq.afterKind, 'presentation');
  assert.deepEqual(seq.inserts, [{ slug: 'alsea-starbucks-circuito', afterBlock: 'store-cover' }]);
});

test('campos desconocidos en generate dan error; brief supera 1200', () => {
  assert.throws(() => assertKnownGenerateFields({ displayName: 'X', inventado: true }), /Campos desconocidos/);
  assert.ok(BRIEF_MAX > 1200);
  assert.equal(normalizeFooter('Confidencial · Alsea').text, 'Confidencial · Alsea');
  assert.throws(() => normalizeFooter({ text: 'ok', neon: true }), /footer campos desconocidos/);
});

test('generate con structure admiranext + insertDeck por slug respeta orden y códigos', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.x.ai')) throw new Error('xAI no debería llamarse con structure');
    if (u.endsWith('/logo.png')) return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(PNG.byteLength) } });
    throw new Error('fetch inesperado: ' + u);
  };
  try {
    const store = kv({
      'presentation:alsea-starbucks-circuito': {
        slug: 'alsea-starbucks-circuito', displayName: 'Alsea Starbucks', website: 'https://www.alsea.net', languages: ['es', 'en'], outputs: ['website']
      },
      'ideas:alsea-starbucks-circuito': {
        hero: { title: 'Circuito', summary: 'Sala insertada' },
        objective: 'Demo',
        skeleton: [
          { id: 'circuito-a', title: 'Circuito A', message: 'Mensaje A', detail: 'Detalle A', enabled: true },
          { id: 'circuito-b', title: 'Circuito B', message: 'Mensaje B', detail: 'Detalle B', enabled: true }
        ],
        closing: { title: 'Cierre', action: 'Acción' },
        labels: { objective: 'Objetivo', next: 'Siguiente' }
      }
    });
    const brief = 'B'.repeat(1800);
    const body = {
      displayName: 'Alsea Estructura Demo',
      slug: 'alsea-estructura-demo',
      website: 'https://www.alsea.net/',
      problem: brief,
      audience: 'Dirección Alsea',
      structure: 'admiranext',
      insertDeck: { slug: 'alsea-starbucks-circuito', afterBlock: 'store-cover' },
      footer: 'ADmiraNeXT · Alsea · confidencial',
      inspiration: {
        url: 'https://www.alsea.net/', title: 'Alsea', description: 'Restauración',
        primary: '#112233', accent: '#ffaa00',
        logo: { type: 'url', url: 'https://www.alsea.net/logo.png' }
      },
      outputs: ['website'],
      languages: ['es', 'en']
    };
    const request = new Request('https://www.admiranext.com/presentaciones/api/generate', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', Origin: 'https://www.admiranext.com' },
      body: JSON.stringify(body)
    });
    const response = await onRequestPut({ request, env: { PRESENTATION_IDEAS: store, PRESENTATION_MEDIA: { async put() {} }, PRES_SIGNING_KEY: 'clave-de-prueba' }, params: {}, waitUntil() {} });
    const data = await response.json();
    assert.equal(response.status, 201, JSON.stringify(data).slice(0, 400));
    assert.equal(data.narrativeSource, 'admiranext-structure');
    assert.equal(data.structure.id, 'admiranext');
    assert.equal(data.structure.slideCodes.length, 12);
    assert.equal(data.sequence.inserts[0].slug, 'alsea-starbucks-circuito');
    assert.equal(data.footer.text, 'ADmiraNeXT · Alsea · confidencial');
    const ideas = JSON.parse(store.values.get('ideas:alsea-estructura-demo'));
    assert.equal(ideas.skeleton.length, 12);
    assert.equal(ideas.skeleton.map(s => s.id).join(','), data.structure.slideCodes.join(','));
    const presentation = JSON.parse(store.values.get('presentation:alsea-estructura-demo'));
    assert.equal(presentation.problem.length, 1800, 'el brief no se corta a 1200');

    const htmlResponse = await renderPresentation({
      params: { client: 'alsea-estructura-demo' },
      env: { PRESENTATION_IDEAS: store },
      data: { presentationAccess: { canGenerate: false } },
      request: new Request('https://www.admiranext.com/presentaciones/alsea-estructura-demo/presentacion'),
      next() { throw new Error('unexpected next'); }
    });
    const html = await htmlResponse.text();
    assert.match(html, /data-act="studio"/);
    assert.match(html, /data-chapter="a"/);
    assert.match(html, /data-insert-slug="alsea-starbucks-circuito"/);
    assert.match(html, /slide-footer/);
    assert.match(html, /Circuito A/);
    assert.equal((html.match(/data-block-id="studio-/g) || []).length, 4);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('generate rechaza beforeDeck desconocido y campos inventados', async () => {
  const request = new Request('https://www.admiranext.com/presentaciones/api/generate', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', Origin: 'https://www.admiranext.com' },
    body: JSON.stringify({ displayName: 'X', website: 'https://www.example.com', beforeDeck: 'no-existe-ni-pack', foo: 1 })
  });
  const response = await onRequestPut({ request, env: { PRESENTATION_IDEAS: kv(), PRES_SIGNING_KEY: 'k' }, params: {}, waitUntil() {} });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /Campos desconocidos|beforeDeck/);
});

test('MCP expone update_slide, structure e insertDeck (v1.6)', async () => {
  assert.equal(SERVER_INFO.version, '1.6.0');
  assert.ok(TOOLS.some(t => t.name === 'update_slide'));
  const create = TOOLS.find(t => t.name === 'create_presentation');
  assert.ok(create.inputSchema.properties.structure);
  assert.ok(create.inputSchema.properties.insertDeck);
  assert.ok(create.inputSchema.properties.footer);
  const calls = [];
  const ctx = {
    access: { email: 'arquitecto@admira.com', level: 'editor' },
    env: { PRES_SIGNING_KEY: 'k' },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, method: options.method, body: options.body });
      if (String(url).includes('inline-edit')) {
        return new Response(JSON.stringify({ ok: true, revised: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  };
  await callTool(ctx, 'update_slide', { client: 'demo', blockId: 'studio-a', title: 'Nuevo', message: 'Msg' });
  assert.equal(calls.at(-1).method, 'PUT');
  assert.match(calls.at(-1).url, /inline-edit/);
  const payload = JSON.parse(calls.at(-1).body);
  assert.equal(payload.edits.length, 2);
  await assert.rejects(() => callTool(ctx, 'create_presentation', { displayName: 'X', inventado: true }), /Campos desconocidos/);
});
