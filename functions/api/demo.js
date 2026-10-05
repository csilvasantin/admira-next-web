/**
 * /api/demo · cola de demos formales (ArquitectoCursorCloud · 05-10-2026).
 *
 * POST  público (rate-limit): encola solicitud completa → KV PRESENTATION_IDEAS
 *       y, si hay DEMO_HOOK / AGORA_NOTIFY_URL, notifica (Mac Mini / Agora).
 * GET   ?estado=pendiente  (Bearer machine key) → lista pendientes para procesar_cola.py
 * GET   ?id=…              público recortado / machine: detalle
 * PATCH {id, estado}       (Bearer) → hecha | error | cancelada
 *
 * Campos: cliente, website, color, xpacio_tipo (demostore|estanco|cafeteria|other),
 * xpacio_otro, ciudades[], cierre, idiomas[], logo (data URL opcional), notas.
 * Nunca persiste ni registra secretos.
 */
import { limitarFrecuencia } from '../_limite-frecuencia.js';

const TIPOS = new Set(['demostore', 'estanco', 'cafeteria', 'other']);
const CIUDADES_OK = new Set(['london','newyork','barcelona','madrid','paris','milano','lisboa','valencia','mexico']);
const PREF = 'demo-solicitud:';
const IDX = 'demo-solicitud-index';
const MAX_LOGO = 400_000; // ~300 KB base64
const MAX_BODY = 500_000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
  },
});

