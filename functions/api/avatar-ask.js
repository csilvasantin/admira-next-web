// Relé CENTRAL del cerebro del avatar (encargo avatar · 4-oct-2026). Para los sitios
// sin /avatar-ask propio (xpaceos.com va en GitHub Pages y no ejecuta Functions) y para
// la propia admiranext.com. brain.digitalavatar.ai solo admite por CORS a
// csilvasantin.github.io, por eso hace falta un relé. La clave xAI se queda en ese
// servidor: aquí no hay secretos, no se reenvía audio y solo responden los orígenes
// de la red (el censo de functions/_proyectos.js, igual que /api/presence).
import {allowedOrigin} from '../_presence.js';

const BRAIN = 'https://brain.digitalavatar.ai/metahuman/ask';

const SHEET = {
  es: [
    'AdmiraNeXT tiene cuatro pilares, en este orden: Studio, Store, App y Yokup.',
    'Studio (pixeria.com; la cara Admira es admira.studio) es el estudio para crear contenido con IA. Su modo Experto es la consola del navegador: /help, /clear, /echo, /date, /status, /version, /history y /open (secciones home, audio, music, images, video, stock, assets, docs, radar).',
    'Store (xpaceos.com y admira.store) es el sistema operativo de la tienda Admira XP. El gemelo digital está en /admira-xp/. El modo Experto es la barra inferior. En cualquier página: /help, /limpiar, /gemelo y /marca (marca blanca; /marca off vuelve a Admira). Los verbos del gemelo (good, better, best, matrix, /distribuir, /inventario, /sincro) se ejecutan en /admira-xp/.',
    'App (admira.app y clearchannel.tv) es la cara de circuitos de publicidad exterior. Tiene su propia consola de experto en esa web.',
    'Yokup (yokup.com) es la bandeja de la flota: encargos, decisiones y normativa. No es el estudio ni la tienda.',
    'El avatar digital se controla desde el modo Experto de cada sitio: /avatarON lo enciende, /avatarOFF lo apaga y /avatar alterna (alias /avatarDigital, /digitalAvatar, /cli ayudante). La elección se recuerda en ese sitio, en el navegador, y gana al interruptor del proyecto que se fija en admiranext.com/webmaster. No hay claves en la página.',
  ],
  en: [
    'AdmiraNeXT has four pillars, in this order: Studio, Store, App and Yokup.',
    'Studio (pixeria.com; the Admira face is admira.studio) is the studio for creating content with AI. Its Expert mode is the browser console: /help, /clear, /echo, /date, /status, /version, /history and /open (sections home, audio, music, images, video, stock, assets, docs, radar).',
    'Store (xpaceos.com and admira.store) is the operating system of the Admira XP shop. The digital twin is at /admira-xp/. Expert mode is the bottom bar. On any page: /help, /limpiar, /gemelo and /marca (white label; /marca off returns to Admira). Twin verbs (good, better, best, matrix, /distribuir, /inventario, /sincro) run inside /admira-xp/.',
    'App (admira.app and clearchannel.tv) is the out-of-home advertising circuits face. It has its own expert console on that site.',
    'Yokup (yokup.com) is the fleet desk: tasks, decisions and rules. It is not the studio and it is not the shop.',
    'The digital avatar is controlled from each site\'s Expert mode: /avatarON turns it on, /avatarOFF turns it off and /avatar toggles (aliases /avatarDigital, /digitalAvatar, /cli helper). The choice is remembered on that site, in the browser, and beats the project switch set at admiranext.com/webmaster. There are no keys in the page.',
  ],
};

const TOPICS = [
  {keys: ['studio', 'pixeria', 'admira.studio'], i: 1},
  {keys: ['store', 'xpace', 'admira.store', 'gemelo', 'twin'], i: 2},
  {keys: ['clearchannel', 'admira.app'], i: 3},
  {keys: ['yokup'], i: 4},
  {keys: ['avatar', 'ayudante', 'helper', 'avatardigital', 'digitalavatar', 'experto', 'expert'], i: 5},
];

