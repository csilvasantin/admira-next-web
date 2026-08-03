import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = fs.readFileSync(new URL("assets/budget-generator.js", root), "utf8");
const appSource = fs.readFileSync(new URL("assets/app.js", root), "utf8");
const html = fs.readFileSync(new URL("presupuestos/index.html", root), "utf8");
const css = fs.readFileSync(new URL("assets/budget-generator.css", root), "utf8");
const app = fs.readFileSync(new URL("assets/app.js", root), "utf8");
const context = vm.createContext({
  Number, String, Date, Math, JSON, Intl,
  crypto: { randomUUID: () => "qa-id" },
});
vm.runInContext(source, context);
const B = context.BudgetGenerator._test;

test("calcula subtotal, margen, descuento, IVA, total y beneficio con cifras exactas", () => {
  const result = B.calculate({
    discount: 10,
    vat: 21,
    items: [
      { description: "Estrategia", quantity: 2, cost: 100, margin: 25 },
      { description: "Producción", quantity: 3, cost: 50, margin: 20 },
    ],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    items: [
      { id: "qa-id", description: "Estrategia", quantity: 2, unit: "ud.", cost: 100, margin: 25, price: 125 },
      { id: "qa-id", description: "Producción", quantity: 3, unit: "ud.", cost: 50, margin: 20, price: 60 },
    ],
    subtotal: 430,
    costs: 350,
    discountRate: 10,
    discount: 43,
    base: 387,
    vatRate: 21,
    vat: 81.27,
    total: 468.27,
    profit: 37,
    realMargin: 9.56,
  });
});

test("limita descuento e IVA y nunca admite cantidades, costes o precios negativos", () => {
  const result = B.calculate({
    discount: 150,
    vat: -20,
    items: [{ quantity: -2, cost: -5, margin: 30, price: -10 }],
  });
  assert.equal(result.discountRate, 100);
  assert.equal(result.vatRate, 0);
  assert.equal(result.items[0].quantity, 0);
  assert.equal(result.items[0].cost, 0);
  assert.equal(result.items[0].price, 0);
  assert.equal(result.total, 0);
  assert.equal(result.profit, 0);
  assert.equal(result.realMargin, 0);
});

test("redondea importes monetarios a céntimos con half-up decimal", () => {
  assert.equal(B.round(1.005), 1.01);
  assert.equal(B.round(2.675), 2.68);
  assert.equal(B.round(10.075), 10.08);
});

test("CSV conserva UTF-8, escapa contenido y neutraliza fórmulas incluso tras espacios o tabuladores", () => {
  const csv = B.csvFor({
    number: "=CMD()",
    client: " Cliente; \"QA\"\r\nsegunda línea",
    opportunity: "\t=HYPERLINK(\"https://evil.test\")",
    date: "2026-08-03",
    discount: 0,
    vat: 21,
    items: [{ description: "  +SUM(1;1)", quantity: 1, unit: "@unidad", cost: 10, margin: 20 }],
  });
  assert.ok(csv.startsWith("\ufeff"), "debe incluir BOM UTF-8");
  assert.match(csv, /"'=CMD\(\)"/);
  assert.match(csv, /" Cliente; ""QA""\r\nsegunda línea"/);
  assert.match(csv, /"\t'=HYPERLINK\(""https:\/\/evil\.test""\)"/);
  assert.match(csv, /"  '\+SUM\(1;1\)"/);
  assert.match(csv, /"'@unidad"/);
});

test("persistencia local está versionada y las versiones son snapshots restaurables sin cambiar id", () => {
  assert.match(source, /STORAGE_KEY="admiranext\.budget-generator\.v1"/);
  assert.match(source, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY,JSON\.stringify\(store\)\)/);
  assert.match(source, /data=clone\(active\);delete data\.versions/);
  assert.match(source, /active\.versions\.push\(\{id:id\(\),label:"Versión "\+sequence,createdAt:Date\.now\(\),data:data\}\)/);
  assert.match(source, /Object\.assign\(active,clone\(version\.data\),\{id:activeId,versions:keep,updatedAt:Date\.now\(\)\}\)/);
  assert.match(source, /store\.trash\.unshift\(removed\)/);
});

test("la interfaz conserva accesibilidad operativa y una hoja de impresión A4", () => {
  assert.match(html, /<html lang="es">/);
  assert.match(html, /class="skip" href="#editor"/);
  assert.match(html, /role="toolbar" aria-label="Acciones del presupuesto"/);
  assert.match(html, /id="storageState" role="status"/);
  assert.match(html, /id="itemList"[^>]*aria-live="polite"/);
  assert.match(html, /id="toast" role="status" aria-live="polite"/);
  assert.match(source, /setAttribute\("aria-label","Eliminar partida "/);
  assert.match(source, /\$\("printBudget"\)\.addEventListener\("click",function\(\)\{root\.print\(\)\}\)/);
  assert.match(css, /@media print/);
  assert.match(css, /@page\{size:A4;margin:13mm\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("el launcher registra Presupuestos una sola vez desde INTRANET_CATALOG", () => {
  const entries = [...appSource.matchAll(/\{\s*cmd:\s*['"]\/presupuestos['"][^}]*\}/g)];
  assert.equal(entries.length, 1, "debe existir una sola entrada /presupuestos");
  const entry = entries[0][0];
  assert.match(entry, /labelEs:\s*['"]Generador de Presupuestos['"]/);
  assert.match(entry, /labelEn:\s*['"]Budget generator['"]/);
  assert.match(entry, /url:\s*['"]https:\/\/www\.admiranext\.com\/presupuestos\/['"]/);
  assert.equal((appSource.match(/https:\/\/www\.admiranext\.com\/presupuestos\//g) || []).length, 1,
    "la URL canónica no debe duplicarse fuera del catálogo");
  assert.match(appSource, /INTRANET_CATALOG\.forEach\(g => g\.items\.forEach\(it => \{ INTRANET_BY_CMD\[it\.cmd\] = it; \}\)\)/);
  assert.match(appSource, /Object\.values\(INTRANET_BY_CMD\)\.forEach\(function\(it\) \{[\s\S]*?registerHidden\(it\.cmd,[\s\S]*?launchEgg\(/);
});

test("INTRANET_CATALOG publica el comando canónico del Generador de Presupuestos", () => {
  const catalog = app.slice(app.indexOf("const INTRANET_CATALOG = ["), app.indexOf("const INTRANET_BY_CMD"));
  assert.match(catalog, /\{ cmd: '\/presupuestos', labelEs: 'Generador de Presupuestos',\s+labelEn: 'Budget generator',\s+url: 'https:\/\/www\.admiranext\.com\/presupuestos\/', color: 'accent' \}/);
  assert.equal((catalog.match(/cmd: '\/presupuestos'/g) || []).length, 1, "el comando no debe duplicarse");
});
