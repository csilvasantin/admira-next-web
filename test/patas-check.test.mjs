import test from "node:test";
import assert from "node:assert/strict";
import { PATAS, comprobarPata, presencia, sirveContenido, tabla } from "../tools/patas-check.mjs";

const yokup = PATAS.find((p) => p.id === "yokup");

test("admira.biz es el otro dominio del registro yokup, no una pata nueva", () => {
  assert.equal(PATAS.length, 4);
  assert.deepEqual(PATAS.map((p) => p.registro), ["pixeria", "xpaceos", "clearchannel", "yokup"]);
  assert.deepEqual(yokup.dominios, ["https://www.yokup.com", "https://admira.biz"]);
  assert.equal(PATAS.filter((p) => p.dominios.some((d) => d.includes("admira.biz"))).length, 1);
});

test("si yokup.com sirve contenido, el chequeo exige sondear también admira.biz", () => {
  const soloYokup = comprobarPata(yokup, [
    { url: "https://www.yokup.com", status: 200, bytes: 6200, type: "text/html; charset=utf-8" },
  ]);
  assert.equal(soloYokup.registro, "yokup");
  assert.equal(soloYokup.algunoSirve, true);
  assert.equal(soloYokup.incompleto, true);

  const ambos = comprobarPata(yokup, [
    { url: "https://www.yokup.com", status: 200, bytes: 6200, type: "text/html" },
    { url: "https://admira.biz", status: 0, bytes: 0, type: "", error: "no-sirve" },
  ]);
  assert.equal(ambos.incompleto, false);
  assert.equal(ambos.dominios[1].sondado, true);
  assert.equal(ambos.dominios[1].sirve, false);
});

test("un html o json con cuerpo cuenta como contenido; la verja 401 también; un fallo de TLS no", () => {
  assert.equal(sirveContenido({ status: 200, bytes: 10, type: "application/json" }), true);
  assert.equal(sirveContenido({ status: 401, bytes: 2300, type: "text/html; charset=utf-8" }), true);
  assert.equal(sirveContenido({ status: 200, bytes: 0, type: "text/html" }), false);
  assert.equal(sirveContenido({ status: 0, bytes: 0, type: "" }), false);
  assert.equal(sirveContenido({ status: 404, bytes: 100, type: "text/html" }), false);
});

test("el grid de yokup no se duplica para admira.biz", () => {
  const fuentes = {
    demos: { projects: [{ id: "altadis", circuit: "altadis_bcn" }] },
    circuits: { circuits: [{ id: "altadis_bcn", project: "altadis" }] },
  };
  const pre = presencia("altadis", fuentes);
  assert.equal(pre.demos, true);
  assert.equal(pre.grid, true);
  assert.equal(pre.yokup, pre.grid);
  const patas = PATAS.map((p) => comprobarPata(p, p.dominios.map((url) => (
    url.includes("admira.biz")
      ? { url, status: 0, bytes: 0, type: "" }
      : { url, status: 200, bytes: 100, type: "text/html" }
  ))));
  const out = tabla("altadis", fuentes, patas);
  assert.equal(out.incompletas.length, 0);
  assert.match(out.texto, /registro yokup \(también vale para admira.biz\)/);
  assert.match(out.texto, /https:\/\/admira\.biz\s+✗ no sirve/);
  assert.equal(out.texto.split("yokup").length > 2, true);
});
