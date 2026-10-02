// Encargo #4871: marca (id de catálogo) o prospectUrl en create_presentation.
// Una URL se analiza y se guarda como propuesta no oficial (KV marca:<id>, logo en R2).
import test from 'node:test';
import assert from 'node:assert/strict';
import {crearMarca} from '../marcablanca/marca.js';
import {aplicarAtajoMarca, leerAtajoMarca} from '../functions/presentaciones/_marca-atajo.js';
import {onRequest as jobsPost} from '../functions/presentaciones/api/jobs.js';

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function kv(){
  const values = new Map();
  return {values, async get(key, o){ const v = values.get(key); if (v == null) return null; return o?.type === 'json' ? JSON.parse(v) : v; },
    async put(key, value){ values.set(key, String(value)); },
    async list(o){ return {keys: [...values.keys()].filter(k => !o?.prefix || k.startsWith(o.prefix)).map(name => ({name}))}; }};
}
function r2(){
  const objects = new Map();
  return {objects, async put(key, bytes, meta){ objects.set(key, {bytes, meta}); }, async delete(){}};
}

test('leerAtajoMarca admite un id o una URL, nunca las dos', () => {
  assert.deepEqual(leerAtajoMarca({}), {marca: '', prospectUrl: ''});
  assert.equal(leerAtajoMarca({marca: 'Lumbre'}).marca, 'lumbre');
  assert.equal(leerAtajoMarca({prospectUrl: 'cafenorte.example'}).prospectUrl, 'https://cafenorte.example');
  assert.throws(() => leerAtajoMarca({marca: 'lumbre', prospectUrl: 'https://x.example'}), /no las dos/);
  assert.throws(() => leerAtajoMarca({marca: 'nueva'}), /prospectUrl/);
  assert.throws(() => leerAtajoMarca({prospectUrl: 'javascript:alert(1)'}), /https/);
});

test('prospectUrl analiza la web y guarda la marca como propuesta no oficial', async () => {
  const env = {PRESENTATION_IDEAS: kv(), PRESENTATION_MEDIA: r2()};
  const propuesta = crearMarca({
    id: 'cafe-norte', nombre: 'Café Norte', primario: '#5B2A86', secundario: '#F2B5D4', acento: '#00B3A4',
    logo: {imagen: PNG_1PX, alt: 'Logo de Café Norte'}, web: 'https://www.cafenorte.example', origenTipo: 'url'
  });
  let analizada = '';
  const resultado = await aplicarAtajoMarca({
    raw: {prospectUrl: 'https://www.cafenorte.example'},
    env,
    request: new Request('https://www.admiranext.com/presentaciones/api/generate'),
    autor: {nombre: 'SmithMacMini', email: 'smith@admiranext.com'},
    analizar: async (url) => {
      analizada = url;
      return {propuesta, datos: {web: url}, analisis: {url, finalUrl: url}};
    }
  });
  assert.equal(analizada, 'https://www.cafenorte.example');
  assert.deepEqual(resultado.prospectRaw, {activo: true, marca: 'cafe-norte'});
  assert.equal(resultado.catalogo.propuesta, true);
  assert.equal(resultado.catalogo.guardada, true);
  const guardada = JSON.parse(env.PRESENTATION_IDEAS.values.get('marca:cafe-norte'));
  assert.equal(guardada.marca.id, 'cafe-norte');
  assert.equal(guardada.catalogo.origen, 'url');
  assert.equal(guardada.catalogo.propuesta, true);
  assert.match(guardada.catalogo.aviso, /no es la marca oficial/);
  assert.equal(guardada.marca.logo.imagen, '/marcablanca/api/marcas/cafe-norte/logo');
  assert.ok(env.PRESENTATION_MEDIA.objects.has('marcas/cafe-norte/logo.png'), 'el logo queda en R2 PRESENTATION_MEDIA');
});

test('el job admite marca sin web y rechaza las dos a la vez', async () => {
  const env = {PRESENTATION_IDEAS: kv(), PRES_SIGNING_KEY: 'clave-de-prueba'};
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', {status: 202});
  try {
    const cabeceras = {origin: 'https://www.admiranext.com', 'content-type': 'application/json'};
    const pedir = (body) => jobsPost({env, request: new Request('https://www.admiranext.com/presentaciones/api/jobs', {method: 'POST', headers: cabeceras, body: JSON.stringify(body)})});
    const lasDos = await pedir({displayName: 'Cliente X', marca: 'lumbre', prospectUrl: 'https://x.example'});
    assert.equal(lasDos.status, 400);
    assert.match((await lasDos.json()).error, /no las dos/);
    const sinWeb = await pedir({displayName: 'Sin nada'});
    assert.equal(sinWeb.status, 400);
    const porMarca = await pedir({displayName: 'Lumbre Café', marca: 'lumbre'});
    assert.equal(porMarca.status, 202, JSON.stringify(await porMarca.clone().json()));
    const data = await porMarca.json();
    assert.equal(data.status, 'queued');
    const crudo = [...env.PRESENTATION_IDEAS.values.entries()].find(([clave]) => clave.startsWith('create-job:'));
    assert.equal(JSON.parse(crudo[1]).body.marca, 'lumbre');
    const porUrl = await pedir({displayName: 'Café Norte', prospectUrl: 'https://www.cafenorte.example'});
    assert.equal(porUrl.status, 202);
    const crudoUrl = [...env.PRESENTATION_IDEAS.values.entries()].filter(([clave]) => clave.startsWith('create-job:')).map(([, v]) => JSON.parse(v)).find(job => job.slug !== data.slug);
    assert.equal(crudoUrl.body.prospectUrl, 'https://www.cafenorte.example');
  } finally {
    globalThis.fetch = real;
  }
});
