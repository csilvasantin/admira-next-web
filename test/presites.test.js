import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizePresite, renderPresite, safeDestination, validatePresite} from '../functions/presites/_presite.js';
import {onRequest as sitesApi} from '../functions/presites/api/sites.js';
import {onRequest as siteApi} from '../functions/presites/[site]/api/site.js';
import {onRequest as versionsApi} from '../functions/presites/[site]/api/versions.js';
import {onRequestGet as preview} from '../functions/presites/[site]/preview.js';
import {onRequestGet as exportPresite} from '../functions/presites/[site]/export.js';
import {onRequestGet as generatorRoute} from '../functions/presites/generador.js';

class KV {
  constructor() { this.values = new Map(); }
  async get(key, options) {
    const value = this.values.get(key);
    return value == null ? null : options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, value); }
}

const payload = {
  displayName: 'PUMA Press Start',
  slug: 'puma-press-start',
  brief: 'Abrir la presentación como una aventura de cultura deportiva.',
  objective: 'Crear expectación antes de revelar el piloto conectado.',
  audience: 'Dirección de retail, marca e innovación',
  culture: 'Arcades, VHS, radio nocturna y ciencia ficción optimista.',
  language: 'es',
  quality: 'best',
  destination: {type: 'presentation', url: '/presentaciones/puma/'},
  experience: {style: 'synthwave', duration: 18, autoAdvance: false},
  cta: 'Entrar en la experiencia.',
  theme: {primary: '#05070d', accent: '#65e9f4', glow: '#ff4fa3'}
};

test('el modelo Presite v2 normaliza destino, experiencia y storyboard de cinco beats', () => {
  const site = normalizePresite(payload);
  assert.equal(validatePresite(site), '');
  assert.equal(site.schemaVersion, 2);
  assert.equal(site.destination.type, 'presentation');
  assert.equal(site.destination.url, '/presentaciones/puma/');
  assert.deepEqual(site.experience, {style: 'synthwave', duration: 18, autoAdvance: false});
  assert.deepEqual(site.storyboard.map(beat => beat.id), ['boot', 'signal', 'odyssey', 'reveal', 'launch']);
  assert.match(site.storyboard[1].title, /PUMA/);
});

test('solo admite rutas internas y destinos HTTPS', () => {
  assert.equal(safeDestination('/presentaciones/nike/?mode=best'), '/presentaciones/nike/?mode=best');
  assert.equal(safeDestination('https://example.com/demo'), 'https://example.com/demo');
  assert.equal(safeDestination('http://example.com'), '');
  assert.equal(safeDestination('javascript:alert(1)'), '');
  const invalid = normalizePresite({...payload, destination: {type: 'site', url: 'javascript:alert(1)'}});
  assert.match(validatePresite(invalid), /destino HTTPS/);
});

test('Good, Better y Best conservan la secuencia pero tienen tratamientos distintos', () => {
  for (const quality of ['good', 'better', 'best']) {
    const html = renderPresite(normalizePresite({...payload, quality}));
    assert.match(html, new RegExp(`data-quality="${quality}"`));
    assert.match(html, /intro-scene scene-5/);
    assert.match(html, /intro-progress/);
  }
  assert.match(renderPresite(normalizePresite({...payload, quality: 'better'})), /body\[data-quality="better"\]/);
  assert.match(renderPresite(normalizePresite({...payload, quality: 'best'})), /mix-blend-mode:screen/);
});

test('runtime hace Skip visible, soporta teclado, pausa, mute, reduced motion y fallback', () => {
  const html = renderPresite(normalizePresite(payload));
  assert.match(html, /id="skipIntro"/);
  assert.match(html, /id="togglePlayback"/);
  assert.match(html, /id="toggleSound"/);
  assert.match(html, /event\.key==='Escape'/);
  assert.match(html, /event\.key==='Enter'/);
  assert.match(html, /!event\.target\.closest\('button,a,input,select,textarea'\)/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /<noscript>/);
  assert.match(html, /location\.assign\(config\.destination\)/);
  assert.match(html, /AudioContext/);
  assert.doesNotMatch(html, /autoplay/);
});

