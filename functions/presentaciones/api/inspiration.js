import {analyzeInspiration} from '../_inspiration.js';
import {ensureHttpsUrl} from '../_defaults.js';

function json(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export async function onRequestPost(context){
  const origin = context.request.headers.get('Origin'); const requestUrl = new URL(context.request.url);
  if (!origin || origin !== requestUrl.origin) return json({error:'Origen no permitido.'}, 403);
  let body; try { body = await context.request.json(); } catch (_) { return json({error:'JSON no válido.'}, 400); }
  try { return json({ok:true, inspiration:await analyzeInspiration(ensureHttpsUrl(body.url))}); }
  catch (error) { return json({error:error.message || 'No se pudo analizar la web inspiradora.'}, 422); }
}
