import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { PROYECTOS } from "../functions/_proyectos.js";
import { cantidadReleases, censoAgentes, equipoDelResponsable, normalizarResponsable, onRequestGet, onRequestPatch, resolverProyectoYokup, selloVivo, veredicto, RESPONSABLE_POR_DEFECTO } from "../functions/api/proyectos.js";

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
  assert.equal(subprojects.length, 25);
  assert.deepEqual(
    subprojects
      .filter((project) => project.parentKey !== "admira-tv")
      .map((project) => [project.clave, project.parentKey]),
    [
      ["admiranext-webmaster", "admiranext"],
      ["generador-presupuestos", "admiranext"],
      ["la-incubadora", "admira-live"],
      ["incubadora-bus", "la-incubadora"],
      ["yokup-rtc", "yokup"],
    ],
  );

  assert.match(apiSource, /https:\/\/api\.yokup\.com\/projects/);
  assert.match(apiSource, /totalProyectos, totalSubproyectos, yokupTotal/);
  assert.match(apiSource, /coincideYokup:/);
  assert.match(webmasterSource, /data-sort="proyecto"[^>]*>Proyecto <span id="proyectosCuenta"/);
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
  assert.equal(equipoDelResponsable("MorfeoMBP14"), "MacBookProNegro14");
  assert.equal(equipoDelResponsable("NeoMini"), "Mac Mini");
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
  let yokupWrite = null;
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
    env: {
      WEBMASTER_SIGNING_KEY: key,
      PRESENTATION_IDEAS: kv,
      YOKUP_FETCH: async (url, options = {}) => {
        assert.equal(url, "https://api.yokup.com/projects");
        if (!options.method) return new Response(JSON.stringify({
          ok:true,
          projects:[{ id:"webmaster-admiranext", name:"Webmaster AdmiraNeXT", web:"https://www.admiranext.com/webmaster", machines:["admira-macmini"], agents:["NeoMacMini"] }],
        }), { status:200, headers:{"content-type":"application/json"} });
        yokupWrite = JSON.parse(options.body);
        return new Response(JSON.stringify({
          ok:true,
          project:{ id:"webmaster-admiranext", owner:yokupWrite.primary_responsible, primary_responsible:yokupWrite.primary_responsible, machines:yokupWrite.machines, agents:yokupWrite.agents },
        }), { status:200, headers:{"content-type":"application/json"} });
      },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(storedKey, "webmaster:responsable:admiranext-webmaster");
  assert.equal(stored.responsable, "InfraNeoMini");
  assert.equal(stored.updatedBy, "csilvasantin@gmail.com");
  assert.deepEqual(yokupWrite, {
    id:"webmaster-admiranext",
    owner:"InfraNeoMini",
    primary_responsible:"InfraNeoMini",
    agents:["NeoMacMini", "InfraNeoMini"],
    machines:["admira-macmini"],
    by:"AdmiraNeXT Webmaster",
  });
  assert.deepEqual(await response.json(), {
    ok: true, clave: "admiranext-webmaster", responsable: "InfraNeoMini",
    yokupSynced:true,
    yokupProject:{ id:"webmaster-admiranext", name:"Webmaster AdmiraNeXT" },
  });
});

test("la ficha canónica de Yokup se resuelve sin inventar proyectos", () => {
  const censo = [
    { id:"yokup", name:"Yokup", web:"www.yokup.com" },
    { id:"webmaster-admiranext", name:"Webmaster AdmiraNeXT", web:"https://www.admiranext.com/webmaster" },
    { id:"xpaceos", name:"XpaceOS", web:"https://www.xpaceos.com" },
  ];
  assert.equal(resolverProyectoYokup(PROYECTOS.find((p) => p.clave === "yokup"), censo).id, "yokup");
  assert.equal(resolverProyectoYokup(PROYECTOS.find((p) => p.clave === "admiranext-webmaster"), censo).id, "webmaster-admiranext");
  assert.equal(resolverProyectoYokup(PROYECTOS.find((p) => p.clave === "admira-store"), censo).id, "xpaceos");
  assert.equal(resolverProyectoYokup({ clave:"sin-ficha", nombre:"Sin ficha", url:"https://sin-ficha.example" }, censo), null);
});

