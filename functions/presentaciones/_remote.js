const SESSION_PREFIX = 'presenter-remote:v1:';
const MIN_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 4 * 60 * 60;
const MAX_BODY_BYTES = 4096;
const MAX_COMMANDS = 32;
const MIN_WRITE_INTERVAL_MS = 100;
const COMMANDS = new Set(['prev', 'next', 'skip', 'timer-toggle', 'timer-reset']);
const PACE_STATES = new Set(['ready', 'on-time', 'ahead', 'behind']);
const enc = new TextEncoder();

export function json(body, status = 200, extraHeaders = {}){
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      ...extraHeaders
    }
  });
}

export function error(code, status, extra = {}){
  return json({error:code, ...extra}, status);
}

export function remoteStore(env){
  return env?.PRESENTATION_IDEAS || null;
}

export function cleanClient(value){
  value = String(value || '').toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(value) ? value : '';
}

export function cleanSessionId(value){
  value = String(value || '');
  return /^[A-Za-z0-9_-]{20,64}$/.test(value) ? value : '';
}

export function sessionKey(client, sessionId){
  return `${SESSION_PREFIX}${client}:${sessionId}`;
}

function b64url(bytes){
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomSecret(byteLength = 32){
  const bytes = new Uint8Array(Math.max(16, byteLength));
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function hashSecret(value){
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(value || '')))));
}

export function constantTimeEqual(a, b){
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export function sameOrigin(request){
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return origin === new URL(request.url).origin; }
  catch (_) { return false; }
}

export function bearer(request){
  const value = request.headers.get('authorization') || '';
  const match = value.match(/^Bearer ([A-Za-z0-9_-]{20,128})$/);
  return match ? match[1] : '';
}

export async function readJson(request){
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return {response:error('too_large', 413)};
  let text = '';
  try { text = await request.text(); }
  catch (_) { return {response:error('bad_request', 400)}; }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return {response:error('too_large', 413)};
  if (!text.trim()) return {value:{}};
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('object required');
    return {value};
  } catch (_) {
    return {response:error('bad_request', 400)};
  }
}

export function onlyKeys(value, allowed){
  return Object.keys(value).every(key => allowed.includes(key));
}

export function integer(value, min, max){
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

export async function loadSession(store, client, sessionId){
  if (!store) return {response:error('storage_unavailable', 503)};
  if (!client || !sessionId) return {response:error('not_found', 404)};
  let value;
  try { value = await store.get(sessionKey(client, sessionId), {type:'json'}); }
  catch (_) { return {response:error('storage_unavailable', 503)}; }
  if (!value || value.schema !== 1 || value.client !== client || value.id !== sessionId) {
    return {response:error('not_found', 404)};
  }
  if (value.revoked) return {response:error('revoked', 410)};
  if (!Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
    return {response:error('expired', 410)};
  }
  return {value};
}

export async function saveSession(store, value){
  const remaining = Math.max(60, Math.ceil((value.expiresAt - Date.now()) / 1000));
  try {
    await store.put(sessionKey(value.client, value.id), JSON.stringify(value), {expirationTtl:remaining});
    return null;
  } catch (_) {
    return error('storage_unavailable', 503);
  }
}

export async function authorize(request, session, role){
  const token = bearer(request);
  if (!token) return false;
  const expected = role === 'stage' ? session.stageTokenHash : session.remoteTokenHash;
  return Boolean(expected) && constantTimeEqual(await hashSecret(token), expected);
}

export function rateLimited(session, bucket, now = Date.now()){
  session.rate = session.rate && typeof session.rate === 'object' ? session.rate : {};
  const last = Number(session.rate[bucket] || 0);
  if (last && now - last < MIN_WRITE_INTERVAL_MS) return true;
  session.rate[bucket] = now;
  return false;
}

export function sessionTtl(value){
  if (value === undefined || value === null || value === '') return MAX_TTL_SECONDS;
  return integer(value, MIN_TTL_SECONDS, MAX_TTL_SECONDS);
}

export function publicState(value){
  if (!value || typeof value !== 'object') return null;
  return {
    seq:value.seq,
    index:value.index,
    count:value.count,
    elapsed:value.elapsed,
    running:value.running,
    paceLabel:value.paceLabel,
    ackCommandSeq:value.ackCommandSeq
  };
}

export function validateState(value){
  if (!onlyKeys(value, ['seq','index','count','elapsed','running','paceLabel','ackCommandSeq'])) return null;
  const seq = integer(value.seq, 1, Number.MAX_SAFE_INTEGER);
  const count = integer(value.count, 1, 10000);
  const index = integer(value.index, 0, count === null ? 0 : count - 1);
  const elapsed = Number(value.elapsed);
  const ackCommandSeq = integer(value.ackCommandSeq, 0, Number.MAX_SAFE_INTEGER);
  if (seq === null || count === null || index === null || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 86400 || typeof value.running !== 'boolean' || !PACE_STATES.has(value.paceLabel) || ackCommandSeq === null) return null;
  return {seq,index,count,elapsed:Math.round(elapsed * 10) / 10,running:value.running,paceLabel:value.paceLabel,ackCommandSeq};
}

export function validateCommand(value){
  if (!onlyKeys(value, ['seq','command','index'])) return null;
  const seq = integer(value.seq, 1, Number.MAX_SAFE_INTEGER);
  if (seq === null || !COMMANDS.has(value.command)) return null;
  if (value.command === 'skip') {
    const index = integer(value.index, 0, 9999);
    if (index === null) return null;
    return {seq,command:value.command,index};
  }
  if (Object.prototype.hasOwnProperty.call(value, 'index')) return null;
  return {seq,command:value.command};
}

export function appendCommand(session, command){
  session.commands = Array.isArray(session.commands) ? session.commands : [];
  session.commands.push(command);
  if (session.commands.length > MAX_COMMANDS) session.commands = session.commands.slice(-MAX_COMMANDS);
}

export function pruneCommands(session, ack){
  session.commands = (Array.isArray(session.commands) ? session.commands : []).filter(command => command.seq > ack);
}
