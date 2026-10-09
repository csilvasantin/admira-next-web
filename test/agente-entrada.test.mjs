import test from 'node:test';
import assert from 'node:assert/strict';
import { resumirEntrada } from '../functions/api/agente-entrada.js';

test('el estado de agentes no copia la clave ni un error del upstream', () => {
  const sinSesion = resumirEntrada(401, { error: 'token no válido', token: 'no-debe-salir', name: 'SmithMacMini' });
  assert.deepEqual(sinSesion, { ok: true, desplegado: true, sesion: false, nombre: null });
  assert.doesNotMatch(JSON.stringify(sinSesion), /no-debe-salir|token/);
  assert.deepEqual(resumirEntrada(404, { name: 'SmithMacMini' }), { ok: true, desplegado: false, sesion: false, nombre: null });
  assert.deepEqual(resumirEntrada(200, { agent: true, name: 'SmithMacMini', email: 'agentes@silicio.admiranext.com' }), {
    ok: true, desplegado: true, sesion: true, nombre: 'SmithMacMini',
  });
  assert.equal(resumirEntrada(200, { agent: true, name: 'a'.repeat(80) }).sesion, false);
  assert.equal(resumirEntrada(0, null).ok, false);
});