export function sheetAnswer(question, lang) {
  const L = lang === 'en' ? 'en' : 'es';
  const q = String(question || '').toLowerCase();
  const hits = [];
  for (const topic of TOPICS) {
    if (topic.keys.some((k) => q.includes(k))) hits.push(SHEET[L][topic.i]);
  }
  if (/pilar|pillar|admiranext|cuatro|four/.test(q)) hits.unshift(SHEET[L][0]);
  if (hits.length) return [...new Set(hits)].join(' ');
  return L === 'en'
    ? 'That is not in the sheet. I can talk about Admira Studio (pixeria.com), Admira Store (xpaceos.com), admira.app and yokup.com.'
    : 'Eso no consta en la ficha. Puedo hablar de Admira Studio (pixeria.com), Admira Store (xpaceos.com), admira.app y yokup.com.';
}

const rates = new Map();

function json(body, status, origin) {
  const headers = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin'};
  if (origin) Object.assign(headers, {'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type', 'access-control-max-age': '86400'});
  return new Response(body == null ? null : JSON.stringify(body), {status: status || 200, headers});
}

export async function onRequest(context, fetchImpl = fetch) {
  const request = context.request;
  const origin = allowedOrigin(request.headers.get('Origin'));
  if (!origin) return json({text: 'Origen no permitido'}, 403);
  if (request.method === 'OPTIONS') return json(null, 204, origin);
  if (request.method !== 'POST') return json({text: 'POST {question, lang}'}, 405, origin);
  // Freno por IP solo en memoria: no se guarda ni se devuelve la IP.
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) {
    const key = ip + ':' + Math.floor(Date.now() / 60000), n = (rates.get(key) || 0) + 1;
    if (rates.size > 2000) rates.clear();
    rates.set(key, n);
    if (n > 20) return json({text: 'Demasiadas preguntas seguidas. Espera un minuto.'}, 429, origin);
  }
  let body = {};
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({text: 'Pregunta demasiado larga.'}, 413, origin);
    body = JSON.parse(raw || '{}');
  } catch (_) { body = {}; }
  const question = String(body.question || '').trim().slice(0, 500);
  const lang = String(body.lang || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
  if (!question) return json({text: lang === 'en' ? 'Ask a question.' : 'Escribe una pregunta.'}, 200, origin);
  const grounded = (lang === 'en'
    ? 'You are the AdmiraNeXT avatar. Answer in English, in 2 to 4 sentences. Use ONLY this sheet. If it is not in the sheet, say it is not in the sheet. Do not invent figures, prices or clients.\n\nSHEET:\n'
    : 'Eres el avatar de AdmiraNeXT. Responde en español, en 2 a 4 frases. Usa SOLO esta ficha. Si no consta, di que no consta en la ficha. No inventes cifras, precios ni clientes.\n\nFICHA:\n')
    + SHEET.es.join('\n') + '\n' + SHEET.en.join('\n') + '\n\nPREGUNTA:\n' + question;
  const sheet = sheetAnswer(question, lang);
  try {
    const r = await fetchImpl(BRAIN, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({question: grounded, lang, room: 'xtanco', persona: 'neo'}),
    });
    const data = await r.json().catch(() => ({}));
    const text = String((data && (data.text || data.answer)) || '').trim();
    const sheetMiss = /no consta en la ficha|not in the sheet/i.test(sheet);
    const brainMiss = /no consta|not in the sheet|isn['’]?t in the sheet|no est[aá] en la ficha/i.test(text);
    const ancla = /pixeria|xpaceos|yokup|clearchannel|admira\.app|admira\.studio|admira\.store|admiranext/i.test(text);
    if (r.ok && text && !(brainMiss && !sheetMiss) && (sheetMiss || ancla)) return json({text: text.slice(0, 1200)}, 200, origin);
  } catch (_) {}
  return json({text: sheet}, 200, origin);
}
