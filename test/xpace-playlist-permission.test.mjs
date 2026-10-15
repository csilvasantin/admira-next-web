import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { asegurarDirectorio } from '../functions/_webmaster-gate.js';
import { ensureRegistry } from '../functions/_xpace-registry.js';
import { issueAccess } from '../functions/_xpace-auth.js';
import { PLAYLIST_PERMISSION_PATH as path, issuePlaylistGrant, verifyPlaylistGrant, validPlaylistScope } from '../functions/_xpace-playlist-grant.js';
import { onRequestPost as permission } from '../functions/pruebas/api/xpace/playlist-permission.js';
import { onRequest as perimeter } from '../functions/pruebas/_middleware.js';

class Statement {
  constructor(statement) { this.statement = statement; this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return this.statement.get(...this.values) || null; }
  all() { return { results: this.statement.all(...this.values) }; }
  run() { return { success: true, meta: this.statement.run(...this.values) }; }
}
class D1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.db.prepare(sql)); }
  async batch(statements) { return statements.map(statement => statement.run()); }
}
const origin = 'https://www.admira.store';
const serviceKey = 'test-service-key-for-playlist-349-not-production';
const signingKey = 'test-signing-key-for-playlist-349-not-production';
const scope = { projectId: 'starbucks', venueId: 'alsea-sbux-021', channelId: 'music' };
const subject = 'csilva@admira.com';
const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-Admira-Playlist-Service-Key': serviceKey };
const request = (body = {}, patch = {}) => new Request('https://www.admiranext.com' + path, {
  method: 'POST', headers: { ...headers, ...patch }, body: JSON.stringify({ email: subject, ...scope, ...body }),
});
async function setup() {
  const env = { AUTH_DB: new D1(), WEBMASTER_SIGNING_KEY: 'test-directory-signing-key', XPACE_PLAYLIST_SERVICE_KEY: serviceKey, XPACE_PLAYLIST_GRANT_SECRET: signingKey };
  await asegurarDirectorio(env); await ensureRegistry(env); return env;
}
async function result(env, body = {}, patch = {}) {
  const response = await permission({ request: request(body, patch), env });
  return { response, body: await response.json() };
}
async function user(env, email, role, keys, kind = 'team') {
  env.AUTH_DB.prepare("INSERT INTO admiranext_users(email,display_name,role,status,session_version,created_at,updated_at,account_kind) VALUES(?,?,?,'active',1,1,1,?)").bind(email, 'Test', role, kind).run();
  for (const key of keys) env.AUTH_DB.prepare('INSERT INTO admiranext_user_projects VALUES(?,?,1,?)').bind(email, key, 'test').run();
}
async function venue(env, id, projectId, scene = 'cafeteria', enabled = 1) {
  env.AUTH_DB.prepare('INSERT INTO admiranext_xpace_venues VALUES(?,?,?,?,?,1,?)').bind(id, projectId, 'QA ' + id, 'https://www.admira.store/admira-xp/?autostart=' + scene, enabled, 'test').run();
}

