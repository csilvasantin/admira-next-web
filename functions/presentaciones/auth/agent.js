import {agentSessionFromRequest,makeAgentBrowserToken,agentBrowserCookies} from '../_agent-token.js';
import {writeAccessEvent} from '../_access.js';

const base={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer'};
const page='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Generador · entrada de agentes</title><style>body{background:#0b1220;color:#eef4ff;font:16px system-ui;max-width:480px;margin:12vh auto;padding:24px}input,button{box-sizing:border-box;display:block;width:100%;padding:12px;margin:12px 0;background:#13213a;color:inherit;border:1px solid #53759b;border-radius:6px}</style><main><h1>Entrada de agentes</h1><p>Usa el token MCP existente de tu bóveda. La sesión dura una hora y conserva los permisos actuales del generador.</p><form method="post" action="/presentaciones/auth/agent" autocomplete="off"><label for="token">Token MCP</label><input id="token" name="token" type="password" required maxlength="200"><button>Entrar en Alsea</button></form></main></html>';
export async function onRequest(context){
  const {request,env}=context;
  if(request.method==='GET')return new Response(page,{headers:{...base,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
  const json=(value,status)=>Response.json(value,{status,headers:base});
  if(request.method!=='POST')return json({error:'Usa POST.'},405);
  if(!env.PRES_SIGNING_KEY || !env.AUTH_DB)return json({error:'Acceso no disponible.'},503);
  const origin=request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
  const bearer=request.headers.get('Authorization');
  let candidate=request;
  if(!bearer){
    if(!origin)return json({error:'Origen no permitido.'},403);
    if(Number(request.headers.get('Content-Length')||0)>2048)return json({error:'Petición demasiado grande.'},413);
    const raw=await request.text();if(raw.length>2048)return json({error:'Petición demasiado grande.'},413);
    const token=new URLSearchParams(raw).get('token')||'';
    candidate=new Request(request.url,{headers:{Authorization:'Bearer '+token}});
  }
  const wait=p=>{try{context.waitUntil(p);}catch(_){}};
  const session=await agentSessionFromRequest(env,candidate,wait);
  if(!session)return json({error:'Token no válido o sin permiso de edición.'},401);
  const token=await makeAgentBrowserToken(env,session),headers=new Headers(base);
  for(const cookie of agentBrowserCookies(token))headers.append('Set-Cookie',cookie);
  wait(writeAccessEvent(env,request,{type:'agent_browser_session',client:'_generator',presentation:'Generador de presentaciones',identity:{name:session.tokenLabel||session.name,email:session.email,visitorId:'anmcp:'+session.tokenId},access:session.level,path:new URL(request.url).pathname}));
  if(!bearer){headers.set('Location','/pruebas/alsea/');return new Response(null,{status:303,headers});}
  headers.set('content-type','application/json');
  return new Response(JSON.stringify({ok:true,level:session.level,expiresIn:3600,next:'/pruebas/alsea/'}),{headers});
}
