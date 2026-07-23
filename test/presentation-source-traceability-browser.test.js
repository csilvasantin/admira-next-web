import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/qa/source-traceability.js';

async function render(suffix=''){
  return onRequestGet({request:new Request(`https://admiranext.test/qa/source-traceability${suffix}`)});
}

test('fixture visual usa el runtime real y expone contrato solo al presentador',async()=>{
  const response=await render();
  const html=await response.text();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(html,/data-presenter-surface="presenter"/);
  assert.match(html,/__ADMIRA_SOURCE_TRACEABILITY__/);
  assert.match(html,/__ADMIRA_COMPATIBILITY_LAB__/);
  assert.match(html,/__ADMIRA_ROOM_DEVICE_LAB__/);
  assert.match(html,/presentation-source-traceability\.js/);
  assert.match(html,/presentation-room-device-lab\.js/);
  assert.match(html,/presentation-presenter-mode\.js/);
  assert.match(html,/claim-cover/);
  assert.doesNotMatch(html,/presenter-audience-mode/);
});

test('fixture visual de audiencia elimina contrato, runtime privado y notas',async()=>{
  const response=await render('?audience=1');
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/presenter-audience-mode/);
  assert.match(html,/data-presenter-surface="audience"/);
  assert.match(html,/presentation-presenter-mode\.js/);
  assert.doesNotMatch(html,/__ADMIRA_SOURCE_TRACEABILITY__|__ADMIRA_COMPATIBILITY_LAB__|__ADMIRA_ROOM_DEVICE_LAB__|presentation-source-traceability\.js|presentation-room-device-lab\.js|mobile:codecs|proposal:qa|claim-cover|data-speaker-notes|Confirmar fuentes|Validar aislamiento/);
});

test('fixture visual puede abrir el panel real solo en presentador',async()=>{
  const presenter=await (await render('?open=1')).text();
  const audience=await (await render('?audience=1&open=1')).text();
  assert.match(presenter,/admiraPresenterLaunch.*\?\.click\(\)/);
  assert.doesNotMatch(audience,/admiraPresenterLaunch.*\?\.click\(\)/);
});
