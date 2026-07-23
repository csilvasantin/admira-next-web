import {cleanIdentity,identityCookie,makeIdentityToken,readCookies} from '../presentaciones/_access.js';
const enc=new TextEncoder(),MAXAGE=60*60*24*30;
function b64url(buf){return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function hmac(key,message){const cryptoKey=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',cryptoKey,enc.encode(message)))}
function ctEq(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;let result=0;for(let index=0;index<a.length;index++)result|=a.charCodeAt(index)^b.charCodeAt(index);return result===0}
async function validToken(key,slug,token){if(!token)return false;const dot=token.indexOf('.'),exp=parseInt(token.slice(0,dot),10);return dot>0&&exp>Math.floor(Date.now()/1000)&&ctEq(token.slice(dot+1),await hmac(key,`${slug}:${exp}`))}
async function makeToken(key,slug,exp){return `${exp}.${await hmac(key,`${slug}:${exp}`)}`}
function esc(value){return String(value||'').replace(/[<>&"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[char]))}
function login(path,message=''){
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Acceso · Presites</title><style>:root{--bg:#05090d;--panel:#09151e;--line:#173640;--ink:#eef5f8;--mut:#82a1ad;--cyan:#65e9f4;--green:#3df08a}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(70% 60% at 90% 0%,rgba(101,233,244,.12),transparent 60%),var(--bg);color:var(--ink);font-family:-apple-system,"Segoe UI",sans-serif}.box{width:min(440px,100%);padding:32px;border:1px solid var(--line);background:var(--panel)}small{color:var(--cyan);font:800 10px/1 ui-monospace,monospace;letter-spacing:.15em;text-transform:uppercase}h1{font-size:34px;line-height:1;margin:18px 0 10px}p{color:var(--mut)}label{display:block;margin:14px 0 7px;color:var(--mut);font:800 9px/1 ui-monospace,monospace;text-transform:uppercase}input{width:100%;padding:12px;border:1px solid var(--line);background:#061018;color:var(--ink)}button{width:100%;margin-top:18px;padding:13px;border:0;background:var(--green);color:#041014;font-weight:900;cursor:pointer}.error{color:#ff7a7a;font:700 11px/1.5 ui-monospace,monospace}</style></head><body><form class="box" method="post" action="${esc(path)}"><small>ADmiraNeXT · Workspace interno</small><h1>Generador de Presites</h1><p>Identifícate para entrar al estudio y conservar la trazabilidad editorial.</p><label>Nombre</label><input name="name" autocomplete="name" required><label>Correo</label><input name="email" type="email" autocomplete="email" required><label>Contraseña interna</label><input name="password" type="password" autocomplete="current-password" required>${message?`<p class="error">${esc(message)}</p>`:''}<button>Entrar al workspace</button></form></body></html>`,{status:401,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
export async function onRequest(context){
  const {request,env,next}=context,url=new URL(request.url),key=env.PRES_SIGNING_KEY;
  if(!key||(!env.PRES_ADMIN&&!env.PRES_EDITOR))return login(url.pathname+url.search,'Acceso interno no configurado.');
  const cookies=readCookies(request),authorized=await Promise.all([validToken(key,'_master',cookies.pres_master),validToken(key,'_editor',cookies.pres_editor)]).then(values=>values.some(Boolean));
  const contentType=request.headers.get('content-type')||'';
  if(request.method==='POST'&&/application\/x-www-form-urlencoded|multipart\/form-data/i.test(contentType)){
    let form;try{form=await request.formData()}catch(_){form=new FormData()}
    const identity=cleanIdentity({name:form.get('name'),email:form.get('email')}),password=String(form.get('password')||'');
    if(!identity)return login(url.pathname+url.search,'Indica un nombre y un correo válidos.');
    const master=env.PRES_ADMIN&&ctEq(password,env.PRES_ADMIN),editor=env.PRES_EDITOR&&ctEq(password,env.PRES_EDITOR);
    if(!master&&!editor)return login(url.pathname+url.search,'Esta zona requiere acceso interno de Admira.');
    const exp=Math.floor(Date.now()/1000)+MAXAGE,slug=master?'_master':'_editor',cookie=master?'pres_master':'pres_editor';
    const [token,identityToken]=await Promise.all([makeToken(key,slug,exp),makeIdentityToken(key,identity)]);
    const headers=new Headers({location:url.pathname+url.search,'cache-control':'no-store'});
    headers.append('set-cookie',`${cookie}=${token}; Path=/; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`);
    headers.append('set-cookie',identityCookie(identityToken));
    return new Response(null,{status:303,headers});
  }
  if(!authorized)return login(url.pathname+url.search);
  const response=await next(),headers=new Headers(response.headers);headers.set('cache-control','no-store');headers.set('x-robots-tag','noindex, nofollow');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
