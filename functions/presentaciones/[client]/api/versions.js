import {listVersions,restoreVersion} from '../../_versions.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function onRequest(context){
  const client=String(context.params.client||'').toLowerCase();if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client))return json({error:'Presentación no válida.'},400);
  if(context.request.method==='GET')return json({versions:await listVersions(context.env,client)});
  if(context.request.method!=='POST')return json({error:'Método no permitido.'},405);
  const origin=context.request.headers.get('origin'),url=new URL(context.request.url);if(!origin||origin!==url.origin)return json({error:'Origen no permitido.'},403);
  let body;try{body=await context.request.json()}catch(_){return json({error:'JSON no válido.'},400)}
  try{const snapshot=await restoreVersion(context.env,client,String(body.id||''));return json({ok:true,id:snapshot.id,versions:await listVersions(context.env,client)})}
  catch(error){return json({error:error.message||'No se pudo restaurar.'},404)}
}
