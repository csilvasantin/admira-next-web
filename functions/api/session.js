import { sesionCompleta } from '../_webmaster-gate.js';

export async function onRequestGet({request,env}) {
  const current=await sesionCompleta(request,env);
  if(!current)return Response.json({ok:false,error:'acceso restringido'},{status:401,headers:{'cache-control':'no-store'}});
  return Response.json({ok:true,user:{email:current.email,display_name:current.display_name,role:current.role,project_keys:current.project_keys},csrf:current.csrf},{headers:{'cache-control':'no-store'}});
}
