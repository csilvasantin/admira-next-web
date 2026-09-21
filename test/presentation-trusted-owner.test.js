import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/presentaciones/_middleware.js';
import {makeSessionToken} from '../functions/presentaciones/_directory.js';

const env = {
  PRES_SIGNING_KEY:'trusted-owner-test-key',
  PRES_GENERIC:'1234'
};

function fakeDb(users, projects){
  return {
    prepare(sql){
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
}

function context(url, options = {}, envOverride = env){
  return {
    request:new Request(url, options),
    env:envOverride,
    next:async () => new Response('ok'),
    waitUntil(){}
  };
}

function cookieHeader(response){
  return response.headers.getSetCookie()
    .map(value => value.split(';', 1)[0])
    .join('; ');
}

test('Cloudflare Access inicia automáticamente al propietario verificado', async () => {
  const response = await onRequest(context('https://www.admiranext.com/presentaciones/', {
    headers:{
      'Cf-Access-Authenticated-User-Email':'csilva@admira.com',
      'Cf-Access-Jwt-Assertion':'verified-by-cloudflare-access'
    }
  }));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/presentaciones/');
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(value => value.startsWith('pres_owner=')));
  assert.ok(cookies.some(value => value.startsWith('pres_identity=')));
  assert.ok(cookies.some(value => value.includes('Max-Age=2592000')));

  const api = await onRequest(context('https://www.admiranext.com/presentaciones/api/clients', {
    headers:{Cookie:cookieHeader(response)}
  }));
  assert.equal(api.status, 200);
  assert.equal(await api.text(), 'ok');
});

test('el propietario automático exige correo exacto, JWT y dominio protegido', async () => {
  for (const [url, headers] of [
    ['https://www.admiranext.com/presentaciones/', {'Cf-Access-Authenticated-User-Email':'otro@admira.com', 'Cf-Access-Jwt-Assertion':'jwt'}],
    ['https://www.admiranext.com/presentaciones/', {'Cf-Access-Authenticated-User-Email':'csilvasantin@gmail.com'}],
    ['https://preview.pages.dev/presentaciones/', {'Cf-Access-Authenticated-User-Email':'csilvasantin@gmail.com', 'Cf-Access-Jwt-Assertion':'jwt'}]
  ]) {
    const response = await onRequest(context(url, {headers}));
    assert.equal(response.status, 401);
    assert.doesNotMatch(response.headers.get('set-cookie') || '', /pres_owner=/);
  }
});

test('la sesión de propietario Admin abre el área de control sin contraseña maestra', async () => {
  const login = await onRequest(context('https://www.admiranext.com/presentaciones/', {
    headers:{
      'Cf-Access-Authenticated-User-Email':'csilvasantin@gmail.com',
      'Cf-Access-Jwt-Assertion':'verified-by-cloudflare-access'
    }
  }));
  const response = await onRequest(context('https://www.admiranext.com/presentaciones/control/', {
    headers:{Cookie:cookieHeader(login), Accept:'text/html'}
  }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
});

test('la sesión de Editor no abre el área de control', async () => {
  const users = [
    { email:'editor@admira.com', display_name:'Edi Tor', role:'editor', status:'active', session_version:1, google_sub:null }
  ];
  const projects = [
    { user_email:'editor@admira.com', project_key:'generador-de-presentaciones' }
  ];
  const editorEnv = {
    PRES_SIGNING_KEY:'trusted-owner-test-key',
    PRES_GENERIC:'1234',
    AUTH_DB:fakeDb(users, projects)
  };
  const token = await makeSessionToken('trusted-owner-test-key', {
    level:'editor',
    email:'editor@admira.com',
    name:'Edi Tor',
    sessionVersion:1
  }, 3600);
  const response = await onRequest(context('https://www.admiranext.com/presentaciones/control/', {
    headers:{Cookie:`pres_owner=${token}`, Accept:'text/html'}
  }, editorEnv));
  assert.equal(response.status, 401);
});

test('la ruta antigua del generador redirige a la entrada canónica',async()=>{
  const response=await onRequest(context('https://www.admiranext.com/presentaciones/generador/?source=brief'));
  assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'https://www.admiranext.com/presentaciones/?source=brief');
});

test('las cuentas Google Admin abren presentaciones, generador y control', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    aud:'861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com',
    email:'csilva@admira.com',
    email_verified:'true',
    exp:String(Math.floor(Date.now() / 1000) + 300),
    name:'Carlos Silva'
  }));
  const form = new URLSearchParams({intent:'google', credential:'signed-google-id-token'});
  const response = await onRequest(context('https://www.admiranext.com/presentaciones/demo/', {
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:form
  }));

  assert.equal(response.status, 303);
  // Desde el 4-sep-2026 el acceso con Google emite la sesión del generador (pres_owner), no pres_master.
  assert.ok(response.headers.getSetCookie().some(value => value.startsWith('pres_owner=')));

  const presentation = await onRequest(context('https://www.admiranext.com/presentaciones/demo/', {
    headers:{Cookie:cookieHeader(response), Accept:'text/html'}
  }));
  assert.equal(presentation.status, 200);

  // FLT-100781: Admin (owner) abre /control/ sin contraseña maestra.
  const control = await onRequest(context('https://www.admiranext.com/presentaciones/control/', {
    headers:{Cookie:cookieHeader(response), Accept:'text/html'}
  }));
  assert.equal(control.status, 200);
});