function limpio(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function slug(texto) {
  return limpio(texto, 80).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'demo';
}

function machineOk(env, request) {
  const auth = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(\S+)/i.exec(auth);
  const token = m ? m[1] : '';
  if (!token) return false;
  const keys = [env.DEMO_QUEUE_KEY, env.PRES_MACHINE_KEY, env.ADMIRANEXT_PRESENTACIONES_MACHINE_KEY]
    .filter(Boolean);
  return keys.some((k) => k && k === token);
}

async function leerIndice(env) {
  if (!env?.PRESENTATION_IDEAS) return [];
  const raw = await env.PRESENTATION_IDEAS.get(IDX, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

async function escribirIndice(env, ids) {
  const trim = ids.slice(-200);
  await env.PRESENTATION_IDEAS.put(IDX, JSON.stringify(trim), { expirationTtl: 60 * 60 * 24 * 90 });
}

async function notify(env, waitUntil, solicitud) {
  const url = env.DEMO_HOOK || env.AGORA_NOTIFY_URL || '';
  if (!url) return { ok: false, motivo: 'sin DEMO_HOOK' };
  const body = {
    tipo: 'demo-solicitud',
    id: solicitud.id,
    cliente: solicitud.cliente,
    xpacio_tipo: solicitud.xpacio_tipo,
    website: solicitud.website,
    ciudades: solicitud.ciudades,
    mensaje: `Nueva demo formal · ${solicitud.cliente} · ${solicitud.xpacio_tipo} · ${solicitud.ciudades.join(',')}`,
  };
  const p = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'admiranext-demo-form/1.0' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  }).then(() => {}).catch(() => {});
  try { waitUntil(p); } catch (_) {}
  return { ok: true };
}

function publico(s) {
  if (!s) return null;
  return {
    id: s.id,
    cliente: s.cliente,
    website: s.website,
    color: s.color,
    xpacio_tipo: s.xpacio_tipo,
    xpacio_otro: s.xpacio_otro || '',
    ciudades: s.ciudades,
    cierre: s.cierre,
    idiomas: s.idiomas,
    estado: s.estado,
    creadaEn: s.creadaEn,
    tiene_logo: Boolean(s.logo_data_url),
  };
}

export async function onRequestOptions() {
  return json({ ok: true }, 204);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  const id = limpio(u.searchParams.get('id'), 64);
  const estado = limpio(u.searchParams.get('estado'), 32).toLowerCase();
  const machine = machineOk(env, request);

  if (id) {
    const s = await env.PRESENTATION_IDEAS?.get(PREF + id, { type: 'json' });
    if (!s) return json({ ok: false, error: 'No existe.' }, 404);
    if (machine) return json({ ok: true, solicitud: s });
    return json({ ok: true, solicitud: publico(s) });
  }

  if (estado === 'pendiente' || estado === 'pendientes') {
    if (!machine) return json({ ok: false, error: 'Autorización de máquina requerida.' }, 401);
    const ids = await leerIndice(env);
    const out = [];
    for (const sid of ids.slice().reverse()) {
      const s = await env.PRESENTATION_IDEAS.get(PREF + sid, { type: 'json' });
      if (s && (s.estado === 'pendiente' || s.estado === 'encolada')) out.push(s);
      if (out.length >= 20) break;
    }
    return json({ ok: true, solicitudes: out });
  }

  return json({
    ok: true,
    endpoint: '/api/demo',
    metodos: ['POST', 'GET', 'PATCH'],
    xpacio_tipos: [...TIPOS],
    ciudades: [...CIUDADES_OK],
    form: 'https://www.admiranext.com/demo',
    pipeline: 'Mac Mini · tools/crear-demo/procesar_cola.py · crear_demo.py --xpacio-tipo',
  });
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  const rate = await limitarFrecuencia(env, request, { ambito: 'demo-form', maximo: 8, ventanaSeg: 600 });
  if (!rate.permitido) {
    return json({ ok: false, error: `Demasiadas solicitudes. Reintenta en ~${rate.reintentarEn}s.` }, 429);
  }

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json({ ok: false, error: 'Cuerpo demasiado grande.' }, 413);

  let body;
  try {
    const texto = await request.text();
    if (texto.length > MAX_BODY) return json({ ok: false, error: 'Cuerpo demasiado grande.' }, 413);
    body = JSON.parse(texto);
  } catch (_) {
    return json({ ok: false, error: 'JSON no válido.' }, 400);
  }

  const cliente = limpio(body.cliente || body.company || body.nombre, 80);
  const website = limpio(body.website || body.web || body.url, 300);
  const color = limpio(body.color || body.brand_color || '', 20);
  const xpacio_tipo = limpio(body.xpacio_tipo || body.xpacioType || body.tipo || 'demostore', 20).toLowerCase();
  const xpacio_otro = limpio(body.xpacio_otro || body.xpacioOtro || '', 60);
  const cierre = limpio(body.cierre || body.close_time || '20:00', 8);
  const notas = limpio(body.notas || body.notes || '', 500);
  let ciudades = body.ciudades || body.cities || ['london', 'newyork', 'barcelona', 'madrid'];
  if (typeof ciudades === 'string') ciudades = ciudades.split(/[,;\s]+/);
  ciudades = [...new Set(ciudades.map((c) => slug(c).replace(/-/g, '')).filter((c) => CIUDADES_OK.has(c)))];
  if (!ciudades.length) ciudades = ['london', 'newyork', 'barcelona', 'madrid'];
  let idiomas = body.idiomas || body.languages || ['en', 'es'];
  if (typeof idiomas === 'string') idiomas = idiomas.split(/[,;\s]+/);
  idiomas = [...new Set(idiomas.map((x) => limpio(x, 5).toLowerCase()).filter(Boolean))];
  if (!idiomas.length) idiomas = ['en', 'es'];

  if (!cliente) return json({ ok: false, error: 'Falta el nombre de la compañía.' }, 400);
  if (!website || !/^https?:\/\//i.test(website)) {
    return json({ ok: false, error: 'La web debe ser una URL http(s).' }, 400);
  }
  if (!TIPOS.has(xpacio_tipo)) {
    return json({ ok: false, error: `xpacio_tipo inválido (vale: ${[...TIPOS].join(', ')}).` }, 400);
  }
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return json({ ok: false, error: 'color debe ser #RRGGBB.' }, 400);
  }
  if (!/^\d{1,2}:\d{2}$/.test(cierre)) {
    return json({ ok: false, error: 'cierre debe ser HH:MM.' }, 400);
  }

  let logo_data_url = '';
  const logo = body.logo || body.logo_data_url || '';
  if (typeof logo === 'string' && logo.startsWith('data:image/') && logo.length <= MAX_LOGO) {
    logo_data_url = logo;
  } else if (logo) {
    return json({ ok: false, error: 'Logo opcional: data URL de imagen ≤ ~300 KB.' }, 400);
  }

  if (!env?.PRESENTATION_IDEAS) {
    return json({ ok: false, error: 'Cola no disponible (KV).' }, 503);
  }

  const ahora = new Date().toISOString();
  const id = `${Date.now().toString(36)}-${slug(cliente).slice(0, 24)}`;
  const solicitud = {
    id,
    id_marca: slug(cliente),
    cliente,
    website,
    color: color || '',
    xpacio_tipo,
    xpacio_otro: xpacio_tipo === 'other' ? xpacio_otro : '',
    ciudades,
    cierre,
    idiomas,
    notas,
    logo_data_url: logo_data_url || undefined,
    estado: 'pendiente',
    creadaEn: ahora,
    actualizadaEn: ahora,
    origen: 'admiranext.com/demo',
    ip: limpio(request.headers.get('CF-Connecting-IP'), 64),
  };

  await env.PRESENTATION_IDEAS.put(PREF + id, JSON.stringify(solicitud), { expirationTtl: 60 * 60 * 24 * 60 });
  const ids = await leerIndice(env);
  ids.push(id);
  await escribirIndice(env, ids);

  const aviso = await notify(env, waitUntil || (() => {}), solicitud);

  return json({
    ok: true,
    id,
    estado: 'pendiente',
    mensaje: 'Solicitud en cola. El Mac Mini lanzará crear_demo.py con el tipo de Xpacio indicado.',
    solicitud: publico(solicitud),
    notify: aviso.ok ? 'hook' : 'kv-only',
    comando_sugerido: `python3 tools/crear-demo/crear_demo.py --cliente "${cliente}" --web ${website}`
      + (color ? ` --color '${color}'` : '')
      + ` --xpacio-tipo ${xpacio_tipo}`
      + (xpacio_tipo === 'other' && xpacio_otro ? ` --xpacio-otro "${xpacio_otro}"` : '')
      + ` --ciudades ${ciudades.join(',')} --cierre ${cierre} --idiomas ${idiomas.join(',')}`,
  }, 201);
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!machineOk(env, request)) return json({ ok: false, error: 'Autorización de máquina requerida.' }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'JSON no válido.' }, 400); }
  const id = limpio(body.id, 64);
  const estado = limpio(body.estado || body.status, 32).toLowerCase();
  if (!id) return json({ ok: false, error: 'Falta id.' }, 400);
  const okEstados = new Set(['pendiente', 'encolada', 'en_curso', 'hecha', 'error', 'cancelada']);
  if (!okEstados.has(estado)) return json({ ok: false, error: 'estado inválido.' }, 400);
  const s = await env.PRESENTATION_IDEAS.get(PREF + id, { type: 'json' });
  if (!s) return json({ ok: false, error: 'No existe.' }, 404);
  s.estado = estado;
  s.actualizadaEn = new Date().toISOString();
  if (body.nota) s.nota = limpio(body.nota, 500);
  if (body.resultado && typeof body.resultado === 'object') {
    // no copiar secretos: solo urls/ids públicos
    s.resultado = {
      circuit: limpio(body.resultado.circuit, 80),
      marca: limpio(body.resultado.marca, 80),
      playlist: limpio(body.resultado.playlist, 120),
    };
  }
  await env.PRESENTATION_IDEAS.put(PREF + id, JSON.stringify(s), { expirationTtl: 60 * 60 * 24 * 60 });
  return json({ ok: true, solicitud: publico(s) });
}
