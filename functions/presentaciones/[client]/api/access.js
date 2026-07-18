import {readIdentity, writeAccessEvent} from '../../_access.js';

function json(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export async function onRequestPost(context){
  if (!context.env.PRESENTATION_IDEAS || !context.env.PRES_SIGNING_KEY) return json({error:'Registro no disponible.'}, 503);
  const identity = await readIdentity(context.request, context.env.PRES_SIGNING_KEY);
  if (!identity) return json({error:'Identidad no confirmada.'}, 401);
  let body = {};
  try { body = await context.request.json(); } catch (_) { return json({error:'JSON no válido.'}, 400); }
  const allowed = new Set(['download','external_link','fullscreen','media_play','language_change','look_change']);
  if (!allowed.has(body.type)) return json({error:'Evento no permitido.'}, 400);
  const client = String(context.params.client || '').toLowerCase().slice(0, 80);
  await writeAccessEvent(context.env, context.request, {
    type:body.type, client, presentation:client, identity, access:'client',
    path:String(body.path || new URL(context.request.url).pathname),
    target:String(body.target || ''), language:String(body.language || ''), detail:String(body.detail || '')
  });
  return json({ok:true}, 201);
}
