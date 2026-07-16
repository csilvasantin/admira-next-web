const BUILT_IN = new Set(['lacaixa', 'clearchannel', 'lenovo']);
const MAX_BYTES = 64 * 1024;

function response(body, status = 200){
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
      'x-content-type-options': 'nosniff'
    }
  });
}

function cleanText(value, max = 1600){
  return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function normalize(payload, client){
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Formato no válido.');
  const skeleton = Array.isArray(payload.skeleton) ? payload.skeleton.slice(0, 20) : [];
  if (!skeleton.length) throw new Error('Añade al menos una idea al esqueleto.');

  return {
    schemaVersion: 1,
    client,
    displayName: cleanText(payload.displayName, 100),
    hero: {
      eyebrow: cleanText(payload.hero?.eyebrow, 120),
      title: cleanText(payload.hero?.title, 220),
      summary: cleanText(payload.hero?.summary, 900)
    },
    objective: cleanText(payload.objective, 1200),
    skeleton: skeleton.map((item, index) => ({
      id: cleanText(item?.id, 80) || `idea-${index + 1}`,
      title: cleanText(item?.title, 180) || `Idea ${index + 1}`,
      message: cleanText(item?.message, 900),
      detail: cleanText(item?.detail, 1600),
      enabled: item?.enabled !== false
    })),
    closing: {
      title: cleanText(payload.closing?.title, 220),
      action: cleanText(payload.closing?.action, 700)
    },
    notes: cleanText(payload.notes, 4000),
    updatedAt: new Date().toISOString()
  };
}

export async function onRequest(context){
  const client = String(context.params.client || '').toLowerCase();
  if (!context.env.PRESENTATION_IDEAS) return response({ error: 'Almacenamiento no configurado.' }, 503);
  const validSlug = /^[a-z0-9][a-z0-9-]{1,62}$/.test(client);
  const generated = validSlug ? await context.env.PRESENTATION_IDEAS.get(`presentation:${client}`, { type:'json' }) : null;
  if (!BUILT_IN.has(client) && !generated) return response({ error: 'Cliente no válido.' }, 404);

  const key = `ideas:${client}`;
  if (context.request.method === 'GET'){
    const requestedKey = new URL(context.request.url).searchParams.get('base') === '1' ? `ideas-base:${client}` : key;
    const saved = await context.env.PRESENTATION_IDEAS.get(requestedKey, { type: 'json' }) ||
      await context.env.PRESENTATION_IDEAS.get(key, { type: 'json' });
    return saved ? response(saved) : response({ error: 'Todavía no hay una versión guardada.' }, 404);
  }

  if (context.request.method !== 'PUT') return response({ error: 'Método no permitido.' }, 405);

  const origin = context.request.headers.get('Origin');
  const url = new URL(context.request.url);
  if (!origin || origin !== url.origin) return response({ error: 'Origen no permitido.' }, 403);
  const length = Number(context.request.headers.get('Content-Length') || 0);
  if (length > MAX_BYTES) return response({ error: 'El contenido es demasiado grande.' }, 413);

  let payload;
  try { payload = await context.request.json(); }
  catch (_) { return response({ error: 'JSON no válido.' }, 400); }

  let data;
  try { data = normalize(payload, client); }
  catch (error) { return response({ error: error.message || 'Contenido no válido.' }, 400); }

  await context.env.PRESENTATION_IDEAS.put(key, JSON.stringify(data));
  return response({ ok: true, data });
}
