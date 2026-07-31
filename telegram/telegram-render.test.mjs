import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./telegram.js", import.meta.url), "utf8");

test("las capturas de YOKUP incluidas en el texto se convierten en imagen", () => {
  assert.match(source, /function captureUrl\(text\)/);
  assert.match(source, /\/media\/fleet\//);
  assert.match(source, /captureUrl\(m\.text\)/);
  assert.match(source, /alt="Captura de la misión en YOKUP"/);
});

test("solo se admiten hosts HTTPS conocidos para las capturas", () => {
  assert.match(source, /u\.protocol==="https:"/);
  assert.match(source, /hosts\.includes\(u\.hostname\)/);
});

test("el feed real pinta una captura aunque Telegram entregue media_type null", async () => {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      id, innerHTML: "", textContent: "", files: [], scrollTop: 0, scrollHeight: 0,
      addEventListener() {}, reset() {}, disabled: false, value: ""
    });
    return elements.get(id);
  };
  const capture = "https://yokup-rtc.csilvasantin.workers.dev/media/fleet/prueba.png";
  const context = vm.createContext({
    document: { getElementById: element }, URL, FileReader: class {},
    setInterval() { return 0; }, encodeURIComponent,
    fetch: async () => ({ ok: true, json: async () => ({ messages: [{
      id: 9, date: 1785534024, from_name: "Oraculo", direction: "out",
      media_type: null, text: `Captura de progreso recibida en YOKUP\nCaptura: ${capture}`
    }] }) })
  });

  vm.runInContext(source, context);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.match(element("tgFeed").innerHTML, /<img[^>]+alt="Captura de la misión en YOKUP"/);
  assert.match(element("tgFeed").innerHTML, new RegExp(capture.replaceAll(".", "\\.")));
});
