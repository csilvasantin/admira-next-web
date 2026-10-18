# Supervisor · cara, cámara y parte / Face, camera and report

## Castellano

El **Supervisor** es la tercera mascota del ⌘ Experto, junto a Admirito y Bugito. Es la Insta360 del MacMini que mira la pantalla del **MBP16** del laboratorio (Gran de Gràcia 51, CI `GDG51-PAN-07`). Si la pantalla se apaga o falla, abre la incidencia en [admira.app/supervisor](https://www.admira.app/supervisor).

Su cara es Admirito en menta y teal, con gorra de vigilante y el ojo derecho hecho objetivo de cámara: `digitalavatar.ai/nube.html?personaje=supervisor`.

### Qué hace cada orden

| Orden | Dónde | Qué hace |
|---|---|---|
| `/supervisor` | Admira Live | Abre la cámara de Analizar con sus controles, como antes. Además saca la cara en el panel del avatar con lo que ve ahora. La cara **nunca tapa la cámara**: si no cabe al lado, se estrecha a su derecha (mínimo 220 px) y, si tampoco cabe así, se pliega en la burbuja del Supervisor. Medido en admira.live: a 1920×1080 cabe tal cual, a 1440×900 se estrecha a 234 px y a 1280×800 se pliega. |
| `/supervisor` | Cualquier otra página | Va a `admira.live/analizar?supervisor=1`, como antes. Al llegar se abre la cámara y sale la cara. |
| `/supervisor estado` · `/supervisor status` | Cualquier página | Da el parte en la consola sin salir de la página. Saca la cara, que primero enfoca y luego dice lo que ve. |
| Otro argumento | — | Error de uso. Nunca ejecuta nada más. |

El parte incluye:

- el estado de la pantalla del MBP16, con la hora de la lectura y el ciclo;
- las incidencias abiertas, con su enlace;
- la última foto publicada;
- el enlace al tablero.

Lo escribe `parteSupervisor` de `admira.biz/supervisor-core.mjs`, el mismo lector que usa `/supervisor estado` en admira.biz. No se copia en la suite.

### Qué le dices a la cara

La cara entiende las dos órdenes del verbo, en castellano o en inglés:

- «¿Qué ves?» o «¿Hay incidencias?» ejecuta `/supervisor estado`.
- «Abre la cámara» ejecuta `/supervisor`.

Lo demás lo contesta ella: no pregunta al cerebro ni lee el tablero por su cuenta. Lo que le cuenta el anfitrión es lo único que sabe.

### Honestidad

- La cara sólo cita una incidencia si el anfitrión le da un id `INC-…` válido.
- Ver la pantalla encendida otra vez **no cierra** la incidencia: la cara lo dice («sigue abierta hasta que alguien la revise»).
- Sin señal del tablero, el parte no cuenta como éxito y la cara lo dice.

## English

The **Supervisor** is the ⌘ Expert's third mascot, next to Admirito and Bugito: the Mac mini Insta360 that watches the lab **MBP16** screen and opens incidents at [admira.app/supervisor](https://www.admira.app/supervisor). Its face is Admirito in mint and teal with a security cap and a camera-lens right eye (`nube.html?personaje=supervisor`).

- `/supervisor` opens the camera with its controls, as before. On Admira Live the face also appears in the avatar panel; from any other page the browser goes to `admira.live/analizar?supervisor=1` and the face appears there.
- `/supervisor status` prints the report in the console without leaving the page, and the face says what it sees.
- Any other argument is a usage error.
- The face sends «what do you see?» and «open the camera» back to the host as those two commands. It never asks the brain and never reads the board itself.

## Contrato / Contract

### Cargador · `assets/avatar.js`

- `PERSONAJES.supervisor` has `soloCara: true`. The loader knows the face, but `decide('/supervisor')` returns `null`, so the suite keeps the verb.
- `AdmiraAvatar.cara(id, {orden})` opens the avatar panel with `nube.html?personaje=<id>`. If that face is already showing, it is not reloaded.
- `cara()` returns `{enviar(msg), cerrar()}`, or `null` for an unknown id.
- A loader without `cara` (an older cached one) is upgraded with it. If it still has none, the suite prints the report without a face.
- `enviar(msg)` sanitises `msg` with `caraMensaje`, keeps the latest one, and posts it once the face says it is ready. It posts it again if the face reloads.
- `enviar` returns `false` once that face has left the panel, for example after `/avatar good` or when the panel is hidden.
- `opts.orden({orden, texto, lang})` receives the face's orders, filtered by `caraOrden`.
- `opts.evitar` is a CSS selector (≤ 100 chars) for what the face must never cover; the suite passes `#analizar-webcam`. `caraHueco(zona, panel, vista)` decides `libre`, `estrecha` (the width left to the right of that zone, at least 220 px; the narrowing is never saved as the user's chosen size) or `plegada` (the Supervisor bubble). The face looks again when the window is resized. Jobs, 18-oct-2026: «que no tape ningún control de la cámara; si los tapa, que se pliegue o se aparte».
- Without the reader (`admira.biz/supervisor-core.mjs` not loading), `/supervisor` still opens the camera and `/supervisor estado` says so clearly; the face goes to `sin-senal`.
- Messages go only to and from the avatar's own iframe, and only to and from the origin `https://digitalavatar.ai`. Never to `*`.

### Mensajes / Messages

| Dirección | Mensaje |
|---|---|
| cara → anfitrión | `{type:"da-supervisor-listo"}` |
| cara → anfitrión | `{type:"da-supervisor-orden", orden:"estado"\|"camara", texto (≤ 500), lang}` |
| anfitrión → cara | `{type:"da-supervisor", estado, espera?, ticket?, texto? (≤ 240), silencio?, lang?}` |

Para `ticket` vale `INC-[A-Z0-9]{3,16}` o `incidencia.id`.

`estado` puede ser uno de estos tres vocabularios. La cara traduce los dos últimos:

- **De la piel:** `vigilando`, `enfocando`, `alerta`, `conforme`, `dudando`, `ciego` o `sin-senal`.
- **Del tablero (`leerTablero`):**
  - `encendida` → vigilando
  - `apagada` → alerta
  - `sin-dato` → ciego
  - `sin-senal` → sin-senal
- **Del veredicto (`veredicto`):**
  - `visto` → conforme si `espera` es `encendida`; si no, alerta
  - `esperando` → enfocando
  - `esperando-senal` → sin-senal
  - `sin-nueva` y `no-visto` → dudando

Cualquier otro valor se ignora.

La cara acepta estos mensajes sólo de su ventana padre y de un origen de la lista de `da-context.js`. Esa lista incluye **admira.live** desde digitalavatar.ai#43.

### Suite · `suite/experto.js`

- El lector es `https://www.admira.biz/supervisor-core.mjs`, que se sirve con `Access-Control-Allow-Origin: *`.
- Una página que ya tenga el lector puede dejarlo en `window.AdmiraSupervisorCore` y la suite no lo vuelve a cargar.
- Si el lector no carga, la consola lo dice. La cara pasa a `sin-senal` y no se inventa ninguna lectura.
- El mensaje a la cara lleva:
  - el estado del tablero, tal cual;
  - la primera incidencia abierta;
  - un `texto` con el estado y la incidencia, por ejemplo «Pantalla encendida · incidencia INC-KOBKYX abierta.».
- admira.biz conserva su propio adaptador de `/supervisor` (`clearchannel-tv/expert-panel.js`). Cuando esta versión de la suite se publique, Morfeo lo alineará para que también saque la cara.

Tests: `test/experto-supervisor.test.mjs` (la cámara, sin cambios) y `test/experto-supervisor-cara.test.mjs` (cara, parte y contrato). En digitalavatar.ai: `tests/supervisor.test.mjs`.
