/**
 * /api/avatar/flags — interruptor del avatar digital por proyecto.
 *
 *   GET  ?host=www.pixeria.com  → {ok, host, project, on, source}   público, CORS *, 60 s
 *   GET                         → {ok, v, projects, hosts, map}       público, CORS *, 60 s
 *   PUT  {project, on} | {host, on|null}                              solo /webmaster (admin + CSRF)
 *
 * Lo lee https://www.admiranext.com/assets/avatar.js desde cualquier sitio de la red.
 * Sin cookies ni datos personales en la lectura.
 */
import {exigirRol, csrfValido, auditar} from '../../_webmaster-gate.js';
import {AVATAR_HOSTS, AVATAR_PROJECTS, readFlags, writeFlags, applyChange, stateForHost} from '../../_avatar-flags.js';

const PUBLIC = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'public, max-age=60',
};
const PRIVATE = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'};

async function options() {
  return new Response(null, {status: 204, headers: {...PUBLIC, 'access-control-max-age': '86400'}});
}

async function get({request, env}) {
  const url = new URL(request.url);
  const {doc, storage} = await readFlags(env);
  if (url.searchParams.has('host')) {
    return new Response(JSON.stringify({ok: true, ...stateForHost(doc, url.searchParams.get('host'))}), {headers: PUBLIC});
  }
  return new Response(JSON.stringify({ok: true, v: doc.v, updatedAt: doc.updatedAt, storage,
    projects: doc.projects, hosts: doc.hosts, map: AVATAR_HOSTS, keys: AVATAR_PROJECTS}), {headers: PUBLIC});
}

async function put({request, env}) {
  const current = await exigirRol(request, env, ['admin']);
  if (!current) return new Response(JSON.stringify({ok: false, error: 'administrador requerido'}), {status: 403, headers: PRIVATE});
  if (!csrfValido(request, current)) return new Response(JSON.stringify({ok: false, error: 'CSRF inválido'}), {status: 403, headers: PRIVATE});
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) throw new Error('Cuerpo demasiado grande');
    body = JSON.parse(raw);
  } catch (_) {
    return new Response(JSON.stringify({ok: false, error: 'JSON no válido'}), {status: 400, headers: PRIVATE});
  }
  const {doc} = await readFlags(env);
  let next;
  try { next = applyChange(doc, body, current.email); } catch (e) {
    return new Response(JSON.stringify({ok: false, error: e.message}), {status: 400, headers: PRIVATE});
  }
  let storage;
  try { storage = await writeFlags(env, next); } catch (_) {
    return new Response(JSON.stringify({ok: false, error: 'No se pudo guardar el interruptor'}), {status: 503, headers: PRIVATE});
  }
  try {
    const target = body.project ? 'proyecto ' + body.project : 'dominio ' + body.host;
    await auditar(env, current.email, '-', 'avatar-flag', target + ' → ' + JSON.stringify(body.on));
  } catch (_) {}
  return new Response(JSON.stringify({ok: true, v: next.v, updatedAt: next.updatedAt, storage,
    projects: next.projects, hosts: next.hosts}), {headers: PRIVATE});
}

export async function onRequest(context) {
  const m = context.request.method;
  if (m === 'GET' || m === 'HEAD') return get(context);
  if (m === 'OPTIONS') return options();
  if (m === 'PUT') return put(context);
  return new Response(JSON.stringify({ok: false, error: 'Método no permitido'}), {status: 405, headers: {...PUBLIC, allow: 'GET, PUT, OPTIONS'}});
}
