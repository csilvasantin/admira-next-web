// FLT-100766 (Morfeo, 21-sep-2026) · lo que el middleware de /presentaciones le cuenta
// a quien viene detrás.
//
// a) Una API no contesta con un formulario: un fetch() a /api/ sin sesión recibía la
//    página de login (HTML) con su 401 y el operador veía un «HTTP 401» seco. Mismo 401,
//    ahora en JSON y con el motivo; una navegación sigue recibiendo el login.
// b) La sala sabe quién mira: el middleware deja en context.data si la sesión puede
//    llamar a la API del generador, y la sala sólo genera láminas con ese permiso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest as middleware} from '../functions/presentaciones/_middleware.js';

function kv(){
  const store = new Map();
  return {
    async get(key){ return store.has(key) ? store.get(key) : null; },
    async put(key, value){ store.set(key, value); },
    async list(){ return {keys:[], list_complete:true}; }
  };
}
const environment = {PRES_SIGNING_KEY:'sala-test-sign-key', PRES_GENERIC:'1234', PRES_ADMIN:'maestra', PRESENTATION_IDEAS:kv()};
const cookieHeader = response => response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');

// Devuelve la respuesta y el context.data con el que el middleware llamó a next().
async function pasa(url, init = {}){
  const data = {};
  let visto = null;
  const response = await middleware({request:new Request(url, init), env:environment, data, waitUntil(){}, next:async () => { visto = {...data}; return new Response('ok'); }});
  return {response, visto};
}

async function entra(password){
  const form = new URLSearchParams({name:'Ana Prueba', email:'ana@example.com', password});
  const {response} = await pasa('https://www.admiranext.com/presentaciones/demo/presentacion', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:form});
  assert.equal(response.status, 303, 'el login con la contraseña correcta redirige');
  return cookieHeader(response);
}

test('a) una API sin sesión responde 401 en JSON, con el motivo', async () => {
  const {response} = await pasa('https://www.admiranext.com/presentaciones/api/images', {method:'POST', headers:{'content-type':'application/json', accept:'application/json'}, body:'{}'});
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.match(body.error, /sesión ha caducado/);
});

test('a) un fetch() sin Accept explícito a una API también recibe JSON', async () => {
  const {response} = await pasa('https://www.admiranext.com/presentaciones/api/generate', {method:'PUT', headers:{'content-type':'application/json'}, body:'{}'});
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type'), /application\/json/);
});

test('a) una navegación sin sesión sigue recibiendo la página de login', async () => {
  const {response} = await pasa('https://www.admiranext.com/presentaciones/demo/presentacion', {headers:{accept:'text/html'}});
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type'), /text\/html/);
});

test('b) el invitado con la contraseña de la sala NO puede generar', async () => {
  const cookie = await entra('1234');
  const {response, visto} = await pasa('https://www.admiranext.com/presentaciones/demo/presentacion', {headers:{accept:'text/html', cookie}});
  assert.equal(response.status, 200);
  assert.deepEqual(visto.presentationAccess, {level:'client', canGenerate:false});
});

test('b) quien entra con la maestra SÍ puede generar', async () => {
  const cookie = await entra('maestra');
  const {response, visto} = await pasa('https://www.admiranext.com/presentaciones/demo/presentacion', {headers:{accept:'text/html', cookie}});
  assert.equal(response.status, 200);
  assert.deepEqual(visto.presentationAccess, {level:'master', canGenerate:true});
});
