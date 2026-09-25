/**
 * Alta asíncrona de create_presentation (encargo #4324).
 * El conector no espera a la traducción: el trabajo queda registrado
 * y un fallo se guarda en el propio registro, no se pierde al cortar la llamada.
 */

export const JOB_STATUSES = new Set(['queued', 'running', 'saved', 'failed']);
export const STALE_MS = 10 * 60 * 1000;
export const STALE_REASON = 'El alta llevaba más de 10 minutos sin avanzar y se ha dado por caducada. El identificador queda libre.';

export function publicCreateJob(job) {
  if (!job || typeof job !== 'object') return null;
  const saved = job.status === 'saved';
  return {
    id: job.id,
    slug: job.slug,
    displayName: job.displayName || '',
    status: job.status,
    error: job.error || '',
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    result: saved ? {
      slug: job.result?.slug || job.slug,
      password: job.result?.password || null,
      narrativeSource: job.result?.narrativeSource || null
    } : null
  };
}

/** Aplica el desenlace. Un fallo siempre deja status failed y el texto del error. */
const enc = new TextEncoder();

export function jobKey(id) { return `create-job:${id}`; }
export function reserveKey(slug) { return `create-reserve:${slug}`; }
export function slugJobKey(slug) { return `create-job-slug:${slug}`; }

export async function readJob(env, id) {
  if (!env?.PRESENTATION_IDEAS || !id) return null;
  return env.PRESENTATION_IDEAS.get(jobKey(id), { type: 'json' });
}

export function jobIsStale(job, now = Date.now()) {
  if (!job || (job.status !== 'queued' && job.status !== 'running')) return false;
  const stamp = Date.parse(job.updatedAt || job.startedAt || job.createdAt || '');
  if (!Number.isFinite(stamp)) return true;
  return now - stamp > STALE_MS;
}

export async function expireJobIfStale(env, job, now = Date.now()) {
  if (!jobIsStale(job, now)) return false;
  applyJobResult(job, { ok: false, error: STALE_REASON });
  await writeJob(env, job);
  return true;
}

export async function writeJob(env, job) {
  await env.PRESENTATION_IDEAS.put(jobKey(job.id), JSON.stringify(job));
  const reserve = await env.PRESENTATION_IDEAS.get(reserveKey(job.slug), { type: 'json' });
  const otherActive = reserve && reserve.id !== job.id && (reserve.status === 'queued' || reserve.status === 'running');
  if (otherActive && job.status !== 'queued') return;
  await env.PRESENTATION_IDEAS.put(reserveKey(job.slug), JSON.stringify({ id: job.id, status: job.status, slug: job.slug, updatedAt: job.updatedAt || null }));
  await env.PRESENTATION_IDEAS.put(slugJobKey(job.slug), job.id);
}

export async function jobRunSignature(env, id) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(env.PRES_SIGNING_KEY || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`create-job:${id}`));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function applyJobResult(job, { ok, error, result } = {}) {
  const now = new Date().toISOString();
  if (ok) {
    job.status = 'saved';
    job.error = '';
    job.result = result || null;
  } else {
    job.status = 'failed';
    job.error = String(error || 'el alta falló').replace(/\s+/g, ' ').trim().slice(0, 500) || 'el alta falló';
    job.result = null;
  }
  job.finishedAt = now;
  job.updatedAt = now;
  return job;
}
