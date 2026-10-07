import test from 'node:test';
import assert from 'node:assert/strict';
import { pagina } from '../functions/avatar-metricas.js';
import { returnToSeguro } from '../functions/_webmaster-gate.js';
const d = { ok: true, desde: '2026-10-01', hasta: '2026-10-07', dias: 7, preguntas: 3, conversaciones: 1, preguntas_por_conversacion: 3, duracion_media_s: 75, duracion_mediana_s: 75, respuesta_media_ms: 1200, por_dia: [{ k: '2026-10-07', v: 3 }], top_preguntas: [{ k: '<b>qué hay de temporada', v: 2 }], por_tema: [{ k: 'temporada', v: 2 }], por_idioma: [{ k: 'es', v: 3 }], por_avatar: [{ k: 'admirito', v: 3 }], por_plataforma: [{ k: 'admira.store', v: 3 }], por_marca: [{ k: 'starbucks', v: 3 }], privacidad: 'Sin IP' };
test('panel de métricas: escapa, muestra KPIs y vuelve tras el login', () => {
  const h = pagina(d, new URLSearchParams('brand=starbucks'), 'Carlos');
  assert.match(h, /Starbucks · Avatar digital/); assert.match(h, /1 min 15 s/); assert.match(h, /&lt;b&gt;qué hay/); assert.doesNotMatch(h, /<b>qué hay/);
  assert.equal(returnToSeguro('/avatar-metricas'), '/avatar-metricas');
});
