// La vista de flota de admiranext.com lee Yokup y NO maquilla lo que encuentra:
// si hay sesiones abiertas y nadie cuenta como trabajando, lo dice con el motivo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../flota.html", import.meta.url), "utf8");
const script = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));

class Nodo {
  constructor(){ this.innerHTML=""; this.textContent=""; this.onclick=null; }
}
function monta(respuestas){
  const nodos = {};
  const pedidas = [];
  const doc = { querySelector: (sel) => (nodos[sel] ||= new Nodo()) };
  const ctx = vm.createContext({
    document: doc, Date, Math, JSON, Intl, Number, String, Map, Promise, Array, Object,
    setInterval: () => 0, console,
    fetch: async (url) => {
      const ruta = String(url).replace("https://api.yokup.com", "");
      pedidas.push(ruta);
      const r = respuestas[ruta.split("?")[0]];
      if (r instanceof Error) return { ok:false, status:500 };
      return { ok:true, status:200, json: async () => r };
    },
  });
  vm.runInContext(script, ctx);
  return { nodos, pedidas, ctx };
}
const espera = () => new Promise((r) => setTimeout(r, 10));

const TRABAJO_PARADO = {
  ok:true, mode:"recent", running_count:0, count:2,
  participants:[{ agent:"NeoMBP16", executor:"SubNeoMBP16", machine:"MBP16", kind:"task",
    reference:"DCL-abc:a", title:"Credencial de Workspace", state:"assigned_stale", active_at:Date.now()-120000 }],
  observations:[
    { agent:"NeoMBP16", machine:"MBP16", host:"app", process_state:"open", activity_state:"unverified", reason:"no_linked_work" },
    { agent:"TrinityMBP14", machine:"MBP14", host:"cli", process_state:"open", activity_state:"unverified", reason:"no_linked_work" },
    { agent:"MorfeoMacMini", machine:"MacMini", host:"cli", process_state:"closed", activity_state:"unverified", reason:"sin proceso" },
  ],
};
const MARCADOR = { day:"2026-09-16", scores:[
  { agent:"Neo", objective_points:100, window_points:0, mission_points:100, missions:5, windows:0 },
  { agent:"Trinity", objective_points:40, window_points:0, mission_points:0, missions:1, windows:0 },
  { agent:"Trinity", objective_points:40, window_points:0, mission_points:0, missions:1, windows:0 },
]};
const MISIONES = { missions:[
  { display_ref:"Hoy #26", persona:"NeoMBP16", project:"admira-tv", status:"in_progress", subject:"Permisos de admira.tv" },
  { display_ref:"Hoy #9", persona:"MorfeoMacMini", project:"yokup", status:"done", subject:"Cerrada ayer" },
]};
const TODO = { "/highscore/active-work":TRABAJO_PARADO, "/highscore/daily":MARCADOR, "/fleet/missions":MISIONES };

test("pide los tres orígenes de Yokup y ninguno más", async () => {
  const { pedidas } = monta(TODO); await espera();
  assert.deepEqual(pedidas.map((p) => p.split("?")[0]).sort(),
    ["/fleet/missions", "/highscore/active-work", "/highscore/daily"]);
});

test("con sesiones abiertas y cero trabajando, denuncia el fallo y da el motivo", async () => {
  const { nodos } = monta(TODO); await espera();
  const aviso = nodos["#diagnostico"].innerHTML;
  assert.match(aviso, /Nadie figura trabajando/);
  assert.match(aviso, /2 sesión\(es\) abierta\(s\)/, "solo cuenta los procesos abiertos");
  assert.match(aviso, /no_linked_work ×2/);
  assert.match(nodos["#kpis"].innerHTML, /<b>0<\/b>/, "contados trabajando");
});

test("un trabajo rancio se nombra como tal, no como trabajo en curso", async () => {
  const { nodos } = monta(TODO); await espera();
  assert.match(nodos["#diagnostico"].innerHTML, /1 trabajo\(s\) con estado <b>rancio<\/b>/);
  assert.match(nodos["#trabajando"].innerHTML, /assigned_stale/);
  assert.match(nodos["#trabajando"].innerHTML, /ejecuta SubNeoMBP16/);
});

test("avisa de que el marcador agrupa por persona y Trinity sale dos veces", async () => {
  const { nodos } = monta(TODO); await espera();
  assert.match(nodos["#marcador"].innerHTML, /Trinity ×2/);
  assert.match(nodos["#marcador"].innerHTML, /no se suman/);
});

test("el marcador se ordena por total, no por el orden que llega", async () => {
  const { nodos } = monta(TODO); await espera();
  const filas = [...nodos["#marcador"].innerHTML.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
  assert.deepEqual(filas, ["Neo", "Trinity", "Trinity"]);
  assert.match(nodos["#marcador"].innerHTML, /<td class="num">200<\/td>/);
});

test("solo se listan las misiones vivas", async () => {
  const { nodos } = monta(TODO); await espera();
  assert.match(nodos["#misiones"].innerHTML, /Permisos de admira\.tv/);
  assert.doesNotMatch(nodos["#misiones"].innerHTML, /Cerrada ayer/);
  assert.equal(nodos["#nmisiones"].textContent, "1 vivas");
});

test("si un origen falla se dice, y los otros dos se pintan igual", async () => {
  const { nodos } = monta({ ...TODO, "/highscore/daily": new Error("caído") }); await espera();
  assert.match(nodos["#fallo"].innerHTML, /No he podido leer Yokup entero/);
  assert.match(nodos["#fallo"].innerHTML, /HTTP 500/);
  assert.match(nodos["#misiones"].innerHTML, /Permisos de admira\.tv/);
});

test("la página no se indexa: enseña nombres y trabajo interno", () => {
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
});
