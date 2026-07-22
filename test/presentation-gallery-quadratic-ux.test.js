import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controls = [
  ['ykOptionsToggle', 'ykOptionsPanel'],
  ['ykAdvancedToggle', 'ykAdvancedPanel'],
  ['ykExpertToggle', 'ykExpertPanel']
];

function elementWithId(html, id) {
  return html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, 'i'))?.[0] || '';
}

test('presentation gallery exposes the quadratic options hierarchy accessibly', async () => {
  const gallery = await readFile(new URL('../presentaciones/index.html', import.meta.url), 'utf8');

  for (const [toggleId, panelId] of controls) {
    const toggle = elementWithId(gallery, toggleId);
    assert.ok(toggle, `missing #${toggleId}`);
    assert.match(toggle, new RegExp(`\\baria-controls=["']${panelId}["']`, 'i'));
    assert.match(toggle, /\baria-expanded=["'](?:true|false)["']/i);
    assert.ok(elementWithId(gallery, panelId), `missing #${panelId}`);
  }

  assert.match(gallery, /(?:src|href)=["']\/assets\/presentations-quadratic-ui\.js["']/i);
});

test('quadratic redesign preserves access control and presenter entry points', async () => {
  const gallery = await readFile(new URL('../presentaciones/index.html', import.meta.url), 'utf8');

  assert.match(gallery, /href=["']\/presentaciones\/control\/["']/i);
  assert.match(gallery, /href=["']\/presentaciones\/generador\/["']/i);
});
