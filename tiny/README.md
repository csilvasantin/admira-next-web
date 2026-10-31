# /tiny · ThinkPad Admira MCP

Frontend retro (estilo Tiny Computers) del proyecto `thinkpad-admira-mcp`.
Es un cliente MCP estático: en la terminal, `url <https://.../mcp>`, `token <MCP_TOKEN>`, `conectar`.
El servidor MCP (Cloudflare Worker) **no está publicado** todavía: necesita las claves de Admira
(`ADMIRA_API_BASE`, `ADMIRA_API_KEY`, `MCP_TOKEN`) vía `npx wrangler secret put` y `npx wrangler deploy`.
Aquí no hay ninguna credencial.

## Vitrina de 10 máquinas
`/tiny` muestra 10 ordenadores retro (nombres genéricos, sin logos). `/tiny?m=<id>` abre cada uno con su tema.
Módulos reales: mac128 (encargos), c64 (LOAD/RUN → enviar_comando), ibmpc (DIR PLAYERS), win95 (ventanas de players), thinkpad (consola).
Pendientes (falta herramienta MCP): amiga500 (demos), imacg3 (canales), ibookg3 (tienda Casas), powerbookg4 (incidencias), winxp (analíticas + pantalla azul si cae un player).
