// ESM (FLT-100016, 6-sep-2026): con `require` este fichero reventaba en `node --test` y no vigilaba nada.
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let M;
test.before(async () => {
  M = await import(pathToFileURL(path.join(__dirname, "..", "functions", "quien-publica.js")).href);
});

// El caso que lo origina: la mañana del 10-ago-2026 el historial de Yokup
// atribuía a «csilvasantin» —el usuario de la máquina, y Carlos dormía— dos de
// los cambios de una noche en la que publicaron los agentes.
test("el usuario de la máquina no se presenta como responsable", () => {
  const r = M.quienPublica({ autorGit: "csilvasantin", asunto: "fix(highscore): respetar proyecto principal diario" });
  assert.equal(r.fiable, false);
  assert.equal(r.agente, "");
  assert.match(M.etiquetaResponsable(r), /sin identificar \(csilvasantin\)/);
});

test("tampoco el nombre propio de una persona", () => {
  const r = M.quienPublica({ autorGit: "Carlos Silva", asunto: "yokup: la ventana de formación deja ELEGIR la temática" });
  assert.equal(r.fiable, false);
});

test("la firma del sello manda: dice agente y máquina", () => {
  const r = M.quienPublica({
    autorGit: "csilvasantin",
    asunto: "chore(release): sellar yokup-rtc v.10.08.2026.r5.08:05 · SubMorfeoMacMini · MacMini",
  });
  assert.equal(r.agente, "SubMorfeoMacMini");
  assert.equal(r.maquina, "MacMini");
  assert.equal(r.via, "sello");
  assert.equal(M.etiquetaResponsable(r), "SubMorfeoMacMini · MacMini");
});

test("un sello sin firma no inventa responsable", () => {
  const r = M.quienPublica({ autorGit: "csilvasantin", asunto: "chore(release): sellar yokup-rtc v.10.08.2026.r4.01:01" });
  assert.equal(r.fiable, false);
});

test("el pie «Agente:» gana a todo lo demás", () => {
  const r = M.quienPublica({
    autorGit: "csilvasantin",
    asunto: "chore(release): sellar Yokup · SubOraculoMini · MacMini",
    cuerpo: "lo que sea\n\nAgente: NeoMBP14 · MacBookPro14\n",
  });
  assert.equal(r.agente, "NeoMBP14");
  assert.equal(r.maquina, "MacBookPro14");
  assert.equal(r.via, "pie");
});

test("un autor de git que YA es un agente vale tal cual", () => {
  for (const nombre of ["SubOraculoMini", "InfraOraculoMini", "NeoMBP14", "MorfeoMacMini", "TrinityMBP14"]) {
    const r = M.quienPublica({ autorGit: nombre, asunto: "fix(algo): lo que sea" });
    assert.equal(r.agente, nombre, `${nombre} debería reconocerse como agente`);
    assert.equal(r.fiable, true);
  }
});

test("sin ninguna pista, se dice que no se sabe — no se deja en blanco", () => {
  assert.equal(M.etiquetaResponsable(M.quienPublica({})), "sin identificar");
});
