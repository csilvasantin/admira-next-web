import { applyJobResult, publicCreateJob, readJob, writeJob } from '../../_create-job.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

export async function onRequest(context) {
  if (!context.env.PRESENTATION_IDEAS) return json({ error: 'Generador no configurado.' }, 503);
  const id = String(context.params.id || '').trim().toLowerCase();
  if (context.request.method === 'GET') return readOne(context, id);
  if (context.request.method === 'POST') return cancelOne(context, id);
  return json({ error: 'Método no permitido.' }, 405);
}

async function readOne(context, id) {
  const job = await readJob(context.env, id);
  if (!job) return json({ error: 'No hay un alta con ese número.', jobId: id }, 404);
  return json({ ok: true, job: publicCreateJob(job), slug: job.slug });
}

async function cancelOne(context, id) {
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('Origin');
  if (!origin || origin !== url.origin) return json({ error: 'Origen no permitido.' }, 403);
  const job = await readJob(context.env, id);
  if (!job) return json({ error: 'No hay un alta con ese número.', jobId: id }, 404);
  if (job.status === 'saved') return json({ error: 'El alta ya está guardada. No se cancela.', job: publicCreateJob(job) }, 409);
  if (job.status !== 'failed') {
    applyJobResult(job, { ok: false, error: 'Alta cancelada. El identificador queda libre.' });
    await writeJob(context.env, job);
  }
  return json({ ok: true, job: publicCreateJob(job), slug: job.slug });
}
