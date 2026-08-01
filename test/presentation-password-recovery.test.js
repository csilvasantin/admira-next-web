import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../functions/presentaciones/_middleware.js', import.meta.url), 'utf8');

test('el acceso ofrece una recuperación de contraseña visible', () => {
  assert.match(source, /¿Has olvidado la contraseña\?/);
  assert.match(source, /Recuperar contraseña/);
  assert.match(source, /name="intent" value="recover"/);
});

test('la recuperación no revela la contraseña ni enumera usuarios', () => {
  assert.match(source, /nunca mostraremos ni enviaremos la contraseña actual/);
  assert.match(source, /La respuesta es siempre la misma/);
  assert.doesNotMatch(source, /payload\.set\([^\n]*password/i);
});

test('la solicitud se limita, se registra y avisa al equipo', () => {
  assert.match(source, /access:recovery-rate:/);
  assert.match(source, /password_recovery_requested/);
  assert.match(source, /formsubmit\.co\/ajax\/info@admira\.com/);
});
