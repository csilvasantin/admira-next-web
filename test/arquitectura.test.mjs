// /arquitectura y /api/arquitectura — organigrama tecnológico (9-oct-2026).
// Guardián: toda flecha une nodos que existen y lleva evidencia; todo texto está en ES y EN;
// la página traduce su cuerpo (no lo deja al diccionario) y la API responde con CORS abierto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestGet, versionesVivas } from '../functions/api/arquitectura.js';

const ROOT = new URL('../', import.meta.url);
const datos = JSON.parse(await readFile(new URL('data/arquitectura.json', ROOT), 'utf8'));

test('las siete piezas están y cada flecha une nodos que existen, con evidencia', () => {
  const ids = new Set(datos.nodos.map((n) => n.id));
  for (const id of ['admiranext', 'studio', 'store', 'tv', 'app', 'biz', 'live']) assert.ok(ids.has(id), id);
  for (const a of datos.aristas) {
    assert.ok(ids.has(a.de) && ids.has(a.a), `${a.de} → ${a.a}`);
    assert.ok(a.es && a.en, `${a.de} → ${a.a} tiene etiqueta ES y EN`);
    if (a.seguro) assert.ok(a.evidencia && a.evidencia.length > 8, `${a.de} → ${a.a} verificada con evidencia`);
  }
});

test('cada nodo y cada duda tienen su texto en castellano y en inglés', () => {
  for (const n of datos.nodos) {
    for (const k of ['nombre', 'rol', 'modulos', 'expone', 'consume', 'cambios']) {
      assert.ok(k in n.es && k in n.en, `${n.id}.${k}`);
      if (Array.isArray(n.es[k])) assert.equal(n.es[k].length, n.en[k].length, `${n.id}.${k}: mismas entradas en ES y EN`);
    }
  }
  for (const d of datos.dudas) assert.ok(d.es && d.en);
});

test('la página carga sus datos, traduce su cuerpo y registra verbos en los dos idiomas', async () => {
  const html = await readFile(new URL('arquitectura.html', ROOT), 'utf8');
  const js = await readFile(new URL('assets/arquitectura.js', ROOT), 'utf8');
  assert.match(html, /<main data-yk-main data-yk-no-traducir/);
  assert.match(js, /\/api\/arquitectura/);
  assert.match(js, /attributeFilter: \['lang'\]/);
  for (const [es, en] of [['nodo', 'node'], ['relaciones', 'relations'], ['etiquetas', 'labels']]) {
    assert.match(js, new RegExp(`id: '${es}', aliases: \\['${en}'`));
  }
  const claves = [...html.matchAll(/data-t="([^"]+)"/g)].map((m) => m[1]);
  const bloque = (l) => js.slice(js.indexOf(`${l}: {`), js.indexOf(l === 'es' ? '\n    en: {' : 'var COLOR'));
  for (const k of claves) {
    assert.match(bloque('es'), new RegExp(`\\b${k}:`), `TXT.es.${k}`);
    assert.match(bloque('en'), new RegExp(`\\b${k}:`), `TXT.en.${k}`);
  }
});

test('/api/arquitectura: JSON con CORS abierto y versiones vivas sin romperse si una web no contesta', async () => {
  const r = await onRequestGet({ request: new Request('https://www.admiranext.com/api/arquitectura?vivo=0') });
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const j = await r.json();
  assert.equal(j.nodos.length, datos.nodos.length);
  assert.equal(j.versiones, undefined);
  const falso = async (u) => (String(u).includes('admira.tv') ? new Response('{"version":"v.09.10.2026.r1.00:06","signature":"X · Y"}') : Promise.reject(new Error('red')));
  const v = await versionesVivas(datos.nodos, falso);
  assert.deepEqual(Object.keys(v), ['tv']);
  assert.equal(v.tv.version, 'v.09.10.2026.r1.00:06');
});
