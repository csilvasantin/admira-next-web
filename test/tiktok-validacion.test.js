// Yokup #3199 (12-sep-2026): gate de validación del máster antes de publicar y
// elección del póster representativo. El script deja el API en globalThis.
import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/tiktok-validacion.js');
const V = globalThis.AdmiraValidacionVideo;

// Muestras reales del «Langostino cocido» (ffmpeg signalstats, 12-sep-2026):
// fotograma 0 = relleno #020508 (luma 20, plano); del 1 en adelante hay imagen.
const langostino = [
  { t: 0.0, luma: 20, var: 4 }, { t: 0.46, luma: 69.7, var: 2400 }, { t: 0.96, luma: 70.8, var: 2500 },
  { t: 1.46, luma: 72.8, var: 2600 }, { t: 2.46, luma: 79.2, var: 2700 }, { t: 3.46, luma: 87.9, var: 2900 },
  { t: 4.46, luma: 95.1, var: 3300 }, { t: 5.46, luma: 93.7, var: 3100 }, { t: 6.46, luma: 92.7, var: 3000 },
  { t: 8.46, luma: 93.2, var: 2800 }, { t: 10.46, luma: 92.7, var: 2900 }, { t: 12.46, luma: 89.0, var: 2500 },
  { t: 14.46, luma: 89.7, var: 2400 },
];

test('el API existe y expone los umbrales de la regla', () => {
  assert.ok(V, 'window.AdmiraValidacionVideo');
  assert.equal(V.NEGRO_MAX_RATIO, 0.7);
  assert.equal(V.DURACION_MIN, 10);
  assert.equal(V.MUESTRAS_MIN, 12);
  assert.equal(V.POSTER_W, 540); assert.equal(V.POSTER_H, 960);
});

test('lumaDeImageData: negro puro → luma 0 var 0; tablero → varianza alta', () => {
  const negro = new Uint8ClampedArray(4 * 16).fill(0);
  for (let i = 3; i < negro.length; i += 4) negro[i] = 255;
  assert.deepEqual(V.lumaDeImageData(negro), { luma: 0, var: 0 });
  const tablero = new Uint8ClampedArray(4 * 16);
  for (let p = 0; p < 16; p++) { const v = p % 2 ? 255 : 0; tablero[p * 4] = v; tablero[p * 4 + 1] = v; tablero[p * 4 + 2] = v; tablero[p * 4 + 3] = 255; }
  const r = V.lumaDeImageData(tablero);
  assert.ok(Math.abs(r.luma - 127.5) < 0.01); assert.ok(r.var > 16000);
});

test('esNegra: el relleno #020508 (luma 20 plano) cuenta como negro; con imagen no', () => {
  assert.equal(V.esNegra({ luma: 20, var: 4 }), true);
  assert.equal(V.esNegra({ luma: 10, var: 5000 }), true);
  assert.equal(V.esNegra({ luma: 69.7, var: 2400 }), false);
  assert.equal(V.esNegra({ luma: 22, var: 400 }), false);
});

test('evaluarMuestras: el Langostino es válido; 12/12 negros se rechaza con el mensaje exacto; umbral 70 %', () => {
  const ok = V.evaluarMuestras(langostino, { duracion: 15 });
  assert.deepEqual([ok.ok, ok.negros, ok.muestras, ok.motivo], [true, 1, 13, null]);
  const negro = Array.from({ length: 12 }, (_, i) => ({ t: i + 0.5, luma: 20, var: 3 }));
  const ko = V.evaluarMuestras(negro, { duracion: 15 });
  assert.equal(ko.ok, false);
  assert.equal(ko.motivo, 'Vídeo inválido: 12/12 fotogramas negros');
  const mixto = (n) => negro.slice(0, n).concat(Array.from({ length: 12 - n }, (_, i) => ({ t: 5 + i, luma: 80, var: 2000 })));
  assert.equal(V.evaluarMuestras(mixto(9), { duracion: 15 }).ok, false, '9/12 = 75 % > 70 %');
  assert.equal(V.evaluarMuestras(mixto(8), { duracion: 15 }).ok, true, '8/12 = 66 %');
});

test('evaluarMuestras: duración < 10 s, sin muestras o sin pista → inválido; duración desconocida no invalida', () => {
  assert.match(V.evaluarMuestras(langostino, { duracion: 4.2 }).motivo, /duración 4\.2 s < 10 s/);
  assert.equal(V.evaluarMuestras([], { duracion: 15 }).motivo, 'sin pista de vídeo');
  assert.equal(V.evaluarMuestras(langostino, { duracion: 15, tienePista: false }).ok, false);
  assert.equal(V.evaluarMuestras(langostino, { duracion: Infinity }).ok, true);
});

test('elegirPoster: nunca el fotograma 0; máxima varianza con luma 40..220 fuera de los 0,8 s de cada extremo', () => {
  const i = V.elegirPoster(langostino, { duracion: 15 });
  assert.equal(langostino[i].t, 4.46);
  const extremos = [{ t: 0, luma: 20, var: 3 }, { t: 0.3, luma: 90, var: 1000 }, { t: 14.9, luma: 90, var: 1500 }];
  assert.equal(V.elegirPoster(extremos, { duracion: 15 }), 2, 'si solo hay candidatos en los extremos, se admiten');
  assert.equal(V.elegirPoster([{ t: 1, luma: 5, var: 1 }]), -1, 'todo negro → sin póster');
  assert.equal(V.elegirPoster([{ t: 2, luma: 240, var: 5000 }, { t: 5, luma: 120, var: 800 }], { duracion: 15 }), 1, 'quemado (>220) se evita si hay alternativa');
});

test('instantesDeMuestreo: ≥12 instantes, ninguno en t=0 ni en el final exacto, repartidos por la duración', () => {
  const t = V.instantesDeMuestreo(15);
  assert.equal(t.length, 12);
  assert.ok(t[0] > 0 && t[0] < 1);
  assert.ok(t[11] < 15 && t[11] > 14);
  assert.equal(V.instantesDeMuestreo(Infinity, 12).length, 12, 'sin duración conocida se asume 15 s');
  assert.equal(V.instantesDeMuestreo(30, 20).length, 20);
});
