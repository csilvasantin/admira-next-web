import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (rel) => readFile(new URL('../' + rel, import.meta.url), 'utf8');
const ESPERADOS = [
  ['admira.store', 'Morfeo'],
  ['admira.tv', 'Neo'],
  ['admira.app', 'Smith'],
  ['admira.studio', 'Oráculo'],
  ['admira.biz', 'Trinity'],
];

test('data/pilares-finde.json lleva la asignación FINAL #5505 y la congelación #5510', async () => {
  const datos = JSON.parse(await leer('data/pilares-finde.json'));
  assert.equal(datos.encargo, 5505);
  assert.equal(datos.congelacion_encargo, 5510);
  assert.deepEqual(datos.pilares.map((p) => [p.pilar, p.agente]), ESPERADOS);
  assert.equal(datos.pilares.find((p) => p.pilar === 'admira.studio').supervision, 'Jobs');
  assert.equal(datos.pilares.find((p) => p.pilar === 'admira.biz').supervision, 'Jobs');
  assert.match(datos.congeladas.texto, /CONGELADAS|congel/i);
});

test('/flota y /organigrama muestran el panel final #5505+#5510', async () => {
  const flota = await leer('flota.html');
  const org = await leer('organigrama.html');
  for (const html of [flota, org]) {
    assert.match(html, /id="reparto-finde"/);
    assert.match(html, /#5505/);
    assert.match(html, /#5510/);
    assert.match(html, /pixeria\.com/);
    assert.doesNotMatch(html, /sin agente hasta que Carlos/i);
    assert.doesNotMatch(html, /Pendiente de Carlos/);
    for (const [pilar, agente] of ESPERADOS) {
      assert.match(html, new RegExp(pilar.replace('.', '\\.')));
      assert.match(html, new RegExp(agente));
    }
  }
});

test('la portada pública no filtra el reparto', async () => {
  const index = await leer('index.html');
  assert.doesNotMatch(index, /reparto-finde|#5505|CONGELADAS/);
});

test('gate de /data/pilares-finde.json exige sesión', async () => {
  const gate = await leer('functions/data/pilares-finde.json.js');
  assert.match(gate, /sesionCompleta/);
  assert.match(gate, /respuestaLogin/);
});
