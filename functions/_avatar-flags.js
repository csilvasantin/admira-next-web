/*
 * Interruptor del avatar digital por proyecto (encargo avatar · 4-oct-2026).
 *
 * Fuente única: KV AVATAR_FLAGS, clave «flags». Si el binding no existe se usa el
 * KV que ya estaba enlazado (PRESENTATION_IDEAS) con la clave «avatar:flags».
 *
 * Documento guardado:
 *   {v, updatedAt, by, projects:{<clave>:{on}}, hosts:{<host>:{on}}}
 * «hosts» es la excepción opcional por dominio (p. ej. clearchannel.tv y admira.biz
 * comparten proyecto pero pueden diferir). Precedencia en el servidor:
 *   hosts[host] > projects[clave] > apagado.
 * La preferencia de cada usuario (/avatarON, /avatarOFF) vive en su navegador y
 * gana a todo esto: la resuelve assets/avatar.js.
 */

// Proyectos con interruptor. Todos nacen apagados.
export const AVATAR_PROJECTS = [
  'admiranext', 'pixeria', 'admira-studio', 'xpaceos', 'admira-store',
  'admira-tv', 'clearchannel-tv', 'admira-biz', 'admira-app', 'yokup',
];

// Dominio → proyecto. El apex y el www de cada sitio.
export const AVATAR_HOSTS = Object.freeze({
  'admiranext.com': 'admiranext', 'www.admiranext.com': 'admiranext',
  'pixeria.com': 'pixeria', 'www.pixeria.com': 'pixeria',
  'admira.studio': 'admira-studio', 'www.admira.studio': 'admira-studio',
  'xpaceos.com': 'xpaceos', 'www.xpaceos.com': 'xpaceos',
  'admira.store': 'admira-store', 'www.admira.store': 'admira-store',
  'admira.tv': 'admira-tv', 'www.admira.tv': 'admira-tv',
  'clearchannel.tv': 'clearchannel-tv', 'www.clearchannel.tv': 'clearchannel-tv',
  'admira.biz': 'admira-biz', 'www.admira.biz': 'admira-biz',
  'admira.app': 'admira-app', 'www.admira.app': 'admira-app',
  'yokup.com': 'yokup', 'www.yokup.com': 'yokup',
});

export function normalHost(value) {
  const h = String(value || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  return /^[a-z0-9.-]{1,253}$/.test(h) ? h : '';
}

export function emptyFlags() {
  return {v: 0, updatedAt: null, by: null,
    projects: Object.fromEntries(AVATAR_PROJECTS.map((k) => [k, {on: false}])), hosts: {}};
}

// Limpia lo que venga del KV: solo claves conocidas y booleanos.
export function sanitize(doc) {
  const base = emptyFlags();
  if (!doc || typeof doc !== 'object') return base;
  base.v = Number.isFinite(Number(doc.v)) ? Number(doc.v) : 0;
  base.updatedAt = typeof doc.updatedAt === 'string' ? doc.updatedAt.slice(0, 40) : null;
  base.by = typeof doc.by === 'string' ? doc.by.slice(0, 254) : null;
  for (const k of AVATAR_PROJECTS) base.projects[k] = {on: !!(doc.projects && doc.projects[k] && doc.projects[k].on === true)};
  for (const [h, val] of Object.entries((doc && doc.hosts) || {})) {
    const host = normalHost(h);
    if (host && AVATAR_HOSTS[host] && val && typeof val.on === 'boolean') base.hosts[host] = {on: val.on};
  }
  return base;
}

export function stateForHost(doc, hostValue) {
  const host = normalHost(hostValue);
  const project = AVATAR_HOSTS[host] || null;
  if (!project) return {host, project: null, on: false, source: 'desconocido'};
  if (doc.hosts[host]) return {host, project, on: doc.hosts[host].on, source: 'dominio'};
  return {host, project, on: !!doc.projects[project].on, source: 'proyecto'};
}

// {project, on} | {host, on} | {host, on:null} (quita la excepción) → documento nuevo
export function applyChange(doc, change, actor, now = new Date()) {
  const next = sanitize(doc);
  if (!change || typeof change !== 'object') throw new Error('Cuerpo no válido');
  if (change.project != null) {
    if (!AVATAR_PROJECTS.includes(change.project)) throw new Error('Proyecto desconocido');
    if (typeof change.on !== 'boolean') throw new Error('on debe ser true o false');
    next.projects[change.project] = {on: change.on};
  } else if (change.host != null) {
    const host = normalHost(change.host);
    if (!AVATAR_HOSTS[host]) throw new Error('Dominio desconocido');
    if (change.on === null) delete next.hosts[host];
    else if (typeof change.on === 'boolean') next.hosts[host] = {on: change.on};
    else throw new Error('on debe ser true, false o null');
  } else {
    throw new Error('Falta project o host');
  }
  next.v = (next.v || 0) + 1;
  next.updatedAt = now.toISOString();
  next.by = String(actor || '').slice(0, 254) || null;
  return next;
}

export function storage(env) {
  if (env && env.AVATAR_FLAGS) return {kv: env.AVATAR_FLAGS, key: 'flags', name: 'AVATAR_FLAGS'};
  if (env && env.PRESENTATION_IDEAS) return {kv: env.PRESENTATION_IDEAS, key: 'avatar:flags', name: 'PRESENTATION_IDEAS'};
  return null;
}

export async function readFlags(env) {
  const s = storage(env);
  if (!s) return {doc: emptyFlags(), storage: 'none'};
  try {
    const raw = await s.kv.get(s.key);
    return {doc: sanitize(raw ? JSON.parse(raw) : null), storage: s.name};
  } catch (_) {
    return {doc: emptyFlags(), storage: s.name};
  }
}

export async function writeFlags(env, doc) {
  const s = storage(env);
  if (!s) throw new Error('Sin almacenamiento');
  await s.kv.put(s.key, JSON.stringify(doc));
  return s.name;
}
