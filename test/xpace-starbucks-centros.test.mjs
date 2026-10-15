// Starbucks en «Proyecto y local» (Carlos, 15-oct-2026): Paseo de Gràcia 103, Diagonal 634 y Gran de Gràcia 51.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/xpace/demos.js';
import { DEMOS, SEEDS, validateVenue } from '../functions/_xpace-registry.js';

const starbucks = SEEDS.filter(p => p.id === 'starbucks').map(p => ({ id: p.id, circuit: p.circuit }));

test('the public demos list the three Starbucks venues, Paseo de Gràcia first', async () => {
  const r = await onRequestGet({ request: new Request('https://www.admiranext.com/api/xpace/demos', { headers: { Origin: 'https://www.admira.store' } }) });
  const body = await r.json();
  const venues = body.venues.filter(v => v.project_id === 'starbucks');
  assert.deepEqual(venues.map(v => v.id), ['demo-starbucks', 'starbucks-diagonal-634', 'lab-gran-de-gracia-51']);
  assert.deepEqual(venues.map(v => v.name), ['Starbucks Paseo de Gràcia 103 · Barcelona', 'Starbucks Diagonal 634 · Barcelona', 'Gran de Gràcia 51 · laboratorio AdmiraNeXT · Barcelona']);
  assert.ok(body.projects.some(p => p.id === 'starbucks'));
  const [pg, diag, lab] = venues.map(v => new URL(v.xpace_url));
  assert.equal(pg.pathname, '/admira-xp/'); assert.equal(pg.searchParams.get('loc'), 'alsea-sbux-021', 'Paseo de Gràcia keeps the Matrix twin');
  assert.equal(diag.pathname, '/xpacios/starbucks-centros/'); assert.equal(diag.searchParams.get('loc'), 'starbucks-diagonal-634');
  assert.equal(lab.pathname, '/xpacios/gran-de-gracia-51/'); assert.equal(lab.searchParams.get('loc'), 'lab-gran-de-gracia-51', 'the lab keeps its real location');
  assert.equal(new Set(DEMOS.map(v => v.id)).size, DEMOS.length, 'demo ids stay unique');
});

test('an admin can register the same three venues for accounts', () => {
  for (const v of DEMOS.filter(d => d.project_id === 'starbucks')) {
    const saved = validateVenue({ ...v, enabled: true }, starbucks);
    const u = new URL(saved.xpace_url);
    assert.equal(u.searchParams.get('project'), 'starbucks'); assert.equal(u.searchParams.get('circuit'), 'alsea_starbucks');
  }
});

test('the centres page is accepted only for Starbucks and only with its own venue', () => {
  const v = { id: 'starbucks-diagonal-634', project_id: 'starbucks', name: 'Starbucks Diagonal 634', enabled: true, xpace_url: 'https://www.admira.store/xpacios/starbucks-centros/?loc=starbucks-diagonal-634' };
  assert.ok(validateVenue(v, starbucks));
  const otros = [...starbucks, { id: 'altadis', circuit: 'altadis_bcn' }];
  for (const patch of [
    { project_id: 'altadis' },
    { id: 'otro-local' },
    { xpace_url: v.xpace_url.replace('starbucks-centros/', 'otra-pagina/') },
    { xpace_url: v.xpace_url + '&token=secreto' },
    { xpace_url: v.xpace_url.replace('https://www.admira.store', 'https://evil.example') },
  ]) assert.throws(() => validateVenue({ ...v, ...patch }, otros), JSON.stringify(patch));
});
