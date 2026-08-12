/* La puerta cápsula → TikTok. Se prueba con un motor de mentira: lo que importa
 * aquí es quién puede llamar, qué se le manda al motor y qué se contesta cuando
 * la cápsula no da para vídeo. */
const test = require('node:test');
const assert = require('node:assert/strict');

let onRequest;
test.before(async () => {
  ({ onRequest } = await import('../functions/presentaciones/api/capsule-tiktok.js'));
});

const SECRETO = 'secreto-de-ingesta';
const CAPSULA = {
  type: 'capsula',
  title: 'La privacidad es una decisión de producto',
  tags: ['tech'],
  comment: 'Los líderes de tecnología deben respaldar leyes de protección de datos. ' +
    'Eso exige tratarla como una decisión de producto y no como un trámite legal.'
};

function peticion(cuerpo, {secreto = SECRETO, metodo = 'POST'} = {}) {
  const body = JSON.stringify(cuerpo);
  return new Request('https://www.admiranext.com/presentaciones/api/capsule-tiktok', {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'content-length': String(body.length),
      ...(secreto ? {'x-admiranext-ingest': secreto} : {})
    },
    body: metodo === 'POST' ? body : undefined
  });
}

// El motor se invoca EN PROCESO: una Function no puede hacer fetch a su propio
// host (el borde devuelve 502). Así que el doble NO se pone donde antes —no hay
// llamada de red a grok-video que interceptar—, sino un salto más adentro: en la
// salida a xAI, que es la única red que queda de verdad. Lo que se comprueba es
// que el brief de 15 s llega hasta el final de la cadena.
const ENV = {PIXERIA_INGEST_TOKEN: SECRETO, XAI_API_KEY: 'clave-de-mentira'};

function conMotor({requestId = 'req-1234567890abcdef', status = 200} = {}) {
  const llamadas = [];
  globalThis.fetch = async (url, init) => {
    llamadas.push({url: String(url), body: init && init.body ? JSON.parse(init.body) : null});
    return new Response(JSON.stringify({request_id: requestId}), {status,
      headers: {'content-type': 'application/json'}});
  };
  return llamadas;
}

test('sin el secreto de ingesta no entra nadie', async () => {
  const res = await onRequest({request: peticion(CAPSULA, {secreto: ''}), env: {PIXERIA_INGEST_TOKEN: SECRETO}});
  assert.equal(res.status, 401);
});

test('sin configurar, lo dice en vez de fallar raro', async () => {
  const res = await onRequest({request: peticion(CAPSULA), env: {}});
  assert.equal(res.status, 503);
});

test('POST encarga y GET pregunta: lo demás no', async () => {
  for (const metodo of ['PUT', 'DELETE']) {
    const res = await onRequest({request: peticion(CAPSULA, {metodo}), env: ENV});
    assert.equal(res.status, 405, `${metodo} no tiene nada que hacer aquí`);
  }
  // GET SÍ vale: es por donde se sonda el estado, y sondear es lo que dispara la
  // publicación en Pixeria. Sin id no se puede preguntar por nada, y eso es un
  // 400 (petición mal hecha), no un 405 (método prohibido).
  const sinId = await onRequest({request: peticion(CAPSULA, {metodo: 'GET'}), env: ENV});
  assert.equal(sinId.status, 400);
});

test('una cápsula con texto llega al motor con su brief de 15 s', async () => {
  const llamadas = conMotor();
  const res = await onRequest({request: peticion(CAPSULA), env: ENV});
  const d = await res.json();
  assert.equal(res.status, 200);
  assert.equal(d.generado, true);
  assert.equal(d.requestId, 'req-1234567890abcdef');
  assert.equal(d.tema, 'tech');
  assert.equal(llamadas.length, 1, 'se encarga el vídeo UNA vez');
  // La única red que queda es la de xAI: el motor ya no se llama por HTTP.
  assert.match(llamadas[0].url, /^https:\/\/api\.x\.ai\//);
  assert.match(llamadas[0].body.prompt, /15 segundos/);
  assert.equal(llamadas[0].body.duration, 15);
  assert.equal(llamadas[0].body.aspect_ratio, '9:16', 'vertical nativo, no recortado');
  assert.ok(d.estado.includes('grok-video?id='), 'se dice dónde sondear el estado');
});

test('una cápsula sin texto NO es un error: se contesta 200 y no se llama al motor', async () => {
  const llamadas = conMotor();
  const res = await onRequest({request: peticion({title: 'Vacía', tags: ['tech'], comment: ''}), env: ENV});
  const d = await res.json();
  assert.equal(res.status, 200, 'un 4xx haría que quien llama lo reintentara en bucle');
  assert.equal(d.generado, false);
  assert.ok(d.motivo);
  assert.equal(llamadas.length, 0, 'no se gasta una generación en 15 s de relleno');
});

test('si el motor falla se dice, y con 502 para que se pueda reintentar', async () => {
  // Con la clave puesta: así el 502 sale de que xAI se cayó, que es lo que se
  // quiere probar, y no de que faltara configuración.
  conMotor({status: 500});
  const res = await onRequest({request: peticion(CAPSULA), env: ENV});
  assert.equal(res.status, 502);
});