test("PATCH no finge guardado local cuando no existe ficha canónica en Yokup", async () => {
  const key = "test-webmaster-key";
  const payload = Buffer.from(JSON.stringify({ email:"csilvasantin@gmail.com", exp:Math.floor(Date.now()/1000)+3600 })).toString("base64url");
  const cryptoKey = await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC",cryptoKey,new TextEncoder().encode(`wm:${payload}`))).toString("base64url");
  let writes = 0;
  const response = await onRequestPatch({
    request:new Request("https://www.admiranext.com/api/proyectos",{
      method:"PATCH",headers:{cookie:`wm_session=${payload}.${signature}`,origin:"https://www.admiranext.com","content-type":"application/json"},
      body:JSON.stringify({clave:"yokup",responsable:"OraculoMacMini"}),
    }),
    env:{
      WEBMASTER_SIGNING_KEY:key,
      PRESENTATION_IDEAS:{async put(){writes+=1;}},
      YOKUP_FETCH:async()=>new Response(JSON.stringify({ok:true,projects:[]}),{status:200,headers:{"content-type":"application/json"}}),
    },
  });
  assert.equal(response.status,409);
  assert.equal(writes,0);
  assert.deepEqual(await response.json(),{ok:false,error:"el proyecto no tiene ficha canónica en Yokup"});
});

test("la subsolución abre su URL propia y verifica el release compartido de AdmiraNeXT", () => {
  const project = PROYECTOS.find((entry) => entry.clave === "generador-presupuestos");
  assert.equal(project.estadoUrl, "https://www.admiranext.com");
  assert.notEqual(project.estadoUrl, project.url);

  assert.match(apiSource, /const estadoUrl = p\.estadoUrl \|\| p\.url/);
  assert.match(apiSource, /traer\(fresco\(estadoUrl\)/);
  assert.match(apiSource, /estadoUrl\.replace\(\/\\\/\$\/, ''\).*\/version\.json/);
});

// Las veinte que la portada de admira.tv explica, en el mismo orden en que las
// enumera (`apps/public-catalog.json` del repositorio admira-tv). Si la home
// añade o quita una, esta lista es la que dice que el censo se quedó viejo.
const SUBSOLUCIONES_ADMIRA_TV = [
  "dashboard", "digitalsignage", "contentcatalogue", "support", "pushnotifications",
  "virtualassistant", "adcelerate", "gamification", "iotmanager", "videoanalytics",
  "radioanalytics", "socialwifi", "queuemanager", "roombooking", "audiobranding",
  "olfactorymarketing", "virtualreality", "augmentedreality", "xpaceos", "yarig",
];

test("admira.tv da de alta sus veinte subsoluciones, con dirección propia y release compartido", () => {
  const hijas = PROYECTOS.filter((project) => project.parentKey === "admira-tv");
  assert.deepEqual(hijas.map((p) => p.clave), SUBSOLUCIONES_ADMIRA_TV.map((s) => `admira-tv-${s}`));
  assert.deepEqual(hijas.map((p) => p.url), SUBSOLUCIONES_ADMIRA_TV.map((s) => `https://admira.tv/${s}/`));

  const padre = PROYECTOS.find((project) => project.clave === "admira-tv");
  for (const hija of hijas) {
    // Abre su propia dirección, pero el sello y la firma se leen donde de
    // verdad se publica: no tienen despliegue propio que verificar.
    assert.equal(hija.estadoUrl, "https://admira.tv");
    assert.notEqual(hija.estadoUrl, hija.url);
    assert.equal(hija.repo, padre.repo);
    assert.equal(hija.pages, padre.pages);
    assert.equal(hija.publica, padre.publica);
    assert.equal(hija.tipo, "sitio");
    assert.match(hija.repoTxt, /^admira-tv · [a-z]+\/$/);
    assert.match(hija.nota, /^Subsolución de admira\.tv: /);
  }

  // Claves únicas: sin esto, /api/historial y el guardado de responsables
  // (que van por clave) se pisarían entre filas.
  assert.equal(new Set(PROYECTOS.map((p) => p.clave)).size, PROYECTOS.length);
});

test("una portada compartida por varias filas se lee una sola vez por petición", async () => {
  const original = globalThis.fetch;
  const pedidas = [];
  globalThis.fetch = async (url) => {
    pedidas.push(String(url).replace(/[?&]wm=\d+/, ""));
    return new Response(
      '<meta name="admiranext-version" content="v.03.08.2026.r2.15:51">',
      { status: 200, headers: { "content-type": "text/html" } },
    );
  };
  try {
    const cache = new Map();
    const hijas = PROYECTOS.filter((p) => p.parentKey === "admira-tv");
    const sellos = await Promise.all(hijas.map((p) => selloVivo(p, cache)));

    // Veinte filas, una sola lectura de portada y una sola de version.json.
    assert.deepEqual([...new Set(pedidas)].sort(), [
      "https://admira.tv",
      "https://admira.tv/version.json",
    ]);
    assert.equal(pedidas.length, 2);
    for (const sello of sellos) assert.equal(sello.sello, "v.03.08.2026.r2.15:51");
  } finally {
    globalThis.fetch = original;
  }
});

test("Webmaster da de alta los cambios posteriores a la hora exacta del despliegue", async () => {
  const original = globalThis.fetch;
  let since = "";
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    since = parsed.searchParams.get("since") || "";
    return new Response(JSON.stringify([{
      sha: "despues-del-release",
      commit: { author: { date: "2026-08-11T20:05:00Z" } },
    }]), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const control = await veredicto(
      { url: "https://admira.tv", repo: "csilvasantin/admira-tv" },
      {
        sello: "v.11.08.2026.r5.21:03",
        deployedAt: "2026-08-11T19:03:24Z",
        valida: true,
      },
      {},
      new Map(),
    );
    assert.equal(since, "2026-08-11T19:03:25.000Z");
    assert.equal(control.estado, "sin-versionar");
    assert.equal(control.sinVersionar, 1);
    assert.equal(control.ultimoCambio, "2026-08-11T20:05:00Z");
  } finally {
    globalThis.fetch = original;
  }
});

test("un deployedAt futuro no puede ocultar cambios ni producir un al día falso", async () => {
  const original = globalThis.fetch;
  let since = "";
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    since = parsed.searchParams.get("since") || "";
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const control = await veredicto(
      { url: "https://admira.tv", repo: "csilvasantin/admira-tv" },
      {
        sello: "v.11.08.2026.r5.21:03",
        deployedAt: "2999-01-01T00:00:00Z",
        valida: true,
      },
      {},
      new Map(),
    );
    assert.equal(since, "2026-08-12T00:00:00.000Z", "una evidencia inválida nunca gobierna el corte");
    assert.equal(control.estado, "sin-firma");
    assert.match(control.texto, /deployedAt está en el futuro/);
  } finally {
    globalThis.fetch = original;
  }
});

