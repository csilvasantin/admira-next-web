import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../functions/presentaciones/_middleware.js', import.meta.url), 'utf8');

test('el acceso ofrece una recuperación de contraseña visible', () => {
  assert.match(source, /¿Has olvidado la contraseña\?/);
  assert.match(source, /Recuperar contraseña/);
  assert.match(source, /name="intent" value="recover"/);
});

test('el acceso es reconocible por Google Password Manager', () => {
  assert.match(source, /<form[^>]*autocomplete="on"/);
  assert.match(source, /name="email"[^>]*autocomplete="username"/);
  assert.match(source, /name="password"[^>]*autocomplete="current-password"/);
  assert.match(source, /Google Password Manager/);
});

test('las presentaciones ofrecen el acceso con cuenta de Google por redirección y verifican la credencial', () => {
  // Contrato del 4-sep-2026 (FLT-1631/0478, NeoMBP14): sin popup ni botón GSI. Google vuelve por POST
  // a /webmaster (única URI registrada) y webmaster.js reenvía la credencial a esta página, que la
  // verifica en tokeninfo, exige el aud del cliente y emite la sesión del generador (pres_owner).
  // Este test guardaba el contrato anterior (g_id_signin, pres_master) y llevaba en rojo desde entonces.
  assert.match(source, /id="google-access" method="POST"/);
  assert.match(source, /name="intent" value="google"/);
  assert.match(source, /https:\/\/www\.admiranext\.com\/webmaster/);
  assert.match(source, /oauth2\.googleapis\.com\/tokeninfo/);
  assert.match(source, /payload\.aud !== GOOGLE_CLIENT_ID/);
  assert.match(source, /pres_owner=\$\{accessToken\}/);
  assert.match(source, /makeSessionToken\(signKey, googleAccess, MAXAGE\)/);
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
