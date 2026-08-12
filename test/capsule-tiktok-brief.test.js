/* La traducción cápsula → TikTok de 15 s es donde se decide si el vídeo sirve o
 * es relleno, así que se prueba aquí y no a ojo mirando el resultado. */
const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../functions/presentaciones/api/_capsule-brief.mjs');
});

const CAPSULA = {
  type: 'capsula',
  title: 'Tim Cook impulsa automatización de privacidad',
  tags: ['tech', 'good', 'timcook'],
  comment: 'Los líderes de tecnología deben respaldar leyes federales de protección de datos. ' +
    'Esto exige tratar la privacidad como una decisión de producto y no como un trámite legal.'
};

test('el tema sale de las etiquetas que la cápsula YA trae', () => {
  assert.equal(mod.temaDeCapsula(CAPSULA), 'tech');
  assert.equal(mod.temaDeCapsula({tags: ['creatividad']}), 'creativity');
  assert.equal(mod.temaDeCapsula({tags: ['negocio']}), 'business');
  // Sin etiqueta de tema no se inventa una: lo dice quien la publicó o no lo dice nadie.
  assert.equal(mod.temaDeCapsula({tags: ['good', 'timcook']}), null);
});

test('cada tema suena distinto: si no, un vídeo de negocio parece uno de tecnología', () => {
  const tech = mod.briefDesdeCapsula(CAPSULA);
  const negocio = mod.briefDesdeCapsula({...CAPSULA, tags: ['business']});
  const creativo = mod.briefDesdeCapsula({...CAPSULA, tags: ['creativity']});
  assert.notEqual(tech.prompt, negocio.prompt);
  assert.notEqual(negocio.prompt, creativo.prompt);
  assert.match(tech.prompt, /sobrio/);
  assert.match(negocio.prompt, /cuesta/);
  assert.match(creativo.prompt, /juego/);
});

test('se ELIGE una idea, no se recorta media frase', () => {
  const idea = mod.ideaPrincipal(CAPSULA.comment);
  assert.ok(idea.length > 40, 'una idea de dos palabras deja el vídeo mudo');
  assert.ok(!idea.endsWith(' '), 'no se corta a mitad de palabra');
  // 15 s son unas 40 palabras dichas en voz alta: más no cabe.
  assert.ok(idea.split(/\s+/).length <= 41, 'no cabe más de lo que se puede decir en 15 s');
});

test('una frase corta se completa con la siguiente', () => {
  const idea = mod.ideaPrincipal('La privacidad importa. Y por eso hay que tratarla como una decisión de producto desde el primer día.');
  assert.ok(idea.split(/\s+/).length >= 15, 'una frase de seis palabras no llena 15 segundos');
});

test('sin texto NO se genera: mejor nada que 15 s de relleno que alguien tendrá que tirar', () => {
  assert.equal(mod.briefDesdeCapsula({title: 'Vacía', tags: ['tech'], comment: ''}), null);
  assert.equal(mod.briefDesdeCapsula({title: 'Corta', tags: ['tech'], comment: 'Ideas sueltas.'}), null);
});

test('el brief sale listo para EMITIRSE, no solo para verse', () => {
  const b = mod.briefDesdeCapsula(CAPSULA);
  // 'vertical' es la llave con la que el MUPI emite en 9:16 nativo en vez de recortar.
  assert.ok(b.tags.includes('vertical'));
  assert.ok(b.tags.includes('capsula'));
  assert.ok(b.tags.includes('tech'));
  assert.ok(b.titulo.length > 0);
  assert.match(b.prompt, /15 segundos/);
  assert.match(b.prompt, /9:16/);
  // Sin caras ni marcas: son piezas para pantalla de calle, no para redes.
  assert.match(b.prompt, /sin caras reconocibles/i);
});
