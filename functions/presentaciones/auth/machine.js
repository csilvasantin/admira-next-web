/*
 * POST /presentaciones/auth/machine — canje clave de máquina → sesión corta.
 * Cabecera `X-Admira-Machine-Key: amk_…` (o `Authorization: Bearer amk_…`).
 * Responde 200 JSON (o 303 a ?next= si se pide HTML) con la cookie `pres_machine`
 * limitada a /presentaciones y 1 h de vida. Sin clave o con clave mala: 401.
 * El middleware deja pasar esta ruta sin login: es justo lo que viene a conseguir.
 */
import {writeAccessEvent} from '../_access.js';
import {MACHINE_IDENTITY, MACHINE_LEVEL, MACHINE_SESSION_MAXAGE, configuredMachineKey, machineKeyMatches, machineSessionCookie, makeMachineSessionToken, safeNext, suppliedMachineKey} from '../_machine-key.js';

const headersBase = {'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow'};
function json(body, status, extra = {}){
  return new Response(JSON.stringify(body), {status, headers:{...headersBase, 'content-type':'application/json; charset=utf-8', ...extra}});
}

export async function onRequest(context){
  const {request, env} = context;
  if (request.method !== 'POST') return json({error:'Usa POST con la cabecera X-Admira-Machine-Key.'}, 405, {allow:'POST'});
  const url = new URL(request.url);
  const wait = (promise) => { try { context.waitUntil(promise); } catch (_) {} };
  if (!configuredMachineKey(env) || !env.PRES_SIGNING_KEY) return json({error:'Clave de máquina no configurada.'}, 503);
  const supplied = suppliedMachineKey(request);
  if (!supplied || !await machineKeyMatches(env, supplied)) {
    wait(writeAccessEvent(env, request, {type:'machine_key_failed', client:'_generator', presentation:'Generador de presentaciones', access:'denied', path:url.pathname}));
    return json({error:'Clave de máquina ausente o no válida.'}, 401);
  }
  const token = await makeMachineSessionToken(env, env.PRES_SIGNING_KEY);
  const next = safeNext(url.searchParams.get('next'));
  wait(writeAccessEvent(env, request, {type:'machine_session_issued', client:'_generator', presentation:'Generador de presentaciones', identity:MACHINE_IDENTITY, access:MACHINE_LEVEL, path:url.pathname}));
  const cookie = {'set-cookie':machineSessionCookie(token)};
  if ((request.headers.get('Accept') || '').includes('text/html')) {
    return new Response(null, {status:303, headers:{...headersBase, Location:next, ...cookie}});
  }
  return json({ok:true, identity:MACHINE_IDENTITY.email, level:MACHINE_LEVEL, expiresIn:MACHINE_SESSION_MAXAGE, next}, 200, cookie);
}

