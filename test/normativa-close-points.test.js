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

test("la normativa queda numerada de 01 a 28 sin huecos", () => {
  const numbers = [...html.matchAll(/<article class="art" id="n(\d+)">\s*<div class="num">(\d+)<\/div>/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(numbers, Array.from({ length: 28 }, (_, index) => {
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

// La regla 27 no repite a la 14, la 17 ni la 22: las ata. Nació el 12-ago-2026
// porque cumplir media norma se sentía como cumplirla —había trabajo dado de alta
// sin cifras al cerrar, y cifras de trabajo que nunca se dio de alta—. Lo que el
// test guarda es justo eso: que siga citando a las tres y que siga diciendo que
// alcanza a todos, que es lo que la hace exigible.
test("la regla 27 ata el alta y el cierre en una sola obligación para todos", () => {
  const rule = html.split('id="n27"')[1].split("</article>")[0];
  for (const ref of ["14", "17", "22"]) {
    assert.match(rule, new RegExp("<b>" + ref + "</b>"), `la 27 debe citar a la regla ${ref}`);
  }
  assert.match(rule, /indivisible/i);
  assert.match(rule, /Sin alta no se empieza/);
  assert.match(rule, /no está cerrado/);
  assert.match(rule, /TODOS los agentes de AdmiraNeXT, sin excepción/);
  assert.match(rule, /el tamaño no es un criterio/i);
});

// La regla 28 nació el 3-sep-2026, y de un caso concreto: el 2 de septiembre
// xpaceos.com/nvidia devolvía un 404 el día de la reunión con NVIDIA, se arregló en
// veinte minutos y se quedó sin misión porque quien lo arregló no figuraba en ese
// proyecto del censo. Un registro que impide arreglar lo que está roto no protege nada.
test("la regla 28 abre los proyectos a los cinco sin quitarle el mando a nadie", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const regla = html.match(/<article class="art" id="n28">[\s\S]*?<\/article>/)?.[0];
  assert.ok(regla, "la regla 28 tiene que existir");
  for (const persona of ["Neo", "Trinity", "Morfeo", "Oráculo", "Smith"]) {
    assert.ok(regla.includes(persona), `la regla nombra a los cinco: falta ${persona}`);
  }
  assert.match(regla, /responsable de silicio/, "sigue habiendo un responsable por proyecto");
  assert.match(regla, /avisa, no pisa/, "acceso para cuidar, no para mandar");
});
