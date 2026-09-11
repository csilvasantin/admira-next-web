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
  assert.match(app, /externalId:b\.externalId,\n/, 'el máster lleva la identidad exacta del brief');
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

// Incidencia 11-sep-2026 19:20 (Carlos): con ?brief= de coche salió un anuncio
// de edición de PDF (el ejemplo del estudio) con la ficha de Xtore, y el máster
// no llegó al Stock. Con encargo, Grok solo arranca desde la idea desarrollada.
test('con encargo, Grok nunca arranca desde el ejemplo: exige la idea desarrollada y la verifica en el prompt', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.match(app, /let ideaEncargo = null;/);
  const guard = app.slice(app.indexOf('async function startGrokVideo()'), app.indexOf('generateGrokButton.disabled = true;', app.indexOf('async function startGrokVideo()')));
  assert.match(guard, /if\(encargoActivo\(\)\)\{/, 'la guardia vive en el único sitio que llama a Grok');
  assert.match(guard, /if\(!ideaEncargo\)\{[\s\S]*?return false;/, 'sin idea desarrollada no hay vídeo');
  assert.match(guard, /prompt\.includes\(example\.task\)[\s\S]*?return false;/, 'el ejemplo del PDF jamás llega a Grok con un encargo');
  const flujo = app.slice(app.indexOf('async function generarAnuncioCatalogo()'), app.indexOf('function terminarFlujoCatalogo'));
  assert.match(flujo, /if\(!ok\) throw new Error\(`El director creativo no devolvió la idea/, 'si ad-idea falla se aborta con mensaje claro');
  assert.match(flujo, /if\(!ideaCoherenteConEncargo\(ad\)\) throw/, 'una idea que no habla del encargo no se rueda');
  assert.match(flujo, /const planEncargo = core\.buildPlan\(core\.buildBriefFromAd\(ad\), 0\);\s*grokPrompt\.value = /, 'el prompt se construye desde la idea desarrollada, no desde la pantalla');
  assert.match(app, /function sembrarTallerConEncargo\(\)/, 'el taller se siembra con el encargo desde el primer segundo');
});

test('si el máster no se puede montar, el bruto se publica con la identidad EXACTA y avisa «sin rótulo»', async () => {
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  const fallback = app.slice(app.indexOf('async function publicarBrutoSinRotulo'), app.indexOf('async function composeAndPublishGrokPackage'));
  assert.match(fallback, /const ficha = fichaActiva\(\);/);
  assert.match(fallback, /title:core\.clean\(`\$\{ficha\.title\} · sin rótulo`, 200\)/);
  assert.match(fallback, /'x-package-ficha':encodeURIComponent\(JSON\.stringify\(fichaBruto\)\)/, 'la ficha conserva externalId exacto (spread de ficha)');
  assert.doesNotMatch(fallback, /externalId:/, 'no se reescribe el externalId: viaja el del encargo tal cual');
  assert.match(fallback, /Publicado SIN rótulo como «\$\{ficha\.externalId\}»/);
  assert.equal((app.match(/void publicarBrutoSinRotulo\(/g) || []).length, 3, 'navegador incapaz, Pixeria caída y montaje roto: los tres caminos caen al bruto');
});

test('con encargo el bruto no va al Stock: la ficha lleva brutoAlStock:false y la UI entiende «retenido»', async () => {
  const {saneaFicha} = await import('../functions/presentaciones/api/_ficha-video.mjs');
  assert.equal(saneaFicha({title:'x', externalId:'admiranext:xtore:coche', brutoAlStock:false}).brutoAlStock, false);
  assert.ok(!('brutoAlStock' in saneaFicha({title:'x', externalId:'admiranext:xtore:coche'})), 'sin la marca, el flujo libre sigue publicando el bruto');
  const app = await readFile(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/brutoAlStock:false/g) || []).length, 2, 'ficha de producto y ficha de brief');
  assert.match(app, /payload\.pixeria\?\.mediaUrl \|\| payload\.pixeria\?\.assetUrl/, 'el bruto retenido se reproduce same-origin');
  assert.match(app, /publication\.status === 'published' \|\| publication\.status === 'retenido'/, 'retenido dispara el máster igual que published');
  assert.match(app, /function recordarPublicado\(requestId, stockId\)/, 'flujo libre: memoria local de requestId publicados');
  assert.match(app, /sustituye a la pieza anterior con la misma identidad/, 'la UI dice cuándo sustituye');
});
