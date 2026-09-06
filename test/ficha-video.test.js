// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
/* La ficha decide cómo se llama la pieza en el catálogo y en qué categoría cae.
 * Es la diferencia entre 14 vídeos distintos y 14 vídeos con el mismo nombre. */
import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
test.before(async () => { mod = await import('../functions/presentaciones/api/_ficha-video.mjs'); });

test('la ficha del encargo llega tal cual', () => {
  const f = mod.saneaFicha({
    title: 'La privacidad es una decisión de producto',
    comment: 'Los líderes de tecnología deben respaldar leyes de protección de datos.',
    tags: ['tech', 'capsula', '15s']
  });
  assert.equal(f.title, 'La privacidad es una decisión de producto');
  assert.match(f.comment, /protección de datos/);
  assert.ok(f.tags.includes('tech'));
  assert.equal(f.tags[0], 'admiranext', 'las de casa primero, siempre');
});

test('las etiquetas de casa van SIEMPRE, aunque el encargo se las olvide', () => {
  const f = mod.saneaFicha({title: 'Algo', tags: ['tech']});
  // Sin 'tiktok' la pieza no cae en la categoría tiktoks y deja de estar donde
  // se la busca; sin 'vertical' el MUPI la recorta en vez de emitir 9:16.
  assert.ok(f.tags.includes('tiktok'));
  assert.ok(f.tags.includes('vertical'));
  assert.ok(f.tags.includes('admiranext'));
});

test('sin ficha se publica igual: perder el vídeo sería peor', () => {
  for (const nada of [null, undefined, {}, {title: '   '}]) {
    const f = mod.saneaFicha(nada);
    assert.equal(f.title, mod.FICHA_POR_DEFECTO.title);
    assert.ok(f.comment.length > 0);
    assert.deepEqual(f.tags, mod.ETIQUETAS_BASE);
  }
});

test('las etiquetas se normalizan y no se repiten', () => {
  const f = mod.saneaFicha({title: 'X', tags: ['Tech', 'tech', 'TikTok', '  15 s ', '', '¡¿?!']});
  assert.equal(new Set(f.tags).size, f.tags.length);
  assert.ok(f.tags.includes('tech'));
  assert.ok(!f.tags.some(t => t !== t.toLowerCase() || /\s/.test(t)), 'sin mayúsculas ni espacios');
  assert.ok(!f.tags.includes(''), 'las que se quedan en nada no entran');
});

test('con un solo hueco libre sobrevive la primera etiqueta propia', () => {
  // El Stock guarda CUATRO y tres se van en las de casa. La que quede la decide
  // el orden en que las manda quien encarga, no el azar del recorte.
  const f = mod.saneaFicha({title: 'X', tags: ['tech', 'capsula', '15s']});
  assert.equal(f.tags.length, 4);
  assert.ok(f.tags.includes('tech'), 'el tema es lo que da los hashtags: no puede caerse');
  assert.ok(!f.tags.includes('15s'));
});

test('un título kilométrico se recorta antes de salir por la red', () => {
  const f = mod.saneaFicha({title: 'a'.repeat(5000), comment: 'b'.repeat(50000)});
  assert.ok(f.title.length <= 200);
  assert.ok(f.comment.length <= 1200);
});

test('los saltos de línea no viajan al título del catálogo', () => {
  const f = mod.saneaFicha({title: '  Dos\n\nlíneas  ', comment: 'a\nb'});
  assert.equal(f.title, 'Dos líneas');
  assert.equal(f.comment, 'a b');
});
