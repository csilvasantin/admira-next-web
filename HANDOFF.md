# HANDOFF — Trilogía AdmiraNeXT

Actualizado: 2026-06-19
Matriz: `admira-next-web` → https://www.admiranext.com
HANDOFF público: https://www.admiranext.com/HANDOFF.md · GitHub: https://github.com/csilvasantin/admira-next-web/blob/main/HANDOFF.md

## Qué es la trilogía

Empresa agéntica **AdmiraNeXT** = una matriz + dos derivadas iniciales, conectadas en estrella:

| Pata | URL | Repo | Versión | Último commit |
|---|---|---|---|---|
| Matriz (corporate / RaaS·IoT) | https://www.admiranext.com | `csilvasantin/admira-next-web` | `v.26.06.18.r2` | `88b9c93` |
| Tienda de robots (venta+alquiler Agibot) | https://www.admira.shop | `csilvasantin/admira-bots` | `v.26.06.18.r2` | `b8b735a` |
| Consejo de Silicio (+ mesa + fichas) | https://www.admira.live | `csilvasantin/32.-ConsejoAdmiraNextGame` | homepage · mesa · control `v.26.06.19.r2` (unificadas) | `fdef4f5` |

`admira.store` (repo `admira-store`) queda FUERA de la trilogía: solo como ejemplo de xpaceos.com. No tocar como producto.

Nomenclatura oficial: **`v.AA.MM.DD.rN`** (año.mes.día.release). Visible en cada página (en la matriz, en `<meta name="admiranext-version">`).

## Navegación (en estrella, ya implementada)

- Matriz → derivadas: comando `/intranet` en admiranext.com con accesos `/shop` y `/live` (catálogo en `assets/app.js`, `INTRANET_CATALOG`, gateado tras la intranet).
- admira.shop → matriz: enlace `← AdmiraNeXT` en el footer (index + venta/alquiler/catálogo/contacto).
- admira.live → matriz: badge `🏠 AdmiraNeXT` en la barra superior.
- Regla: admira.shop ↔ admira.live NO se enlazan entre sí (las dos derivadas son independientes).

## Mesa del Consejo (control de la flota) — admira.live/control.html → teamwork.html

Trabajo principal del 18 jun. **Arquitectura real (clave):** el Funnel `https://macmini.tail48b61c.ts.net` enruta `/` → servidor **Node `src/server.js`** (puerto 3030, servicio launchd `com.admiranext.control`), que sirve TODO el panel (`/api/teamwork/*` y `/api/council/*`) y hace el SSH vía `src/ssh-exec.js` (clave `~/.ssh/admiranext_ed25519`). `council-api.py` (Python, 8420) solo se expone bajo `/pixtube`. → El control/monitor de máquinas va en el servidor Node, NO en council-api.py.

Funciones desplegadas y verificadas en vivo:
- **Monitor por máquina** (`GET /api/council/machine-status`): online, cuenta Claude logueada, versión de Claude Code, si está corriendo. Alcanzabilidad por SSH real (hostname Tailscale → IP), no por ping. Badge por máquina en la mesa. **(19 jun)** ahora cubre TODA la flota (12 máquinas): los workers Windows/sin-SSH salen marcados `monitor:"unsupported"` ("sin sondeo · requiere agente") en vez de ocultarse, y se auto-sondean en cuanto ganen canal SSH.
- **Feedback al enviar órdenes**: estado Enviando→Entregado, error real (offline / canal no habilitado / fallo SSH), captura del resultado y mini-historial por máquina.
- **Acciones de control acotadas** (`POST /api/teamwork/machine-action`, lista blanca): `claude-open`, `claude-quit` y **(19 jun)** `claude-restart` (quit→activate) + `refresh-capture` (recaptura pantalla+apps bajo demanda). Sin comando libre ni sudo. Botones ▶ Abrir / ■ Cerrar / ↻ Reiniciar / 📸 Captura por máquina (handler data-driven `MACT_LABELS`). `runMachineAction` soporta osascript multilínea y `kind:capture`.

Cuentas Claude por máquina (18 jun): Mac Mini = `csilva@admira.com`; resto del consejo online = `csilvasantin@gmail.com`. Todas con Claude Code 2.1.177 embebido en la app de escritorio (no CLI suelto).

## Cómo desplegar (importante)

- **Frontend** (admiranext.com, admira.shop, admira.live/teamwork.*): se publica por **GitHub Pages** al hacer push. El CDN cachea los `.js` ~10 min; cache-bustear con `?v=AAAAMMDD-N`.
- **Mac Mini** (`~/32.-ConsejoAdmiraNextGame`): repo **crónicamente divergido** (commit local duplicado + `data/*.json` de runtime) → `git pull` falla. Desplegar fichero a fichero: `git fetch origin && git checkout origin/main -- <fichero>` y reiniciar el servicio:
  - panel/Node: `launchctl kickstart -k "gui/$(id -u)/com.admiranext.control"`
  - council-api: `launchctl kickstart -k "gui/$(id -u)/com.csilvasantin.council-api"`
  - `node` no está en el PATH no-interactivo del SSH (validar sintaxis en local con `node --check`).
- Aviso obligatorio por Telegram al grupo **AdmiraXP** (`chat_id -1003841065210`, bot Memorizer, token en `~/Memorizer/.env`), texto plano, firmado "Admira IA".

## SSH / topología

- El servidor Node del Mac Mini SSHea a la flota con `~/.ssh/admiranext_ed25519`; su clave está autorizada en las demás (`MacMini-MacMini.local`).
- Air16 tiene clave (`id_ed25519`, "Air16-council") autorizada en Crema (100.110.80.2) y acceso al Mac Mini.
- Máquinas del consejo en `data/machines.json` (campo `unitType: council`, `ssh.enabled`).

## Riesgos / notas abiertas

- ~~admira.live homepage (r1) y mesa (r3) con versiones distintas~~ → **resuelto 19 jun**: homepage, mesa y control unificadas a `v.26.06.19.r1`.
- Workers Windows (4: Runner/OCR/Bot/Sitges) tienen `ssh.enabled:false`; el sondeo de cuenta es Python/macOS, no corre en Windows. Hoy aparecen en el monitor marcados "sin sondeo · requiere agente". El sondeo real necesita un agente nativo Windows (PowerShell o heartbeat reverso a `/api/council/heartbeat`) — paso de infra pendiente, no de frontend.
- HTTPS no forzado en admira.live y admira.store (sí en admiranext.com y admira.shop).
- `admira-bots` repo: descripción ya corregida a admira.shop.

## Siguiente foco recomendado

1. ~~Más acciones acotadas (reiniciar app, refrescar captura)~~ → **hecho 19 jun** (`claude-restart`, `refresh-capture`). Si hace falta más, siempre lista blanca, nunca comando libre/sudo.
2. **Agente Windows para los workers**: para que el monitor sondee cuenta/estado en los PC (hoy "sin sondeo"), montar un canal en Windows — PowerShell por SSH (habilitar `ssh.enabled`) o heartbeat reverso del worker a `/api/council/heartbeat`. Es el siguiente paso real del monitor de flota.
3. ~~Cuadrar versión visible r2/r1~~ → **hecho 19 jun** (unificadas a `v.26.06.19.r1`).

## Convención

Cuando el usuario escriba `handoff` (o "handON") para la trilogía, actualizar este archivo (fecha, URLs, versiones `v.AA.MM.DD.rN`, commits, últimos cambios, riesgos, siguiente paso) y enviar Telegram a AdmiraXP con: URL pública, versión, URL de este HANDOFF.md y commit. Firmado "Admira IA".