test('preview desactiva la salida real pero export conserva el destino', async () => {
  const kv = new KV();
  const site = normalizePresite(payload);
  await kv.put('presite:site:puma-press-start', JSON.stringify(site));
  const rendered = await preview({params: {site: 'puma-press-start'}, env: {PRESENTATION_IDEAS: kv}});
  assert.match(rendered.headers.get('content-security-policy'), /script-src 'unsafe-inline'/);
  const previewHtml = await rendered.text();
  assert.match(previewHtml, /"preview":true/);
  assert.match(previewHtml, /salida desactivada/);
  const exported = await exportPresite({params: {site: 'puma-press-start'}, env: {PRESENTATION_IDEAS: kv}});
  assert.match(exported.headers.get('content-disposition'), /-intro\.html/);
  const exportHtml = await exported.text();
  assert.match(exportHtml, /\/presentaciones\/puma\//);
  assert.match(exportHtml, /"preview":false/);
});

test('API crea, lista, edita storyboard y conserva versiones sin publicar', async () => {
  const kv = new KV();
  const env = {PRESENTATION_IDEAS: kv};
  const create = await sitesApi({
    request: new Request('https://admiranext.test/presites/api/sites', {
      method: 'PUT',
      headers: {origin: 'https://admiranext.test', 'content-type': 'application/json'},
      body: JSON.stringify(payload)
    }),
    env
  });
  assert.equal(create.status, 201);
  const created = await create.json();
  assert.equal(created.site.status, 'draft');
  assert.equal(created.previewUrl, '/presites/puma-press-start/preview');
  const list = await sitesApi({request: new Request('https://admiranext.test/presites/api/sites'), env});
  const summary = (await list.json()).sites[0];
  assert.equal(summary.style, 'synthwave');
  assert.equal(summary.destinationType, 'presentation');

  const read = await siteApi({request: new Request('https://admiranext.test/presites/puma-press-start/api/site'), params: {site: 'puma-press-start'}, env});
  const site = (await read.json()).site;
  site.storyboard[1].title = 'Forever faster.';
  const update = await siteApi({
    request: new Request('https://admiranext.test/presites/puma-press-start/api/site', {
      method: 'PUT',
      headers: {origin: 'https://admiranext.test', 'content-type': 'application/json'},
      body: JSON.stringify({storyboard: site.storyboard, experience: {...site.experience, duration: 22}})
    }),
    params: {site: 'puma-press-start'},
    env
  });
  const updated = (await update.json()).site;
  assert.equal(updated.storyboard[1].title, 'Forever faster.');
  assert.equal(updated.experience.duration, 22);

  const simulation = await siteApi({
    request: new Request('https://admiranext.test/presites/puma-press-start/api/site', {
      method: 'PUT',
      headers: {origin: 'https://admiranext.test', 'content-type': 'application/json'},
      body: JSON.stringify({action: 'simulate-publish'})
    }),
    params: {site: 'puma-press-start'},
    env
  });
  const simulated = (await simulation.json()).site;
  assert.equal(simulated.status, 'review-ready');
  assert.equal(simulated.publication.published, false);
  const history = await versionsApi({request: new Request('https://admiranext.test/presites/puma-press-start/api/versions'), params: {site: 'puma-press-start'}, env});
  assert.equal((await history.json()).versions.length, 3);
});

test('workspace integra generador, storyboard, preview responsive y versiones', async () => {
  const [hub, generator, studio, styles, client, readme] = await Promise.all([
    readFile(new URL('../presites/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../presites/generador/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../functions/presites/[site]/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/presites-workspace.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/presites-studio.js', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8')
  ]);
  assert.match(hub, /La intro antes de la experiencia/);
  assert.match(hub, /Skip intro siempre/);
  for (const label of ['Good', 'Better', 'Best']) assert.match(generator, new RegExp(label));
  for (const field of ['destinationUrl', 'duration', 'style', 'language']) assert.match(generator, new RegExp(`name="${field}"`));
  for (const device of ['desktop', 'tablet', 'mobile']) assert.match(generator, new RegExp(`data-device="${device}"`));
  assert.match(studio, /Storyboard de cinco beats/);
  assert.match(client, /simulate-publish/);
  assert.match(client, /api\/versions/);
  assert.match(client, /querySelectorAll\('\.ps-block-fields input,\.ps-block-fields textarea'\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(readme, /secuencia\s+audiovisual/i);
});

test('la ruta /presites/generador/ sirve el asset exacto sin caer en [site]', async () => {
  const source = '<!doctype html><html><body><form id="presiteGenerator"></form></body></html>';
  const response = await generatorRoute({
    request: new Request('https://admiranext.test/presites/generador/'),
    env: {ASSETS: {fetch: async request => {
      assert.equal(new URL(String(request)).pathname, '/presites/generador/index.html');
      return new Response(source);
    }}}
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /presiteGenerator/);
});
