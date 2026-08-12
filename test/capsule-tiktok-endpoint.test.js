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

function conMotor(respuesta) {
  const llamadas = [];
  globalThis.fetch = async (url, init) => {
    llamadas.push({url: String(url), body: JSON.parse(init.body)});
    return new Response(JSON.stringify(respuesta.cuerpo), {status: respuesta.status || 200,
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

test('solo POST', async () => {
  const res = await onRequest({request: peticion(CAPSULA, {metodo: 'GET'}), env: {PIXERIA_INGEST_TOKEN: SECRETO}});
  assert.equal(res.status, 405);
});

test('una cápsula con texto llega al motor con su brief de 15 s', async () => {
  const llamadas = conMotor({cuerpo: {requestId: 'req-1234567890abcdef'}});
  const res = await onRequest({request: peticion(CAPSULA), env: {PIXERIA_INGEST_TOKEN: SECRETO}});
  const d = await res.json();
  assert.equal(res.status, 200);
  assert.equal(d.generado, true);
  assert.equal(d.requestId, 'req-1234567890abcdef');
  assert.equal(d.tema, 'tech');
  assert.equal(llamadas.length, 1, 'se llama al motor UNA vez');
  assert.match(llamadas[0].url, /\/presentaciones\/api\/grok-video$/);
  assert.match(llamadas[0].body.prompt, /15 segundos/);
  assert.match(llamadas[0].body.prompt, /9:16/);
  assert.ok(d.estado.includes('grok-video?id='), 'se dice dónde sondear el estado');
});

test('una cápsula sin texto NO es un error: se contesta 200 y no se llama al motor', async () => {
  const llamadas = conMotor({cuerpo: {requestId: 'no-deberia-usarse'}});
  const res = await onRequest({request: peticion({title: 'Vacía', tags: ['tech'], comment: ''}),
                               env: {PIXERIA_INGEST_TOKEN: SECRETO}});
  const d = await res.json();
  assert.equal(res.status, 200, 'un 4xx haría que quien llama lo reintentara en bucle');
  assert.equal(d.generado, false);
  assert.ok(d.motivo);
  assert.equal(llamadas.length, 0, 'no se gasta una generación en 15 s de relleno');
});

test('si el motor falla se dice, y con 502 para que se pueda reintentar', async () => {
  conMotor({status: 500, cuerpo: {error: 'Grok caído'}});
  const res = await onRequest({request: peticion(CAPSULA), env: {PIXERIA_INGEST_TOKEN: SECRETO}});
  assert.equal(res.status, 502);
});
