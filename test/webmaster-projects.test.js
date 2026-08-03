import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PROYECTOS } from "../functions/_proyectos.js";
import { cantidadReleases, normalizarResponsable, onRequestPatch, RESPONSABLE_POR_DEFECTO } from "../functions/api/proyectos.js";

const apiSource = fs.readFileSync(new URL("../functions/api/proyectos.js", import.meta.url), "utf8");
const webmasterSource = fs.readFileSync(new URL("../webmaster.html", import.meta.url), "utf8");

test("el censo publica una única fila operativa para el Generador de Presupuestos", () => {
  const matches = PROYECTOS.filter((project) => project.clave === "generador-presupuestos");
  assert.equal(matches.length, 1);

  const project = matches[0];
  assert.equal(project.nombre, "Generador de Presupuestos");
  assert.equal(project.url, "https://www.admiranext.com/presupuestos/");
  assert.equal(project.repoTxt, "admira-next-web · presupuestos/");
  assert.equal(project.pages, "admiranext");
  assert.equal(project.parentKey, "admiranext");
});

test("Webmaster distingue proyectos raíz, subproyectos y el total canónico de Yokup", () => {
  const rootKeys = new Set(PROYECTOS.map((project) => project.clave));
  const subprojects = PROYECTOS.filter((project) => project.parentKey && rootKeys.has(project.parentKey));
  assert.equal(PROYECTOS.length - subprojects.length, 17);
  assert.equal(subprojects.length, 3);
  assert.deepEqual(subprojects.map((project) => [project.clave, project.parentKey]), [
    ["admiranext-webmaster", "admiranext"],
    ["generador-presupuestos", "admiranext"],
    ["yokup-rtc", "yokup"],
  ]);

  assert.match(apiSource, /https:\/\/api\.yokup\.com\/projects/);
  assert.match(apiSource, /totalProyectos, totalSubproyectos, yokupTotal/);
  assert.match(apiSource, /coincideYokup:/);
  assert.match(webmasterSource, /data-sort="proyecto"[^>]*>Proyectos <span id="proyectosCuenta"/);
  assert.match(webmasterSource, /function ordenarJerarquia\(lista, comparar\)/);
  assert.match(webmasterSource, /class="tree-toggle"/);
  assert.match(webmasterSource, /conectarArbol\(\)/);
});

test("los cabezales ordenan sin separar los subproyectos de su padre", () => {
  assert.match(webmasterSource, /class="sort-btn" data-sort="proyecto"/);
  assert.match(webmasterSource, /class="sort-btn" data-sort="releases"/);
  assert.match(webmasterSource, /data-sort="norma"/);
  assert.match(webmasterSource, /data-sort="responsable"/);
  assert.match(webmasterSource, /data-sort="repo"/);
  assert.match(webmasterSource, /data-sort="publica"/);
  assert.match(webmasterSource, /modo:eraAlfabetico \? 'antiguedad' : 'alfabetico'/);
  assert.match(webmasterSource, /direccion:eraReleases && ordenActual\.direccion === 'desc' \? 'asc' : 'desc'/);
  assert.match(webmasterSource, /hijos\[clave\]\.sort\(comparar\)/);
  assert.match(webmasterSource, /setAttribute\('aria-sort'/);
  assert.match(apiSource, /releaseCount: cantidadReleases\(v\.sello\)/);
  assert.match(apiSource, /ordenAlta/);
  assert.equal(cantidadReleases("v.03.08.2026.r27.15:59"), 27);
  assert.equal(cantidadReleases("v.03.08.2026.r3"), 3);
  assert.equal(cantidadReleases("sin portada"), 0);
});

test("Webmaster es subproyecto y los responsables se editan con persistencia", () => {
  const project = PROYECTOS.find((entry) => entry.clave === "admiranext-webmaster");
  assert.ok(project);
  assert.equal(project.parentKey, "admiranext");
  assert.equal(project.url, "https://www.admiranext.com/webmaster");
  assert.equal(project.estadoUrl, "https://www.admiranext.com");

  assert.equal(RESPONSABLE_POR_DEFECTO, "NeoMacMini");
  assert.equal(normalizarResponsable(""), "NeoMacMini");
  assert.equal(normalizarResponsable("  InfraNeoMini   MacMini  "), "InfraNeoMini MacMini");
  assert.equal(normalizarResponsable("x".repeat(100)).length, 80);
  assert.match(apiSource, /export async function onRequestPatch/);
  assert.match(apiSource, /PRESENTATION_IDEAS\.put\(`\$\{RESPONSABLE_KEY\}\$\{clave\}`/);
  assert.match(apiSource, /proyecto no encontrado/);
  assert.match(apiSource, /origen no permitido/);
  assert.match(webmasterSource, /class="responsable-input"/);
  assert.match(webmasterSource, /method:'PATCH'/);
  assert.match(webmasterSource, /guardarResponsable/);
});

test("PATCH guarda una asignación autenticada en KV", async () => {
  const key = "test-webmaster-key";
  const payload = Buffer.from(JSON.stringify({
    email: "csilvasantin@gmail.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = Buffer.from(await crypto.subtle.sign(
    "HMAC", cryptoKey, new TextEncoder().encode(`wm:${payload}`),
  )).toString("base64url");
  let stored = null;
  let storedKey = null;
  const kv = {
    async get() { return stored; },
    async put(name, value) { storedKey = name; stored = JSON.parse(value); },
  };
  const request = new Request("https://www.admiranext.com/api/proyectos", {
    method: "PATCH",
    headers: {
      cookie: `wm_session=${payload}.${signature}`,
      origin: "https://www.admiranext.com",
      "content-type": "application/json",
    },
    body: JSON.stringify({ clave: "admiranext-webmaster", responsable: "InfraNeoMini" }),
  });
  const response = await onRequestPatch({
    request,
    env: { WEBMASTER_SIGNING_KEY: key, PRESENTATION_IDEAS: kv },
  });
  assert.equal(response.status, 200);
  assert.equal(storedKey, "webmaster:responsable:admiranext-webmaster");
  assert.equal(stored.responsable, "InfraNeoMini");
  assert.equal(stored.updatedBy, "csilvasantin@gmail.com");
  assert.deepEqual(await response.json(), {
    ok: true, clave: "admiranext-webmaster", responsable: "InfraNeoMini",
  });
});

test("la subsolución abre su URL propia y verifica el release compartido de AdmiraNeXT", () => {
  const project = PROYECTOS.find((entry) => entry.clave === "generador-presupuestos");
  assert.equal(project.estadoUrl, "https://www.admiranext.com");
  assert.notEqual(project.estadoUrl, project.url);

  assert.match(apiSource, /const estadoUrl = p\.estadoUrl \|\| p\.url/);
  assert.match(apiSource, /traer\(fresco\(estadoUrl\)/);
  assert.match(apiSource, /estadoUrl\.replace\(\/\\\/\$\/, ''\).*\/version\.json/);
});
