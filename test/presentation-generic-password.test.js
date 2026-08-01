import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../functions/presentaciones/_middleware.js', import.meta.url), 'utf8');

test('la contraseña genérica solo concede acceso de cliente a áreas públicas', () => {
  assert.match(source, /const generic = env\.PRES_GENERIC/);
  assert.match(source, /!isInternalArea && generic && ctEq\(password, generic\)/);
  assert.match(source, /targetName = cookieName; targetSlug = cookieSlug; granted = 'client'/);
  assert.doesNotMatch(source, /generic[^\n]+granted = 'master'/);
  assert.doesNotMatch(source, /generic[^\n]+granted = 'editor'/);
});
