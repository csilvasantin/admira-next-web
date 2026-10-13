import {agentSessionFromRequest,agentBrowserCookies,AGENT_BROWSER_MAXAGE} from '../_agent-token.js';
import {writeAccessEvent} from '../_access.js';
import {limitarFrecuencia} from '../../_limite-frecuencia.js';
import {DEVICE_PATH,DEVICE_TTL,DEVICE_COOKIE,DEVICE_INIT_COOKIE,randomSecret,deviceCookie,cookieValue,sameSecret,normalizedCode,createDevice,browserDevice,approveDevice,consumeDevice} from '../_agent-device.js';

const base={'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY'};
const json=(value,status=200,extra={})=>Response.json(value,{status,headers:{...base,...extra}});
function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin;}
function page(csrf,nonce){
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Alsea · acceso de dispositivo</title><style nonce="${nonce}">body{background:#0b1220;color:#eef4ff;font:18px system-ui;max-width:620px;margin:12vh auto;padding:24px}output{display:block;font:700 40px ui-monospace,monospace;letter-spacing:.12em;margin:32px 0}p{line-height:1.5}a{color:#80f0c5}</style><main><h1>Conectar este navegador a Alsea</h1><p>Trinity debe leer y aprobar este código desde la bóveda. El código caduca en cinco minutos y solo inicia sesión en este navegador.</p><output id="device-code" aria-label="Código del dispositivo">Preparando…</output><p id="status" role="status" aria-live="polite">La sesión conservará los permisos actuales y durará una hora.</p><a href="${DEVICE_PATH}">Generar otro código</a></main><script nonce="${nonce}">
const csrf=${JSON.stringify(csrf)},endpoint=${JSON.stringify(DEVICE_PATH)};let deadline=Date.now()+${DEVICE_TTL*1000};
async function call(action){const r=await fetch(endpoint+'?action='+action,{method:'POST',headers:{'Content-Type':'application/json','X-Admira-Device-CSRF':csrf},body:'{}',credentials:'same-origin'});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo conectar.');return d;}
async function poll(){try{if(Date.now()>=deadline)throw Error('El código ha caducado. Genera otro código.');const d=await call('poll');if(d.state==='approved'){const done=await call('consume');location.replace(done.next);return;}setTimeout(poll,2000);}catch(e){document.getElementById('status').textContent=e.message;}}
call('start').then(d=>{document.getElementById('device-code').textContent=d.code;deadline=Date.now()+d.expiresIn*1000;document.getElementById('status').textContent='Esperando la aprobación de Trinity…';poll();}).catch(e=>{document.getElementById('status').textContent=e.message;});
</script></html>`;
}
async function smallJson(request){
  if(!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))throw Error('content-type');
  if(Number(request.headers.get('Content-Length')||0)>512)throw Error('large');
  const text=await request.text();if(text.length>512)throw Error('large');
  const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('body');return value;
}
function audit(context,type,session){
  const event=writeAccessEvent(context.env,context.request,{type,client:'_generator',presentation:'Generador de presentaciones',identity:{name:session.tokenLabel||session.name,email:session.email,visitorId:'anmcp:'+session.tokenId},access:session.level,path:DEVICE_PATH});
  try{context.waitUntil(event);}catch(_){event.catch(()=>{});}
}
export async function onRequest(context){
  const {request,env}=context,url=new URL(request.url),action=url.searchParams.get('action')||'';
  if(!env.AUTH_DB||!env.PRES_SIGNING_KEY)return json({error:'Acceso no disponible.'},503);
  if(request.method==='GET'&&!action){
    const csrf=randomSecret(),nonce=randomSecret();
    return new Response(page(csrf,nonce),{headers:{...base,'content-type':'text/html; charset=utf-8','set-cookie':deviceCookie(DEVICE_INIT_COOKIE,csrf),'content-security-policy':`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`}});
  }
  if(request.method!=='POST')return json({error:'Usa POST.'},405,{Allow:'POST'});
  if(!['start','approve','poll','consume'].includes(action))return json({error:'Acción no válida.'},400);
  // Only Bearer approval works without a browser. Browser requests require
  // both exact Origin and an independent CSRF nonce; no credentials in URLs.
  if(action!=='approve'&&!sameOrigin(request))return json({error:'Origen no permitido.'},403);
  if(action==='approve'&&request.headers.has('Origin')&&!sameOrigin(request))return json({error:'Origen no permitido.'},403);
  let body;try{body=await smallJson(request);}catch(e){return json({error:'Petición no válida.'},e.message==='large'?413:400);}
  try{
    if(action==='approve'){
      const wait=p=>{try{context.waitUntil(p);}catch(_){p.catch(()=>{});}};
      const session=await agentSessionFromRequest(env,request,wait);
      if(!session)return json({error:'Token no válido o sin permiso de edición.'},401);
      const code=normalizedCode(body.code);if(!code)return json({error:'Código no válido.'},400);
      const approved=await approveDevice(env,code,session);
      if(!approved)return json({error:'Código caducado, aprobado o no disponible.'},409);
      audit(context,'agent_device_approved',session);
      return json({ok:true,state:'approved'});
    }
    if(action==='start'){
      const csrf=String(request.headers.get('X-Admira-Device-CSRF')||'');
      if(!sameSecret(csrf,cookieValue(request,DEVICE_INIT_COOKIE)))return json({error:'Desafío de navegador no válido.'},403);
      const rate=await limitarFrecuencia(env,request,{ambito:'agent-device-start',maximo:12,ventanaSeg:600});
      if(!rate.permitido)return json({error:'Demasiados códigos. Reintenta más tarde.'},429,{'retry-after':String(rate.reintentarEn)});
      const created=await createDevice(env,csrf),headers=new Headers(base);
      headers.append('Set-Cookie',created.cookie);headers.append('Set-Cookie',deviceCookie(DEVICE_INIT_COOKIE,'',0));headers.set('Content-Type','application/json');
      return new Response(JSON.stringify({ok:true,code:created.code,expiresIn:DEVICE_TTL}),{headers});
    }
    const device=await browserDevice(env,request);
    if(!device)return json({error:'Este navegador no tiene ese desafío.'},403);
    if(device.expires_at<=Date.now())return json({error:'El código ha caducado. Genera otro código.'},410);
    if(device.consumed_at)return json({error:'Este código ya se utilizó.'},409);
    if(action==='poll')return json({state:device.approved_token_id?'approved':'pending'});
    if(!device.approved_token_id)return json({error:'Falta la aprobación del agente.'},409);
    const result=await consumeDevice(env,device,request);
    if(result.state==='unavailable')return json({error:'Este código ya se utilizó o ha caducado.'},409);
    if(result.state==='denied')return json({error:'El token o sus permisos ya no están vigentes.'},401);
    audit(context,'agent_device_session',result.session);
    const headers=new Headers(base);for(const cookie of agentBrowserCookies(result.token))headers.append('Set-Cookie',cookie);
    headers.append('Set-Cookie',deviceCookie(DEVICE_COOKIE,'',0));headers.set('Content-Type','application/json');
    return new Response(JSON.stringify({ok:true,expiresIn:AGENT_BROWSER_MAXAGE,next:'/pruebas/alsea/?lang=es'}),{headers});
  }catch(_){return json({error:'Acceso no disponible ahora mismo.'},503);}
}
