import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la normativa exige cada día el apellido físico completo del agente", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const identityRule = html.match(/<article class="art" id="n01">[\s\S]*?<\/article>/)?.[0];

  assert.ok(identityRule, "la normativa pública debe conservar la regla de identidad n01");
  assert.match(identityRule, /La identidad se resuelve de nuevo cada día/);
  assert.match(identityRule, /se usa\s+completa en toda salida y superficie visible durante esa jornada/);
  assert.match(
    identityRule,
    /la identidad es <b>OraculoMacMini<\/b>, nunca\s+<b[^>]*>OraculoMini<\/b>/,
  );
  assert.match(identityRule, /Oraculo \+ Mac Mini = OraculoMacMini/);
});

test("la normativa arranca Codex, Claude y los CLIs a máxima velocidad", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const speedRule = html.match(/<article class="art" id="n11">[\s\S]*?<\/article>/)?.[0] ?? "";

  assert.match(speedRule, /Máxima velocidad por defecto/);
  assert.match(speedRule, /Codex, Claude y todos los CLIs arrancan por defecto a la máxima velocidad disponible/);
  assert.match(speedRule, /mayor consumo/);
});
