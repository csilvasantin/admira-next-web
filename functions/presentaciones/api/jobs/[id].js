import { publicCreateJob, readJob } from '../../_create-job.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405);
  if (!context.env.PRESENTATION_IDEAS) return json({ error: 'Generador no configurado.' }, 503);
  const id = String(context.params.id || '').trim().toLowerCase();
  const job = await readJob(context.env, id);
  if (!job) return json({ error: 'No hay un alta con ese número.', jobId: id }, 404);
  return json({ ok: true, job: publicCreateJob(job), slug: job.slug });
}
