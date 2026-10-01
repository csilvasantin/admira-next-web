/*
 * GET /marcablanca/api/marcas/<id> · una marca del catálogo único (lectura PÚBLICA), con el esquema
 * de marcablanca/clientes/esquema.json más `catalogo` (origen, tipo, propuesta, web, fechas).
 * Las semillas (clientes/*.json) se sirven siempre, aunque KV no responda.
 */
import {obtenerMarca, json, CORS_LECTURA} from '../../../_catalogo.js';

export async function onRequestGet(context){
  const id = String(context.params.id || '').toLowerCase().replace(/\.json$/, '');
  const marca = await obtenerMarca(context.env, context.request, id);
  if (!marca) return json({error:`La marca «${id.slice(0, 60)}» no está en el catálogo.`}, 404, {...CORS_LECTURA, 'cache-control':'no-store'});
  return json(marca, 200, CORS_LECTURA);
}

export function onRequestOptions(){
  return new Response(null, {status:204, headers:{...CORS_LECTURA, 'access-control-max-age':'86400'}});
}
