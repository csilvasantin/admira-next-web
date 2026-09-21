// FLT-100780 (Morfeo, 21-sep-2026) · las llamadas externas que quedaban sin plazo.
//
// FLT-100766 puso reloj a la traducción del alta, las láminas y el vídeo. Quedaban: la
// idea publicitaria, la edición en línea (que traduce antes de guardar), la verificación
// de Google en el login, el aviso de recuperación y —lo más grave— el productor local de
// NotebookLM, que atiende la cola en serie: una llamada colgada paraba la cola entera.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as adIdea, AD_IDEA_TIMEOUT_MS} from '../functions/presentaciones/api/ad-idea.js';
import {onRequest as inlineEdit, INLINE_TRANSLATION_TIMEOUT_MS} from '../functions/presentaciones/[client]/api/inline-edit.js';
import {onRequest as puerta, GOOGLE_VERIFY_TIMEOUT_MS, RECOVERY_NOTICE_TIMEOUT_MS} from '../functions/presentaciones/_middleware.js';
import {fetchConPlazo, plazoSubida, API_TIMEOUT_MS, UPLOAD_TIMEOUT_MS} from '../tools/notebooklm-local/network.js';

const plazoVencido = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');
async function conFetch(falso, cuerpo){
  const original = globalThis.fetch;
  globalThis.fetch = falso;
  try { return await cuerpo(); } finally { globalThis.fetch = original; }
}
function kv(inicial = []){
  const values = new Map(inicial);
  return {values, async get(key, options){ const v = values.get(key); return v == null ? null : options?.type === 'json' ? JSON.parse(v) : v; }, async put(key, value){ values.set(key, value); }, async delete(key){ values.delete(key); }, async list(){ return {keys:[]}; }};
}

// ── a) Servidor ──────────────────────────────────────────────────────────────
const pedirIdea = env => adIdea({env, request:new Request('https://www.admiranext.com/presentaciones/api/ad-idea', {method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com', 'CF-Connecting-IP':'203.0.113.5'}, body:JSON.stringify({headline:'Zapatillas que duran'})})});

test('idea publicitaria: la petición a xAI lleva plazo y, si vence, es un 504 con motivo', async () => {
  let senal = null;
  const r = await conFetch(async (_u, init) => { senal = init.signal; throw plazoVencido(); }, () => pedirIdea({XAI_API_KEY:'k', PRESENTATION_IDEAS:kv()}));
  assert.ok(senal instanceof AbortSignal);
  assert.equal(r.status, 504);
  assert.match((await r.json()).error, new RegExp(`no respondió a tiempo \\(${AD_IDEA_TIMEOUT_MS / 1000} s\\)`));
});

test('idea publicitaria: si el plazo vence leyendo el CUERPO, también es 504 (no «respuesta no válida»)', async () => {
  const cuerpoQueSeCorta = new ReadableStream({start(c){ c.error(plazoVencido()); }});
  const r = await conFetch(async () => new Response(cuerpoQueSeCorta, {status:200}), () => pedirIdea({XAI_API_KEY:'k', PRESENTATION_IDEAS:kv()}));
  assert.equal(r.status, 504);
});

const presentation = {displayName:'Demo', outputs:['website'], languages:['es', 'en'], theme:{}};
const ideas = {displayName:'Demo', languages:['es', 'en'], translations:{}, updatedAt:'2026-09-21T10:00:00.000Z', hero:{eyebrow:'E', title:'Título', summary:'R'}, objective:'O', skeleton:[{id:'uno', title:'Uno', message:'M', detail:'D', enabled:true}], closing:{title:'C', action:'A'}, labels:{objective:'O', next:'S'}};
const editar = env => inlineEdit({env, params:{client:'demo'}, request:new Request('https://www.admiranext.com/presentaciones/demo/api/inline-edit', {method:'PUT', headers:{origin:'https://www.admiranext.com', 'content-type':'application/json'}, body:JSON.stringify({language:'es', revision:ideas.updatedAt, edits:[{field:'hero.title', value:'Título nuevo'}]})})});

test('edición en línea: si la traducción vence, 504, lo dice y NO guarda nada', async () => {
  const store = kv([['presentation:demo', JSON.stringify(presentation)], ['ideas:demo', JSON.stringify(ideas)]]);
  let senal = null;
  const r = await conFetch(async (_u, init) => { senal = init.signal; throw plazoVencido(); }, () => editar({XAI_API_KEY:'k', PRESENTATION_IDEAS:store}));
  assert.ok(senal instanceof AbortSignal);
  assert.equal(r.status, 504);
  assert.match((await r.json()).error, new RegExp(`\\(${INLINE_TRANSLATION_TIMEOUT_MS / 1000} s\\)\\. No se ha guardado nada`));
  assert.equal(JSON.parse(store.values.get('ideas:demo')).hero.title, 'Título', 'el texto original sigue intacto');
});

test('edición en línea: sin red sigue siendo 502 (no se disfraza de plazo)', async () => {
  const store = kv([['presentation:demo', JSON.stringify(presentation)], ['ideas:demo', JSON.stringify(ideas)]]);
  const r = await conFetch(async () => { throw new TypeError('fetch failed'); }, () => editar({XAI_API_KEY:'k', PRESENTATION_IDEAS:store}));
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /No se pudo llegar a xAI/);
});

test('login con Google: si Google no responde a tiempo, falla cerrado y queda auditado', async () => {
  const eventos = [];
  const env = {PRES_SIGNING_KEY:'k', PRES_ADMIN:'m', PRES_GENERIC:'1234', PRESENTATION_IDEAS:kv()};
  const form = new URLSearchParams({intent:'google', credential:'x'.repeat(40)});
  let senal = null;
  const r = await conFetch(async (url, init) => { if (String(url).includes('tokeninfo')) { senal = init?.signal; throw plazoVencido(); } return new Response('{}'); }, () => puerta({
    env, data:{}, next:async () => new Response('ok'),
    waitUntil(p){ eventos.push(p); },
    request:new Request('https://www.admiranext.com/presentaciones/', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:form})
  }));
  await Promise.allSettled(eventos);
  assert.ok(senal instanceof AbortSignal, 'la verificación de Google lleva plazo');
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('set-cookie'), null, 'sin cookie: falla cerrado');
  assert.match(await r.text(), /no se ha podido verificar/);
  assert.ok(GOOGLE_VERIFY_TIMEOUT_MS <= 10000 && RECOVERY_NOTICE_TIMEOUT_MS <= 10000);
});

test('recuperación: el aviso al equipo lleva plazo y su fallo queda en el log', async () => {
  const fuente = await readFile(new URL('../functions/presentaciones/_middleware.js', import.meta.url), 'utf8');
  assert.match(fuente, /formsubmit\.co[^\n]*signal:AbortSignal\.timeout\(RECOVERY_NOTICE_TIMEOUT_MS\)/);
  assert.match(fuente, /aviso de recuperación interrumpido/);
});

// ── b) Productor local ───────────────────────────────────────────────────────
const colgado = (_url, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));

