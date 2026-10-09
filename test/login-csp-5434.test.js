import test from "node:test";
import assert from "node:assert/strict";
import { respuestaHtml } from "../functions/_webmaster-gate.js";

test("el login de /organigrama y /flota deja pasar el estilo de accounts.google.com", () => {
  const res = respuestaHtml("<p>acceso</p>", 401);
  const csp = res.headers.get("content-security-policy");
  assert.match(csp, /style-src[^;]*'unsafe-inline'/);
  assert.match(csp, /style-src[^;]*https:\/\/accounts\.google\.com/);
  assert.match(csp, /script-src https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(csp, /frame-src https:\/\/accounts\.google\.com\/gsi\//);
});

test("la portada declara un solo vídeo, perezoso, y el armazón", async () => {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");
  assert.equal((html.match(/<video\b/gi) || []).length, 1);
  assert.doesNotMatch(html, /bannerAdmiraNext|fondo-prehome|Product Rocket|Resolving 12 case|Resolviendo 12 casos/);
  assert.match(html, /poster="assets\/portada-poster\.jpg"/);
  assert.match(html, /preload="none"/);
  assert.match(html, /data-yk-cli="on"/);
  assert.match(html, /admira-frame\.js/);
  assert.match(app, /assets\/portada\.mp4/);
  assert.doesNotMatch(app, /Product Rocket|productrocket\.ro|Trei Fantani/);
});
