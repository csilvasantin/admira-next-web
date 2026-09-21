// FLT-100773 a (Morfeo, 21-sep-2026) · un alta nueva no puede pisar PortAventura.
//
// El formulario del Generador nacía relleno con PortAventura y con el slug clavado
// (slugTouched=true): quien escribía otro nombre seguía mandando slug=portaventura, el
// alta chocaba 409 y el diálogo le ofrecía SOBRESCRIBIR PortAventura. Y «Mejorar» desde
// el censo sólo pisaba los campos que el censo traía: título, objetivo, audiencia y
// embeds de PortAventura acababan en el relato de otro cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as listClients} from '../functions/presentaciones/api/clients.js';

const html = await readFile(new URL('../presentaciones/generador.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../assets/presentation-generator-20260721-11.js', import.meta.url), 'utf8');

test('el formulario nace vacío: ni rastro de PortAventura', () => {
  assert.doesNotMatch(html, /portaventura/i);
  for (const id of ['displayName', 'slug', 'website', 'audience', 'title']) {
    assert.match(html, new RegExp(`<input id="${id}"[^>]*value=""`), `${id} vacío`);
  }
  for (const id of ['problem', 'objective', 'embeds']) {
    assert.match(html, new RegExp(`<textarea id="${id}"[^>]*></textarea>`), `${id} vacío`);
  }
});

test('el slug sigue al nombre hasta que alguien lo escribe a mano', () => {
  assert.match(js, /let slugTouched=false,/);
  assert.match(js, /display\.addEventListener\('input',\(\)=>\{if\(!slugTouched\)slug\.value=slugify\(display\.value\)\}\)/);
  assert.match(js, /slug\.addEventListener\('input',\(\)=>\{slugTouched=Boolean\(slug\.value\)\}\)/);
});

test('«Mejorar» reescribe TODOS los campos del relato y descarta el análisis visual anterior', () => {
  const reset = js.slice(js.indexOf('function resetStory('), js.indexOf('function fillFromCatalog('));
  assert.match(js, /const storyFields=\['problem','audience','title','objective','embeds'\];/);
  assert.match(reset, /field\.value=values\[id\]\|\|''/, 'lo que el censo no trae se vacía, no se hereda');
  assert.match(reset, /inspirationAnalysis=null;renderInspiration\(null\);/);
  const fill = js.slice(js.indexOf('function fillFromCatalog('), js.indexOf('async function loadCatalog('));
  assert.match(fill, /website\.value=client\.website\|\|'';/, 'la web se pisa siempre, también si el censo no la trae');
  assert.match(fill, /resetStory\(\{problem:client\.problem,audience:client\.audience,/);
});

test('volver a «Nueva presentación» lo vacía todo y el slug vuelve a seguir al nombre', () => {
  const fill = js.slice(js.indexOf('function fillFromCatalog('), js.indexOf('async function loadCatalog('));
  assert.match(fill, /if\(!client\)\{[\s\S]*?display\.value='';slug\.value='';slugTouched=false;website\.value='';resetStory\(\);/);
  assert.match(js, /if\(client\)fillFromCatalog\(client\); else \{fillFromCatalog\(null\);/);
});

test('el censo devuelve la audiencia guardada, para que «Mejorar» no tenga que vaciarla', async () => {
  const store = new Map([['presentation:demo', {slug:'demo', displayName:'Demo', website:'https://demo.example', problem:'P', audience:'Dirección de tiendas', languages:['es', 'en'], outputs:['website']}]]);
  const env = {PRESENTATION_IDEAS:{
    async list(){ return {keys:[...store.keys()].map(name => ({name}))}; },
    async get(key){ return store.get(key) ?? null; }
  }};
  const response = await listClients({env});
  const {clients} = await response.json();
  assert.equal(clients[0].audience, 'Dirección de tiendas');
});