test('internal grant uses current commercial ACL and signs an exact venue/channel plus trusted context', async () => {
  const env = await setup(), { response, body } = await result(env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(body.scope, scope);
  assert.deepEqual(body.capabilities, { read: true, add: true, remove: true });
  const claims = await verifyPlaylistGrant(body.grant, signingKey, { scope, operation: 'remove' });
  assert.equal(claims.sub, subject);
  assert.equal(claims.exp - claims.iat, 60);
  assert.equal(claims.context.renderer, 'starbucks');
  const url = new URL(claims.context.xpaceUrl);
  assert.equal(url.origin, origin);
  assert.equal(url.searchParams.get('loc'), scope.venueId);
  assert.equal(url.searchParams.get('project'), scope.projectId);
  for (const changed of [{ venueId: 'other-starbucks' }, { channelId: 'screen-ds1' }, { projectId: 'estancos' }]) {
    assert.equal(await verifyPlaylistGrant(body.grant, signingKey, { scope: { ...scope, ...changed } }), null);
  }
});

test('two same-brand establishments and another Xpace get distinct canonical scope without sharing destinations', async () => {
  const env = await setup();
  await venue(env, 'qa349-starbucks-b', 'starbucks'); await venue(env, 'qa349-xtanco', 'estancos', 'xtanco');
  const rows = [];
  for (const s of [scope, { ...scope, venueId: 'qa349-starbucks-b' }, { projectId: 'estancos', venueId: 'qa349-xtanco', channelId: 'screen-ds1' }]) {
    const { response, body } = await result(env, s); assert.equal(response.status, 200);
    const p = await verifyPlaylistGrant(body.grant, signingKey, { scope: s });
    assert.deepEqual(p.scope, s); assert.equal(new URL(p.context.xpaceUrl).searchParams.get('loc'), s.venueId); rows.push(p);
  }
  assert.equal(new Set(rows.map(r => r.jti)).size, 3);
  assert.equal(rows[2].context.renderer, 'xtanco');
  assert.equal(env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM admiranext_xpace_venues').first().n, 3);
});

test('viewers retain read-only grants, while software-project access cannot grant commercial editing', async () => {
  const env = await setup();
  await user(env, 'viewer@test.com', 'viewer', ['commercial:starbucks']);
  let r = await result(env, { email: 'viewer@test.com' });
  assert.equal(r.response.status, 200); assert.deepEqual(r.body.capabilities, { read: true, add: false, remove: false });
  assert.ok(await verifyPlaylistGrant(r.body.grant, signingKey, { scope }));
  assert.equal(await verifyPlaylistGrant(r.body.grant, signingKey, { scope, operation: 'add' }), null);
  await user(env, 'software@test.com', 'editor', ['starbucks', 'xpaceos']);
  assert.equal((await result(env, { email: 'software@test.com' })).response.status, 403);
  await user(env, 'parent@test.com', 'editor', ['commercial-projects']);
  assert.equal((await result(env, { email: 'parent@test.com' })).response.status, 200);
});

test('active role, project entitlement, app entitlement and expiry are checked again on every issue', async () => {
  const env = await setup(), email = 'editor@test.com';
  await user(env, email, 'editor', ['commercial:starbucks'], 'guest');
  assert.equal((await result(env, { email })).response.status, 403);
  env.AUTH_DB.prepare("INSERT INTO admiranext_user_apps VALUES(?,'xpaceos',1,'test')").bind(email).run();
  assert.equal((await result(env, { email })).response.status, 200);
  env.AUTH_DB.prepare('UPDATE admiranext_users SET expires_at=1 WHERE email=?').bind(email).run();
  assert.equal((await result(env, { email })).response.status, 403);
  env.AUTH_DB.prepare('UPDATE admiranext_users SET expires_at=NULL WHERE email=?').bind(email).run();
  env.AUTH_DB.prepare("UPDATE admiranext_users SET status='suspended' WHERE email=?").bind(email).run();
  assert.equal((await result(env, { email })).response.status, 403);
  env.AUTH_DB.prepare("UPDATE admiranext_users SET status='active' WHERE email=?").bind(email).run();
  env.AUTH_DB.prepare('DELETE FROM admiranext_user_projects WHERE user_email=?').bind(email).run();
  assert.equal((await result(env, { email })).response.status, 403);
});

test('disabled or wrong-project venues fail closed; an explicit demo alias resolves only to its canonical venue', async () => {
  const env = await setup();
  assert.equal((await result(env, { venueId: 'demo-starbucks' })).body.scope.venueId, 'alsea-sbux-021');
  assert.equal((await result(env, { projectId: 'estancos' })).response.status, 404);
  assert.equal((await result(env, { venueId: 'missing-venue' })).response.status, 404);
  await venue(env, 'demo-xtanco', 'estancos', 'xtanco', 0);
  assert.equal((await result(env, { projectId: 'estancos', venueId: 'demo-xtanco' })).response.status, 404);
  env.AUTH_DB.prepare('UPDATE admiranext_xpace_venues SET enabled=0 WHERE id=?').bind(scope.venueId).run();
  assert.equal((await result(env, { venueId: 'demo-starbucks' })).response.status, 404);
});

test('known virtual demos are authorized without inventing physical screens or mutating the venue registry', async () => {
  const env = await setup(), s = { projectId: 'estancos', venueId: 'demo-xtanco', channelId: 'screen-escaparate' };
  const r = await result(env, s); assert.equal(r.response.status, 200);
  const claims = await verifyPlaylistGrant(r.body.grant, signingKey, { scope: s });
  assert.equal(claims.context.renderer, 'xtanco');
  assert.equal(claims.screen, undefined); assert.equal(r.body.screen, undefined);
  assert.equal(env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM admiranext_xpace_venues').first().n, 1);
});

test('office and lab metadata follows the registered venue, including an office inside a retail project', async () => {
  const env = await setup();
  await venue(env, 'qa349-office', 'starbucks', 'office'); await venue(env, 'qa349-lab', 'admiraxperience', 'lab');
  assert.equal((await result(env, { venueId: 'qa349-office' })).body.renderer, 'office');
  assert.equal((await result(env, { projectId: 'admiraxperience', venueId: 'qa349-lab' })).body.renderer, 'lab');
});

test('missing scope, injected destination, arbitrary channels and untrusted identity shapes are rejected', async () => {
  const env = await setup();
  for (const patch of [{ venueId: '' }, { projectId: '' }, { channelId: 'global' }, { channelId: 'screen-../iphone17' },
    { channelId: 'screen-' + 'a'.repeat(49) }, { screen: 'iphone17-mupi' }, { playlist: 'default' }, { renderer: 'starbucks' },
    { email: 'someone@example.com\nInjected' }, { initialItems: ['arbitrary'] }]) assert.equal((await result(env, patch)).response.status, 400);
  assert.equal(validPlaylistScope({ ...scope, screen: 'iphone17-mupi' }), false);
  assert.equal((await result(env, { email: 'unknown@example.com' })).response.status, 403);
});

test('only the private service credential and canonical origin work; browser read tokens cannot become write grants', async () => {
  const env = await setup();
  const access = await issueAccess(env, { email: subject, session_version: 1 }, origin);
  for (const patch of [{ 'X-Admira-Playlist-Service-Key': '' }, { 'X-Admira-Playlist-Service-Key': 'wrong'.repeat(12) },
    { 'X-Admira-Playlist-Service-Key': '', Authorization: 'Bearer ' + access.token }, { Origin: 'https://evil.example' },
    { Origin: 'https://www.xpaceos.com' }, { Origin: '' }]) assert.equal((await result(env, {}, patch)).response.status, 401);
  assert.equal((await result({ ...env, XPACE_PLAYLIST_GRANT_SECRET: '' })).response.status, 503);
  assert.equal((await result({ ...env, AUTH_DB: null })).response.status, 503);
});

test('grants expire, cannot be altered or verified with rotated keys, and reject malformed JWT headers', async () => {
  const env = await setup(), r = await result(env), token = r.body.grant;
  assert.ok(await verifyPlaylistGrant(token, signingKey, { scope, now: r.body.expiresAt - 1 }));
  assert.equal(await verifyPlaylistGrant(token, signingKey, { scope, now: r.body.expiresAt }), null);
  assert.equal(await verifyPlaylistGrant(token, signingKey + '-rotated', { scope }), null);
  const parts = token.split('.');
  parts[1] = btoa(JSON.stringify({ ...JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))), scope: { ...scope, venueId: 'another-local' } })).replace(/=/g, '');
  assert.equal(await verifyPlaylistGrant(parts.join('.'), signingKey, { scope: { ...scope, venueId: 'another-local' } }), null);
  for (const value of ['not-a-jwt', 'x'.repeat(5000), 'e30.e30.', 'eyJhbGciOiJub25lIn0.e30.e30']) assert.equal(await verifyPlaylistGrant(value, signingKey, { scope }), null);
  const valid = await verifyPlaylistGrant(token, signingKey, { scope });
  await assert.rejects(issuePlaylistGrant({ secret: signingKey, subject, scope, context: { ...valid.context, xpaceUrl: 'https://evil.example/admira-xp/' }, operations: ['read'], sessionVersion: 1 }));
});

test('the pruebas perimeter admits only this authenticated service POST and keeps every other private route closed', async () => {
  const env = await setup(); let calls = 0;
  const execute = req => perimeter({ request: req, env, next: () => { calls++; return permission({ request: req, env }); } });
  assert.equal((await execute(request())).status, 200); assert.equal(calls, 1);
  assert.equal((await execute(request({}, { 'X-Admira-Playlist-Service-Key': '' }))).status, 401); assert.equal(calls, 1);
  for (const target of ['/pruebas/frontier/', path + '/extra', '/pruebas/api/solicitud']) {
    const req = new Request('https://www.admiranext.com' + target, { method: 'POST', headers, body: '{}' });
    assert.notEqual((await execute(req)).status, 200); assert.equal(calls, 1);
  }
  const directGet = new Request('https://www.admiranext.com' + path, { headers });
  assert.equal((await execute(directGet)).status, 401); assert.equal(calls, 1);
});
