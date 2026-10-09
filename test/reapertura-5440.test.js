import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('el diagrama no presenta admira.app = yokup.com como equivalencia de hoy', () => {
  const js = leer('assets/arquitectura.js');
  assert.match(js, /instalaciones y mantenimiento \(antes yokup\.com\)/);
  assert.match(js, /DooH y Retail Media \(antes clearchannel\.tv\)/);
  assert.match(js, /Formerly/);
  assert.doesNotMatch(js, /t2\.textContent = PRINCIPALES[\s\S]{0,180}= ' \+ n\.alias/);
});

test('en la portada /idioma traduce el cuerpo aunque el registro del Experto no exista', () => {
  const home = leer('index.html');
  const app = leer('assets/app.js');
  const experto = leer('assets/experto-admiranext.js');
  assert.match(home, /data-i18n="manifesto\.who\.value"/);
  assert.match(app, /idioma\|language\|languague/);
  assert.match(app, /window\.setLang\(nextLang\)/);
  assert.match(app, /setAttribute\('data-i18n', step\.key\)/);
  assert.match(experto, /#ykExpertRail \.yk-cli-out/);
  assert.match(experto, /X\.setLanguage/);
});
