// Ninguna página publicada puede llevar marcadores de un merge sin resolver.
//
// El 8 de agosto de 2026, entre r9 y r10, www.admiranext.com/normativa —la
// página del contrato operativo— estuvo sirviendo en PRODUCCIÓN esto:
//
//     <<<<<<< HEAD
//     <meta name="admiranext-version" content="v.08.08.2026.r9.13:33">
//     =======
//     <meta name="admiranext-version" content="v.08.08.2026.r9.13:33">
//     >>>>>>> 35830d7 (Un solo verificador por pestaña, y un boton que siempre contesta)
//
// Uno en el <head> y otro en el pie. Y nadie lo vio, por un motivo que importa
// más que el fallo: LOS DOS LADOS ERAN IDÉNTICOS. Un conflicto así no rompe
// nada, no cambia el contenido y no altera ningún test de los que miran QUÉ
// dice la página — sólo deja la tripa de git a la vista de quien la abra. Es
// exactamente el tipo de defecto que no encuentra una revisión por diff, porque
// el diff de la resolución es vacío.
//
// Por eso el guardia no mira contenido: mira que el archivo publicado no
// contenga los tres marcadores en el margen izquierdo, que es la única señal
// que un conflicto sin resolver deja SIEMPRE.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

// Lo que se sirve al navegador. El .md y los propios tests quedan fuera a
// propósito: este fichero, sin ir más lejos, cita los marcadores para explicar
// de qué habla, y un guardia que se denuncia a sí mismo no lo usaría nadie.
const EXTENSIONES = new Set([".html", ".js", ".css", ".json", ".svg", ".webmanifest"]);
const FUERA = new Set([".git", "node_modules", "test", ".wrangler", ".github"]);

// El marcador cuenta sólo a principio de línea: «=======» aparece de sobra
// dentro de bloques de código o de arte ASCII, y ahí no significa nada.
const MARCADORES = [/^<{7}\s/, /^={7}\s*$/, /^>{7}\s/];

function archivos(dir) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name.startsWith(".") && entrada.name !== ".well-known") continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (FUERA.has(entrada.name)) continue;
      salida.push(...archivos(completo));
    } else if (EXTENSIONES.has(path.extname(entrada.name))) {
      salida.push(completo);
    }
  }
  return salida;
}

test("ninguna página publicada lleva marcadores de un merge sin resolver", () => {
  const sospechosos = [];
  for (const archivo of archivos(RAIZ)) {
    const lineas = fs.readFileSync(archivo, "utf8").split("\n");
    lineas.forEach((linea, i) => {
      if (MARCADORES.some((m) => m.test(linea))) {
        sospechosos.push(`${path.relative(RAIZ, archivo)}:${i + 1}  ${linea.slice(0, 60)}`);
      }
    });
  }
  assert.deepStrictEqual(
    sospechosos, [],
    "Hay un merge sin resolver en lo que se iba a publicar:\n" + sospechosos.join("\n") +
    "\n\nOJO: si los dos lados del conflicto son iguales, el sitio no se rompe — sólo enseña " +
    "la tripa de git en producción, que es como llegó a pasar la primera vez."
  );
});
