// FLT-1631 · el generador de presentaciones autoriza contra el directorio central (/usuarios).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allowedBy, generatorAccess, levelForRole, makeSessionToken, projectGrantsGenerator, readSession } from './_directory.js';

const middleware = await readFile(new URL('./_middleware.js', import.meta.url), 'utf8');

// D1 de mentira: usuarios + proyectos, con la forma prepare().bind().first()/all().
function fakeDb(users, projects){
  const db = {
    prepare(sql){
      // asegurarDirectorio() ejecuta el esquema con prepare(stmt).run() sin bind.
      return { async run(){ return {}; }, bind(...args){ return {
        async first(){
          if (/FROM admiranext_users WHERE google_sub=/.test(sql)) return users.find(u => u.google_sub === args[0]) || null;
          if (/FROM admiranext_users WHERE email=\? AND google_sub IS NULL/.test(sql)) return users.find(u => u.email === args[0] && !u.google_sub) || null;
          if (/FROM admiranext_users WHERE email=/.test(sql)) return users.find(u => u.email === args[0]) || null;
          return null;
        },
        async all(){
          if (/FROM admiranext_user_projects WHERE user_email=/.test(sql)) return { results: projects.filter(p => p.user_email === args[0]).map(p => ({project_key:p.project_key})) };
          return { results: [] };
        },
        async run(){ return {}; }
      }; } };
    }
  };
  return db;
}
const users = [
  { email:'csilva@admira.com', display_name:'Carlos Silva', role:'admin', status:'active', session_version:3, google_sub:'sub-carlos' },
  { email:'editor@admira.com', display_name:'Edi Tor', role:'editor', status:'active', session_version:1, google_sub:null },
  { email:'viewer@admira.com', display_name:'Vi Ewer', role:'viewer', status:'active', session_version:1, google_sub:null },
  { email:'baja@admira.com', display_name:'De Baja', role:'admin', status:'disabled', session_version:2, google_sub:null },
  { email:'otro@admira.com', display_name:'Otro Proyecto', role:'editor', status:'active', session_version:1, google_sub:null },
];
const projects = [
  { user_email:'csilva@admira.com', project_key:'*' },
  { user_email:'editor@admira.com', project_key:'generador-de-presentaciones' },
  { user_email:'viewer@admira.com', project_key:'generador-de-presentaciones' },
  { user_email:'baja@admira.com', project_key:'*' },
  { user_email:'otro@admira.com', project_key:'xpaceos' },
];
const env = { AUTH_DB: fakeDb(users, projects) };

test('el rol del directorio decide el nivel y el proyecto decide si entra', async () => {
  assert.equal(levelForRole('admin'), 'owner'); assert.equal(levelForRole('editor'), 'editor'); assert.equal(levelForRole('viewer'), 'viewer'); assert.equal(levelForRole('x'), null);
  assert.equal(projectGrantsGenerator(['*']), true); assert.equal(projectGrantsGenerator(['generador-de-presentaciones']), true); assert.equal(projectGrantsGenerator(['xpaceos']), false);
  const carlos = await generatorAccess(env, {email:'csilva@admira.com', sub:'sub-carlos'});
  assert.deepEqual(carlos, { level:'owner', email:'csilva@admira.com', name:'Carlos Silva', sessionVersion:3, source:'directory' });
  assert.equal((await generatorAccess(env, {email:'editor@admira.com'})).level, 'editor');
  assert.equal((await generatorAccess(env, {email:'viewer@admira.com'})).level, 'viewer');
  assert.equal(await generatorAccess(env, {email:'baja@admira.com'}), null, 'una baja no entra aunque sea admin');
  assert.equal(await generatorAccess(env, {email:'otro@admira.com'}), null, 'sin el proyecto no entra aunque sea editor');
  assert.equal(await generatorAccess(env, {email:'nadie@admira.com'}), null);
});

test('sin AUTH_DB sólo entran los correos de arranque (red de seguridad, nunca lista abierta)', async () => {
  assert.equal((await generatorAccess({}, {email:'csilva@admira.com'})).source, 'bootstrap');
  assert.equal(await generatorAccess({}, {email:'editor@admira.com'}), null);
});

test('la sesión se re-cruza con D1: revocar (session_version) o dar de baja corta el acceso', async () => {
  const carlos = await generatorAccess(env, {email:'csilva@admira.com'});
  const token = await makeSessionToken('clave', carlos, 3600);
  assert.equal((await readSession(env, 'clave', token)).level, 'owner');
  assert.equal(await readSession(env, 'otra-clave', token), null, 'firma ajena');
  const revoked = { AUTH_DB: fakeDb(users.map(u => u.email === 'csilva@admira.com' ? {...u, session_version:4} : u), projects) };
  assert.equal(await readSession(revoked, 'clave', token), null, 'session_version distinta = revocada');
  const disabled = { AUTH_DB: fakeDb(users.map(u => u.email === 'csilva@admira.com' ? {...u, status:'disabled'} : u), projects) };
  assert.equal(await readSession(disabled, 'clave', token), null, 'baja = fuera');
  const demoted = { AUTH_DB: fakeDb(users.map(u => u.email === 'csilva@admira.com' ? {...u, role:'viewer'} : u), projects) };
  assert.equal((await readSession(demoted, 'clave', token)).level, 'viewer', 'el nivel vigente es el del directorio, no el de la cookie');
});

test('cada nivel llega hasta donde le toca', () => {
  const internal = { ownerAllowed:false, editorAllowed:true, internalArea:true };
  const generator = { ownerAllowed:true, editorAllowed:false, internalArea:true };
  const publicDeck = { ownerAllowed:false, editorAllowed:false, internalArea:false };
  const control = { ownerAllowed:false, editorAllowed:false, internalArea:true };
  assert.equal(allowedBy('owner', generator), true); assert.equal(allowedBy('owner', internal), true); assert.equal(allowedBy('owner', control), false);
  assert.equal(allowedBy('editor', internal), true); assert.equal(allowedBy('editor', generator), true); assert.equal(allowedBy('editor', control), false);
  assert.equal(allowedBy('viewer', publicDeck), true); assert.equal(allowedBy('viewer', internal), false); assert.equal(allowedBy('viewer', generator), false);
  assert.equal(allowedBy('', publicDeck), false);
});

test('el middleware ya no lleva la lista de correos escrita: consulta el directorio', () => {
  assert.doesNotMatch(middleware, /TRUSTED_GENERATOR_EMAILS\.has/);
  assert.match(middleware, /generatorAccess\(/);
  assert.match(middleware, /readSession\(env, signKey, cookies\.pres_owner\)/);
  assert.match(middleware, /makeSessionToken\(signKey/);
});
