// ESM (FLT-100016). Xtore · Puerta Cam (Carlos, 11-sep-2026): un anuncio por
// TIPOLOGÍA. El brief (?brief=) llega al director creativo como contexto de
// campaña, el público es la tipología y la pieza sale al Stock con identidad
// estable admiranext:xtore:<lane> para que el player la enganche solo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function kv(){
  const values = new Map();
  return { async get(k){ return values.get(k) ?? null; }, async put(k, v){ values.set(k, v); } };
}

const BRIEF = {
  campana:'Xtore · Puerta Cam', lane:'coche', tipologia:'coche',
  titulo:'Aparca. Entra. Estrena.', mensaje:'Tienes plaza a un minuto y las zapatillas que quieres a dos pasos.',
  externalId:'admiranext:xtore:coche', formato:'9:16', duracion:15, origen:'admira.tv/videoanalytics/xtore'
};

test('el brief viaja al director creativo: público = tipología, tono calle→tienda, título literal', async () => {
  const {onRequest} = await import('../functions/presentaciones/api/ad-idea.js');
  let providerBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    providerBody = JSON.parse(init.body);
    // El modelo «olvida» el título y pone una marca ficticia: la garantía los repone.
    const ad = {idea:'Baja del coche y sube de nivel', detail:'Plano desde el interior de un coche que frena ante el escaparate. Corte a las zapatillas en la mano. Cierre con la puerta abierta de Xtore y la invitación a entrar ahora.', brand:'Marca ficticia', objective:'visits', audience:'Conductores que pasan por delante de la tienda'};
    return new Response(JSON.stringify({output:[{type:'message', content:[{type:'output_text', text:JSON.stringify({ad})}]}]}), {status:200, headers:{'content-type':'application/json'}});
  };
  try{
    const request = new Request('https://www.admiranext.com/presentaciones/api/ad-idea', {
      method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com'},
      body:JSON.stringify({headline:'Aparca. Entra. Estrena. · Tienes plaza a un minuto', brief:BRIEF})
    });
    const response = await onRequest({request, env:{XAI_API_KEY:'test', PRESENTATION_IDEAS:kv()}});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.mode, 'brief');
    const system = providerBody.input[0].content[0].text;
    const user = JSON.parse(providerBody.input[1].content[0].text);
    assert.match(system, /BRIEF DE CAMPAÑA/);
    assert.match(system, /un conductor que pasa en coche por delante de la tienda Xtore/);
    assert.match(system, /Título obligatorio de la campaña: «Aparca\. Entra\. Estrena\.»/);
    assert.match(system, /Tono de calle a tienda/);
    assert.match(system, /15 segundos en formato 9:16/);
    assert.equal(user.mode, 'campaign_brief');
    assert.equal(user.brief.lane, 'coche');
    assert.equal(user.brief.claim, 'Xtore · IoT Gallery');
    assert.equal(payload.ad.brand, 'Xtore', 'la marca ficticia se sustituye por la del brief');
    assert.match(payload.ad.idea, /^Aparca\. Entra\. Estrena\./, 'el titular conserva el título del brief');
    assert.deepEqual(payload.brief, {campana:'Xtore · Puerta Cam', tipologia:'coche', lane:'coche', titulo:'Aparca. Entra. Estrena.'});
  }finally{ globalThis.fetch = originalFetch; }
});

test('cada tipología tiene su público; un brief sin título se ignora', async () => {
  const {normalizeBrief} = await import('../functions/presentaciones/api/ad-idea.js');
  assert.equal(normalizeBrief(null), null);
  assert.equal(normalizeBrief({campana:'X'}), null);
  assert.match(normalizeBrief({titulo:'Hola', lane:'persona'}).publico, /persona a pie/);
  assert.match(normalizeBrief({titulo:'Hola', lane:'moto'}).publico, /motorista/);
  assert.match(normalizeBrief({titulo:'Hola', tipologia:'Bici'}).publico, /ciclista/);
  assert.equal(normalizeBrief({titulo:'Hola', lane:'bici', duracion:'15'}).duracion, 15);
});

test('el creador lee ?brief=, prefija el titular y publica con el externalId exacto del brief', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.match(app, /get\('brief'\)/, 'lee el deep-link ?brief=');
  assert.match(app, /function fichaBrief\(b\)/);
  assert.match(app, /externalId:b\.externalId\n/, 'el máster lleva la identidad exacta del brief');
  assert.match(app, /tags:\['admiranext', 'tiktok', 'vertical', slugCatalogo\(b\.marca\) \|\| 'xtore'\]/);
  assert.match(app, /function drawBriefOverlay\(ctx, b, seconds = 0\)/);
  assert.match(app, /briefCampana\.overlay\) drawBriefOverlay/, 'brief.overlay === false apaga el rótulo');
  assert.match(app, /body:JSON\.stringify\(productoCatalogo \? \{headline, producto:productoCatalogo\} : briefCampana \? \{headline, brief:briefCampana\}/);
  assert.match(app, /if\(fichaActiva\(\)\) headers\['x-package-ficha'\]/);
});

test('la página de lanzamiento tiene las cuatro tipologías con identidad estable y consulta el Stock', async () => {
  const html = await readFile(new URL('../tiktok/xtore.html', import.meta.url), 'utf8');
  for(const lane of ['persona', 'coche', 'moto', 'bici']) assert.match(html, new RegExp(`lane:'${lane}'`), `tipología ${lane}`);
  assert.match(html, /externalId = \(b\) => `admiranext:xtore:\$\{b\.lane\}`/);
  assert.match(html, /https:\/\/api\.admira\.store\/stock\/list\?limit=200&type=video/);
  assert.match(html, /'auto-' \+ Array\.from\(new Uint8Array\(bytes\)\)\.slice\(0, 10\)/, 'deriva el id del asset como lo hace el Stock');
  const index = await readFile(new URL('../tiktok/index.html', import.meta.url), 'utf8');
  assert.match(index, /href="\/tiktok\/xtore\.html"/, 'el creador enlaza la página de Xtore');
});