test('productor: una llamada que no contesta vence a su plazo con un motivo accionable', async () => {
  const inicio = Date.now();
  await assert.rejects(fetchConPlazo('https://www.admiranext.com/presentaciones/api/production', {method:'POST'}, 60, colgado),
    /Producción no respondió entera en 0\.06 s \(POST \/presentaciones\/api\/production\)\. Revisa el estado del encargo antes de reintentar/);
  assert.ok(Date.now() - inicio < 2000);
});

test('productor: cabeceras sí pero cuerpo que no llega también vence (se lee dentro del plazo)', async () => {
  const cabecerasYSilencio = (_url, {signal}) => Promise.resolve(new Response(new ReadableStream({start(c){ signal.addEventListener('abort', () => c.error(signal.reason)); }}), {status:200}));
  await assert.rejects(fetchConPlazo('https://x/api', {}, 60, cabecerasYSilencio), /no respondió entera/);
});

test('productor: una respuesta normal llega entera y se puede leer después sin esperar', async () => {
  const r = await fetchConPlazo('https://x/api', {}, 1000, async () => new Response(JSON.stringify({ok:true}), {status:201, headers:{'content-type':'application/json'}}));
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), {ok:true});
  assert.equal((await fetchConPlazo('https://x/api', {}, 1000, async () => new Response(null, {status:204}))).status, 204);
});

test('productor: un error de red que no es de plazo se propaga tal cual', async () => {
  await assert.rejects(fetchConPlazo('https://x/api', {}, 1000, async () => { throw new TypeError('fetch failed'); }), /fetch failed/);
});

test('productor: la subida crece con el tamaño del fichero', () => {
  assert.equal(plazoSubida(0), UPLOAD_TIMEOUT_MS);
  assert.equal(plazoSubida(100 * 1024 * 1024), UPLOAD_TIMEOUT_MS + 100 * 4000);
  assert.ok(API_TIMEOUT_MS <= 30000);
});

test('productor: TODAS las llamadas del worker pasan por el plazo y el --setup tiene techo', async () => {
  const worker = await readFile(new URL('../tools/notebooklm-local/worker.js', import.meta.url), 'utf8');
  assert.doesNotMatch(worker, /await fetch\(/, 'ninguna llamada directa a fetch sin plazo');
  assert.equal((worker.match(/fetchConPlazo\(/g) || []).length, 4, 'API, subida y las dos del logo');
  assert.match(worker, /plazoSubida\(bytes\.byteLength\)/);
  assert.match(worker, /while\(!valid&&Date\.now\(\)<limite\)/);
});
