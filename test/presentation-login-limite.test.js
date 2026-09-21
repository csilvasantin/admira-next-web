// FLT-100778 a (Morfeo, 21-sep-2026) · el login deja de admitir intentos sin fin.
//
// Las tres puertas que aceptan contraseña (/presentaciones, /presentations y /presites)
// comparaban sin límite contra la maestra, la de editor, la genérica y las de cliente.
// El contador es por IP y COMÚN a las tres: la maestra vale en cualquier slug y en
// cualquier puerta, así que un contador por slug o por puerta se esquivaba cambiando.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as presentaciones} from '../functions/presentaciones/_middleware.js';
import {onRequest as presentations} from '../functions/presentations/_middleware.js';
import {onRequest as presites} from '../functions/presites/_middleware.js';
import {LOGIN_FAIL_LIMIT, LOGIN_WINDOW_SEC, LOGIN_LOCKOUT_SEC, loginLockout, noteLoginAttempt} from '../functions/presentaciones/_login-rate.js';

// `rota`: las claves del limitador fallan (KV saturado o caído para ellas); el resto no,
// porque la puerta ya dependía del KV para las presentaciones generadas antes de este cambio.
function kv({rota = false} = {}){
  const store = new Map();
  const falla = key => { if (rota && String(key).startsWith('access:login-rate:')) throw new Error('KV caído'); };
  return {
    store,
    async get(key, options){ falla(key); const v = store.get(key); return v == null ? null : options?.type === 'json' ? JSON.parse(v) : v; },
    async put(key, value){ falla(key); store.set(key, value); },
    async delete(key){ falla(key); store.delete(key); },
    async list(){ return {keys:[], list_complete:true}; }
  };
}
const entorno = (extra = {}) => ({PRES_SIGNING_KEY:'limite-test-key', PRES_GENERIC:'1234', PRES_ADMIN:'maestra-larga', PRESENTATION_IDEAS:kv(), ...extra});

const PUERTAS = {
  presentaciones:{fn:presentaciones, url:'https://www.admiranext.com/presentaciones/demo/presentacion'},
  presentations:{fn:presentations, url:'https://www.admiranext.com/presentations/lacaixa'},
  presites:{fn:presites, url:'https://www.admiranext.com/presites/'}
};

async function intenta(env, puerta, password, ip = '203.0.113.7'){
  const {fn, url} = PUERTAS[puerta];
  const body = new URLSearchParams({name:'Ana Prueba', email:'ana@example.com', password});
  const request = new Request(url, {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded', 'CF-Connecting-IP':ip}, body});
  const pendientes = [];
  const response = await fn({request, env, data:{}, waitUntil(p){ pendientes.push(p); }, next:async () => new Response('ok')});
  await Promise.all(pendientes);
  return response;
}

test(`tras ${LOGIN_FAIL_LIMIT} fallos, ni la contraseña buena entra: 429 con el motivo`, async () => {
  const env = entorno();
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) assert.equal((await intenta(env, 'presentaciones', `mala-${i}`)).status, 401);
  const bloqueada = await intenta(env, 'presentaciones', 'maestra-larga');
  assert.equal(bloqueada.status, 429);
  assert.match(await bloqueada.text(), /Demasiados intentos fallidos desde tu conexión/);
});

test('el bloqueo es de ESA IP: desde otra conexión se entra con normalidad', async () => {
  const env = entorno();
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) await intenta(env, 'presentaciones', 'mala');
  assert.equal((await intenta(env, 'presentaciones', '1234', '198.51.100.20')).status, 303);
});

test('el contador es común a las tres puertas: cambiar de puerta no reinicia la cuenta', async () => {
  const env = entorno();
  const puertas = ['presites', 'presentations', 'presentaciones'];
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) assert.equal((await intenta(env, puertas[i % 3], 'mala')).status, 401);
  assert.equal((await intenta(env, 'presentaciones', 'maestra-larga')).status, 429);
  const en = await intenta(env, 'presentations', 'maestra-larga');
  assert.equal(en.status, 429);
  assert.match(await en.text(), /Too many failed attempts from your connection/);
  assert.equal((await intenta(env, 'presites', 'maestra-larga')).status, 429);
});

test('cambiar de slug tampoco reinicia la cuenta (la maestra vale en cualquiera)', async () => {
  const env = entorno();
  const {fn} = PUERTAS.presentaciones;
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) {
    const body = new URLSearchParams({name:'Ana Prueba', email:'ana@example.com', password:'mala'});
    const request = new Request(`https://www.admiranext.com/presentaciones/slug-${i}/presentacion`, {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded', 'CF-Connecting-IP':'203.0.113.7'}, body});
    await fn({request, env, data:{}, waitUntil(){}, next:async () => new Response('ok')});
  }
  assert.equal((await intenta(env, 'presentaciones', 'maestra-larga')).status, 429);
});

test('un acierto borra el historial: quien se equivoca unas veces no acumula', async () => {
  const env = entorno();
  for (let i = 0; i < LOGIN_FAIL_LIMIT - 1; i++) await intenta(env, 'presentaciones', 'mala');
  assert.equal((await intenta(env, 'presentaciones', '1234')).status, 303);
  for (let i = 0; i < LOGIN_FAIL_LIMIT - 1; i++) assert.equal((await intenta(env, 'presentaciones', 'mala')).status, 401);
  assert.equal((await intenta(env, 'presentaciones', '1234')).status, 303);
});

test('si el KV del limitador falla, el login sigue funcionando (el freno nunca tumba la puerta)', async () => {
  const env = entorno({PRESENTATION_IDEAS:kv({rota:true})});
  assert.equal((await intenta(env, 'presentaciones', 'mala')).status, 401);
  assert.equal((await intenta(env, 'presentaciones', '1234')).status, 303);
  assert.equal((await intenta(env, 'presites', 'maestra-larga')).status, 303);
});

test('la ventana y el bloqueo caducan', async () => {
  const env = entorno();
  const request = new Request('https://x/', {headers:{'CF-Connecting-IP':'203.0.113.9'}});
  const t0 = Date.parse('2026-09-21T18:00:00Z');
  // Fallos espaciados más que la ventana no se suman.
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) await noteLoginAttempt(env, request, false, t0 + i * (LOGIN_WINDOW_SEC + 1) * 1000);
  assert.equal(await loginLockout(env, request, t0 + LOGIN_FAIL_LIMIT * (LOGIN_WINDOW_SEC + 1) * 1000), 0);
  // Seguidos, bloquean… y el bloqueo se acaba a su hora.
  const t1 = t0 + 10 * 24 * 3600 * 1000;
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) await noteLoginAttempt(env, request, false, t1 + i * 1000);
  const fin = t1 + (LOGIN_FAIL_LIMIT - 1) * 1000 + LOGIN_LOCKOUT_SEC * 1000;
  assert.ok(await loginLockout(env, request, fin - 1000) > 0);
  assert.equal(await loginLockout(env, request, fin + 1000), 0);
});

test('sin CF-Connecting-IP (fuera de Cloudflare) no se agrupa a todos bajo una clave', async () => {
  const env = entorno();
  const request = new Request('https://x/');
  for (let i = 0; i < LOGIN_FAIL_LIMIT + 2; i++) await noteLoginAttempt(env, request, false);
  assert.equal(await loginLockout(env, request), 0);
  assert.equal(env.PRESENTATION_IDEAS.store.size, 0);
});
