const VALID_STATUSES = new Set(['queued','processing','ready','failed','skipped']);

function json(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, must-revalidate','x-content-type-options':'nosniff'}
  });
}

function publicJob(job){
  if (!job) return null;
  const { sourceText, provider, ...safe } = job;
  return safe;
}

export async function onRequest(context){
  if (!context.env.PRESENTATION_IDEAS) return json({error:'Almacenamiento no configurado.'},503);
  const client = String(context.params.client || '').toLowerCase();
  const key = `generation:${client}`;
  const job = await context.env.PRESENTATION_IDEAS.get(key,{type:'json'});
  if (!job) return json({error:'Todavía no hay una generación solicitada.'},404);

  if (context.request.method === 'GET') return json({ok:true,generation:publicJob(job)});
  if (context.request.method !== 'PUT') return json({error:'Método no permitido.'},405);

  const origin = context.request.headers.get('Origin');
  const url = new URL(context.request.url);
  if (!origin || origin !== url.origin) return json({error:'Origen no permitido.'},403);

  let payload;
  try { payload = await context.request.json(); }
  catch (_) { return json({error:'JSON no válido.'},400); }

  if (payload.id && payload.id !== job.id) return json({error:'La generación ya no es la vigente.'},409);
  if (payload.status && VALID_STATUSES.has(payload.status)) job.status = payload.status;
  if (payload.artifacts && typeof payload.artifacts === 'object') {
    for (const [name, update] of Object.entries(payload.artifacts)) {
      if (!job.artifacts[name] || !update || typeof update !== 'object') continue;
      const current = job.artifacts[name];
      if (VALID_STATUSES.has(update.status)) current.status = update.status;
      if (typeof update.url === 'string' && update.url.length <= 1000) current.url = update.url;
      if (typeof update.error === 'string' && update.error.length <= 500) current.error = update.error;
      current.updatedAt = new Date().toISOString();
    }
  }
  job.updatedAt = new Date().toISOString();
  await context.env.PRESENTATION_IDEAS.put(key,JSON.stringify(job));
  return json({ok:true,generation:publicJob(job)});
}
