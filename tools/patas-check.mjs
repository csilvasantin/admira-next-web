#!/usr/bin/env node
// patas-check.mjs — comprueba un proyecto en las patas y, si un dominio sirve
// contenido, mira también a su gemelo.
//
// Carlos, 2-oct-2026: admira.biz es el gemelo en español de yokup.com, igual que
// admira.studio/pixeria.com, admira.store/xpaceos.com y admira.app/clearchannel.tv.
// Es la misma pata y el mismo registro. No es un quinto registro.
//
// Uso: node tools/patas-check.mjs <proyecto>
// Solo lee. No da de alta, no escribe y no despliega.

export const PATAS = [
  { id: "studio", registro: "pixeria", dominios: ["https://www.admira.studio", "https://www.pixeria.com"] },
  { id: "store", registro: "xpaceos", dominios: ["https://www.admira.store", "https://www.xpaceos.com"] },
  { id: "app", registro: "clearchannel", dominios: ["https://www.admira.app", "https://www.clearchannel.tv"] },
  { id: "yokup", registro: "yokup", dominios: ["https://www.yokup.com", "https://admira.biz"] },
];

const hostDe = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return String(url || ""); }
};

const igual = (valor, q) => String(valor || "").trim().toLowerCase() === q;

export function sirveContenido(sonda) {
  if (!sonda) return false;
  const status = Number(sonda.status) || 0;
  const bytes = Number(sonda.bytes) || 0;
  const type = String(sonda.type || "");
  // 401 con HTML es la verja de acceso: el dominio sí sirve. Un fallo de red
  // llega como status 0 y no cuenta.
  const documento = /^(text\/html|application\/json|text\/plain)\b/.test(type);
  return (status === 200 || status === 401) && bytes > 0 && documento;
}

// Una fila por pata. Si algún dominio sirve contenido, los dos tienen que
// haber sido sondeados: es el mismo chequeo del mismo registro.
export function comprobarPata(pata, sondas) {
  const porHost = new Map((sondas || []).map((s) => [hostDe(s.url), s]));
  const dominios = pata.dominios.map((url) => {
    const s = porHost.get(hostDe(url));
    return { url, sondado: Boolean(s), sirve: sirveContenido(s), status: s ? (Number(s.status) || 0) : null };
  });
  const algunoSirve = dominios.some((d) => d.sirve);
  return {
    id: pata.id,
    registro: pata.registro,
    algunoSirve,
    incompleto: algunoSirve && dominios.some((d) => !d.sondado),
    dominios,
  };
}

export function presencia(proyecto, fuentes = {}) {
  const q = String(proyecto || "").trim().toLowerCase();
  const projects = fuentes.demos?.projects || [];
  const circuits = fuentes.circuits?.circuits || [];
  const demos = projects.some((p) => igual(p.id, q) || igual(p.circuit, q));
  const grid = circuits.some((c) => igual(c.project, q) || igual(c.id, q));
  return { proyecto: q, demos, grid, yokup: grid };
}

async function sonda(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "patas-check" } });
    const buf = await r.arrayBuffer();
    return { url, status: r.status, bytes: buf.byteLength, type: r.headers.get("content-type") || "" };
  } catch (e) {
    return { url, status: 0, bytes: 0, type: "", error: e.name === "AbortError" ? "tiempo" : "no-sirve" };
  } finally {
    clearTimeout(timer);
  }
}

async function leerJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": "patas-check", Accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json();
}

function marca(ok) { return ok ? "✓" : "✗"; }

export function tabla(proyecto, fuentes, patas) {
  const pre = presencia(proyecto, fuentes);
  const lineas = [
    `proyecto  ${pre.proyecto || "(vacío)"}`,
    `demos     ${marca(pre.demos)}  /api/xpace/demos`,
    `grid      ${marca(pre.grid)}  /grid/circuits   registro yokup (también vale para admira.biz)`,
    "",
    "pata      registro       dominio                         sirve",
  ];
  for (const fila of patas) {
    for (const d of fila.dominios) {
      const estado = !d.sondado ? "sin sondeo" : d.sirve ? (d.status === 401 ? "✓ verja" : "✓") : "✗ no sirve";
      lineas.push(`${fila.id.padEnd(9)} ${fila.registro.padEnd(14)} ${d.url.padEnd(31)} ${estado}`);
    }
  }
  const incompletas = patas.filter((p) => p.incompleto).map((p) => p.id);
  if (incompletas.length) lineas.push("", `incompleto  ${incompletas.join(", ")}: sirve contenido y falta el otro dominio del mismo registro`);
  return { texto: lineas.join("\n"), incompletas, presencia: pre };
}

async function main() {
  const proyecto = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (!proyecto) {
    console.error("uso: node tools/patas-check.mjs <proyecto>");
    process.exit(2);
  }
  const [demos, circuits, sondas] = await Promise.all([
    leerJson("https://www.admiranext.com/api/xpace/demos"),
    leerJson("https://api.admira.store/grid/circuits"),
    Promise.all(PATAS.flatMap((p) => p.dominios).map(sonda)),
  ]);
  const patas = PATAS.map((p) => comprobarPata(p, sondas));
  const out = tabla(proyecto, { demos, circuits }, patas);
  console.log(out.texto);
  if (out.incompletas.length) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith("patas-check.mjs")) main();
