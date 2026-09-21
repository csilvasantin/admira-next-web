// FLT-100778 b (Morfeo, 21-sep-2026) · el modo antifallo de la sala no sobrevive a la sesión.
//
// El service worker guarda el deck para que la presentación aguante si se cae la red
// (717df1b), pero la copia no tenía fin: el HTML privado quedaba en el dispositivo, se
// servía sin red aunque la sesión ya no existiera y el worker vigilaba todo el sitio.
// Aquí se EJECUTA el worker contra una caché, un fetch y un registro simulados.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const fuente = await readFile(new URL('../presentation-presenter-sw.js', import.meta.url), 'utf8');
const ORIGEN = 'https://www.admiranext.com';
const DECK = `${ORIGEN}/presentaciones/demo/presentacion`;
const DOCE_HORAS = 12 * 60 * 60 * 1000;

function cacheStorage(){
  const caches = new Map();
  const key = r => typeof r === 'string' ? r : r.url;
  const abrir = name => {
    if (!caches.has(name)) caches.set(name, new Map());
    const store = caches.get(name);
    return {
      store,
      async put(request, response){ store.set(key(request), response); },
      async match(request){ const hit = store.get(key(request)); return hit ? hit.clone() : undefined; },
      async delete(request){ return store.delete(key(request)); }
    };
  };
  return {
    caches,
    async open(name){ return abrir(name); },
    async keys(){ return [...caches.keys()]; },
    async delete(name){ return caches.delete(name); },
    async match(request){ for (const name of caches.keys()) { const hit = await abrir(name).match(request); if (hit) return hit; } return undefined; }
  };
}

// Monta el worker con un fetch programable y devuelve cómo lanzarle eventos.
function montar({scope = `${ORIGEN}/presentaciones/`, ahora = () => Date.now()} = {}){
  const listeners = {};
  const caches = cacheStorage();
  const estado = {red:null, unregistered:false, claimed:false};
  const self = {
    location:new URL(`${ORIGEN}/presentation-presenter-sw.js`),
    registration:{scope, async unregister(){ estado.unregistered = true; return true; }},
    clients:{async claim(){ estado.claimed = true; }},
    addEventListener(type, fn){ listeners[type] = fn; },
    async skipWaiting(){}
  };
  const fetch = async (request) => {
    if (!estado.red) throw new TypeError('Failed to fetch');
    return estado.red(typeof request === 'string' ? request : request.url);
  };
  const DateFalso = {now:ahora};
  new Function('self', 'caches', 'fetch', 'Date', fuente)(self, caches, fetch, DateFalso);
  async function evento(type, extra){
    let promesa = null;
    const event = {...extra, respondWith(p){ promesa = p; }, waitUntil(p){ promesa = p; }};
    listeners[type](event);
    return promesa && await promesa;
  }
  const navega = url => evento('fetch', {request:{url, method:'GET', mode:'navigate', destination:'document', headers:new Headers()}});
  const recurso = url => evento('fetch', {request:{url, method:'GET', mode:'no-cors', destination:'image', headers:new Headers()}});
  return {estado, caches, evento, navega, recurso};
}
const html = (status = 200, headers = {}) => () => new Response('<html>deck privado</html>', {status, headers:{'content-type':'text/html', 'cache-control':'no-store', ...headers}});

test('con red, el deck se guarda para el modo antifallo… con su hora', async () => {
  const sw = montar();
  sw.estado.red = html();
  const respuesta = await sw.navega(DECK);
  assert.equal(respuesta.status, 200);
  const guardada = await sw.caches.match(DECK);
  assert.ok(guardada, 'la copia offline existe aunque el servidor diga no-store');
  assert.ok(Number(guardada.headers.get('x-admira-cached-at')) > 0);
});

