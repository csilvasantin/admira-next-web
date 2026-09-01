import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la normativa exige cada día el apellido físico completo del agente", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const identityRule = html.match(/<article class="art" id="n01">[\s\S]*?<\/article>/)?.[0];

  assert.ok(identityRule, "la normativa pública debe conservar la regla de identidad n01");
  assert.match(identityRule, /La identidad se resuelve de nuevo cada día/);
  assert.match(identityRule, /se usa\s+igual en toda salida y superficie visible durante esa jornada/);
  // El ejemplo canónico del canon nuevo: nombre y equipo separados por un punto medio,
  // no pegados. Si alguien vuelve a concatenarlos en la norma, esto salta.
  assert.match(
    identityRule,
    /Se escribe <b>Morfeo · Mac Mini<\/b>, no <b class="bad">MorfeoMacMini<\/b>/,
  );
  assert.match(identityRule, /El equipo físico no forma parte del nombre/);
});

// La regla 11 se reescribió («Máxima velocidad por defecto» → «Modo rápido siempre
// puesto») y este test se quedó con el texto viejo: llevaba fallando desde
// entonces, y encima exigía «mayor consumo», que es justo lo contrario de lo que
// la regla dice hoy. Un test que contradice a la doctrina que vigila no protege
// nada. Vigila ahora lo que de verdad importa de esa norma: que el modo rápido va
// por defecto y que NO rebaja el modelo.
test("la normativa deja el modo rápido puesto por defecto, sin bajar de modelo", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const speedRule = html.match(/<article class="art" id="n11">[\s\S]*?<\/article>/)?.[0] ?? "";

  assert.match(speedRule, /Modo rápido siempre puesto/);
  assert.match(speedRule, /modo rápido activado por defecto/);
  assert.match(speedRule, /no baja a un modelo menor/);
});

test("la normativa obliga a introducirse antes de trabajar", async () => {
  const html = await readFile(new URL("../normativa.html", import.meta.url), "utf8");
  const introRule = html.match(/<article class="art" id="n18">[\s\S]*?<\/article>/)?.[0] ?? "";

  // Los cinco pasos son uno solo: si se cae uno, el agente no se ha introducido.
  assert.match(introRule, /PRIMERA función de todo agente de silicio/);
  assert.match(introRule, /proyecto principal/);
  assert.match(introRule, /tarea «login»/);
  assert.match(introRule, /highscore/);
  assert.match(introRule, /Telegram/);
  assert.match(introRule, /Obliga a TODOS los miembros de AdmiraNeXT/);
});

test('la normativa manda CLI para el agente que trabaja solo', async () => {
  const html = await readFile(new URL('../normativa.html', import.meta.url), 'utf8');
  const rule = html.match(/<article class="art" id="n20">[\s\S]*?<\/article>/)?.[0] ?? '';

  // Carlos, 08-08-2026: «Grok está siempre en modo CLI... dejaría las desktop
  // apps para aquello que una carbono y silicio, como Claude Code o Codex, y el
  // resto CLIs». El corolario es lo que más se olvida: a un agente CLI no se le
  // busca en la lista de procesos, porque no tiene por qué estar ahí.
  assert.match(rule, /Grok va siempre en CLI/);
  assert.match(rule, /Claude Code/);
  assert.match(rule, /no necesita un buzon escuchando siempre/);
});
