// /frontier (Carlos, 10-10-2026 14:01) y presites sin ⌘ Experto (Carlos, 10-10-2026 14:02; norma 32).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const leer = (p) => readFileSync(join(raiz, p), 'utf8');

test('/frontier salta a /pruebas/frontier/ desde el terminal de la entrada (portada y /pruebas)', () => {
  for (const f of ['assets/app.js', 'pruebas/assets/app.js']) {
    const js = leer(f);
    const m = js.match(/\{ id: 'frontier',[^\n]*\}/);
    assert.ok(m, f + ': entrada frontier en SALTOS');
    assert.match(m[0], /url: '\/pruebas\/frontier\/'/);
    assert.match(m[0], /alias: \['frontier'\], interno: true/);
    assert.match(m[0], /es: '[^']+'/);
    assert.match(m[0], /en: '[^']+'/);
  }
});

test('/frontier es verbo del ⌘ Experto (solo se registra con sesión)', () => {
  const js = leer('assets/experto-admiranext.js');
  assert.match(js, /function registrarFrontier\(F\)/);
  assert.match(js, /id: 'frontier'/);
  assert.match(js, /FRONTIER_URL = '\/pruebas\/frontier\/'/);
  assert.match(js, /registrarFrontier\(F\);/);
});

test('presites: sin sesión no hay ⌘ Experto; en su hueco, selector ES · EN', () => {
  const css = leer('assets/admira-frame.css');
  assert.match(css, /html:not\(\.admira-con-sesion\) #ykExpertToggle/);
  assert.match(css, /html:not\(\.admira-con-sesion\) #ykExpertRail/);
  assert.match(css, /html:not\(\.admira-con-sesion\) #axAdmiranextExperto/);
  assert.match(css, /html\.admira-con-sesion #ykLangPre\{ display: none !important \}/);
  const frame = leer('assets/admira-frame.js');
  assert.match(frame, /btnIdioma\.id = 'ykLangPre'/);
  assert.match(frame, /'admiranext_expert_lang', 'admiranext_lang'/);
  assert.match(frame, /admira:languagechange/);
  const exp = leer('assets/experto-admiranext.js');
  assert.match(exp, /conSesion\(\)\.then\(function \(ok\) \{\s*if \(!ok\) \{ sincronizarIdioma\(null\); return; \}/);
});

test('la norma 32 está en /normativa y en AGENTS.md', () => {
  assert.match(leer('normativa.html'), /id="n32"[\s\S]*Sin modo Experto en los presites/);
  assert.match(leer('AGENTS.md'), /Sin modo Experto en los presites/);
});

test('portada pública: un solo control de idioma (sin el botón ESP/ENG del terminal)', () => {
  const html = leer('index.html');
  assert.doesNotMatch(html, /terminal-lang-toggle/);
  assert.doesNotMatch(html, /<button[^>]*lang-toggle[^>]*>/);
  assert.match(html, /window\.setLang = function/, 'la lógica de idioma sigue para el selector ES · EN');
});
