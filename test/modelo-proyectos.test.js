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

test('el texto de /proyectos cabe en una barra cerrada y no pierde el modelo', () => {
  const page = fs.readFileSync(new URL('../proyectos/index.html', import.meta.url), 'utf8');
  assert.match(page, /<details class="censo-nota" id="nota-censo">/);
  assert.doesNotMatch(page, /<details class="censo-nota" id="nota-censo"[^>]*\sopen/);
  assert.match(page, /data-en="Live census:">Censo vivo:<\/span><span> <\/span>/);
  assert.match(page, /href="https:\/\/api\.yokup\.com\/projects">api\.yokup\.com\/projects<\/a>/);
  assert.match(page, /href="https:\/\/www\.yokup\.com\/misiones" data-en="Missions">Misiones<\/a>/);
  assert.match(page, /href="https:\/\/www\.yokup\.com\/equipo" data-en="Team">Equipo<\/a>/);
  assert.match(page, /data-en="Model ⓘ">Modelo ⓘ<\/span>/);
  const nota = page.indexOf('id="nota-censo"');
  const cierre = page.indexOf('</details>');
  const censo = page.indexOf('id="censo"');
  assert.ok(nota > 0 && cierre > nota && censo > cierre, 'el censo queda debajo de la barra, no entre el texto');
  const cuerpo = page.slice(nota, cierre);
  for (const frase of [
    'El censo vivo está en Yokup. Aquí se ve el modelo (qué es un proyecto, de qué xpacio, por dónde entra) y el inventario actual. Un admin puede mandar un proyecto a la papelera 7 días; después se purga la copia y no vuelve al censo. Pulsa una cabecera del censo para ordenar.',
    'El censo de la flota está en esta página',
    'GET https://api.yokup.com/projects',
    'admira.biz es DooH y Retail Media (antes clearchannel.tv)',
    'admira.app es instalaciones y mantenimiento',
    'href="https://www.yokup.com/misiones">/misiones</a>',
    'href="https://www.yokup.com/equipo">/equipo</a>',
    'Modelo canónico',
    'Agente (silicio)',
    'SmithMacMini',
    'project_id',
    'POST /projects/principal',
    'id="modelo"',
    'Puertas norma 24',
    'Yokup no admite DELETE',
    'id="papelera"',
    'id="dlg-eliminar"',
    'id="col-eliminar"',
  ]) assert.ok(cuerpo.includes(frase) || page.includes(frase), frase);
  assert.doesNotMatch(page, /sin borrar nada/);
  assert.doesNotMatch(page, /No se borra el censo/);
  assert.doesNotMatch(page, /no se borra nada desde aquí/);
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
