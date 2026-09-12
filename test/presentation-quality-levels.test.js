import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('quality levels live in a dedicated asset and are injected separately from the inline editor',async()=>{
  const [quality,editor,middleware]=await Promise.all([
    readFile(new URL('../assets/presentation-quality-levels.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-inline-editor.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/presentaciones/_middleware.js',import.meta.url),'utf8')
  ]);

  assert.match(quality,/__ADMIRA_PRESENTATION_STATE__/);
  assert.match(quality,/audience.*=== '1'|get\('audience'\)==='1'/);
  assert.match(quality,/presenter-audience-mode/);
  assert.match(quality,/querySelector\('\.quality-levels'\)/);
  assert.match(quality,/className='quality-levels'|className="quality-levels"/);
  assert.match(quality,/Good, Better and Best/);
  assert.match(quality,/dataset\.deckQuality/);
  assert.match(quality,/Look & feel de la presentación Admira/);
  assert.match(quality,/Cada lámina con imagen temática del tema \(Grok\)/);
  assert.match(quality,/Imagen descriptiva encima del fondo/);
  assert.match(quality,/__ADMIRA_APPLY_QUALITY__/);
  assert.match(quality,/searchParams\.set\('quality'/);
  assert.match(quality,/\.quality-levels\{/);

  assert.doesNotMatch(editor,/quality-levels/);
  assert.doesNotMatch(editor,/__ADMIRA_APPLY_QUALITY__/);
  assert.doesNotMatch(editor,/Good, Better and Best/);
  assert.match(editor,/__ADMIRA_CAN_EDIT__/);
  assert.match(editor,/\.inline-editor\{top:68px\}/);

  assert.match(middleware,/presentation-quality-levels\.js\?v=20260912-hoist/);
  assert.match(middleware,/qualityLevels:\s*isPresentationMode && !isAudienceOutput/);
  assert.match(middleware,/inlineEditor:\s*isPresentationMode && !isAudienceOutput && \(masterValid \|\| editorValid\)/);
});
