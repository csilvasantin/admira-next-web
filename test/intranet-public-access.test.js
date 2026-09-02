import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('la portada ya no incluye controles ni una contraseña de intranet', async () => {
  const source = await read('../index.html');
  assert.doesNotMatch(source, /password-screen|password-input|showIntranetGate|type="password"/);
  assert.doesNotMatch(source, /RESTRICTED ACCESS|ACCESO RESTRINGIDO|INCORRECT PASSWORD|CONTRASEÑA INCORRECTA/);
  assert.doesNotMatch(source, /input\.value\s*===\s*['"]1234['"]/);
});

test('/intranet devuelve directamente el catálogo público', async () => {
  const source = await read('../assets/app.js');
  assert.match(source, /registerHidden\('\/intranet', renderIntranetListing\)/);
  assert.doesNotMatch(source, /isIntranetUnlocked|setIntranetUnlocked|showIntranetGate/);
  assert.doesNotMatch(source, /Restricted access|Acceso restringido|Access required|Acceso requerido/);
});
