// SSO admira.tv → Generador (Yokup #3165, 12-sep-2026). Un pase firmado con el
// secreto compartido abre la MISMA sesión que el login Google del Generador;
// todo lo que no sea exactamente ese pase se queda fuera con el código que toca.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {onRequest as sso, verificarPase, correosConPase, enmascararCorreo} from '../functions/presentaciones/api/sso.js';
import {onRequest as middleware} from '../functions/presentaciones/_middleware.js';

const SECRET = 'a'.repeat(64);
const NOW = Math.floor(Date.now() / 1000);

function b64url(value){ return Buffer.from(value).toString('base64url'); }
function firmar(payloadB64, secret = SECRET){ return createHmac('sha256', secret).update(payloadB64).digest('base64url'); }
function pase(overrides = {}, secret = SECRET){
  const payload = {v:1, email:'csilva@admira.com', iat:NOW, exp:NOW + 90, nonce:randomUUID(), iss:'admira.tv', aud:'admiranext.com', origen:'https://admira.tv/contentcatalogue', ...overrides};
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${firmar(payloadB64, secret)}`;
}
function kv(){
  const store = new Map();
  return {
    store,
    async get(key){ return store.has(key) ? store.get(key) : null; },
    async put(key, value){ store.set(key, value); },
    async list(){ return {keys:[], list_complete:true}; }
  };
}
function env(extra = {}){
  return {PRES_SIGNING_KEY:'sso-test-sign-key', PRES_GENERIC:'1234', ADMIRA_SSO_SECRET:SECRET, ADMIRA_SSO_EMAILS:'csilva@admira.com,csilvasantin@gmail.com', PRESENTATION_IDEAS:kv(), ...extra};
}
function post(body, environment = env(), headers = {}){
  return sso({
    request:new Request('https://www.admiranext.com/presentaciones/api/sso', {method:'POST', headers:{'content-type':'application/json', origin:'https://www.admiranext.com', ...headers}, body:typeof body === 'string' ? body : JSON.stringify(body)}),
    env:environment,
    waitUntil(){}
  });
}
function cookieHeader(response){ return response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; '); }
const opciones = (extra = {}) => ({secret:SECRET, emails:new Set(['csilva@admira.com']), now:NOW + 10, ...extra});

test('verificarPase: pase válido → ok con el correo normalizado', async () => {
  const verdict = await verificarPase(pase({email:'CSilva@Admira.com'}), opciones());
  assert.equal(verdict.ok, true);
  assert.equal(verdict.email, 'csilva@admira.com');
  assert.equal(verdict.nonceGuard, 'sin-kv');
});

test('verificarPase: firma inválida, secreto distinto o payload manipulado → 401 firma', async () => {
  const otroSecreto = await verificarPase(pase({}, 'b'.repeat(64)), opciones());
  assert.deepEqual([otroSecreto.ok, otroSecreto.status, otroSecreto.code], [false, 401, 'firma']);
  const [payloadB64] = pase().split('.');
  const manipulado = `${b64url(JSON.stringify({...JSON.parse(Buffer.from(payloadB64, 'base64url')), email:'intruso@evil.com'}))}.${firmar(payloadB64)}`;
  const verdict = await verificarPase(manipulado, opciones());
  assert.deepEqual([verdict.ok, verdict.status, verdict.code], [false, 401, 'firma']);
});

test('verificarPase: caducado, vigencia > 120 s o emitido en el futuro → 401', async () => {
  const caducado = await verificarPase(pase({iat:NOW - 300, exp:NOW - 200}), opciones());
  assert.deepEqual([caducado.status, caducado.code], [401, 'caducado']);
  const largo = await verificarPase(pase({iat:NOW, exp:NOW + 121}), opciones());
  assert.deepEqual([largo.status, largo.code], [401, 'vigencia']);
  const futuro = await verificarPase(pase({iat:NOW + 600, exp:NOW + 700}), opciones());
  assert.deepEqual([futuro.status, futuro.code], [401, 'futuro']);
});

test('verificarPase: aud o iss distintos → 401', async () => {
  const aud = await verificarPase(pase({aud:'yokup.com'}), opciones());
  assert.deepEqual([aud.status, aud.code], [401, 'destinatario']);
  const iss = await verificarPase(pase({iss:'xpaceos.com'}), opciones());
  assert.deepEqual([iss.status, iss.code], [401, 'emisor']);
});

test('verificarPase: correo fuera de la lista → 403', async () => {
  const verdict = await verificarPase(pase({email:'otro@admira.com'}), opciones());
  assert.deepEqual([verdict.ok, verdict.status, verdict.code], [false, 403, 'correo_fuera_de_lista']);
});

test('verificarPase: el mismo nonce no entra dos veces', async () => {
  const usados = new Set();
  const nonces = {get:async n => usados.has(n), put:async n => { usados.add(n); }};
  const mismo = pase();
  const primero = await verificarPase(mismo, opciones({nonces}));
  assert.equal(primero.ok, true);
  assert.equal(primero.nonceGuard, 'kv');
  const segundo = await verificarPase(mismo, opciones({nonces}));
  assert.deepEqual([segundo.ok, segundo.status, segundo.code], [false, 401, 'nonce_repetido']);
});

test('verificarPase: malformado, sin nonce, versión rara o sin secreto', async () => {
  for (const malo of ['', 'x', 'x.y', 'a.b.c', '.abc', 'abc.', `${b64url('[1]')}.zzz`, 12]) {
    const verdict = await verificarPase(malo, opciones());
    assert.equal(verdict.status, 400, `esperaba 400 para ${JSON.stringify(malo)}`);
  }
  assert.equal((await verificarPase(pase({nonce:'corto'}), opciones())).code, 'nonce');
  assert.equal((await verificarPase(pase({v:2}), opciones())).code, 'version');
  assert.equal((await verificarPase(pase(), opciones({secret:''}))).status, 503);
});

test('POST /presentaciones/api/sso: pase válido → 200, correo enmascarado y las cookies del login del Generador', async () => {
  const environment = env();
  const response = await post({pase:pase()}, environment);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.email_masked, 'cs…va@admira.com');
  assert.equal(payload.nivel, 'owner');
  assert.equal(payload.nonce_guard, 'kv');
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(value => value.startsWith('pres_owner=') && value.includes('Path=/presentaciones') && value.includes('HttpOnly')));
  assert.ok(cookies.some(value => value.startsWith('pres_identity=')));
  assert.ok([...environment.PRESENTATION_IDEAS.store.keys()].some(key => key.startsWith('sso:nonce:')), 'el nonce queda quemado en KV');
  assert.ok([...environment.PRESENTATION_IDEAS.store.keys()].some(key => key.startsWith('access:event:')), 'el alta queda en el registro de accesos');
  const registro = [...environment.PRESENTATION_IDEAS.store.values()].join('\n');
  assert.doesNotMatch(registro, /admira\.tv\.[A-Za-z0-9_-]{20}/, 'el pase nunca se escribe en el registro');

  // La sesión abre ad-idea y grok-video en el middleware sin volver a preguntar.
  const context = (url, options = {}) => ({request:new Request(url, options), env:environment, next:async () => new Response('ok'), waitUntil(){}});
  for (const path of ['/presentaciones/api/ad-idea', '/presentaciones/api/grok-video']) {
    const api = await middleware(context(`https://www.admiranext.com${path}`, {method:'POST', headers:{Cookie:cookieHeader(response), 'content-type':'application/json'}, body:'{}'}));
    assert.equal(api.status, 200, `${path} debe abrirse con la sesión del pase`);
    assert.equal(await api.text(), 'ok');
  }
  // …pero sigue sin abrir el área de control, como cualquier propietario.
  const control = await middleware(context('https://www.admiranext.com/presentaciones/control/', {headers:{Cookie:cookieHeader(response), Accept:'text/html'}}));
  assert.equal(control.status, 401);
});

