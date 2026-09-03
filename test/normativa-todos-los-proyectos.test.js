import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Carlos, 3-sep-2026: «todos los agentes de AdmiraNeXT tienen que ser agentes de todos
// los proyectos para ser realmente efectivos y estar informados de los cambios». La
// norma nacio nombrando a cinco y dejaba fuera a Link y WhiteRabbit, que son personas
// del censo v5. Nombrar la lista obliga a reescribir la doctrina cada vez que la flota
// crece; se nombra la FUENTE.
test("la norma 28 alcanza a toda la flota, no a una lista de cinco", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const norma = html.match(/<article class="art" id="n28">[\s\S]*?<\/article>/)?.[0];
  assert.ok(norma, "la normativa publica debe conservar la norma 28");

  assert.match(norma, /Todos los agentes de AdmiraNeXT/);
  assert.match(norma, /censo canónico/);
  // no puede volver a cerrarse sobre una lista fija
  assert.doesNotMatch(norma, /—los cinco agentes principales—/);
  assert.doesNotMatch(norma, /cinco que lo conocen/);
  // y sigue habiendo UN responsable por proyecto: abrir el censo no diluye la
  // responsabilidad, que es lo que distingue cuidar de mandar.
  assert.match(norma, /un responsable de\s+silicio/);
  assert.match(norma, /un responsable por proyecto/);
});
