import { VALID_STATUSES, normalizeGeneration, recomputeGeneration, publicGeneration, updateTaskStatus } from '../../_generation.js';

function json(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, must-revalidate','x-content-type-options':'nosniff'}
  });
}

function cleanUrl(value){ return typeof value === 'string' && value.length <= 1000 ? value : null; }
function cleanError(value){ return typeof value === 'string' && value.length <= 500 ? value : null; }

export async function onRequest(context){
  if (!context.env.PRESENTATION_IDEAS) return json({error:'Almacenamiento no configurado.'},503);
  const client = String(context.params.client || '').toLowerCase();
  const key = `generation:${client}`;
  const saved = await context.env.PRESENTATION_IDEAS.get(key,{type:'json'});
  if (!saved) return json({error:'Todavía no hay una generación solicitada.'},404);
  const job = normalizeGeneration(saved);

  if (context.request.method === 'GET') return json({ok:true,generation:publicGeneration(job)});
  if (context.request.method !== 'PUT') return json({error:'Método no permitido.'},405);

  const origin = context.request.headers.get('Origin');
  const url = new URL(context.request.url);
  if (!origin || origin !== url.origin) return json({error:'Origen no permitido.'},403);

  let payload;
  try { payload = await context.request.json(); }
  catch (_) { return json({error:'JSON no válido.'},400); }
  if (payload.id && payload.id !== job.id) return json({error:'La generación ya no es la vigente.'},409);

  const now = new Date().toISOString();
  if (payload.action === 'retry') {
    const requested = Array.isArray(payload.tasks) ? payload.tasks : [payload.task].filter(Boolean);
    const keys = requested.length ? requested : Object.keys(job.tasks).filter(key => job.tasks[key].status === 'failed');
    for (const taskId of keys) {
      const task = job.tasks[taskId];
      if (!task) continue;
      delete task.startedAt;
      updateTaskStatus(task,task.output === 'website' ? 'ready' : 'queued',now);
      task.url = task.output === 'website' ? (task.url || `/presentaciones/${client}/presentacion?lang=${task.language}`) : null;
      task.attempts = Number(task.attempts || 0) + 1;
    }
  }

  if (payload.action === 'publish') {
    const requested = Array.isArray(payload.tasks) ? payload.tasks : [payload.task].filter(Boolean);
    for (const taskId of requested) {
      const task = job.tasks[taskId];
      if (task && task.url && ['ready','complete','published'].includes(task.status)) {
        updateTaskStatus(task,'published',now);
      }
    }
  }

  if (payload.tasks && typeof payload.tasks === 'object' && !Array.isArray(payload.tasks)) {
    for (const [taskId, update] of Object.entries(payload.tasks)) {
      const task = job.tasks[taskId];
      if (!task || !update || typeof update !== 'object') continue;
      if (VALID_STATUSES.has(update.status)) updateTaskStatus(task,update.status,now);
      const nextUrl = cleanUrl(update.url); if (nextUrl !== null) task.url = nextUrl;
      const nextError = cleanError(update.error); if (nextError !== null) task.error = nextError;
      task.updatedAt = now;
    }
  }

  // Compatibilidad con integraciones que todavía actualizan por entregable.
  if (payload.artifacts && typeof payload.artifacts === 'object') {
    for (const [output, update] of Object.entries(payload.artifacts)) {
      if (!update || typeof update !== 'object') continue;
      for (const task of Object.values(job.tasks).filter(item => item.output === output)) {
        if (VALID_STATUSES.has(update.status)) updateTaskStatus(task,update.status,now);
        const nextUrl = cleanUrl(update.url); if (nextUrl !== null) task.url = nextUrl;
        const nextError = cleanError(update.error); if (nextError !== null) task.error = nextError;
        task.updatedAt = now;
      }
    }
  }

  if (payload.status && VALID_STATUSES.has(payload.status)) job.status = payload.status;
  recomputeGeneration(job);
  await context.env.PRESENTATION_IDEAS.put(key,JSON.stringify(job));
  return json({ok:true,generation:publicGeneration(job)});
}
