import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// La regla 30 nace de una orden de Carlos del 6-sep-2026: «la misión y el encargo no deberían
// tener el mismo número». Hasta entonces FLT-<n> era el rowid del encargo #n y dos contadores de
// dos bases acababan significando dos cosas con un número (FLT-973/974 pisadas; #2702 / FLT-2702 /
// FLT-2704 en la misma prueba). Publicada por MorfeoMacMini continuando el proyecto de Oráculo
// (misión FLT-2705). El test guarda lo que hace que la regla sirva: serie propia, cruce por
// fleet_ids, histórico intacto y prohibición de deducir un número del otro.
const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
const rule = html.match(/<article class="art" id="n30">[\s\S]*?<\/article>/)?.[0] ?? "";
test("la regla 30 existe y separa los dos contadores", () => {
  assert.ok(rule, "falta el artículo n30");
  assert.match(rule, /<div class="num">30<\/div>/);
  assert.match(rule, /La misión y el encargo no comparten número/);
  assert.match(rule, /serie propia a partir de\s*<code>FLT-100001<\/code>/);
  assert.match(rule, /Nunca se fabrica\s*<code>FLT-&lt;número de encargo&gt;<\/code>/);
});
test("la regla 30 fija el cruce, el histórico y la referencia humana", () => {
  assert.match(rule, /<code>fleet_ids<\/code>/);
  assert.match(rule, /Las misiones anteriores conservan su número/);
  assert.match(rule, /href="#n03"/);
  assert.match(rule, /href="#n05"/);
  assert.match(rule, /Deducir uno del otro en un guion/);
  assert.match(rule, /yokup-rtc\/FLEET_IDS\.md/);
});
test("la regla 30 dice de dónde viene y quién la publicó", () => {
  assert.match(rule, /Decisión de Carlos, 6 de septiembre de 2026/);
  assert.match(rule, /MorfeoMacMini/);
  assert.match(rule, /FLT-2705/);
});
