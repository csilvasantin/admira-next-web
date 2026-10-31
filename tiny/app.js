// Tiny · Admira: vitrina de 10 máquinas + cliente MCP compartido (JSON-RPC sobre HTTP). Sin dependencias ni secretos.
const $ = (id) => document.getElementById(id);
const M = window.MODELOS, q = new URLSearchParams(location.search), m = M.find((x) => x.id === q.get("m"));
const cfg = { url: localStorage.getItem("mcp_url") || "http://localhost:8787/mcp", token: sessionStorage.getItem("mcp_token") || "" };
const tema = (el, t) => Object.entries(t).forEach(([k, v]) => el.style.setProperty("--" + k, v));

if (!m) {
  $("vitrina").hidden = false; $("urlv").value = cfg.url;
  $("urlok").onclick = () => { cfg.url = $("urlv").value.trim(); localStorage.setItem("mcp_url", cfg.url); $("urlok").textContent = "OK"; };
  M.forEach((x) => {
    const a = document.createElement("a"); a.className = "card"; a.href = "?m=" + x.id; tema(a, x.t);
    a.innerHTML = `<div class="mini"><div class="s"></div><div class="k"></div></div><b></b><small></small><br><span class="tag${x.pendiente ? " p" : ""}">${x.pendiente ? "pendiente" : "real"} · ${x.modulo}</span>`;
    a.querySelector(".s").textContent = x.intro.split("\n").slice(0, 5).join("\n");
    a.querySelector("b").textContent = x.nombre; a.querySelector("small").textContent = x.epoca;
    $("grid").appendChild(a);
  });
} else {
  document.title = m.nombre + " · Admira MCP";
  const root = $("maquina"); root.hidden = false; root.classList.add(m.efecto); tema(document.body, m.t); tema(root, m.t);
  document.body.style.background = "radial-gradient(" + m.t.borde + ",#111)";
  $("titulo").textContent = m.nombre.toUpperCase() + " · " + m.modulo.toUpperCase(); $("logo").textContent = m.nombre; $("prompt").textContent = m.prompt;
  const out = $("out"), estado = $("estado"); let id = 0, player = "";
  const print = (t) => { out.textContent += t + "\n"; out.scrollTop = out.scrollHeight; };
  async function rpc(method, params) {
    const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.token }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()));
    const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
  }
  const texto = (res) => (res.isError ? "ERROR: " : "") + res.content.map((c) => c.text).join("\n");
  const call = async (name, args = {}) => { const r = await rpc("tools/call", { name, arguments: args }); const t = texto(r); if (/^pendiente/.test(t)) throw Object.assign(new Error(t), { pend: true }); return { r, t }; };
  const pendiente = (tool) => print(`[ MÓDULO PENDIENTE ]\nFalta herramienta MCP: ${tool}\n(el servidor aún no la implementa con la API de Admira)`);
  const parse = (t) => { try { return JSON.parse(t); } catch { return null; } };

  async function modulo() {
    const mod = m.modulo;
    if (m.pendiente) { try { const { t } = await call(m.tool); print(t); } catch (e) { if (e.pend || /desconocida|HTTP|fetch|Failed/i.test(e.message)) pendiente(m.tool); else throw e; }
      if (mod === "analiticas") { const { t } = await call("estado_players").catch(() => ({ t: "" })); bsod(t); } return; }
    if (mod === "encargos") { const { t } = await call("listar_encargos"); const d = parse(t);
      if (Array.isArray(d)) { const w = $("wins"); w.innerHTML = ""; d.forEach((e) => { const s = document.createElement("span"); s.className = "icono"; s.textContent = e.titulo || e.nombre || e.id; s.ondblclick = () => print(JSON.stringify(e, null, 2)); w.appendChild(s); }); } else print(t); }
    else if (mod === "players") { const { t } = await call("estado_players"); const d = parse(t), w = $("wins"); w.innerHTML = "";
      (Array.isArray(d) ? d : [d || { id: "?", estado: t }]).forEach((p) => { const v = document.createElement("div"); v.className = "win"; v.innerHTML = '<div class="tt"></div><div class="bd"></div>'; v.querySelector(".tt").textContent = "Pantalla " + (p.id ?? "?"); v.querySelector(".bd").textContent = Object.entries(p).filter(([k]) => k !== "id").map(([k, x]) => k + ": " + x).join("\n"); w.appendChild(v); }); }
    else if (mod === "estado") print((await call("estado_players")).t);
    else if (mod === "comandos") print("LOAD \"<player>\",8 y luego RUN <orden>");
    else print(AYUDA);
  }
  function bsod(t) { const d = parse(t); const caidos = Array.isArray(d) ? d.filter((p) => p.online === false || /off|caid|down/i.test(p.estado || "")) : [];
    if (caidos.length) { const b = $("bsod"); b.hidden = false; b.textContent = "Admira\n\nSe ha detectado un problema: " + caidos.length + " player(s) sin conexión.\n\n" + caidos.map((p) => "*** PLAYER " + p.id).join("\n") + "\n\nToca para continuar _"; b.onclick = () => (b.hidden = true); } }
  const AYUDA = `Comandos (todas las máquinas):
  url <https://.../mcp>   servidor MCP   token <...>  (solo sesión)
  conectar | tools | encargos [estado] | players [id]
  cmd <player> <orden>    siguiente|recargar|silencio|sonido
  modulo                  módulo propio de esta máquina (${m.modulo})
  cls | vitrina`;
  async function ejecutar(linea) {
    const l = linea.trim(); if (!l) return; print(m.prompt + l);
    const [c, ...a] = l.split(/\s+/); const C = c.toLowerCase();
    try {
      if (m.id === "c64" && C === "load") { player = (l.match(/"([^"]+)"/) || [, a[0]])[1]; print("SEARCHING FOR " + player.toUpperCase() + "\nLOADING\nREADY."); return; }
      if (m.id === "c64" && C === "run") { if (!player) { print("?NO PLAYER  ERROR\nREADY."); return; } print((await call("enviar_comando", { player_id: player, comando: (a[0] || "siguiente").toLowerCase() })).t + "\nREADY."); return; }
      if (C === "dir" && /players/i.test(a[0] || "")) { print((await call("estado_players")).t); return; }
      switch (C) {
        case "help": case "ayuda": case "?": print(AYUDA); break;
        case "cls": out.textContent = ""; $("wins").innerHTML = ""; break;
        case "vitrina": location.href = "./"; break;
        case "url": cfg.url = a[0]; localStorage.setItem("mcp_url", cfg.url); print("OK " + cfg.url); break;
        case "token": cfg.token = a[0] || ""; sessionStorage.setItem("mcp_token", cfg.token); print("token guardado en la sesión"); break;
        case "conectar": { const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tiny-" + m.id, version: "0.2" } }); estado.textContent = "● " + r.serverInfo.name; print("Conectado a " + r.serverInfo.name + " v" + r.serverInfo.version); break; }
        case "tools": (await rpc("tools/list")).tools.forEach((t) => print(" - " + t.name.padEnd(20) + t.description)); break;
        case "encargos": print((await call("listar_encargos", a[0] ? { estado: a[0] } : {})).t); break;
        case "players": print((await call("estado_players", a[0] ? { player_id: a[0] } : {})).t); break;
        case "cmd": print((await call("enviar_comando", { player_id: a[0], comando: a[1] })).t); break;
        case "modulo": case m.modulo: await modulo(); break;
        default: print(m.id === "c64" ? "?SYNTAX  ERROR\nREADY." : "Comando no válido. Escribe HELP.");
      }
    } catch (e) { if (e.pend) pendiente(e.message.replace(/.*MCP /, "")); else { print("ERROR: " + e.message); estado.textContent = "● sin conexión"; } }
  }
  $("f").onsubmit = (e) => { e.preventDefault(); ejecutar($("cmd").value); $("cmd").value = ""; };
  [["CONECTAR", "conectar"], [m.modulo.toUpperCase(), "modulo"], ["HELP", "help"]].forEach(([n, c]) => { const b = document.createElement("button"); b.textContent = n; b.onclick = () => ejecutar(c); $("track").appendChild(b); });
  "QWERTYUIOPASDFGHJKLÑZXCVBNM.-⌫".split("").concat(["␣", "↵"]).forEach((k) => {
    const b = document.createElement("button"); b.textContent = k;
    b.onclick = () => { const i = $("cmd"); if (k === "⌫") i.value = i.value.slice(0, -1); else if (k === "↵") { ejecutar(i.value); i.value = ""; } else i.value += k === "␣" ? " " : k.toLowerCase(); };
    $("keys").appendChild(b);
  });
  print(m.intro + "\n");
  if (m.pendiente) pendiente(m.tool);
  print("MCP: " + cfg.url + "  (cambia con: url <...>)\n");
}
