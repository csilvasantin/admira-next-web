// Relé central /api/avatar-ask: solo orígenes de la red, sin secretos, ficha de respaldo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest} from '../functions/api/avatar-ask.js';

const req = (origin, method = 'POST', body = {question: '¿Qué es pixeria?', lang: 'es'}) => ({request: new Request('https://www.admiranext.com/api/avatar-ask', {
  method, headers: origin ? {Origin: origin, 'content-type': 'application/json'} : {}, body: method === 'POST' ? JSON.stringify(body) : undefined})});

test('solo responde a orígenes de la red', async () => {
  const ok = async () => new Response(JSON.stringify({text: 'Pixeria (pixeria.com) es el estudio.'}));
  assert.equal((await onRequest(req('https://evil.example'), ok)).status, 403);
  assert.equal((await onRequest(req(null), ok)).status, 403);
  const r = await onRequest(req('https://www.xpaceos.com'), ok);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://www.xpaceos.com');
  assert.match((await r.json()).text, /pixeria/i);
  assert.equal((await onRequest(req('https://www.pixeria.com', 'OPTIONS'))).status, 204);
});

test('si el cerebro falla responde con la ficha', async () => {
  const down = async () => { throw new Error('caído'); };
  const r = await onRequest(req('https://www.admiranext.com', 'POST', {question: 'yokup', lang: 'es'}), down);
  assert.match((await r.json()).text, /Yokup/);
});

test('no lleva claves ni reenvía audio', () => {
  const src = readFileSync(new URL('../functions/api/avatar-ask.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /XAI_API_KEY|env\.[A-Z_]*KEY|audioBase64/);
});

test('la pregunta viaja entera en question y la ficha en context (sin audio)', async () => {
  let sent = null;
  const spy = async (url, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({answer: 'Yokup (yokup.com) es la bandeja.'})); };
  await onRequest(req('https://www.admiranext.com', 'POST', {question: '¿Qué es yokup?', lang: 'es'}), spy);
  assert.equal(sent.question, '¿Qué es yokup?');
  assert.match(sent.context, /Yokup \(yokup\.com\)/);
  assert.ok(sent.context.length <= 2000);
  assert.equal(sent.strict, true);
  assert.equal(sent.voice, false);
});
