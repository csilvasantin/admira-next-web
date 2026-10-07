import test from 'node:test';
import assert from 'node:assert/strict';
import {withMetaStyle} from '../functions/presentaciones/_meta-style.js';
test('el pie común cuenta láminas, conserva secciones anidadas e ignora HTML dentro de scripts',()=>{
  const input='<html><head></head><body><section class="slide cover"><section>Contenido interior</section></section><section class="slide demo-documentation">Demo</section><script>const example="<section class=\"slide\">Ejemplo</section>"</script></body></html>';
  const result=withMetaStyle(input,'Alsea <script>');
  assert.equal((result.match(/class="meta-footer"/g)||[]).length,2);
  assert.match(result,/01 \/ 2/);assert.match(result,/02 \/ 2/);
  assert.match(result,/<section>Contenido interior<\/section><footer/);
  assert.match(result,/Alsea &lt;script&gt;/);
  assert.match(result,/const example="<section/);
});
