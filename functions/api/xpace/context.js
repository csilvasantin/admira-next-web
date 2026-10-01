import { contextUser,json,preflight } from '../../_xpace-auth.js';
import { projects, commercialCatalog, aclKey } from '../../_xpace-registry.js';
import { proyectoPermitido } from '../../_project-access.js';
export const onRequestOptions=({request})=>preflight(request);
export async function onRequestGet({request,env}) {
 const current=await contextUser(request,env);
 if(!current) return json(request,{ok:false,error:'Conecta con AdmiraNext; la sesión puede haber caducado o sido revocada.'},401);
 const catalog=await commercialCatalog(env), allowed=(await projects(env)).filter(p=>proyectoPermitido(current.project_keys,aclKey(p.id),catalog));
 const keys=new Set(allowed.map(p=>p.id)),venues=(await env.AUTH_DB.prepare('SELECT id,project_id,name,xpace_url FROM admiranext_xpace_venues WHERE enabled=1 ORDER BY name').all()).results.filter(v=>keys.has(v.project_id));
 return json(request,{ok:true,source:'admiranext',user:{display_name:current.display_name},projects:allowed,venues});
}
