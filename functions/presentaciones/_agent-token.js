/*
 * DeepAgents como editores del Generador (Carlos, 27-09-2026 · «Todos los deepagents
 * tienen que poder ser editores, arréglalo»).
 *
 * Neo, Morfeo, Trinity, Oráculo, Smith y el Arquitecto no tienen la cookie de Google de
 * una persona: trabajan con su token MCP `anmcp_…` (/usuarios → Tokens MCP). Hasta hoy ese
 * token sólo servía a través de /mcp, que no tiene todas las acciones (p. ej. la biblioteca
 * multimedia), y una llamada directa a /presentaciones/api/* contestaba 401.
 *
 * Aquí el mismo token, enviado como `Authorization: Bearer anmcp_…`, se convierte en una
 * sesión de directorio con EXACTAMENTE las reglas de /mcp:
 *   - el token existe y no está revocado (se guarda sólo su hash);
 *   - su usuario está activo, tiene el proyecto del generador y un rol;
 *   - sólo los niveles owner/editor cuentan como sesión (viewer no edita nada).
 * No hay lista nueva de correos ni secretos nuevos: dar de baja o revocar desde /usuarios
 * corta al agente en la siguiente petición. Un Bearer no lo adjunta el navegador por su
 * cuenta, así que no abre ninguna vía CSRF.
 */

import { bearerOf, tokenRow } from '../mcp/_tokens.js';
import { generatorAccess } from './_directory.js';

export const AGENT_TOKEN_PREFIX = 'anmcp_';
const AGENT_LEVELS = new Set(['owner', 'editor']);

export async function agentSessionFromRequest(env, request, waitUntil){
  const token = bearerOf(request);
  if (!token || !token.startsWith(AGENT_TOKEN_PREFIX) || token.length > 200) return null;
  let row = null;
  try { row = await tokenRow(env, token, waitUntil); } catch (_) { row = null; }
  if (!row) return null;
  let access = null;
  try { access = await generatorAccess(env, { email: row.email }); } catch (_) { access = null; }
  if (!access || !AGENT_LEVELS.has(access.level)) return null;
  return { level: access.level, email: access.email, name: access.name, tokenId: String(row.id || ''), tokenLabel: String(row.label || ''), source: 'agent-token' };
}

// Short browser sessions reuse an existing MCP token's current directory rights.
// Only its ID is signed; the original credential never becomes a cookie.
export const AGENT_BROWSER_COOKIE = 'pres_agent';
export const AGENT_LAUNCH_COOKIE = 'alsea_agent';
export const AGENT_BROWSER_MAXAGE = 3600;
const encoder = new TextEncoder();
async function browserSignature(key, body){
  const signing = await crypto.subtle.importKey('raw', encoder.encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', signing, encoder.encode('_agent-browser:'+body));
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function equal(left,right){
  if(left.length!==right.length)return false;
  let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
export async function makeAgentBrowserToken(env, session){
  if(!env.PRES_SIGNING_KEY || !/^[a-zA-Z0-9-]{1,100}$/.test(session?.tokenId||''))throw Error('Agent session unavailable');
  const body=Math.floor(Date.now()/1000+AGENT_BROWSER_MAXAGE)+'.'+session.tokenId;
  return body+'.'+await browserSignature(env.PRES_SIGNING_KEY,body);
}
export function agentBrowserCookies(token){
  const attributes='; Max-Age='+AGENT_BROWSER_MAXAGE+'; HttpOnly; Secure; SameSite=Lax';
  return [AGENT_BROWSER_COOKIE+'='+token+'; Path=/presentaciones'+attributes,
    AGENT_LAUNCH_COOKIE+'='+token+'; Path=/pruebas/alsea'+attributes];
}
export async function agentBrowserSessionFromRequest(env, request, name=AGENT_BROWSER_COOKIE){
  if(!env.PRES_SIGNING_KEY || !env.AUTH_DB)return null;
  const cookie=String(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));
  const match=cookie&&/^(\d+)\.([a-zA-Z0-9-]{1,100})\.([a-zA-Z0-9_-]{43})$/.exec(cookie.slice(name.length+1));
  if(!match)return null;
  const [,exp,id,signature]=match,now=Math.floor(Date.now()/1000);
  if(Number(exp)<=now || Number(exp)>now+AGENT_BROWSER_MAXAGE)return null;
  if(!equal(signature,await browserSignature(env.PRES_SIGNING_KEY,exp+'.'+id)))return null;
  try{
    const row=await env.AUTH_DB.prepare('SELECT id,email,label,revoked_at FROM admiranext_mcp_tokens WHERE id=?').bind(id).first();
    if(!row || row.revoked_at)return null;
    const access=await generatorAccess(env,{email:row.email});
    if(!access || !AGENT_LEVELS.has(access.level))return null;
    return {...access,tokenId:id,tokenLabel:String(row.label||''),source:'agent-browser'};
  }catch(_){return null;}
}
