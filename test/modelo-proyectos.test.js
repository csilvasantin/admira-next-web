import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { xpacioDe, puertasDe, fichaProyecto } from '../functions/_modelo-proyectos.js';
import { catalogoProyectos } from '../functions/_project-access.js';

test('el xpacio sale del id o del dominio, nunca se inventa un tercero', () => {
  assert.equal(xpacioDe({ id: 'admiranext' }), 'AdmiraNeXT');
  assert.equal(xpacioDe({ id: 'pixeria', web: 'https://www.pixeria.com' }), 'AdmiraNeXT');
  assert.equal(xpacioDe({ id: 'yokup' }), 'Yokup');
  assert.equal(xpacioDe({ id: 'yokup-ideas-objetivos' }), 'Yokup');
  assert.equal(xpacioDe({ id: 'otro', web: 'www.yokup.com' }), 'Yokup');
});

test('las puertas /help y /mcp se derivan del web del proyecto', () => {
  assert.deepEqual(puertasDe('https://www.admiranext.com'), {
    help: 'https://www.admiranext.com/help',
    mcp: 'https://www.admiranext.com/mcp',
  });
  assert.deepEqual(puertasDe('www.yokup.com'), {
    help: 'https://www.yokup.com/help',
    mcp: 'https://www.yokup.com/mcp',
  });
  assert.deepEqual(puertasDe(''), { help: '', mcp: '' });
});

test('la ficha no pierde responsable ni xpacio', () => {
  const f = fichaProyecto({
    id: 'admiranext', name: 'AdmiraNeXT', web: 'https://www.admiranext.com',
    primary_responsible: 'NeoMacMini',
  });
  assert.equal(f.xpacio, 'AdmiraNeXT');
  assert.equal(f.responsible, 'NeoMacMini');
  assert.match(f.help, /\/help$/);
  assert.match(f.mcp, /\/mcp$/);
});

test('el catálogo fusiona el censo Yokup encima del webmaster: no tira el responsable', async () => {
  const env = {
    YOKUP_FETCH: async () => Response.json({
      ok: true,
      projects: [
        { id: 'admiranext', name: 'AdmiraNeXT', web: 'https://www.admiranext.com', primary_responsible: 'NeoMacMini' },
        { id: 'yokup', name: 'Yokup', web: 'www.yokup.com', primary_responsible: 'OraculoMini' },
      ],
    }),
  };
  const catalog = await catalogoProyectos(env);
  assert.equal(catalog.complete, true);
  const next = catalog.projects.find((p) => p.key === 'admiranext');
  const yok = catalog.projects.find((p) => p.key === 'yokup');
  assert.equal(next.xpacio, 'AdmiraNeXT');
  assert.equal(next.responsible, 'NeoMacMini');
  assert.equal(next.source, 'webmaster');
  assert.equal(yok.xpacio, 'Yokup');
  assert.equal(yok.responsible, 'OraculoMini');
});

test('la página /proyectos y /help nombran el hueco de yokup.com/proyectos', () => {
  const page = fs.readFileSync(new URL('../proyectos/index.html', import.meta.url), 'utf8');
  const help = fs.readFileSync(new URL('../help/index.html', import.meta.url), 'utf8');
  const llms = fs.readFileSync(new URL('../mcp/llms.txt', import.meta.url), 'utf8');
  assert.match(page, /yokup\.com\/proyectos no es el censo/);
  assert.match(page, /api\.yokup\.com\/projects/);
  assert.match(help, /id="usuarios-proyectos"/);
  assert.match(llms, /project_id/);
  assert.match(llms, /yokup\.com\/proyectos no es el censo/);
});
