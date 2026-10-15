import { asegurarDirectorio, buscarUsuario } from '../../../_webmaster-gate.js';
import { appAllowed } from '../../../_xpace-auth.js';
import { ensureRegistry, commercialCatalog, aclKey, DEMOS } from '../../../_xpace-registry.js';
import { proyectoPermitido } from '../../../_project-access.js';
import { PLAYLIST_PERMISSION_RELEASE, playlistServiceAuthorized, validPlaylistScope, validPlaylistContext, issuePlaylistGrant } from '../../../_xpace-playlist-grant.js';

const response = (body, status = 200) => Response.json(body, { status, headers: {
  'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow',
} });

export function playlistRenderer(venue, project) {
  try {
    const url = new URL(venue.xpace_url);
    if (!['https://www.admira.store', 'https://admira.store', 'https://www.xpaceos.com', 'https://xpaceos.com'].includes(url.origin)) return null;
    if (url.pathname === '/xpacios/sneakerstore/') return 'sneakers-store';
    const scene = url.searchParams.get('autostart');
    if (project.id === 'starbucks' && (!scene || scene === 'cafeteria')) return 'starbucks';
    return ({ xtanco: 'xtanco', cafeteria: 'cafeteria', office: 'office', oficina: 'office', lab: 'lab', laboratorio: 'lab' })[scene] || null;
  } catch { return null; }
}

function canonicalVenueUrl(venue, project, scope) {
  const url = new URL(venue.xpace_url);
  if (!['https://www.admira.store', 'https://admira.store', 'https://www.xpaceos.com', 'https://xpaceos.com'].includes(url.origin)) throw Error('invalid_venue_url');
  url.hostname = 'www.admira.store';
  url.searchParams.set('project', project.id);
  url.searchParams.set('loc', scope.venueId);
  url.searchParams.set('circuit', project.circuit);
  return url.href;
}

export async function onRequestPost({ request, env }) {
  if (!await playlistServiceAuthorized(request, env)) return response({ ok: false, error: 'playlist_service_required' }, 401);
  if (!env.AUTH_DB || !env.XPACE_PLAYLIST_GRANT_SECRET || env.XPACE_PLAYLIST_GRANT_SECRET.length < 32) return response({ ok: false, error: 'playlist_permission_unavailable' }, 503);
  let body;
  try {
    if (Number(request.headers.get('Content-Length') || 0) > 2048) return response({ ok: false, error: 'invalid_request' }, 400);
    const text = await request.text();
    if (text.length > 2048) return response({ ok: false, error: 'invalid_request' }, 400);
    body = JSON.parse(text);
  } catch { return response({ ok: false, error: 'invalid_request' }, 400); }
  if (!body || Array.isArray(body) || Object.keys(body).some(k => !['email', 'projectId', 'venueId', 'channelId'].includes(k)) ||
      typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+$/.test(body.email)) return response({ ok: false, error: 'invalid_request' }, 400);
  const scope = { projectId: body.projectId, venueId: body.venueId, channelId: body.channelId };
  if (!validPlaylistScope(scope)) return response({ ok: false, error: 'invalid_scope' }, 400);
  if (scope.projectId === 'starbucks' && scope.venueId === 'demo-starbucks') scope.venueId = 'alsea-sbux-021';
  try {
    await asegurarDirectorio(env);
    await ensureRegistry(env);
    const email = body.email.trim().toLowerCase(), user = await buscarUsuario(env, email);
    if (!user || !await appAllowed(env, email)) return response({ ok: false, error: 'playlist_access_denied' }, 403);
    const permissions = (await env.AUTH_DB.prepare('SELECT project_key FROM admiranext_user_projects WHERE user_email=? ORDER BY project_key').bind(user.email).all()).results || [];
    if (!proyectoPermitido(permissions.map(p => p.project_key), aclKey(scope.projectId), await commercialCatalog(env))) return response({ ok: false, error: 'playlist_access_denied' }, 403);
    const project = await env.AUTH_DB.prepare('SELECT id,name,circuit FROM admiranext_commercial_projects WHERE id=?').bind(scope.projectId).first();
    let venue = await env.AUTH_DB.prepare('SELECT id,project_id,name,xpace_url,enabled FROM admiranext_xpace_venues WHERE id=?').bind(scope.venueId).first();
    if (!venue) venue = DEMOS.find(v => v.id === scope.venueId);
    if (!project || !venue || venue.enabled === 0 || venue.project_id !== project.id) return response({ ok: false, error: 'playlist_venue_unavailable' }, 404);
    const editable = ['admin', 'editor'].includes(user.role);
    const operations = editable ? ['read', 'add', 'remove'] : ['read'];
    const context = { renderer: playlistRenderer(venue, project), xpaceUrl: canonicalVenueUrl(venue, project, scope), venueName: venue.name, circuitId: project.circuit };
    if (!validPlaylistContext(context)) return response({ ok: false, error: 'playlist_venue_unavailable' }, 404);
    const issued = await issuePlaylistGrant({ secret: env.XPACE_PLAYLIST_GRANT_SECRET, subject: user.email, scope, context, operations, sessionVersion: Number(user.session_version) });
    return response({ ok: true, serviceVersion: PLAYLIST_PERMISSION_RELEASE, scope, project, venue: { id: venue.id, name: venue.name, xpace_url: context.xpaceUrl },
      renderer: context.renderer, capabilities: { read: true, add: editable, remove: editable },
      grant: issued.grant, expiresAt: issued.expiresAt });
  } catch { return response({ ok: false, error: 'playlist_permission_unavailable' }, 503); }
}
