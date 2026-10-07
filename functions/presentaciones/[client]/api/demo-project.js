import {normalizarDemoProject} from '../../_demo-documentation.js';
import {captureVersion} from '../../_versions.js';

const MAX_BYTES = 256 * 1024;
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});

// Edit the captured demo catalogue without regenerating the original presentation.
export async function onRequest(context) {
  const client = String(context.params.client || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client)) return json({error:'Presentación no válida.'}, 400);
  if (!context.env.PRESENTATION_IDEAS) return json({error:'Almacenamiento no configurado.'}, 503);
  const key = `presentation:${client}`;
  const presentation = await context.env.PRESENTATION_IDEAS.get(key, {type:'json'});
  if (!presentation) return json({error:'Presentación no encontrada.'}, 404);
  if (context.request.method === 'GET') return json({ok:true, demoProject:presentation.demoProject || null, updatedAt:presentation.updatedAt || ''});
  if (context.request.method !== 'PUT') return json({error:'Método no permitido.'}, 405);
  if (context.data?.presentationAccess?.canGenerate !== true) return json({error:'Se requiere acceso de edición.'}, 403);
  const origin = context.request.headers.get('origin');
  if (!origin || origin !== new URL(context.request.url).origin) return json({error:'Origen no permitido.'}, 403);
  if (Number(context.request.headers.get('content-length') || 0) > MAX_BYTES) return json({error:'Catálogo demasiado grande.'}, 413);
  let text;
  try { text = await context.request.text(); } catch (_) { return json({error:'No se pudo leer el catálogo.'}, 400); }
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) return json({error:'Catálogo demasiado grande.'}, 413);
  let body;
  try { body = JSON.parse(text); } catch (_) { return json({error:'JSON no válido.'}, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['demoProject','expectedUpdatedAt'].includes(key)) || !Object.hasOwn(body,'demoProject')) return json({error:'Envía demoProject y expectedUpdatedAt.'}, 400);
  if (typeof body.expectedUpdatedAt !== 'string' || body.expectedUpdatedAt.length > 80) return json({error:'expectedUpdatedAt es obligatorio y debe ser una cadena válida.'}, 400);
  if (body.expectedUpdatedAt !== (presentation.updatedAt || '')) return json({error:'La presentación ha cambiado. Recarga antes de actualizar.', updatedAt:presentation.updatedAt || ''}, 409);
  let demoProject;
  try { demoProject = normalizarDemoProject(body.demoProject, {slug:client,displayName:presentation.displayName,marca:presentation.prospect?.marca}); }
  catch (error) { return json({error:error.message || 'Proyecto de demos no válido.'}, 400); }
  await captureVersion(context.env, client, 'copia antes de actualizar el catálogo de demos');
  // KV has no atomic compare-and-set; reread after the backup to catch intervening edits.
  const current = await context.env.PRESENTATION_IDEAS.get(key, {type:'json'});
  if (!current || body.expectedUpdatedAt !== (current.updatedAt || '')) return json({error:'La presentación ha cambiado. Recarga antes de actualizar.', updatedAt:current?.updatedAt || ''}, 409);
  const updated = {...current, demoProject, updatedAt:new Date().toISOString()};
  await context.env.PRESENTATION_IDEAS.put(key, JSON.stringify(updated));
  await captureVersion(context.env, client, 'catálogo de demos actualizado', {presentation:updated});
  return json({ok:true,demoProject,updatedAt:updated.updatedAt});
}
