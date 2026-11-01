# Ojos remotos (ojosIA) · guía y MCP

Dar ojos a consejeros y agentes de AdmiraNeXT. Página con sesión: https://www.admiranext.com/ojosremotos · Ayuda humana: https://www.admiranext.com/help/#ojosremotos

## Cámaras y orden de preferencia
1. **iPhone Pro con Camo Studio** — la mejor imagen; primera opción.
2. **Samsung Fold** — segunda opción.
3. **Insta360, solo de respaldo**:
   - **Link 2** (Mac Mini, USB/webcam, pan-tilt-zoom). `ojos foto link`.
   - **Luna Ultra** (Wi-Fi propia de la cámara, **un solo cliente**, gimbal de 3 ejes por velocidad, sin zoom en 360). Se pliega/apaga si se toca o queda inactiva. `luna_gimbal.py test | center | move H V SEG` (H, V en −100..100). Cierra antes Luna Ultra Desktop.
   - **Studio Display** (Mac Studio, fija, solo foto). `ojos foto studio`.

Modo Experto: `/abreojosremotos MacStudio|MacMini` abre los ojos de ese ordenador y los enseña.

## MCP (https://www.admiranext.com/mcp)
Autenticación: `Authorization: Bearer anmcp_…` (token de /usuarios → Tokens MCP; la etiqueta lleva tu nombre). Sin token solo `help {"tema":"ojos"}`.

| Tool | Argumentos | Rol | Qué hace |
| --- | --- | --- | --- |
| `ojos_list_cameras` | — | viewer | Cámaras, nodo, si mueven y si el relevo está configurado. Sin peticiones a los nodos. |
| `ojos_get_snapshot` | `cam` | viewer | Foto JPEG actual (contenido MCP `image`). Mirar SIEMPRE antes de mover. |
| `ojos_move_gimbal` | `cam, h, v, seg?, he_mirado:true` | admin | h/v enteros −100..100. Luna: velocidad durante `seg` (≤5 s, luego para). Link 2: grados relativos. |
| `ojos_stop_gimbal` | `cam` | editor | Para (velocidad 0). |
| `ojos_center_gimbal` | `cam, he_mirado:true` | admin | Luna: recentra en el lado actual. Link 2: pan 0, tilt 0. |

`cam` ∈ `link · luna · studio`.

## Arquitectura
Las cámaras viven en `ojos-nodo.py` (admira-vault/ojosia) del Mac Mini y del Mac Studio, solo en la tailnet (`/foto/<cam>`, `/ptz/<cam>`, `/preset/*`). El worker de Cloudflare no está en la tailnet, así que el MCP es un **relevo opcional**:

- `OJOS_NODO_MM_URL`, `OJOS_NODO_MS_URL` (vars): URL HTTPS alcanzable del nodo (Tailscale Funnel o Cloudflare Tunnel). Sin definir = sin relevo.
- `OJOS_NODO_MM_TOKEN`, `OJOS_NODO_MS_TOKEN` (secrets, `wrangler secret put`): Bearer del nodo. Nunca en el repo.
- `OJOS_MOVER=on` (var): interruptor del movimiento. **Apagado por defecto**.

Sin configurar, `ojos_get_snapshot` y el movimiento responden «nodo no configurado» sin hacer ninguna petición.

## Reglas de seguridad
- Nunca pulses el botón rojo de grabar.
- Nunca escribas por BLE ni inventes bytes de protocolo.
- Mira antes dónde apunta (foto) y vuelve a mirar después de cada movimiento.
- Luna Ultra: un solo cliente. Cierra Luna Ultra Desktop antes de `luna_gimbal.py` o el nodo, y vuelve a abrirla después.
- No muevas el robot ni su brazo sin el OK de Carlos.

## Solución de problemas
- **Imagen negra**: la cámara está plegada o apagada. Pide a una persona que la despliegue/encienda; no muevas a ciegas.
- **La Luna no conecta / se corta**: otro cliente (Luna Ultra Desktop, el móvil) la tiene ocupada, o el ordenador no está en la Wi-Fi de la cámara (`ojos-wifi.sh`).
- **«nodo no configurado»** en el MCP: usa /ojosremotos desde la tailnet o el comando local.
- **401 en /ojosremotos**: entra con tu cuenta Google del directorio.
