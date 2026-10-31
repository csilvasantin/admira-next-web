# /tiny · ThinkPad Admira MCP

Frontend retro (estilo Tiny Computers) del proyecto `thinkpad-admira-mcp`.
Es un cliente MCP estático: en la terminal, `url <https://.../mcp>`, `token <MCP_TOKEN>`, `conectar`.
El servidor MCP (Cloudflare Worker) **no está publicado** todavía: necesita las claves de Admira
(`ADMIRA_API_BASE`, `ADMIRA_API_KEY`, `MCP_TOKEN`) vía `npx wrangler secret put` y `npx wrangler deploy`.
Aquí no hay ninguna credencial.
