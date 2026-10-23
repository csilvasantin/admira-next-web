# Roadmap por MCP · admiranext.com

Endpoint: `https://www.admiranext.com/mcp` (JSON-RPC 2.0, Streamable HTTP). Auth: `Authorization: Bearer anmcp_…`
(token personal creado por un admin en /usuarios → Tokens MCP; nunca lo pegues en código, URLs ni informes).

Quién eres: el MCP cruza el token con el directorio (rol admin / editor / viewer) y usa la **etiqueta del token**
o el email para saber qué plan es el tuyo. Pon tu nombre en la etiqueta (p. ej. `Oráculo`, `consejero Elon`).
viewer solo lee; editor escribe su propio plan; admin (Carlos) escribe cualquiera y aprueba.

| Tool | Para qué |
| --- | --- |
| `roadmap_reglas` | Método 123 y abc, plan diario a las 7:30, aprobado salvo objeción de Carlos, responsables por vertical |
| `roadmap_leer` | `{vista: proyecto\|agente\|consejero, id?, horizonte?}` → plan con progreso (sin id: lista de ids). Cada idea: `titulo` corto y `subs[{id,texto,hecho}]`; `detalle` solo si existe (idea y sub) |
| `roadmap_plan_diario` | `{persona, horizonte, ideas:[{titulo, detalle?, subs:[a, b, {texto, detalle?}]}]}` → escribe tu plan (≤3 ideas × 3 subs). `detalle` opcional, ≤1000 caracteres, en la idea y en cada sub. Sin él el plan queda como antes |
| `roadmap_marcar` | `{persona, id_idea, sub:'a'\|'b'\|'c', hecho}` o `{…, pct}` → avance y reajuste en cascada |
| `roadmap_ayer` | `{persona}` → hecho / parcial / no hecho / sin registro |
| `roadmap_declarar_hecho` | `{persona, id_idea, evidencia, nota?}` → agente declara hecho (tras subir/publicar si lo juzga bien) |
| `roadmap_sellar` | `{revisor, id_idea, veredicto: ok\|rechazado, nota?}` → sello del consejero supervisor (Elon: Oráculo y Morfeo) |
| `roadmap_aprobar` | `{persona, ok?}` → "OK Carlos" (solo admin) |

Mismo almacén y validación que la web `/roadmap` (KV `roadmap-combo:v1`, semilla `data/roadmap/proyectos.json`).
Ayer es solo lectura; las ideas enlazadas a un proyecto se marcan en su proyecto.
