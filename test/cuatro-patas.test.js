import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// FLT-101307 · Carlos, 1-oct-2026, ampliado en #5548: cinco patas, no cuatro.
// El ancla sigue siendo #cuatro-patas. Es visión de producto, no un mandamiento.
const leer = (ruta) => readFile(new URL(`../${ruta}`, import.meta.url), "utf8");
const filosofia = await leer("filosofia.html");
const hub = await leer("mcp/index.html");
const llms = await leer("mcp/llms.txt");
const manifest = JSON.parse(await leer("mcp/manifest.json"));

const PATAS = [
  { dominio: "admira.studio", href: "https://www.admira.studio/", funcion: /creación y adaptación de contenidos/i },
  { dominio: "admira.store", href: "https://www.admira.store/", funcion: /distribución, gemelo e inventario/i },
  { dominio: "admira.tv", href: "https://admira.tv/", funcion: /reproducción, emisión y proof of play/i },
  { dominio: "admira.app", href: "https://admira.app/", funcion: /instalaciones y mantenimiento/i },
  { dominio: "admira.biz", href: "https://admira.biz/", funcion: /DooH y Retail Media/i },
];

const bloque = filosofia.match(/<section id="cuatro-patas">[\s\S]*?<\/section>/)?.[0] ?? "";
const plano = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("filosofía publica las 5 patas con sus dominios", () => {
  assert.ok(bloque, "falta <section id=\"cuatro-patas\"> en filosofia.html");
  assert.match(bloque, /Las 5 patas de AdmiraNeXT/);
  assert.match(plano(bloque), /tecnología/);
  assert.match(plano(bloque), /creatividad/);
  assert.match(plano(bloque), /negocio/);
  assert.equal((bloque.match(/class="pata"/g) ?? []).length, 5);
  for (const { href, funcion } of PATAS) {
    assert.ok(bloque.includes(`href="${href}"`), `falta el enlace ${href}`);
    assert.match(plano(bloque), funcion);
  }
  assert.doesNotMatch(plano(bloque), /pixeria|yokup|xpaceos|clearchannel/i);
});

test("las patas van studio → store → tv → app → biz, con MCP y admira.app maestro del ITIL", () => {
  const posiciones = PATAS.map(({ href }) => bloque.indexOf(href));
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
  assert.match(bloque, /studio → store → tv → app → biz/);
  assert.match(plano(bloque), /MCP/);
  assert.match(plano(bloque), /maestro del ITIL/);
});

test("el bloque es visión, no mandamiento: los 15 Mandamientos no cambian de número", () => {
  assert.equal((filosofia.match(/<div class="cmd"><div class="num">/g) ?? []).length, 15);
  assert.ok(filosofia.indexOf('id="cuatro-patas"') < filosofia.indexOf("<h2>Las Máximas</h2>"));
});

test("la capa MCP entrega las 5 patas a los agentes y explica la trilogía", () => {
  for (const { dominio } of PATAS) {
    assert.ok(llms.includes(dominio) && hub.includes(dominio), `falta ${dominio} en llms.txt o el hub`);
  }
  assert.doesNotMatch(hub, /patas en la trilogía/);
  assert.match(hub, /<strong>5<\/strong><span[^>]*>patas del sistema operativo del retail/);
  assert.match(llms, /trilogía corporativa/);
  const patas = manifest.cuatro_patas?.patas ?? [];
  assert.deepEqual(patas.map((p) => p.dominio), PATAS.map((p) => p.href.replace(/\/$/, "")));
  assert.deepEqual(patas.map((p) => p.equivale_a), PATAS.map(() => null));
  assert.deepEqual(patas.map((p) => p.verbo), ["crea", "distribuye", "emite", "mantiene", "comercializa"]);
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
