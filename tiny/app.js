// Frontend retro: cliente MCP mínimo (JSON-RPC sobre HTTP) contra el Worker.
const out = document.getElementById("out"), cmd = document.getElementById("cmd"), estado = document.getElementById("estado");
const cfg = { url: localStorage.getItem("mcp_url") || "http://localhost:8787/mcp", token: sessionStorage.getItem("mcp_token") || "" };
let id = 0;
const print = (t) => { out.textContent += t + "\n"; out.scrollTop = out.scrollHeight; };
async function rpc(method, params) {
  const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.token }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()));
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
}
const texto = (res) => (res.isError ? "ERROR: " : "") + res.content.map((c) => c.text).join("\n");
const AYUDA = `Comandos:
  url <https://.../mcp>   servidor MCP (Worker)
  token <...>             token MCP (solo en esta sesión)
  conectar                initialize
  tools                   lista herramientas
  encargos [estado]       listar_encargos
  players [id]            estado_players
  cmd <player> <orden>    enviar_comando (siguiente|recargar|silencio|sonido)
  cls                     limpiar`;
async function ejecutar(linea) {
  const [c, ...a] = linea.trim().split(/\s+/); if (!c) return;
  print("C:\\ADMIRA>" + linea);
  try {
    switch (c.toLowerCase()) {
      case "help": case "ayuda": case "?": print(AYUDA); break;
      case "cls": out.textContent = ""; break;
      case "url": cfg.url = a[0]; localStorage.setItem("mcp_url", cfg.url); print("OK " + cfg.url); break;
      case "token": cfg.token = a[0] || ""; sessionStorage.setItem("mcp_token", cfg.token); print("token guardado en la sesión"); break;
      case "conectar": { const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "thinkpad-retro", version: "0.1" } }); estado.textContent = "● " + r.serverInfo.name; print("Conectado a " + r.serverInfo.name + " v" + r.serverInfo.version); break; }
      case "tools": (await rpc("tools/list")).tools.forEach((t) => print(" - " + t.name.padEnd(16) + t.description)); break;
      case "encargos": print(texto(await rpc("tools/call", { name: "listar_encargos", arguments: a[0] ? { estado: a[0] } : {} }))); break;
      case "players": print(texto(await rpc("tools/call", { name: "estado_players", arguments: a[0] ? { player_id: a[0] } : {} }))); break;
      case "cmd": print(texto(await rpc("tools/call", { name: "enviar_comando", arguments: { player_id: a[0], comando: a[1] } }))); break;
      default: print("Comando o nombre de archivo no válido. Escribe HELP.");
    }
  } catch (e) { print("ERROR: " + e.message); estado.textContent = "● sin conexión"; }
}
document.getElementById("f").onsubmit = (e) => { e.preventDefault(); ejecutar(cmd.value); cmd.value = ""; };
document.querySelectorAll(".track button").forEach((b) => (b.onclick = () => ejecutar(b.dataset.c)));
const keys = document.getElementById("keys");
"QWERTYUIOPASDFGHJKLÑZXCVBNM.-⌫".split("").concat(["␣", "↵"]).forEach((k) => {
  const b = document.createElement("button"); b.textContent = k;
  b.onclick = () => { if (k === "⌫") cmd.value = cmd.value.slice(0, -1); else if (k === "↵") { ejecutar(cmd.value); cmd.value = ""; } else cmd.value += k === "␣" ? " " : k.toLowerCase(); };
  keys.appendChild(b);
});
print("IBM ThinkPad BIOS · Admira MCP\nMemoria OK  640K\n\nEscribe HELP para ver los comandos.\n");
