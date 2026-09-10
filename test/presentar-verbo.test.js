// Presentar → MCP en la FACE (Jobs, HandON 10-sep-2026, P0 · FLT-100180 · MorfeoMacMini).
// GET /presentar daba 404 en admiranext.com mientras la UI del verbo vivía en admira.live.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = (rel) => readFile(new URL(rel, root), 'utf8');

test('/presentar existe, lleva sello y abre las tres puertas del verbo', async () => {
  const html = await read('presentar.html');
  assert.match(html, /<meta name="admiranext-version" content="v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}"/);
  for (const puerta of ['href="/mcp/generador"', 'href="/presentaciones/"', 'href="https://www.admira.live/"']) assert.ok(html.includes(puerta), puerta);
  for (const tool of ['list_presentations', 'create_presentation', 'generation_status', 'presentation_urls']) assert.ok(html.includes(tool), tool);
  assert.ok(html.includes('https://www.admiranext.com/mcp'), 'endpoint del MCP');
});
test('el hub MCP, llms.txt y el sitemap enlazan /presentar', async () => {
  assert.ok((await read('mcp/index.html')).includes('href="https://www.admiranext.com/presentar"'));
  assert.ok((await read('mcp/llms.txt')).includes('https://www.admiranext.com/presentar'));
  assert.ok((await read('sitemap.xml')).includes('https://www.admiranext.com/presentar</loc>'));
});
