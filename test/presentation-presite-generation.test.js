import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPut as generatePresentation} from '../functions/presentaciones/api/generate.js';

class KV {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    ]));
  }
  async get(key, options) {
    const value = this.values.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) {
    this.values.set(key, value);
  }
}

const inspiration = {
  schemaVersion: 1,
  url: 'https://client.test/',
  finalUrl: 'https://client.test/',
  host: 'client.test',
  title: 'Client',
  primary: '#12233e',
  accent: '#ffb000',
  background: '#f5f6f8',
  surface: '#ffffff',
  text: '#142238',
  palette: ['#12233e', '#ffb000'],
  mode: 'light',
  fontStyle: 'grotesk',
  radius: 10,
  radiusStyle: 'soft',
  density: 'balanced',
  layout: 'editorial',
  profile: 'structured',
  logo: {
    type: 'svg',
    sourceUrl: 'https://client.test/',
    svg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>'
  }
};

function request(extra = {}) {
  return new Request('https://admiranext.test/presentaciones/api/generate', {
    method: 'PUT',
    headers: {origin: 'https://admiranext.test', 'content-type': 'application/json'},
    body: JSON.stringify({
      displayName: 'Client',
      slug: 'client',
      website: 'https://client.test/',
      problem: 'Resolver una necesidad concreta.',
      outputs: ['website'],
      languages: ['es'],
      inspiration,
      ...extra
    })
  });
}

function environment(values = {}) {
  return {
    PRESENTATION_IDEAS: new KV(values),
    PRESENTATION_MEDIA: {async put() {}},
    PRES_SIGNING_KEY: 'test-signing-key'
  };
}

test('generation persists only the canonical Presite slug and derives safe public URLs', async () => {
  const env = environment({
    'presite:site:client-intro': {
      slug: 'client-intro',
      destination: {url: 'https://evil.test/editor'},
      passwordVerifier: 'must-not-leak'
    }
  });
  const response = await generatePresentation({
    request: request({presite: {
      slug: 'client-intro',
      launchUrl: 'https://evil.test/launch',
      deckUrl: '/presites/client-intro/',
      skipIntro: false
    }}),
    env
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.deepEqual(body.presite, {
    slug: 'client-intro',
    launchUrl: '/presentaciones/client/open',
    deckUrl: '/presentaciones/client/presentacion',
    skipIntro: true,
    transition: 'seamless'
  });
  assert.equal(body.launchUrl, '/presentaciones/client/open');
  assert.doesNotMatch(JSON.stringify(body), /evil|passwordVerifier|presites\/client-intro/);
  const stored = await env.PRESENTATION_IDEAS.get('presentation:client', {type: 'json'});
  assert.deepEqual(stored.presite, {
    schemaVersion: 1,
    enabled: true,
    slug: 'client-intro'
  });
});

test('generation without a Presite preserves the direct-deck flow', async () => {
  const env = environment();
  const response = await generatePresentation({request: request({presite: null}), env});
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.presite, null);
  assert.equal(body.launchUrl, '/presentaciones/client/presentacion');
  assert.equal(body.deckUrl, '/presentaciones/client/presentacion');
  const stored = await env.PRESENTATION_IDEAS.get('presentation:client', {type: 'json'});
  assert.equal(stored.presite, null);
});

test('generation rejects a missing Presite before creating presentation state', async () => {
  const env = environment();
  const response = await generatePresentation({
    request: request({presiteSlug: 'missing-intro'}),
    env
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(body.error, 'El Presite seleccionado no existe.');
  assert.equal(body.presite, 'missing-intro');
  assert.equal(await env.PRESENTATION_IDEAS.get('presentation:client'), null);
});
