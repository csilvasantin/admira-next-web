import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const normativa = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
const filosofia = await readFile(new URL("../filosofia.html", import.meta.url), "utf8");
const llms = await readFile(new URL("../mcp/llms.txt", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../mcp/manifest.json", import.meta.url), "utf8"));
const rule = normativa.match(/<article class="art" id="n19">[\s\S]*?<\/article>/)?.[0] ?? "";

function exigeGobernanza(texto) {
  const plano = texto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(plano, /Xpacio de AdmiraNeXT/);
  assert.match(plano, /Xpacio de Yokup\.com/);
  assert.match(plano, /Arquitecto Carlos/);
  assert.match(plano, /importancia.{0,70}equivalente/);
  assert.match(plano, /Neo es el máximo responsable de AdmiraNeXT/);
  assert.match(plano, /Morfeo\s*(?:es|,)?\s*(?:el )?máximo responsable de Yokup\.com/);
  assert.match(plano, /(?:ambos|Los dos) (?:están )?dirigidos por Carlos/);
}

test("la regla 19 fija pertenencia, equivalencia y responsables sin mezclar funciones", () => {
  exigeGobernanza(rule);
  assert.match(rule, /no confunde la responsabilidad operativa/);
  assert.match(rule, /no crea jerarquía de\s+        valor entre proyectos/);
});

test("la filosofía humana publica la misma gobernanza principal", () => {
  exigeGobernanza(filosofia);
  assert.match(filosofia, /Mismo origen\. Misma importancia\. Responsabilidades distintas\./);
});

test("la capa MCP entrega la gobernanza a los agentes", () => {
  exigeGobernanza(llms);
  const entry = manifest.pages.find((item) => item.path === "/normativa");
  assert.equal(entry?.audience, "agents");
  assert.match(entry?.desc ?? "", /Carlos/);
  assert.match(entry?.desc ?? "", /Neo responde por AdmiraNeXT/);
  assert.match(entry?.desc ?? "", /Morfeo por Yokup\.com/);
});
