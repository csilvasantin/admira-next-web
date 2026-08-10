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

test("la normativa queda numerada de 01 a 26 sin huecos", () => {
  const numbers = [...html.matchAll(/<article class="art" id="n(\d+)">\s*<div class="num">(\d+)<\/div>/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(numbers, Array.from({ length: 26 }, (_, index) => {
    const value = String(index + 1).padStart(2, "0");
    return [value, value];
  }));
});

// La regla 26 nace de un fallo concreto: el 10-ago-2026 el proyecto principal
// estaba bien declarado en Yokup y el Highscore anunciaba otro, porque el latido
// de presencia —que es la señal más fresca— conservaba el valor del día anterior.
// El test guarda lo que hace que la regla sirva: que exija LAS DOS superficies.
test("la regla 26 exige declarar el proyecto principal en todas las superficies", () => {
  const rule = html.split('id="n26"')[1].split("</article>")[0];
  assert.match(rule, /proyecto principal/i);
  assert.match(rule, /foco\.sh/);
  assert.match(rule, /latido de presencia/);
  assert.match(rule, /señal más fresca/i);
  assert.match(rule, /tarea del día/i);
});
