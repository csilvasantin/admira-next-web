import { jobRunSignature, readJob } from '../../../_create-job.js';
import { runCreateJob } from '../../jobs.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!context.env.PRESENTATION_IDEAS || !context.env.PRES_SIGNING_KEY) return json({ error: 'Generador no configurado.' }, 503);
  const id = String(context.params.id || '').trim().toLowerCase();
  const expected = await jobRunSignature(context.env, id);
  const given = String(context.request.headers.get('x-presentation-job-run') || '');
  if (!same(expected, given)) return json({ error: 'Alta no autorizada.' }, 403);
  const job = await readJob(context.env, id);
  if (!job) return json({ error: 'No hay un alta con ese número.', jobId: id }, 404);
  if (job.status === 'saved' || job.status === 'failed') return json({ ok: true, jobId: id, status: job.status, error: job.error || '' });
  const url = new URL(context.request.url);
  const current = await runCreateJob(context, job, { origin: url.origin, cookie: context.request.headers.get('cookie') || '' });
  return json({ ok: current.status === 'saved', jobId: id, status: current.status, error: current.error || '' }, current.status === 'failed' ? 422 : 200);
}
