import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/presentaciones/_middleware.js';

const env = {
  PRES_SIGNING_KEY:'trusted-owner-test-key',
  PRES_GENERIC:'1234'
};

function context(url, options = {}){
  return {
    request:new Request(url, options),
    env,
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
  const response = await onRequest(context('https://www.admiranext.com/presentaciones/generador/', {
    headers:{
      'Cf-Access-Authenticated-User-Email':'csilva@admira.com',
      'Cf-Access-Jwt-Assertion':'verified-by-cloudflare-access'
    }
  }));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/presentaciones/generador/');
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
    ['https://www.admiranext.com/presentaciones/generador/', {'Cf-Access-Authenticated-User-Email':'otro@admira.com', 'Cf-Access-Jwt-Assertion':'jwt'}],
    ['https://www.admiranext.com/presentaciones/generador/', {'Cf-Access-Authenticated-User-Email':'csilvasantin@gmail.com'}],
    ['https://preview.pages.dev/presentaciones/generador/', {'Cf-Access-Authenticated-User-Email':'csilvasantin@gmail.com', 'Cf-Access-Jwt-Assertion':'jwt'}]
  ]) {
    const response = await onRequest(context(url, {headers}));
    assert.equal(response.status, 401);
    assert.doesNotMatch(response.headers.get('set-cookie') || '', /pres_owner=/);
  }
});

test('la sesión de propietario no abre el área de control', async () => {
  const login = await onRequest(context('https://www.admiranext.com/presentaciones/generador/', {
    headers:{
      'Cf-Access-Authenticated-User-Email':'csilvasantin@gmail.com',
      'Cf-Access-Jwt-Assertion':'verified-by-cloudflare-access'
    }
  }));
  const response = await onRequest(context('https://www.admiranext.com/presentaciones/control/', {
    headers:{Cookie:cookieHeader(login)}
  }));
  assert.equal(response.status, 401);
});
