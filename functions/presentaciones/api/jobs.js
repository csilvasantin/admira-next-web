import { assertKnownGenerateFields, slugify } from './generate.js';
import { ensureHttpsUrl } from '../_defaults.js';
import { jobRunSignature, publicCreateJob, readJob, reserveKey, slugJobKey, writeJob } from '../_create-job.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

export async function onRequest(context) {
  if (!context.env.PRESENTATION_IDEAS || !context.env.PRES_SIGNING_KEY) return json({ error: 'Generador no configurado.' }, 503);
  const url = new URL(context.request.url);
  if (context.request.method === 'GET') return readStatus(context, url);
  if (context.request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const origin = context.request.headers.get('Origin');
  if (!origin || origin !== url.origin) return json({ error: 'Origen no permitido.' }, 403);
  let raw;
  try { raw = await context.request.json(); } catch (_) { return json({ error: 'JSON no válido.' }, 400); }
  try { assertKnownGenerateFields(raw); } catch (error) { return json({ error: error.message }, 400); }
  const displayName = String(raw.displayName || '').trim().slice(0, 100);
  const slug = slugify(raw.slug || displayName);
  if (!displayName || slug.length < 2) return json({ error: 'Indica un nombre de cliente válido.' }, 400);
  if (['api', 'generador', 'index', 'assets', 'jobs'].includes(slug)) return json({ error: 'Ese identificador está reservado.' }, 400);
  const website = ensureHttpsUrl(raw.website);
  if (!website || !/^https:\/\//i.test(website)) return json({ error: 'La web oficial debe comenzar por https://' }, 400);
  const existing = await context.env.PRESENTATION_IDEAS.get(`presentation:${slug}`, { type: 'json' });
  if (existing && raw.overwrite !== true) return json({ error: 'Ya existe una presentación con ese identificador.', exists: true, slug }, 409);
  const reserve = await context.env.PRESENTATION_IDEAS.get(reserveKey(slug), { type: 'json' });
  if (reserve && (reserve.status === 'queued' || reserve.status === 'running')) {
    return json({ error: 'Ya hay un alta en curso para ese identificador.', jobId: reserve.id, slug, status: reserve.status }, 409);
  }
  const now = new Date().toISOString();
  const job = {
    id: crypto.randomUUID(),
    slug,
    displayName,
    status: 'queued',
    error: '',
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    result: null,
    body: raw
  };
  await writeJob(context.env, job);
  const sig = await jobRunSignature(context.env, job.id);
  const runUrl = new URL(`/presentaciones/api/jobs/${job.id}/run`, url);
  const cookie = context.request.headers.get('cookie') || '';
  const task = fetch(runUrl, {
    method: 'POST',
    headers: {
      origin: url.origin,
      cookie,
      'content-type': 'application/json',
      'x-presentation-job-run': sig
    },
    body: '{}'
  }).then(async (response) => {
    if (response.ok) return;
    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try { message = JSON.parse(text).error || message; } catch (_) {}
    const current = await readJob(context.env, job.id);
    if (current && current.status !== 'saved' && current.status !== 'failed') {
      current.status = 'failed';
      current.error = String(message).slice(0, 500);
      current.finishedAt = new Date().toISOString();
      current.updatedAt = current.finishedAt;
      await writeJob(context.env, current);
    }
  }).catch(async (error) => {
    const current = await readJob(context.env, job.id);
    if (!current || current.status === 'saved' || current.status === 'failed') return;
    current.status = 'failed';
    current.error = String(error && error.message || error || 'no se pudo arrancar el alta').slice(0, 500);
    current.finishedAt = new Date().toISOString();
    current.updatedAt = current.finishedAt;
    await writeJob(context.env, current);
  });
  if (typeof context.waitUntil === 'function') context.waitUntil(task);
  else await task;
  return json({ ok: true, jobId: job.id, slug, status: 'queued', displayName }, 202);
}

async function readStatus(context, url) {
  const client = slugify(url.searchParams.get('client') || '');
  const jobParam = String(url.searchParams.get('job') || '').trim().toLowerCase();
  let job = null;
  if (jobParam) job = await readJob(context.env, jobParam);
  else if (client) {
    const id = await context.env.PRESENTATION_IDEAS.get(slugJobKey(client));
    if (id) job = await readJob(context.env, id);
  }
  if (!job && !client) return json({ error: 'Indica client o job.' }, 400);
  let generation = null;
  const slug = job?.slug || client;
  if (slug) {
    const saved = await context.env.PRESENTATION_IDEAS.get(`generation:${slug}`, { type: 'json' });
    if (saved) generation = { id: saved.id, status: saved.status, updatedAt: saved.updatedAt || null };
  }
  if (!job && !generation) return json({ error: 'Todavía no hay un alta ni una generación para ese identificador.', slug: slug || null }, 404);
  return json({
    ok: true,
    job: publicCreateJob(job),
    slug: slug || null,
    generation
  });
}