test('POST /presentaciones/api/sso: errores con su código y sin cookies', async () => {
  const casos = [
    [{pase:'x.y'}, 400],
    [{pase:'sin-punto'}, 400],
    [{pase:pase({aud:'otro'})}, 401],
    [{pase:pase({email:'otro@admira.com'})}, 403],
    [{pase:pase({iat:NOW - 1000, exp:NOW - 900})}, 401],
    [{}, 400]
  ];
  for (const [body, status] of casos) {
    const response = await post(body);
    assert.equal(response.status, status, `esperaba ${status} para ${JSON.stringify(body).slice(0, 40)}`);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const mismo = pase();
  const environment = env();
  assert.equal((await post({pase:mismo}, environment)).status, 200);
  assert.equal((await post({pase:mismo}, environment)).status, 401, 'nonce repetido');
  assert.equal((await post({pase:pase()}, env({ADMIRA_SSO_EMAILS:''}))).status, 403);
  assert.equal((await post({pase:pase()}, env({ADMIRA_SSO_SECRET:''}))).status, 503);
});

test('POST /presentaciones/api/sso: correo con pase pero sin alta en el directorio → 403 sin_alta', async () => {
  const response = await post({pase:pase({email:'nuevo@admira.com'})}, env({ADMIRA_SSO_EMAILS:'nuevo@admira.com'}));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'sin_alta');
});

