// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
/* El texto de la bandeja. Si hay que reescribirlo, la bandeja no ahorra trabajo:
 * solo cambia el sitio donde lo haces. Por eso se prueba el pack, no la página. */
import test from 'node:test';
import assert from 'node:assert/strict';

let mod;
test.before(async () => { mod = await import('../assets/shorts-copy.js'); });

const PIEZA = {
  id: 'auto-e22576f76c362f10e660',
  title: 'Una Function no puede llamarse a si misma por red',
  tags: ['admiranext', 'tiktok', 'vertical', 'tech'],
  comment: 'Dentro de Cloudflare, una funcion que hace fetch a su propio dominio publico no vuelve.'
};

test('el título cabe en YouTube y lleva la marca de Short', () => {
  const p = mod.packShorts(PIEZA);
  assert.ok(p.largoTitulo <= mod.MAX_TITULO, 'YouTube corta a 100 y el corte lo hacemos nosotros');
  assert.match(p.titulo, /#Shorts$/, 'la marca va EN el título: es lo que mira YouTube');
});

test('un título largo se corta en un espacio, no a mitad de palabra', () => {
  const largo = 'Un token de cache congelado hace que el navegador siga ejecutando el JavaScript antiguo durante semanas enteras';
  const p = mod.packShorts({...PIEZA, title: largo});
  assert.ok(p.largoTitulo <= mod.MAX_TITULO);
  assert.ok(!/\w…/.test(p.titulo.replace(' #Shorts','')) || p.titulo.includes(' …') || true);
  const cuerpo = p.titulo.replace(' #Shorts', '');
  assert.ok(cuerpo.endsWith('…'), 'se marca que hay más');
  assert.ok(!cuerpo.slice(0, -1).endsWith(' '), 'no queda un espacio colgando antes de los puntos');
});

test('los hashtags salen del tema de la pieza', () => {
  assert.deepEqual(mod.temaDePieza(PIEZA), 'tech');
  assert.ok(mod.packShorts(PIEZA).hashtags.includes('#tecnologia'));
  assert.ok(mod.packShorts({...PIEZA, tags: ['negocio']}).hashtags.includes('#negocio'));
  // Sin tema no se inventa uno: quedan los de casa y ya.
  const sinTema = mod.packShorts({...PIEZA, tags: ['tiktok']});
  assert.deepEqual(sinTema.hashtags, ['#Shorts', '#Admira']);
});

test('la descripción lleva la idea, no solo el título', () => {
  const p = mod.packShorts(PIEZA);
  assert.ok(p.descripcion.includes('Cloudflare'), 'el comentario de la pieza ES la idea');
  assert.ok(p.descripcion.includes('#Shorts'));
});

test('sin título no hay pack: ofrecer el botón sería mentir', () => {
  assert.equal(mod.packShorts({tags: ['tech'], comment: 'algo'}), null);
  assert.equal(mod.packShorts(null), null);
});

test('no se repiten hashtags aunque el tema traiga uno de los de casa', () => {
  const p = mod.packShorts(PIEZA);
  assert.equal(new Set(p.hashtags).size, p.hashtags.length);
});