test("selloVivo invalida una firma cuyo deployedAt no corresponde al sello", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("version.json")
    ? new Response(JSON.stringify({
      version: "v.11.08.2026.r5.21:03",
      deployedAt: "2026-08-11T17:00:00Z",
      deployer: "TrinityMBP14",
      machine: "MacBookProNegro14",
      signature: "TrinityMBP14 · MacBookProNegro14",
      git: "486f2681ba3c03d61ca60cb91e800951a522c1e3",
      dirty: false,
    }), { status: 200, headers: { "content-type": "application/json" } })
    : new Response('<meta name="admiranext-version" content="v.11.08.2026.r5.21:03">', {
      status: 200, headers: { "content-type": "text/html" },
    });
  try {
    const vivo = await selloVivo({ url: "https://admira.tv" }, new Map());
    assert.equal(vivo.valida, false);
    assert.equal(vivo.deployedAt, "");
    assert.match(vivo.error, /no corresponde a la fecha y hora del sello/);
  } finally {
    globalThis.fetch = original;
  }
});

test("una fecha de calendario imposible no se normaliza como evidencia válida", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("version.json")
    ? new Response(JSON.stringify({
      version: "v.02.03.2026.r1.20:03",
      deployedAt: "2026-02-30T19:03:24Z",
      deployer: "TrinityMBP14",
      machine: "MacBookProNegro14",
      signature: "TrinityMBP14 · MacBookProNegro14",
      git: "486f2681ba3c03d61ca60cb91e800951a522c1e3",
      dirty: false,
    }), { status: 200, headers: { "content-type": "application/json" } })
    : new Response('<meta name="admiranext-version" content="v.02.03.2026.r1.20:03">', {
      status: 200, headers: { "content-type": "text/html" },
    });
  try {
    const vivo = await selloVivo({ url: "https://admira.tv" }, new Map());
    assert.equal(vivo.valida, false);
    assert.match(vivo.error, /fecha u hora imposible/);
  } finally {
    globalThis.fetch = original;
  }
});

test("la columna se llama Proyecto y la de releases, Producción", () => {
  assert.match(webmasterSource, /data-sort="proyecto"[^>]*>Proyecto <span id="proyectosCuenta"/);
  assert.match(webmasterSource, /data-sort="releases"[^>]*>Producción <span/);
  assert.doesNotMatch(webmasterSource, />En producción </);
});