test('POST /presentaciones/api/sso: método, origen y tipo de contenido', async () => {
  const get = await sso({request:new Request('https://www.admiranext.com/presentaciones/api/sso'), env:env(), waitUntil(){}});
  assert.equal(get.status, 405);
  assert.equal((await post({pase:pase()}, env(), {origin:'https://evil.example'})).status, 403);
  assert.equal((await post({pase:pase()}, env(), {'content-type':'text/plain'})).status, 415);
  assert.equal((await post('{no json', env())).status, 400);
});

test('el middleware deja pasar /presentaciones/api/sso sin sesión previa (lo demás sigue cerrado)', async () => {
  const environment = env();
  const context = (url, options = {}) => ({request:new Request(url, options), env:environment, next:async () => new Response('ok'), waitUntil(){}});
  const abierto = await middleware(context('https://www.admiranext.com/presentaciones/api/sso', {method:'POST', headers:{'content-type':'application/json'}, body:'{}'}));
  assert.equal(abierto.status, 200);
  assert.equal(await abierto.text(), 'ok');
  const cerrado = await middleware(context('https://www.admiranext.com/presentaciones/api/ad-idea', {method:'POST', headers:{'content-type':'application/json'}, body:'{}'}));
  assert.equal(cerrado.status, 401);
});

test('utilidades: lista de correos y máscara', () => {
  assert.deepEqual([...correosConPase({ADMIRA_SSO_EMAILS:' A@x.com, b@y.com ;c@z.com '})], ['a@x.com', 'b@y.com', 'c@z.com']);
  assert.equal(enmascararCorreo('csilvasantin@gmail.com'), 'cs…in@gmail.com');
  assert.equal(enmascararCorreo('ana@x.com'), 'a…@x.com');
  assert.equal(enmascararCorreo('sin-arroba'), '');
});

test('tiktok/app.js canjea ?pase= al cargar, lo retira de la URL y conserva producto/brief', () => {
  const source = readFileSync(new URL('../tiktok/app.js', import.meta.url), 'utf8');
  assert.match(source, /fetch\('\/presentaciones\/api\/sso'/);
  assert.match(source, /searchParams\.delete\('pase'\)/);
  assert.match(source, /history\.replaceState\(/);
  assert.match(source, /Sesión abierta desde admira\.tv/);
  assert.match(source, /void abrirSesionConPase\(\);/);
  assert.match(source, /link\.href = '\/presentaciones\/'/, 'si falla, enlace al login vivo del Generador');
  assert.doesNotMatch(source, /searchParams\.delete\('producto'\)/);
  assert.doesNotMatch(source, /searchParams\.delete\('brief'\)/);
});
