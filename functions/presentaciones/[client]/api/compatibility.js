import {applyCompatibilityReport,publicCompatibilityLab} from '../../_compatibility-lab.js';
import {captureVersion} from '../../_versions.js';

const MAX_BODY_BYTES=64*1024;
const encoder=new TextEncoder();

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store, must-revalidate','x-content-type-options':'nosniff'
  }});
}
function validClient(value){
  const client=String(value||'').toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(client)?client:'';
}

export async function onRequest(context){
  if(!context.env.PRESENTATION_IDEAS)return json({error:'Almacenamiento no configurado.'},503);
  const client=validClient(context.params.client);
  if(!client)return json({error:'Presentación no válida.'},400);
  const key=`presentation:${client}`;
  const presentation=await context.env.PRESENTATION_IDEAS.get(key,{type:'json'});
  if(!presentation)return json({error:'Presentación no encontrada.'},404);
  if(context.request.method==='GET'){
    if(!presentation.compatibilityLab)return json({error:'Esta presentación todavía no tiene laboratorio de compatibilidad.',compatibility:null},404);
    return json({ok:true,compatibility:publicCompatibilityLab(presentation.compatibilityLab)});
  }
  if(context.request.method!=='PUT')return json({error:'Método no permitido.'},405);
  const origin=context.request.headers.get('origin'),url=new URL(context.request.url);
  if(!origin||origin!==url.origin)return json({error:'Origen no permitido.'},403);
  if(Number(context.request.headers.get('content-length')||0)>MAX_BODY_BYTES)return json({error:'Informe demasiado grande.'},413);
  let raw;try{raw=await context.request.text()}catch(_){return json({error:'No se pudo leer el informe.'},400)}
  if(encoder.encode(raw).byteLength>MAX_BODY_BYTES)return json({error:'Informe demasiado grande.'},413);
  let payload;try{payload=JSON.parse(raw)}catch(_){return json({error:'JSON no válido.'},400)}
  if(!presentation.compatibilityLab)return json({error:'Regenera la presentación para crear un contrato de compatibilidad antes de informar ejecuciones.'},409);
  let compatibility;
  try{compatibility=applyCompatibilityReport(presentation.compatibilityLab,payload)}
  catch(error){return json({error:error.message||'Informe de compatibilidad no válido.'},400)}
  presentation.compatibilityLab=compatibility;
  presentation.updatedAt=new Date().toISOString();
  await context.env.PRESENTATION_IDEAS.put(key,JSON.stringify(presentation));
  await captureVersion(context.env,client,`compatibilidad ${payload.target||'destino'} actualizada`,{presentation});
  return json({ok:true,compatibility:publicCompatibilityLab(compatibility)});
}
