import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogoProyectos, vistaCenso } from '../functions/_project-access.js';
import { PROYECTOS } from '../functions/_proyectos.js';

const CENSO = [
  { id: 'admiranext', name: 'admiranext.com', web: 'https://www.admiranext.com' },
  { id: 'generador-de-presentaciones', name: 'Generador de presentaciones', web: 'https://www.admiranext.com/presentaciones/' },
  { id: 'generador-de-presites', name: 'Generador de presites', web: 'https://www.admiranext.com/pruebas/presites/' },
  { id: 'webmaster-admiranext', name: 'Webmaster', web: 'https://www.admiranext.com/webmaster' },
  { id: 'admira-etiqueta-digital', name: 'Etiqueta', web: 'https://www.admiranext.com/etiqueta' },
  { id: 'xpaceos', name: 'xpaceos', web: 'https://www.xpaceos.com' },
  { id: 'ainimation-studio', name: 'Ainimation', web: 'https://www.ainimation.studio' },
  { id: 'director-interactivo', name: 'Director', web: 'https://www.ainimation.studio/director' },
  { id: 'beta', name: 'Beta', web: 'https://beta.example' },
  { id: 'admira-tv', name: 'admira.tv', web: 'https://admira.tv' },
];

async function vista() {
  const catalog = await catalogoProyectos({ YOKUP_FETCH: async () => Response.json({ ok: true, projects: CENSO }) });
  return { catalog, ...vistaCenso(catalog, catalog.yokup) };
}

test('el combo de usuarios es el censo Yokup, no el catálogo de ACL', async () => {
  const v = await vista();
  assert.equal(v.projects.length, CENSO.length);
  assert.deepEqual(v.projects.map((p) => p.key), CENSO.map((p) => p.id));
  assert.equal(v.projects.some((p) => p.key.startsWith('commercial:')), false);
  assert.equal(v.projects.some((p) => p.key === 'admira-tv-dashboard'), false);
  assert.equal(v.projects.some((p) => p.key === 'commercial-projects'), false);
  assert.ok(v.commercial.some((p) => p.key === 'commercial:starbucks'));
  assert.ok(v.catalog.projects.length > v.projects.length);
});

test('un subproyecto, un alias o un token MCP del Generador cuentan como admiranext', async () => {
  const { grants } = await vista();
  for (const key of ['generador-de-presentaciones', 'generador', 'presentaciones']) {
    assert.ok(grants[key].includes('admiranext'), key);
    assert.ok(grants[key].includes('generador-de-presentaciones'), key);
    assert.equal(grants[key].includes('generador-de-presites'), false, key);
    assert.equal(grants[key].includes('beta'), false, key);
  }
  assert.ok(grants['admiranext-analitics'].includes('admiranext'));
  assert.equal(grants['admiranext-analitics'].includes('generador-de-presentaciones'), false);
  assert.equal(grants['commercial:starbucks'].includes('admiranext'), false);
  assert.deepEqual(grants['commercial:starbucks'], []);
  assert.ok(grants['admira-store'].includes('xpaceos'));
  assert.ok(grants.admiranext.includes('generador-de-presites'));
  assert.ok(grants.admiranext.includes('admira-etiqueta-digital'));
  assert.ok(grants.admiranext.includes('webmaster-admiranext'));
  assert.ok(grants['generador-de-presites'].includes('admiranext'));
  assert.equal(grants['generador-de-presites'].includes('generador-de-presentaciones'), false);
  assert.ok(grants['admiranext-webmaster'].includes('webmaster-admiranext'));
  assert.ok(grants['admiranext-webmaster'].includes('admiranext'));
  assert.deepEqual(grants.ainimation, ['ainimation-studio']);
  assert.equal(grants.ainimation.includes('director-interactivo'), false);
  assert.ok(grants.__mcp__.includes('admiranext'));
  assert.ok(grants.__mcp__.includes('generador-de-presentaciones'));
  assert.equal(grants.__mcp__.includes('beta'), false);
  assert.equal(grants['*'], undefined);
});

test('si Yokup no responde, el catálogo de ACL sigue completo y el censo no se inventa', async () => {
  const catalog = await catalogoProyectos({ YOKUP_FETCH: async () => { throw new Error('offline'); } });
  assert.equal(catalog.complete, false);
  assert.equal(catalog.yokup, null);
  assert.ok(catalog.projects.length >= PROYECTOS.length);
  assert.equal(vistaCenso(catalog, null).projects.length, 0);
});
