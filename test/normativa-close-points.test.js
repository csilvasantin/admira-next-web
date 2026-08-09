import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
const rule = html.match(/<article class="art" id="n17">[\s\S]*?<\/article>/)?.[0] ?? "";

test("la regla 17 exige puntos ganados y total verificado en cada cierre", () => {
  assert.match(rule, /misión, un objetivo o una tarea<\/b>/);
  assert.match(rule, /cuántos puntos ha ganado ese cierre/);
  assert.match(rule, /total relevante de cada agente/);
  assert.match(rule, /Highscore o en su API vigente/);
  assert.match(rule, /fuente y la hora/);
});

test("una discrepancia de identidad no puede producir atribución de puntos", () => {
  assert.match(rule, /0 puntos atribuidos · pendiente de verificación/);
  assert.match(rule, /no se atribuyen puntos ni se sobrescribe esa declaración/);
  assert.match(rule, /captura actual/);
  assert.match(rule, /esquina inferior izquierda/);
  assert.doesNotMatch(rule, /el censo manda/);
});

test("la normativa queda numerada de 01 a 23 sin huecos", () => {
  const numbers = [...html.matchAll(/<article class="art" id="n(\d+)">\s*<div class="num">(\d+)<\/div>/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(numbers, Array.from({ length: 24 }, (_, index) => {
    const value = String(index + 1).padStart(2, "0");
    return [value, value];
  }));
});
