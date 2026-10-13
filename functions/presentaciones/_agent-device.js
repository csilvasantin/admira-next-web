// Device sign-in grants no rights of its own: approval uses the existing MCP
// token and completion rechecks the same directory rules as agent browsers.
import {sha256Hex} from '../mcp/_tokens.js';
import {agentBrowserSessionFromRequest,makeAgentBrowserToken,AGENT_BROWSER_COOKIE} from './_agent-token.js';

export const DEVICE_PATH='/presentaciones/auth/device';
export const DEVICE_TTL=300;
export const DEVICE_COOKIE='__Secure-pres_device';
export const DEVICE_INIT_COOKIE='__Secure-pres_device_init';
const READY=new WeakSet();
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SCHEMA=`CREATE TABLE IF NOT EXISTS admiranext_agent_devices (
  id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, browser_hash TEXT NOT NULL,
  csrf_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  approved_token_id TEXT, approved_at INTEGER, consumed_at INTEGER)`;

export function randomSecret(){
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function deviceCookie(name,value,maxAge=DEVICE_TTL){
  return `${name}=${value}; Path=${DEVICE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
export function cookieValue(request,name){
  const values=String(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));
  // Ambiguous cookies fail closed, including cookies planted at another path.
  return values.length===1?values[0].slice(name.length+1):'';
}
export function validSecret(value){return /^[A-Za-z0-9_-]{43}$/.test(value||'');}
export function sameSecret(left,right){
  if(!validSecret(left)||!validSecret(right))return false;
  let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}
export async function ensureDeviceTable(env){
  if(READY.has(env.AUTH_DB))return;
  await env.AUTH_DB.prepare(SCHEMA).run();
  await env.AUTH_DB.prepare('CREATE INDEX IF NOT EXISTS idx_admiranext_agent_devices_expiry ON admiranext_agent_devices(expires_at)').run();
  READY.add(env.AUTH_DB);
}
export function normalizedCode(value){
  const code=String(value||'').trim().toUpperCase().replace(/-/g,'');
  return /^[A-HJ-NP-Z2-9]{10}$/.test(code)?code:'';
}
export async function createDevice(env,csrf,now=Date.now()){
  await ensureDeviceTable(env);
  await env.AUTH_DB.prepare('DELETE FROM admiranext_agent_devices WHERE expires_at<=?').bind(now).run();
  const id=crypto.randomUUID(),browser=randomSecret(),bytes=new Uint8Array(10);crypto.getRandomValues(bytes);
  const code=Array.from(bytes,b=>ALPHABET[b&31]).join('');
  await env.AUTH_DB.prepare('INSERT INTO admiranext_agent_devices(id,code_hash,browser_hash,csrf_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)')
    .bind(id,await sha256Hex(code),await sha256Hex(browser),await sha256Hex(csrf),now,now+DEVICE_TTL*1000).run();
  return {code:code.slice(0,5)+'-'+code.slice(5),cookie:deviceCookie(DEVICE_COOKIE,id+'.'+browser)};
}
export async function browserDevice(env,request){
  const match=/^([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.exec(cookieValue(request,DEVICE_COOKIE));
  const csrf=String(request.headers.get('X-Admira-Device-CSRF')||'');
  if(!match||!validSecret(csrf))return null;
  await ensureDeviceTable(env);
  return env.AUTH_DB.prepare('SELECT * FROM admiranext_agent_devices WHERE id=? AND browser_hash=? AND csrf_hash=?')
    .bind(match[1],await sha256Hex(match[2]),await sha256Hex(csrf)).first();
}
export async function approveDevice(env,code,session,now=Date.now()){
  await ensureDeviceTable(env);
  return env.AUTH_DB.prepare('UPDATE admiranext_agent_devices SET approved_token_id=?,approved_at=? WHERE code_hash=? AND expires_at>? AND consumed_at IS NULL AND approved_token_id IS NULL RETURNING id')
    .bind(session.tokenId,now,await sha256Hex(code),now).first();
}
export async function consumeDevice(env,device,request,now=Date.now()){
  // D1 makes consumption atomic even when two polls/requests race. Invalid or
  // revoked approval is consumed too, then denied, never retried with old rights.
  const consumed=await env.AUTH_DB.prepare('UPDATE admiranext_agent_devices SET consumed_at=? WHERE id=? AND browser_hash=? AND csrf_hash=? AND expires_at>? AND consumed_at IS NULL AND approved_token_id IS NOT NULL RETURNING approved_token_id')
    .bind(now,device.id,device.browser_hash,device.csrf_hash,now).first();
  if(!consumed)return {state:'unavailable'};
  const token=await makeAgentBrowserToken(env,{tokenId:consumed.approved_token_id});
  const candidate=new Request(request.url,{headers:{Cookie:AGENT_BROWSER_COOKIE+'='+token}});
  const session=await agentBrowserSessionFromRequest(env,candidate);
  return session?{state:'complete',token,session}:{state:'denied'};
}
