import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// FLT-101307 · Carlos, 1-oct-2026: todos los DeepAgents de Admira tienen que saber de las
// 4 patas de AdmiraNeXT. Es visión de producto, no un mandamiento ni una norma.
const leer = (ruta) => readFile(new URL(`../${ruta}`, import.meta.url), "utf8");
const filosofia = await leer("filosofia.html");
const hub = await leer("mcp/index.html");
const llms = await leer("mcp/llms.txt");
const manifest = JSON.parse(await leer("mcp/manifest.json"));

const PATAS = [
  { dominio: "admira.studio", equivale: "pixeria.com", funcion: /importación y creación de contenidos/i },
  { dominio: "admira.store", equivale: "xpaceos.com", funcion: /inventario del punto de venta y distribución/i },
  { dominio: "admira.biz", equivale: "clearchannel.tv", funcion: /DooH y Retail Media/i },
  { dominio: "admira.app", equivale: null, funcion: /instalaciones y mantenimiento/i },
];

const bloque = filosofia.match(/<section id="cuatro-patas">[\s\S]*?<\/section>/)?.[0] ?? "";
const plano = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("filosofía publica las 4 patas con sus dominios principales y equivalentes", () => {
  assert.ok(bloque, "falta <section id=\"cuatro-patas\"> en filosofia.html");
  assert.match(bloque, /Las 4 patas de AdmiraNeXT/);
  assert.match(plano(bloque), /sistema operativo del retail/);
  assert.equal((bloque.match(/class="pata"/g) ?? []).length, 4);
  for (const { dominio, equivale, funcion } of PATAS) {
    assert.ok(bloque.includes(`href="https://www.${dominio}/"`), `falta el enlace a ${dominio}`);
    if (equivale) assert.ok(bloque.includes(`href="https://www.${equivale}/"`), `falta ${equivale} como equivalente de ${dominio}`);
    assert.match(plano(bloque), funcion);
  }
});

test("las patas van en orden Studio → Store → Biz → App, con MCP y admira.app maestro del ITIL", () => {
  const posiciones = PATAS.map(({ dominio }) => bloque.indexOf(`https://www.${dominio}/`));
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
  assert.match(bloque, /Studio → Store → Biz → App/);
  assert.match(plano(bloque), /MCP/);
  assert.match(plano(bloque), /maestro del ITIL/);
});

test("el bloque es visión, no mandamiento: los 15 Mandamientos no cambian de número", () => {
  assert.equal((filosofia.match(/<div class="cmd"><div class="num">/g) ?? []).length, 15);
  assert.ok(filosofia.indexOf('id="cuatro-patas"') < filosofia.indexOf("<h2>Las Máximas</h2>"));
});

test("la capa MCP entrega las 4 patas a los agentes y explica la trilogía", () => {
  for (const { dominio, equivale } of PATAS) {
    assert.ok(llms.includes(dominio) && hub.includes(dominio), `falta ${dominio} en llms.txt o el hub`);
    if (equivale) assert.ok(llms.includes(equivale) && hub.includes(equivale), `falta ${equivale} en llms.txt o el hub`);
  }
  assert.doesNotMatch(hub, /patas en la trilogía/);
  // El <span> puede llevar atributos (data-en con su versión inglesa, 9-oct-2026).
  assert.match(hub, /<strong>4<\/strong><span[^>]*>patas del sistema operativo del retail/);
  assert.match(llms, /trilogía corporativa/);
  const patas = manifest.cuatro_patas?.patas ?? [];
  assert.deepEqual(patas.map((p) => p.dominio), PATAS.map((p) => `https://www.${p.dominio}`));
  assert.deepEqual(patas.map((p) => p.equivale_a), PATAS.map((p) => (p.equivale ? `https://www.${p.equivale}` : null)));
});

const PROHIBIDO = [
  /admira\.app\s*=\s*[^\n<]{0,40}clearchannel/i,
  /admira\.app\s*=\s*[^\n<]{0,40}yokup/i,
  /admira\.app\s*\(\s*ClearChannel/i,
  /clearchannel\.tv y admira\.app son el MISMO/i,
];
const PAGINAS = [
  "filosofia.html", "mcp/index.html", "mcp/llms.txt", "mcp/manifest.json",
  "businessplan/index.html", "marcablanca/index.html", "proyectos/index.html",
  "help/index.html", "webmaster.html", "index.html", "libro-de-estilo.html",
  "data/arquitectura.json", "data/roadmap.json",
];

test("ninguna página pública dice que admira.app es clearchannel.tv ni yokup.com", async () => {
  for (const ruta of PAGINAS) {
    const texto = await leer(ruta);
    for (const re of PROHIBIDO) assert.doesNotMatch(texto, re, `${ruta} cumple ${re}`);
  }
});
