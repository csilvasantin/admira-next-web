// Cargador compartido del avatar (assets/avatar.js): piezas puras y precedencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../assets/avatar.js', import.meta.url), 'utf8');
function load() {
  const module = {exports: {}};
  vm.runInNewContext(src, {module, globalThis: {}, window: undefined});
  return module.exports;
}
const A = load();
const R = (o, f) => JSON.parse(JSON.stringify(A.resolve(o, f)));

test('verbos nuevos y alias antiguos', () => {
  assert.equal(A.decide('/avatarON'), 'on');
  assert.equal(A.decide('/avatarOFF'), 'off');
  assert.equal(A.decide('/avatar'), 'status');
  assert.equal(A.decide('/avatar good'), 'good');
  assert.equal(A.decide('/avatar better'), 'better');
  assert.equal(A.decide('/avatar best'), 'best');
  assert.equal(A.decide('avatar on'), 'on');
  assert.equal(A.decide('/avatar ocultar'), 'off');
  assert.equal(A.decide('/avatar reset'), 'reset');
  assert.equal(A.decide('/avatar xyz'), 'bad');
  assert.equal(A.decide('/avatarDigital'), 'status');
  assert.equal(A.decide('/digitalAvatar off'), 'off');
  assert.equal(A.decide('/cli ayudante on'), 'on');
  assert.equal(A.decide('/cli helper'), 'toggle');
  assert.equal(A.decide('/cli demo'), null);
  assert.equal(A.decide('/help'), null);
  assert.equal(A.decide('/avatares'), null);
});

test('good es el calvo, better la chica y best Neo', () => {
  assert.equal(A.LEVELS.good, 'https://digitalavatar.ai/better.html?dock=1');
  assert.equal(A.LEVELS.better, 'https://digitalavatar.ai/best.html?dock=1&kiosk=0');
  assert.equal(A.LEVELS.best, 'https://digitalavatar.ai/metahuman.html?dock=1');
  assert.match(A.message('status', false), /good/);
  assert.match(A.message('status', false), /better/);
  assert.match(A.message('status', false), /best/);
  assert.match(A.message('best', false), /chica/);
});

test('precedencia: elección del usuario > interruptor del proyecto > apagado', () => {
  assert.deepEqual(R('on', false), {on: true, source: 'usuario'});
  assert.deepEqual(R('off', true), {on: false, source: 'usuario'});
  assert.deepEqual(R(null, true), {on: true, source: 'proyecto'});
  assert.deepEqual(R(null, false), {on: false, source: 'proyecto'});
  assert.deepEqual(R(null, null), {on: false, source: 'defecto'});
});

test('migra el interruptor por sitio de FLT-101350', () => {
  assert.equal(A.legacyValue('1'), 'on');
  assert.equal(A.legacyValue('0'), 'off');
  assert.equal(A.legacyValue(null), null);
});

