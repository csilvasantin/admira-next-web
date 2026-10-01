/*
 * GET /marcablanca/api/marcas · catálogo único de marcas (lectura PÚBLICA).
 *   → {porDefecto, plataformas, dominios, clientes:[{id,nombre,sector,ejemplo,catalogo}], fuente, degradado}
 *     (mismo formato que clientes/index.json, así que marcablanca.js lo usa como índice)
 *   ?completo=1 añade `marcas`: cada marca entera (panel prospect del generador).
 * Escribir NO se hace aquí: la sesión del generador vive en /presentaciones (cookie con esa ruta),
 * así que crear o actualizar pasa por POST|PUT /presentaciones/api/marcas, detrás de su puerta.
 */
import {listarMarcas, json, CORS_LECTURA} from '../../_catalogo.js';

export async function onRequestGet(context){
  const completo = new URL(context.request.url).searchParams.get('completo') === '1';
  const lista = await listarMarcas(context.env, context.request, {completo});
  return json({ok:true, ...lista}, 200, CORS_LECTURA);
}

export function onRequestOptions(){
  return new Response(null, {status:204, headers:{...CORS_LECTURA, 'access-control-max-age':'86400'}});
}

function soloLectura(){
  return json({error:'El catálogo es de solo lectura aquí. Para guardar una marca hace falta entrar en el generador de presentaciones: POST /presentaciones/api/marcas.', escritura:'/presentaciones/api/marcas', acceso:'/presentaciones/'}, 405, {allow:'GET, OPTIONS', 'cache-control':'no-store'});
}
export const onRequestPost = soloLectura;
export const onRequestPut = soloLectura;
export const onRequestDelete = soloLectura;