test('sin red y dentro del plazo, la sala sigue funcionando con la copia', async () => {
  const sw = montar();
  sw.estado.red = html();
  await sw.navega(DECK);
  sw.estado.red = null;
  const respuesta = await sw.navega(DECK);
  assert.equal(respuesta.status, 200);
  assert.match(await respuesta.text(), /deck privado/);
});

test('sin red y pasado el plazo, la copia se borra y no se enseña', async () => {
  let reloj = Date.parse('2026-09-21T09:00:00Z');
  const sw = montar({ahora:() => reloj});
  sw.estado.red = html();
  await sw.navega(DECK);
  sw.estado.red = null;
  reloj += DOCE_HORAS + 60 * 1000;
  const respuesta = await sw.navega(DECK);
  assert.equal(respuesta.status, 503);
  assert.match(await respuesta.text(), /ha caducado o no existe/);
  assert.equal(await sw.caches.match(DECK), undefined, 'la copia caducada ya no está en el dispositivo');
});

test('si el servidor dice 401 (sesión caducada o de otro), se borra todo lo guardado', async () => {
  const sw = montar();
  sw.estado.red = html();
  await sw.navega(DECK);
  await sw.navega(`${ORIGEN}/presentaciones/otra/presentacion`);
  sw.estado.red = html(401);
  assert.equal((await sw.navega(DECK)).status, 401, 'con red se ve el login, como siempre');
  sw.estado.red = null;
  assert.equal((await sw.navega(DECK)).status, 503, 'y ya no queda copia que servir sin red');
  assert.equal((await sw.navega(`${ORIGEN}/presentaciones/otra/presentacion`)).status, 503);
});

test('fuera del deck se respeta no-store; lo demás se guarda como antes', async () => {
  const sw = montar();
  const imagen = `${ORIGEN}/presentaciones/demo/images/slide-01.jpg`;
  const privada = `${ORIGEN}/assets/algo-privado.png`;
  await sw.evento('message', {data:{type:'ADMIRA_PRESENTATION_PRECACHE', requestId:'r1', urls:[imagen, privada]}, ports:[]});
  // Sin red en el precache no se guarda nada: lo lanzamos con red.
  sw.estado.red = url => new Response('x', {status:200, headers:{'content-type':'image/png', 'cache-control':url === privada ? 'no-store' : 'private, max-age=3600'}});
  await sw.evento('message', {data:{type:'ADMIRA_PRESENTATION_PRECACHE', requestId:'r2', urls:[imagen, privada]}, ports:[]});
  assert.ok(await sw.caches.match(imagen));
  assert.equal(await sw.caches.match(privada), undefined);
});

test('el registro viejo sobre «/» se da de baja solo; el de /presentaciones/ toma el control', async () => {
  const viejo = montar({scope:`${ORIGEN}/`});
  await viejo.evento('activate', {});
  assert.equal(viejo.estado.unregistered, true);
  assert.equal(viejo.estado.claimed, false);
  const nuevo = montar();
  await nuevo.evento('activate', {});
  assert.equal(nuevo.estado.unregistered, false);
  assert.equal(nuevo.estado.claimed, true);
});

test('activar la v3 purga las copias sin hora de versiones anteriores', async () => {
  const sw = montar();
  const antigua = await sw.caches.open('admira-presenter-offline-v2');
  await antigua.put(DECK, new Response('deck sin hora'));
  await sw.evento('activate', {});
  assert.deepEqual(await sw.caches.keys(), []);
});

test('el cliente registra con alcance /presentaciones/ y da de baja el registro sobre «/»', async () => {
  const cliente = await readFile(new URL('../assets/presentation-presenter-mode.js', import.meta.url), 'utf8');
  assert.match(cliente, /register\('\/presentation-presenter-sw\.js', \{scope: '\/presentaciones\/'\}\)/);
  assert.doesNotMatch(cliente, /\{scope: '\/'\}/);
  assert.match(cliente, /item\.scope === location\.origin \+ '\/'[\s\S]*?item\.unregister\(\)/);
});
