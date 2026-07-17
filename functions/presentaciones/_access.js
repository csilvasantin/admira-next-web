const enc = new TextEncoder();
const EVENT_TTL = 60 * 60 * 24 * 180;

function b64url(bytes){
  let value = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value){
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

async function hmac(key, message){
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message)));
}

function same(a, b){
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

export function readCookies(request){
  const cookies = {};
  (request.headers.get('Cookie') || '').split(/;\s*/).forEach(part => {
    const split = part.indexOf('=');
    if (split > 0) cookies[part.slice(0, split)] = part.slice(split + 1);
  });
  return cookies;
}

export function cleanIdentity(input = {}){
  const name = String(input.name || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  const email = String(input.email || '').trim().toLowerCase().slice(0, 180);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return {name, email, visitorId:String(input.visitorId || crypto.randomUUID()).slice(0, 80)};
}

export async function makeIdentityToken(signKey, identity, maxAge = EVENT_TTL){
  const clean = cleanIdentity(identity);
  if (!clean) return '';
  const payload = b64url(enc.encode(JSON.stringify({...clean, exp:Math.floor(Date.now() / 1000) + maxAge})));
  return `${payload}.${await hmac(signKey, `identity:${payload}`)}`;
}

export async function readIdentity(request, signKey){
  if (!signKey) return null;
  const token = readCookies(request).pres_identity || '';
  const split = token.lastIndexOf('.');
  if (split < 1) return null;
  const payload = token.slice(0, split);
  const signature = token.slice(split + 1);
  if (!same(signature, await hmac(signKey, `identity:${payload}`))) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!value.exp || value.exp < Math.floor(Date.now() / 1000)) return null;
    return cleanIdentity(value);
  } catch (_) { return null; }
}

export function identityCookie(token, maxAge = EVENT_TTL){
  return `pres_identity=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function safe(value, size = 220){ return String(value == null ? '' : value).slice(0, size); }

export async function writeAccessEvent(env, request, input = {}){
  if (!env.PRESENTATION_IDEAS) return false;
  const now = new Date();
  const timestamp = now.toISOString();
  const reverse = String(9999999999999 - now.getTime()).padStart(13, '0');
  const event = {
    id:crypto.randomUUID(),
    timestamp,
    type:safe(input.type || 'page_view', 40),
    client:safe(input.client || '', 80).toLowerCase(),
    presentation:safe(input.presentation || input.client || '', 140),
    path:safe(input.path || new URL(request.url).pathname, 300),
    language:safe(input.language || '', 12),
    target:safe(input.target || '', 300),
    name:safe(input.identity?.name || '', 100),
    email:safe(input.identity?.email || '', 180),
    visitorId:safe(input.identity?.visitorId || '', 80),
    access:safe(input.access || 'client', 20),
    ip:safe(request.headers.get('CF-Connecting-IP') || '', 64),
    country:safe(request.headers.get('CF-IPCountry') || '', 8),
    city:safe(request.cf?.city || '', 100),
    userAgent:safe(request.headers.get('User-Agent') || '', 260),
    referer:safe(request.headers.get('Referer') || '', 300)
  };
  await env.PRESENTATION_IDEAS.put(`access:event:${reverse}:${event.id}`, JSON.stringify(event), {expirationTtl:EVENT_TTL});
  return true;
}

export async function listAccessEvents(env, options = {}){
  if (!env.PRESENTATION_IDEAS) return [];
  const maximum = Math.min(Math.max(Number(options.limit) || 500, 1), 1000);
  const events = [];
  let cursor;
  do {
    const page = await env.PRESENTATION_IDEAS.list({prefix:'access:event:', limit:Math.min(1000, maximum * 2), cursor});
    const values = await Promise.all(page.keys.map(key => env.PRESENTATION_IDEAS.get(key.name, {type:'json'})));
    for (const value of values) {
      if (!value) continue;
      if (options.client && value.client !== options.client) continue;
      if (options.type && value.type !== options.type) continue;
      if (options.since && value.timestamp < options.since) continue;
      events.push(value);
      if (events.length >= maximum) break;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && events.length < maximum);
  return events.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}
