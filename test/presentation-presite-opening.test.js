import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePresiteOpening,
  presiteOpeningInput,
  publicPresiteOpening
} from '../functions/presentaciones/_presite-opening.js';
import {onRequestGet as openPresentation} from '../functions/presentaciones/[client]/open.js';

function kv(values) {
  return {
    async get(key, options) {
      const value = values[key] ?? null;
      if (options?.type === 'json') return value;
      return value == null ? null : JSON.stringify(value);
    }
  };
}

const presite = {
  schemaVersion: 2,
  slug: 'demo-intro',
  displayName: 'Demo',
  language: 'es',
  quality: 'better',
  brief: 'Abrir la presentación con una señal audiovisual.',
  objective: 'Conseguir atención antes del deck.',
  audience: 'Equipo directivo',
  culture: 'Cultura digital',
  cta: 'Entrar',
  destination: {type: 'site', url: 'https://example.com/never-use-this'},
  experience: {style: 'arcade', duration: 18, autoAdvance: true},
  storyboard: [
    {id: 'boot', cue: 'BOOT', title: 'Inicio', body: '', duration: 12},
    {id: 'signal', cue: 'SIGNAL', title: 'Demo', body: '', duration: 18},
    {id: 'odyssey', cue: 'MOVE', title: 'Historia', body: 'Contexto', duration: 28},
    {id: 'reveal', cue: 'READY', title: 'Propuesta', body: 'Objetivo', duration: 24},
    {id: 'launch', cue: 'ENTER', title: 'Entrar', body: 'Deck', duration: 18}
  ],
  theme: {primary: '#05070d', accent: '#65e9f4', glow: '#ff4fa3'}
};

test('presentation Presite contract accepts canonical input and the presiteSlug alias', () => {
  assert.deepEqual(normalizePresiteOpening({slug: 'demo-intro', launchUrl: 'https://evil.test', skipIntro: false}), {
    schemaVersion: 1,
    enabled: true,
    slug: 'demo-intro'
  });
  assert.deepEqual(presiteOpeningInput({presiteSlug: 'demo-intro'}), {
    schemaVersion: 1,
    enabled: true,
    slug: 'demo-intro'
  });
  assert.equal(presiteOpeningInput({presite: null}, {slug: 'old-intro'}), null);
  assert.deepEqual(presiteOpeningInput({}, {slug: 'old-intro'}), {
    schemaVersion: 1,
    enabled: true,
    slug: 'old-intro'
  });
  assert.throws(() => normalizePresiteOpening({slug: '../private'}), /Presite válido/);
});

test('public Presite metadata derives trusted launch and deck URLs', () => {
  assert.deepEqual(publicPresiteOpening({slug: 'demo-intro'}, 'demo'), {
    slug: 'demo-intro',
    launchUrl: '/presentaciones/demo/open',
    deckUrl: '/presentaciones/demo/presentacion',
    skipIntro: true,
    transition: 'seamless'
  });
  assert.equal(publicPresiteOpening(null, 'demo'), null);
  assert.equal(publicPresiteOpening({slug: '../private'}, 'demo'), null);
});

test('opening route reuses the Presite runtime and forces its destination to the deck', async () => {
  const response = await openPresentation({
    params: {client: 'demo'},
    env: {PRESENTATION_IDEAS: kv({
      'presentation:demo': {slug: 'demo', presite: {schemaVersion: 1, enabled: true, slug: 'demo-intro'}},
      'presite:site:demo-intro': presite
    })},
    next() { throw new Error('unexpected next'); }
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(html, /id="skipIntro"/);
  assert.match(html, /Saltar intro/);
  assert.match(html, /location\.assign\(config\.destination\)/);
  assert.match(html, /"destination":"\/presentaciones\/demo\/presentacion"/);
  assert.doesNotMatch(html, /https:\/\/example\.com\/never-use-this/);
});

test('opening route degrades to the deck when disabled or the referenced Presite is missing', async () => {
  for (const [presiteConfig, expected] of [
    [null, 'disabled'],
    [{slug: 'missing-intro'}, 'missing']
  ]) {
    const response = await openPresentation({
      params: {client: 'demo'},
      env: {PRESENTATION_IDEAS: kv({
        'presentation:demo': {slug: 'demo', presite: presiteConfig}
      })},
      next() { throw new Error('unexpected next'); }
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/presentaciones/demo/presentacion');
    assert.equal(response.headers.get('x-presite-status'), expected);
  }
});
