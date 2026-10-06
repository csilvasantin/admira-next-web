import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const leer = (rel) => readFile(new URL('../' + rel, import.meta.url), 'utf8');

test('el organigrama nombra a los seis consejeros, su pata y el DeepAgent que dirige', async () => {
  const html = await leer('organigrama.html');
  const nombres = [...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(nombres, [
    'Steve Jobs',
    'Elon Musk',
    'George Lucas',
    'Jensen Huang',
    'Steve Wozniak',
    'Walt Disney'
  ]);
  assert.ok(html.indexOf('Steve Jobs') < html.indexOf('id="patas"'), 'Jobs queda en la mesa, encima de las cinco patas');
  for (const claim of [
    '«La mesa que une las cinco patas.»',
    '«Reproducción, Emisión y Proof of Play»',
    '«Creación y Adaptación de Contenidos»',
    '«Distribución, Gestión y Visualización»',
    '«Instalaciones, Mantenimiento y Gestión»',
    '«Nuevos ingresos con DooH y Retail Media»'
  ]) assert.ok(html.includes(claim), claim);
  assert.equal((html.match(/DeepAgent que lo dirige/g) || []).length, 6);
  assert.equal((html.match(/Hueco vacío/g) || []).length, 0);
  for (const director of [
    'Morfeo (Claude Code)',
    'Merovingio (DeepAgents)',
    'Oráculo (Codex)',
    'Cypher (DeepAgents)',
    'Smith (Grok)',
    'Niobe (OpenCode)'
  ]) assert.ok(html.includes(director), director);
  assert.ok(html.includes('El DeepAgent se puede cambiar o reforzar según la carga o si se queda sin tokens u horas'));
  assert.doesNotMatch(html, /JTI|Altadis/i);
  for (const href of [
    'https://www.admiranext.com',
    'https://www.admira.tv',
    'https://admira.studio',
    'https://admira.store',
    'https://admira.app',
    'https://www.admira.biz'
  ]) assert.ok(html.includes(`href="${href}"`), href);
});

test('el organigrama está en el menú de la casa y en la zona protegida, no en la portada pública', async () => {
  const [frame, portada, mapa] = await Promise.all([
    leer('assets/admira-frame.js'),
    leer('index.html'),
    leer('sitemap.xml')
  ]);
  assert.match(frame, /\['\/organigrama', 'Organigrama', 'interno'\]/, 'en el mapa del sitio, como entrada interna');
  // Carlos, 06-10-2026: sale de la navegación pública de la portada y vive en la zona protegida.
  assert.doesNotMatch(portada.match(/<nav class="entry-nav"[\s\S]*?<\/nav>/)[0], /href="\/organigrama"/);
  assert.match(await leer('webmaster.html'), /id="zona-protegida"[\s\S]*?<a href="\/organigrama">/);
  const barra = 'Agentes</a><a href="/organigrama" data-yk-interno>Organigrama</a>';
  for (const rel of ['usuarios.html', 'presentaciones/index.html', 'presentaciones/generador.html', 'flota.html']) {
    assert.ok((await leer(rel)).includes(barra), rel);
  }
  assert.doesNotMatch(mapa, /https:\/\/www\.admiranext\.com\/organigrama</, 'privada: fuera del sitemap');
});
