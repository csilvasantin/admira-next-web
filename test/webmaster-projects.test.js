import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PROYECTOS } from "../functions/_proyectos.js";
import { cantidadReleases } from "../functions/api/proyectos.js";

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
  assert.equal(subprojects.length, 2);
  assert.deepEqual(subprojects.map((project) => [project.clave, project.parentKey]), [
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

test("la subsolución abre su URL propia y verifica el release compartido de AdmiraNeXT", () => {
  const project = PROYECTOS.find((entry) => entry.clave === "generador-presupuestos");
  assert.equal(project.estadoUrl, "https://www.admiranext.com");
  assert.notEqual(project.estadoUrl, project.url);

  assert.match(apiSource, /const estadoUrl = p\.estadoUrl \|\| p\.url/);
  assert.match(apiSource, /traer\(fresco\(estadoUrl\)/);
  assert.match(apiSource, /estadoUrl\.replace\(\/\\\/\$\/, ''\).*\/version\.json/);
});