test("Webmaster publica un retorno ejecutable para pixer-eleven", () => {
  const pixer = PROYECTOS.find((p) => p.clave === "pixer-worker");
  assert.ok(pixer);
  assert.equal(
    pixer.volver,
    "npx wrangler rollback a83c7730-a9ba-4403-8ffc-818ec7b37934 --name pixer-eleven --yes",
  );
  assert.match(pixer.nota, /PixerWorker-rollback-pre-mando-silencioso-20260811-2048/);
  assert.match(webmasterSource, /<dt>Volver atrás<\/dt><dd>' \+ esc\(p\.volver\)/);
});

test("Webmaster conserva el retorno exacto anterior al canal responsive", () => {
  const admiraTv = PROYECTOS.find((p) => p.clave === "admira-tv");
  assert.ok(admiraTv);
  assert.equal(
    admiraTv.volver,
    "git checkout admiratv-rollback-pre-canal-responsive-20260811-2103 && ADMIRA_RELEASE_AGENT=TrinityMBP14 ADMIRA_RELEASE_MACHINE=MacBookProNegro14 ./deploy.sh cf",
  );
  assert.match(admiraTv.nota, /8da257a6-0ea2-4018-8aaf-d2d75f68a435/);
});

test("Webmaster publica los retornos anteriores a la autoría principal de Yokup", () => {
  const site = PROYECTOS.find((p) => p.clave === "yokup");
  const rtc = PROYECTOS.find((p) => p.clave === "yokup-rtc");
  assert.ok(site);
  assert.ok(rtc);
  assert.match(site.volver, /git worktree add \/tmp\/yokup-pages-return dd8139e/);
  assert.match(site.volver, /wrangler pages deploy .*yokup-site --project-name yokup --branch main/);
  assert.match(site.nota, /498ee810-cb20-4cb8-85c7-bb6b623fe51e/);
  assert.equal(
    rtc.volver,
    "npx wrangler rollback e941bb22-c71c-4e1c-a336-0c278a47d4a4 --name yokup-rtc --yes",
  );
  assert.match(rtc.nota, /autoría principal y al alta de OpenCode\/Nemotron/);
});

test("la API autenticada entrega a la UI el retorno exacto de pixer-eleven", async () => {
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
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("[]", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    const response = await onRequestGet({
      request: new Request("https://www.admiranext.com/api/proyectos?parte=retornos", {
        headers: { cookie: `wm_session=${payload}.${signature}` },
      }),
      env: { WEBMASTER_SIGNING_KEY: key },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    const pixer = body.proyectos.find((p) => p.clave === "pixer-worker");
    assert.equal(
      pixer.volver,
      "npx wrangler rollback a83c7730-a9ba-4403-8ffc-818ec7b37934 --name pixer-eleven --yes",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("el responsable se elige de un censo cerrado, no se escribe a mano", () => {
  assert.match(webmasterSource, /<select class="responsable-input"/);
  assert.doesNotMatch(webmasterSource, /<input class="responsable-input"/);
  assert.match(webmasterSource, /function opcionesResponsable\(actual\)/);
  assert.match(webmasterSource, /censoResponsables = Array\.isArray\(d\.censo\)/);
  // Elegir en el desplegable guarda al instante, sin esperar a perder el foco.
  assert.match(webmasterSource, /addEventListener\('change'[\s\S]{0,140}guardarResponsable\(e\.target\)/);
  // Un valor que el servidor normalice y no esté en la lista no vacía la casilla.
  assert.match(webmasterSource, /function fijarResponsable\(sel, valor\)/);
  assert.match(apiSource, /censo,/);
});

test("el censo de responsables solo admite agentes con equipo del diccionario", () => {
  const censo = censoAgentes(
    ["MorfeoMBACrema", "TrinityMBP14", "Fulanito", "  OraculoMacMini  ", ""],
    ["SmithMBAAzul"],
  );
  assert.ok(censo.includes("MorfeoMBACrema"));
  assert.ok(censo.includes("TrinityMBP14"));
  assert.ok(censo.includes("OraculoMacMini"), "los nombres llegan con espacios y hay que limpiarlos");
  assert.ok(!censo.includes("Fulanito"), "sin apellido de equipo no es un agente de la flota");
  assert.ok(censo.includes("SmithMBAAzul"), "un responsable ya asignado nunca puede faltar de su propia lista");
  assert.ok(censo.includes(RESPONSABLE_POR_DEFECTO));
  assert.deepEqual(censo, [...censo].sort((a, b) => a.localeCompare(b, "es")));
  assert.equal(new Set(censo).size, censo.length, "sin repetidos");
});
