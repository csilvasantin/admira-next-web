import { applyJobResult, jobRunSignature, readJob, writeJob } from '../../../../_create-job.js';

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
  if (job.status === 'running') return json({ ok: true, jobId: id, status: 'running' });
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  job.updatedAt = job.startedAt;
  await writeJob(context.env, job);
  const url = new URL(context.request.url);
  try {
    const response = await fetch(new URL('/presentaciones/api/generate', url), {
      method: 'PUT',
      headers: {
        origin: url.origin,
        cookie: context.request.headers.get('cookie') || '',
        'content-type': 'application/json'
      },
      body: JSON.stringify(job.body || {})
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { data = null; }
    const current = await readJob(context.env, id) || job;
    if (current.status === 'saved') return json({ ok: true, jobId: id, status: 'saved' });
    if (!response.ok) {
      applyJobResult(current, { ok: false, error: (data && data.error) || `HTTP ${response.status}` });
    } else {
      applyJobResult(current, {
        ok: true,
        result: {
          slug: data?.slug || current.slug,
          password: data?.password || null,
          narrativeSource: data?.narrativeSource || null
        }
      });
    }
    await writeJob(context.env, current);
    return json({ ok: response.ok, jobId: id, status: current.status, error: current.error || '' }, response.ok ? 200 : 422);
  } catch (error) {
    const current = await readJob(context.env, id) || job;
    if (current.status !== 'saved') {
      applyJobResult(current, { ok: false, error: error && error.message || error });
      await writeJob(context.env, current);
    }
    return json({ ok: false, jobId: id, status: current.status, error: current.error || '' }, 422);
  }
}
