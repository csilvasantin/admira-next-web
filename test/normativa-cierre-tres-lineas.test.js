// La regla 22 fija la FORMA del cierre. Las reglas 17 y 21 ya decían qué hay que
// declarar —puntos ganados, total verificado, tiempo—, pero cada agente lo
// escribía a su manera y así no se puede leer de un vistazo ni comparar dos
// equipos. Lo que este test vigila es justo lo que se pierde primero cuando
// alguien reescribe la página: que sigan siendo TRES líneas, que el tiempo se
// mida en vez de estimarse, y que la norma no dependa de la app en la que corra
// el agente. (Carlos, 8-ago-2026.)

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
const regla = html.match(/<article class="art" id="n22">[\s\S]*?<\/article>/)?.[0] ?? "";

test("la regla 22 fija las tres líneas de cierre, en orden", () => {
  assert.match(regla, /tres\s*\n?\s*líneas/);
  const tiempo = regla.indexOf("Tiempo dedicado:");
  const puntos = regla.indexOf("Puntos de la misión:");
  const total = regla.indexOf("Total verificado de");
  assert.ok(tiempo > 0 && puntos > tiempo && total > puntos,
    "las tres líneas deben aparecer en el orden tiempo → puntos → total");
});

test("el tiempo se mide y los puntos se leen: ni se estiman ni se recuerdan", () => {
  assert.match(regla, /tiempo se mide<\/b>, no se estima/);
  assert.match(regla, /puntos se leen<\/b> de yokup\.com\/highscore/);
  assert.match(regla, /nunca de memoria/);
});

test("el cierre no depende de la app en la que corra el agente", () => {
  for (const superficie of ["Codex", "Claude Code", "OpenCode", "CLI"]) {
    assert.ok(regla.includes(superficie), `la regla debe nombrar ${superficie}`);
  }
  // La tabla existe para que nadie pueda leer «esto es cosa de la app X».
  assert.match(regla, /Nada: las mismas tres líneas/);
  assert.match(regla, /da exactamente igual dónde corra el agente/i);
});

test("un cierre sin las tres líneas se declara incompleto", () => {
  assert.match(regla, /est[áa] <b>incompleto<\/b>/);
});
