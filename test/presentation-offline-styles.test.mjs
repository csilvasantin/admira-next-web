import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {collectStylesheets, inlineStylesheets} from '../scripts/_presentation-offline-styles.cjs';

test('offline CSS preserves interleaved source order and each resource base', async () => {
  const calls = [];
  const sheets = [{css: ':root{--brand:blue}'}, {href: '/brand/default.css'}, {css: ':root{--brand:green}'}];
  const css = await inlineStylesheets(sheets, {
    base: 'https://example.test/deck/view',
    read: async url => {assert.equal(url, 'https://example.test/brand/default.css'); return 'body{background:url(../img/logo.png)}';},
    localize: async (source, base) => {calls.push({source, base}); return source.replace('../img/logo.png', 'media/logo.png');}
  });
  assert.equal(css, ':root{--brand:blue}\nbody{background:url(media/logo.png)}\n:root{--brand:green}');
  assert.deepEqual(calls.map(c => c.base), ['https://example.test/deck/view', 'https://example.test/brand/default.css', 'https://example.test/deck/view']);
  assert.equal(calls.length, 3, 'already localized sheets must not be processed twice');
});

test('offline stylesheet media remains conditional and fetch errors are propagated', async () => {
  const css = await inlineStylesheets([{css:'body{color:red}', media:'print'}, {href:'/screen.css', media:'screen'}], {
    base:'https://example.test/', read:async () => 'body{color:green}', localize:async css => css
  });
  assert.equal(css, '@media print{\nbody{color:red}\n}\n@media screen{\nbody{color:green}\n}');
  await assert.rejects(inlineStylesheets([{href:'/missing.css'}], {
    base:'https://example.test/', read:async () => {throw Error('HTTP 404');}, localize:async css => css
  }), /HTTP 404/);
});

let chromium;
try {({chromium} = createRequire(import.meta.url)('playwright'));} catch {}

test('Chromium online/offline brand cascade agrees for screen and print', {skip:!chromium && 'Playwright is required for computed CSS verification'}, async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.ADMIRA_CHROME_PATH ? {executablePath:process.env.ADMIRA_CHROME_PATH} : {})});
  try {
    const page = await browser.newPage();
    const brandDefaults = await readFile(new URL('../marcablanca/marcablanca.css', import.meta.url), 'utf8');
    const resources = new Map([
      ['https://example.test/marcablanca.css', brandDefaults],
      ['https://example.test/print.css', ':root{--mb-acento:#e5bf76}'],
      ['https://example.test/screen.css', ':root{--mb-acento:#31c498}']
    ]);
    await page.route('**/*', route => {
      const body = resources.get(route.request().url());
      return body === undefined ? route.abort() : route.fulfill({contentType:'text/css', body});
    });
    const source = `<!doctype html><html><head>
      <style>:root{--mb-primario:blue}body{color:var(--mb-primario);background:var(--mb-fondo);font-family:var(--mb-fuente-texto)}</style>
      <link rel="stylesheet" href="https://example.test/marcablanca.css">
      <style data-prospect-css>:root{--mb-primario:#00754a;--mb-fondo:#f5f2e9;--mb-fuente-texto:Georgia,serif}</style>
      <link rel="stylesheet" href="https://example.test/print.css" media="print">
      <style media="screen">:root{--mb-acento:#aabbcc}</style>
      <link rel="stylesheet" href="https://example.test/screen.css" media="screen">
      <link rel="stylesheet" disabled href="https://example.test/not-enabled.css">
      <link rel="alternate stylesheet" title="Other" href="https://example.test/not-active.css">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
    </head><body>Marca del cliente</body></html>`;
    const sheets = await page.evaluate(collectStylesheets, source);
    assert.equal(sheets.length, 6);
    assert.deepEqual(sheets.map(s => s.href || 'inline'), ['inline','https://example.test/marcablanca.css','inline','https://example.test/print.css','inline','https://example.test/screen.css']);
    const css = await inlineStylesheets(sheets, {base:'https://example.test/deck', read:async url => resources.get(url), localize:async css => css});
    const computed = () => page.evaluate(() => {
      const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body);
      return {primary:root.getPropertyValue('--mb-primario').trim(), accent:root.getPropertyValue('--mb-acento').trim(), background:body.backgroundColor, color:body.color, font:body.fontFamily};
    });
    // Use only the active sheets for online rendering; external Google fonts
    // are intentionally omitted by the offline packager.
    const online = source.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/, '');
    for (const media of ['screen', 'print']) {
      await page.emulateMedia({media});
      await page.setContent(online, {waitUntil:'load'});
      const expected = await computed();
      assert.equal(expected.primary, '#00754a');
      assert.equal(expected.accent, media === 'print' ? '#e5bf76' : '#31c498');
      await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>Marca del cliente</body></html>`);
      assert.deepEqual(await computed(), expected);
      // Regression witness: the previous builder's inline-before-link ordering
      // really changes the brand tokens, so this fixture detects the bug.
      const legacyCSS = [...sheets.filter(s => !s.href).map(s => s.css), ...sheets.filter(s => s.href).map(s => resources.get(s.href))].join('\n');
      await page.setContent(`<html><style>${legacyCSS}</style><body>Marca</body></html>`);
      assert.notEqual((await computed()).primary, expected.primary);
    }
  } finally {await browser.close();}
});