test('un solo panel y las tres caras viven en digitalavatar.ai', () => {
  assert.equal(Object.keys(A.LEVELS).length, 3);
  assert.equal((src.match(/da-suite/g) || []).length > 0, true);
  assert.match(src, /#da-suite-panel\{display:none\}#da-suite\.open #da-suite-bubble\{display:none\}#da-suite\.open #da-suite-panel\{display:flex\}/);
  assert.doesNotMatch(src, /id="da-suite-panel" style="display:none/);
  assert.equal((src.match(/digitalavatar\.ai\/embed\.js/g) || []).length, 0);
  assert.equal(A.CENTRAL_BRAIN, 'https://www.admiranext.com/api/avatar-ask');
  assert.equal(A.FLAGS_URL, 'https://www.admiranext.com/api/avatar/flags');
});

test('el encendido automático no guarda la elección del usuario', () => {
  const boot = src.slice(src.indexOf('function boot()'));
  const body = boot.slice(0, boot.indexOf('\n  }\n'));
  assert.doesNotMatch(body, /set\(KEY/);
  assert.match(body, /show\(false\)/); // burbuja cerrada
});

const plain = (v) => JSON.parse(JSON.stringify(v));

test('best no espera a metahuman.html: con el stream apagado abre a la chica en dock', () => {
  // digitalavatar.ai 1f5d1be: ?dock=1 deja cara y consola. metahuman.html no
  // cambia de página si el vídeo no llega: se queda en negro con «EN VIVO».
  assert.equal(A.NEO_PROBE_MS, 4000);
  assert.ok(A.NEO_PROBE_MS < 5000);
  assert.equal(A.NEO_WS, 'wss://macbook-pro-16.tail48b61c.ts.net:8443/');
  assert.equal(A.neoVerdict({transportError: true}), 'girl');
  assert.equal(A.neoVerdict({ids: []}), 'girl');
  assert.equal(A.neoVerdict({ids: ['DefaultStreamer'], ice: 'failed'}), 'girl');
  assert.equal(A.neoVerdict({ids: ['DefaultStreamer'], ice: 'checking', elapsed: 1000, timeout: 4000}), 'wait');
  assert.equal(A.neoVerdict({ids: ['DefaultStreamer'], ice: 'checking', elapsed: 4000, timeout: 4000}), 'girl');
  assert.equal(A.neoVerdict({ids: ['DefaultStreamer'], ice: 'connected'}), 'neo');
  assert.equal(A.neoVerdict({ids: ['DefaultStreamer'], conn: 'connected'}), 'neo');

  const girl = plain(A.faceChoice('best', false));
  assert.equal(girl.fallback, true);
  assert.equal(girl.label, 'best');
  assert.equal(girl.url, A.LEVELS.better);
  assert.equal(girl.url, 'https://digitalavatar.ai/best.html?dock=1&kiosk=0');
  const neo = plain(A.faceChoice('best', true));
  assert.equal(neo.fallback, false);
  assert.equal(neo.url, 'https://digitalavatar.ai/metahuman.html?dock=1');
  assert.deepEqual(plain(A.faceChoice('good', false)), {label: 'good', url: A.LEVELS.good, fallback: false});
  assert.deepEqual(plain(A.faceChoice('better', false)), {label: 'better', url: A.LEVELS.better, fallback: false});

  const open = src.slice(src.indexOf('function openLevel'));
  assert.match(open, /faceChoice\('best', ok === true\)/);
  assert.match(open, /LEVELS\.best\) frame\.removeAttribute\('src'\)/);
  assert.match(src, /Neo no disponible, mostrando a la chica/);
  assert.doesNotMatch(src, /favicon-32x32/);
});

test('el sondeo usa el WebRTC y respeta el tiempo límite', async () => {
  class WS {
    constructor() { this.readyState = 1; this.sent = []; WS.last = this; }
    send(raw) { this.sent.push(JSON.parse(raw)); }
    close() { this.readyState = 3; }
  }
  class PC {
    constructor() { this.localDescription = {sdp: 'a=answer'}; PC.last = this; }
    setRemoteDescription() { return Promise.resolve(); }
    createAnswer() { return Promise.resolve({type: 'answer', sdp: 'a=answer'}); }
    setLocalDescription() { return Promise.resolve(); }
    addIceCandidate() { return Promise.resolve(); }
    close() { this.closed = true; }
  }
  const quiet = {setTimeout() { return 1; }, clearTimeout() {}};
  const down = A.probeNeo({WebSocket: WS, RTCPeerConnection: PC, ...quiet});
  WS.last.onmessage({data: JSON.stringify({type: 'config', peerConnectionOptions: {}})});
  assert.deepEqual(WS.last.sent.at(-1), {type: 'listStreamers'});
  WS.last.onmessage({data: JSON.stringify({type: 'streamerList', ids: []})});
  assert.equal(await down, false);

  const up = A.probeNeo({WebSocket: WS, RTCPeerConnection: PC, ...quiet});
  const ws = WS.last;
  ws.onmessage({data: JSON.stringify({type: 'config'})});
  ws.onmessage({data: JSON.stringify({type: 'streamerList', ids: ['DefaultStreamer']})});
  assert.deepEqual(ws.sent.at(-1), {type: 'subscribe', streamerId: 'DefaultStreamer'});
  ws.onmessage({data: JSON.stringify({type: 'offer', sdp: 'v=0'})});
  ws.onmessage({data: JSON.stringify({type: 'iceCandidate', candidate: {candidate: 'c', sdpMid: '0', sdpMLineIndex: 0}})});
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  PC.last.iceConnectionState = 'connected';
  PC.last.oniceconnectionstatechange();
  assert.equal(await up, true);
  assert.equal(PC.last.closed, true);

  let fire;
  const slow = A.probeNeo({
    WebSocket: class extends WS { constructor() { super(); } },
    RTCPeerConnection: PC,
    setTimeout(fn) { fire = fn; return 1; },
    clearTimeout() { fire = null; }
  });
  fire();
  assert.equal(await slow, false);
});

test('el panel recuerda un tamaño acotado y el asa superior izquierda lo agranda', () => {
  assert.equal(A.SIZE_KEY, 'admira-avatar:size');
  const desk = {w: 1440, h: 900, lift: 20};
  assert.deepEqual(plain(A.clampPanelSize(100, 100, desk)), {w: 300, h: 460});
  assert.deepEqual(plain(A.clampPanelSize(500, 640, desk)), {w: 500, h: 640});
  assert.deepEqual(plain(A.clampPanelSize(2000, 2000, desk)), {w: 920, h: 864});
  assert.deepEqual(plain(A.clampPanelSize(400, 680, {w: 320, h: 500, lift: 40})), {w: 296, h: 444});
  // Arrastrar el asa 80 px a la izquierda y 60 hacia arriba agranda.
  assert.deepEqual(
    plain(A.panelSizeAfterDrag({w: 400, h: 680}, {x: 100, y: 80}, {x: 180, y: 140}, desk)),
    {w: 480, h: 740}
  );
  assert.match(src, /id="da-suite-resize"/);
  assert.match(src, /pointerdown/);
  assert.match(src, /touch-action:none/);
});
