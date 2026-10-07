// Una copia del castellano no es un idioma (mezcla de idiomas en Alsea · Starbucks, 07-10-2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {idiomasOfrecidos, esCopiaDelCastellano} from '../functions/presentaciones/_idiomas-reales.js';

const ideas = {
  hero: {eyebrow: 'Estructura AdmiraNeXT · Alsea · Starbucks', title: 'Admira × Alsea', summary: 'Quiénes somos, qué hacemos y qué proponemos. Una propuesta que se demuestra.'},
  objective: 'Elegir un primer piloto de contenidos y operación del espacio con Alsea.',
  skeleton: [
    {title: 'Un local conecta la propuesta con la experiencia', message: 'Partimos del gemelo de demostración de Starbucks.', detail: 'Propuesta de piloto.', product: 'Propuesta para Alsea · Starbucks', promise: 'La ubicación se acuerda con Alsea.'},
    {title: 'Una campaña, cinco formas de crear contenido', message: 'Locución, música, imagen, vídeo y adaptación de formatos.'}
  ],
  closing: {title: 'El piloto empieza con una ubicación y una campaña', action: 'Acordar el primer local.'}
};
const copia = JSON.parse(JSON.stringify(ideas));
const ingles = {
  hero: {eyebrow: 'AdmiraNeXT structure · Alsea · Starbucks', title: 'Admira × Alsea', summary: 'Who we are, what we do and what we propose. A proposal you can see working.'},
  objective: 'Choose a first content and space-operations pilot with Alsea.',
  skeleton: [
    {title: 'One store links the proposal to the experience', message: 'We start from the Starbucks demonstration twin.', detail: 'Pilot proposal.', product: 'Proposal for Alsea · Starbucks', promise: 'The location is agreed with Alsea.'},
    {title: 'One campaign, five ways to create content', message: 'Voice-over, music, image, video and format adaptation.'}
  ],
  closing: {title: 'The pilot starts with one location and one campaign', action: 'Agree on the first store.'}
};

test('una «traducción» que es copia literal del castellano no cuenta como idioma', () => {
  assert.equal(esCopiaDelCastellano(ideas, copia), true);
  assert.deepEqual(idiomasOfrecidos(['es', 'en'], {...ideas, translations: {en: copia}}), ['es']);
});

test('una traducción de verdad se ofrece, aunque conserve nombres propios iguales', () => {
  assert.equal(esCopiaDelCastellano(ideas, ingles), false);
  assert.deepEqual(idiomasOfrecidos(['es', 'en'], {...ideas, translations: {en: ingles}}), ['es', 'en']);
  assert.deepEqual(idiomasOfrecidos(['en', 'es'], {...ideas, translations: {en: ingles}}), ['en', 'es'], 'respeta el orden declarado: el primero es el idioma inicial');
});

test('idioma declarado sin traducción, vacía o a medias: se sigue ofreciendo y se ve incompleto (decisión anterior)', () => {
  assert.deepEqual(idiomasOfrecidos(['es', 'ca', 'en'], {...ideas, translations: {en: ingles}}), ['es', 'ca', 'en']);
  assert.deepEqual(idiomasOfrecidos(['es', 'ca'], {...ideas, translations: {ca: {}}}), ['es', 'ca']);
  assert.deepEqual(idiomasOfrecidos(['en', 'es'], ideas), ['en', 'es']);
  assert.equal(esCopiaDelCastellano(ideas, null), false);
  assert.equal(esCopiaDelCastellano(ideas, {...ingles, objective: ''}), false);
});

test('una presentación solo en otro idioma: con traducción real lo conserva; con copia cae a castellano', () => {
  assert.deepEqual(idiomasOfrecidos(['en'], {...ideas, translations: {en: ingles}}), ['en']);
  assert.deepEqual(idiomasOfrecidos(['en'], {...ideas, translations: {en: copia}}), ['es']);
});

test('sin lista, lista vacía, repetidos y mayúsculas', () => {
  assert.deepEqual(idiomasOfrecidos(undefined, ideas), ['es']);
  assert.deepEqual(idiomasOfrecidos([], ideas), ['es']);
  assert.deepEqual(idiomasOfrecidos(['ES', 'es', 'EN', 'en'], {...ideas, translations: {en: ingles}}), ['es', 'en']);
});

test('casi copia y traducción mayoritaria: manda lo que más abunda entre los textos escritos', () => {
  const casiCopia = JSON.parse(JSON.stringify(ideas)); casiCopia.hero.eyebrow = 'AdmiraNeXT structure · Alsea · Starbucks';
  assert.equal(esCopiaDelCastellano(ideas, casiCopia), true);
  const mayoria = JSON.parse(JSON.stringify(ingles)); mayoria.skeleton = [ideas.skeleton[1], ingles.skeleton[0]];
  assert.equal(esCopiaDelCastellano(ideas, mayoria), false);
});

test('el render de la presentación pasa la lista de idiomas por este filtro', () => {
  const src = readFileSync(new URL('../functions/presentaciones/[client]/presentacion.js', import.meta.url), 'utf8');
  assert.match(src, /import \{idiomasOfrecidos\} from '\.\.\/_idiomas-reales\.js';/);
  assert.match(src, /const languages=idiomasOfrecidos\(/);
});
