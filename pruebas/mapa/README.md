# Mapa privado de equipos · fase 1

Encargo #5594. Implementación en una rama de `admira-next-web`, con una PR sin
fusionar. La interfaz vive únicamente en `/pruebas/mapa/`; este trabajo no publica
el mapa en producción ni modifica su navegación pública.

Preview de la rama: <https://mapa-5594.admiranext.pages.dev/pruebas/mapa/>.
La preview está desplegada; sin sesión el mapa devuelve `401`. El emisor debe
usar **el mismo host**: `https://mapa-5594.admiranext.pages.dev/api/ubicacion`.

Ruta prevista tras una futura fusión y publicación autorizadas:
`https://www.admiranext.com/pruebas/mapa/`, con el emisor en
`https://www.admiranext.com/api/ubicacion`. El secreto de producción ya está
creado. Esta PR no se fusiona: el atajo no debe apuntar todavía a esas
direcciones.

El mapa usa Leaflet. El tema oscuro carga el lienzo gris oscuro de Esri. Una
marca clara —Lumbre u otra cuyo modo o fondo sea claro— pinta toda la página en
ese tema: fondo, cabecera, botones y textos, y carga el lienzo gris claro. El
fondo de puntos de la noche no se queda debajo. CARTO Dark Matter y Positron
eran la base pedida; desde el 25 de septiembre de 2026 su tesela pública, sin
clave, es la marca de agua «API KEY REQUIRED». La clave no está en el
repositorio. El marcador mide unos 32 px y lleva el color de su tipo (teléfono
en los móviles, ordenador en los fijos). El dorado de «Dato de prueba» queda
solo en el borde del marcador. La etiqueta de la tarjeta va en una pastilla
ámbar con borde #B7791F y texto oscuro, para leerse sobre crema y sobre el
tema de noche. El círculo de precisión tiene al menos unos 24 px de radio,
para que el del iPhone (±14 m) se vea alrededor del marcador. La leyenda va
abajo a la izquierda, encima de la atribución. En móvil se pliega en un botón
«Leyenda». En «Datos reales» solo salen avisos reales. Cualquier dato de
prueba se marca «Dato de prueba». Estos retoques siguen en la PR, sin publicar.

## Acceso y alcance

- Todo `/pruebas/**`, incluidos HTML, scripts y datos de demo, pasa por la sesión
  Google y el directorio existentes de `functions/_webmaster-gate.js`.
- `POST /api/ubicacion` es una Pages Function para el equipo. Usa exclusivamente
  su Bearer; no necesita una cookie Google. Sin clave válida devuelve `401`.
- `GET /api/ubicacion` exige la sesión Google. El Bearer del iPhone no autoriza
  leer posiciones. Sin sesión responde `401` y no devuelve coordenadas.
- Respuestas del mapa y de la API: `private, no-store`, sin caché CDN y fuera de
  buscadores. No hay claves en HTML, JavaScript, URLs ni el repositorio.
- La preview repite todos los bindings de producción y usa la base de login
  real (`admiranext-auth`). El KV de ubicaciones sigue en su espacio de preview
  para que un aviso de rama no entre en el historial de producción.
- El callback Google existente apunta a `www.admiranext.com/webmaster`: una
  sesión de producción no abre por sí sola el host de preview. Hasta disponer
  de un callback autorizado para ese host, una sesión de prueba demuestra el
  control de acceso, pero no equivale a validar el login Google completo allí.

La fase 1 admite avisos sólo de `iphone-carlos` (iPhone 17 Pro Max de Carlos).
El Mac mini figura como `fijo`, con la dirección manual «Gran de Gràcia 51,
Barcelona», con la referencia cartográfica manual de OpenStreetMap
[nodo 11967748167](https://www.openstreetmap.org/node/11967748167):
`41.3993419, 2.1559172`. No es una medición GPS ni un aviso automático. Los móviles
son `movil` en el contrato JSON. El inventario se define en
`functions/_ubicacion.js`.

## Contrato del emisor

`POST /api/ubicacion`, `Content-Type: application/json`,
`Authorization: Bearer <UBICACION_KEY_IPHONE>`.

| Campo | Contrato |
| --- | --- |
| `equipo` | Obligatorio, exactamente `iphone-carlos`; otro equipo devuelve `401`. |
| `lat` | Número finito entre −90 y 90. |
| `lon` | Número finito entre −180 y 180. |
| `precision_m` | Número finito entre 0 y 100000, en metros. |
| `bateria` | Opcional; número finito entre 0 y 100, porcentaje. Omitir si no está disponible. |
| `fuente` | Texto obligatorio, de 1 a 64 caracteres, sin caracteres de control. Por ejemplo `atajo-ios`. |
| `ts` | Instante de la medición: ISO 8601 con zona horaria, o Unix numérico en segundos/milisegundos. Máximo 24 h de retraso y 5 min de adelanto. |

No se admiten otros campos, números escritos como cadenas, valores `null` en
campos obligatorios ni un cuerpo mayor de 2048 bytes. Se valida la clave antes
de leer el JSON. La clave configurada debe tener al menos 32 caracteres.

Éxito: `201` con `{ok:true,equipo,ts,recibido_en}`. `ts` y `recibido_en` se
normalizan a ISO UTC. Errores: `400` para datos/JSON inválidos, `401` para clave
o equipo no autorizado, `413` para tamaño, `415` para Content-Type, `503` si KV
no está disponible y `405` para métodos distintos de GET/POST. No se devuelve
ni registra la clave.

## Clave y ejemplo técnico seguro

La clave de **preview** sigue en el Llavero del MacBook Pro 16, servicio
`UBICACION_KEY_IPHONE`, cuenta `TrinityMBP16`. No se ha rotado.

La clave de **producción** es otra, creada para el proyecto Pages `admiranext`
(entorno production, secreto `UBICACION_KEY_IPHONE`). Está en el Llavero del
Mac mini, servicio `UBICACION_KEY_IPHONE`, cuenta `WozMBP14`. El MacBook Pro
Negro 14 se alcanza por Tailscale, pero su llavero de inicio no acepta
escritura por SSH. Para leerla en el Mac mini, sin imprimirla:
`security find-generic-password -a WozMBP14 -s UBICACION_KEY_IPHONE -w`.
No está en el repositorio ni en el chat. La PR sigue sin fusionar: el secreto
queda listo para el próximo despliegue de producción y el atajo no debe apuntar
aún a `www.admiranext.com`.

Este ejemplo envía deliberadamente una **posición sintética de prueba al
preview**. Su fuente la identifica; no demuestra que el iPhone haya informado.
Se ejecuta sólo cuando se quiera registrar ese ensayo en el KV de preview:

```bash
python3 - <<'PY'
import datetime, json, subprocess

key = subprocess.run(
    ['security', 'find-generic-password', '-a', 'TrinityMBP16',
     '-s', 'UBICACION_KEY_IPHONE', '-w'],
    check=True, capture_output=True, text=True,
).stdout.strip()
payload = {
    'equipo': 'iphone-carlos', 'lat': 41.40, 'lon': 2.16,
    'precision_m': 25, 'bateria': 80, 'fuente': 'prueba-sintetica-codex',
    'ts': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
}
config = '\n'.join([
    'url = "https://mapa-5594.admiranext.pages.dev/api/ubicacion"',
    'request = "POST"',
    'header = "Content-Type: application/json"',
    'header = ' + json.dumps('Authorization: Bearer ' + key),
    'data-binary = ' + json.dumps(json.dumps(payload)),
]) + '\n'
result = subprocess.run(
    ['curl', '--silent', '--show-error', '--fail-with-body',
     '--max-time', '20', '--config', '-'],
    input=config, capture_output=True, text=True,
)
body = json.loads(result.stdout)
print(json.dumps({k: body[k] for k in
                 ['ok', 'equipo', 'ts', 'recibido_en', 'error'] if k in body}))
raise SystemExit(result.returncode)
PY
```

El secreto viaja a `curl` por su configuración en stdin; no queda en un archivo
ni en su lista de argumentos. No usar `set -x`, `curl -v` ni copiar el valor a una
URL, captura, informe o ejemplo de código.

## Persistencia y lectura

Binding KV: `UBICACIONES`. Cada medición se guarda como evento inmutable bajo
`ubicacion:v1:iphone-carlos:…`, con tiempo invertido para consultar primero la
medición más reciente. Un aviso atrasado no sustituye a una medición posterior.
La última posición se calcula desde esos eventos; no hay una copia permanente
que sobreviva al histórico.

Cada evento expira como máximo siete días después de su medición y nunca más de
siete días desde su recepción si el reloj del emisor va adelantado. La lectura
también excluye mediciones fuera de plazo. KV tiene consistencia eventual: un
POST aceptado puede tardar en aparecer al leer desde otra región. Actualizar
la página o repetir la lectura posteriormente; no atribuir esa demora a un nuevo
aviso del iPhone. Referencia: [consistencia de Workers KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

`GET /api/ubicacion` devuelve `ok`, `generado_en`, `retencion_dias:7`,
`desactualizado_tras_h:2` y `equipos`. Cada equipo incluye su identidad, `tipo`,
coordenadas/precisión/batería/fuente, `ts`, `ultimo_aviso`, `recibido_en`,
`desactualizado` y `estado`. Los móviles sin aviso válido aparecen como
`sin_datos`; si la medición tiene **más de** dos horas, como `desactualizado`.
Los campos de posición ausentes son `null`. Un fijo usa `fuente:'manual'` y
`estado:'fijo'`; no inventa un «último aviso» de GPS.

## Interfaz y verificación pendiente

La página reutiliza el armazón cuadrático de AdmiraNeXT: ☰ Opciones, ▤ Avanzado,
⌘ Experto, `/marca` y `/idioma ES` / `/idioma EN`. `/demo mapa` y el botón Demo
usan datos sintéticos señalados como tales; no escriben en el endpoint. `/demo
off` vuelve a consultar datos reales. Leaflet se sirve desde `/pruebas/mapa/vendor/`.

Son comprobaciones distintas: prueba automática del contrato, POST técnico al
preview, lectura privada del dato recibido, demo sintética y aviso real desde
el teléfono. Sólo la última valida el circuito completo del dispositivo.

Las capturas de revisión del preview usan una **sesión fixture válida y de corta
duración**, sobre el directorio aislado de pruebas. Se identifica expresamente
como fixture y se revoca después de la captura. Esto comprueba el perímetro y
permite revisar la interfaz; no acredita un login real con Google ni una
ubicación enviada desde el teléfono. Las evidencias y los resultados concretos
se adjuntan a la PR para revisión antes de cualquier fusión.

Wozniak tiene pendiente preparar/activar el atajo real de iOS y verificarlo con
Carlos en el iPhone. Debe enviar ubicación y precisión disponibles, batería si
la hay, `fuente:'atajo-ios'` y la hora real de la medición al endpoint de preview.
Hasta recibir ese aviso y comprobarlo en la lectura privada, la integración
real del teléfono sigue pendiente. La configuración de una automatización y
su frecuencia se verifica en el propio iPhone; la demo no la sustituye.

## Resultado de la comprobación técnica

En Cloudflare preview: POST sin clave `401`; POST con la clave del Llavero
`201`; GET y las cuatro variantes de página/assets sin sesión `401`; GET con
sesión fixture `200` y lectura del aviso `fixture-no-iphone-5594`. No se ha
recibido una posición del iPhone real. La sesión fixture se revoca al cerrar QA.

En esta conexión, las IP `188.114.*` que resuelve `pages.dev` agotaron el plazo.
La comprobación usó otro edge de Cloudflare (`104.21.66.96`), conservando el
host original y la validación TLS. Esto no garantiza la conectividad del
dominio desde todas las redes móviles. No se modificó DNS ni producción.

## SmartTag2 · Luka (#7195)

El inventario incorpora Luka con tipo `smarttag2` e icono propio. **Demo** lo
muestra con coordenadas sintéticas identificadas como «Dato de prueba»; en datos
reales queda sin posición hasta el primer aviso. El adaptador, endpoint privado
y checklist OAuth se explican en [docs/smarttag2-luka.md](../../docs/smarttag2-luka.md).
La adquisición desde Samsung sigue pendiente de acceso y capacidad confirmados.

## Player por ubicación en móvil (misión DCL-fb1c7a60, 29-oct-2026)

`/pruebas/mapa/player/` es un player a pantalla completa para el móvil: el GPS del
propio dispositivo elige la zona y admira.tv reproduce su tema. Entra con la misma
sesión de Google que el mapa (no hay enlaces firmados ni claves en la página).

- **Zonas compartidas.** El editor del mapa tiene «Publicar para el player» y
  «Traer zonas publicadas». Las zonas viven en el KV `UBICACIONES`, clave
  `mapa-zonas:v1`, sin caducidad: solo zonas y temas, nunca posiciones.
  `GET /api/ubicacion/zonas` exige sesión; `PUT` exige rol admin/editor y el CSRF
  de la sesión, y lleva `rev`: con una rev vieja responde `409` y no pisa a nadie.
  Sin zonas publicadas (o sin sesión) el player usa las cinco oficinas de ejemplo.
  El móvil vuelve a leerlas cada minuto.
- **Decisión.** Las mismas reglas del simulador (`resolveBrowserReading`): una zona
  gana cuando todo el círculo de precisión cae dentro; si la lectura es ambigua,
  vieja (más de 5 min) o sin precisión, sigue sonando lo que ya suena. Antes del
  primer GPS suena el tema de «fuera de las zonas».
- **Un player precargado por Xperiencia.** Cada oficina (y «fuera de las zonas»)
  tiene su propio canal de admira.tv con su pantalla virtual fija
  (`virtual-mapa-xperiencia-<zona>`) y su tema, que es su playlist. Los seis se
  cargan al abrir la página y siguen reproduciendo en silencio aunque no se vean;
  cuando Luka llega solo cambia cuál se ve, sin descargar nada en ese momento
  (`players-xperiencias.js`). El móvil enseña «players listos N/6». Mover un
  iframe lo recarga, así que nunca se reordenan: el visible lleva `data-activo="1"`.
- **Tres piezas distintas por Xperiencia.** Admira University reproduce negocio,
  Pixería creatividad y La Nave tecnología. La página lee una vez el Stock de
  admira.studio (`api.admira.store/stock/list?limit=300`, el mismo grupo que usa el
  canal) y cada Xperiencia fija las 3 piezas más recientes de su tema que sean de
  familias distintas: las versiones de un mismo vídeo (16:9, 9:16, subtitulado)
  comparten `par-<id>` o `externalRef` y cuentan una vez; primero las horizontales.
  Van al canal de admira.tv con `?ids=` (admira-tv, parámetro nuevo); sin Stock, el
  canal sigue con `tag` + `max=3`.
- **Locución de `/demo luka`.** Una frase en castellano por parada, de 5 a 9 s para
  caber en los 12 s de cada oficina (`locucion-demo.js`); la primera vuelta empieza
  presentando a Luka. Si hay grabación de la voz de la casa en
  `/pruebas/mapa/locucion/<id>.mp3` (lista `RECORDED`) suena esa; si no, la voz en
  castellano del navegador (en Chrome, la de Google). Sin un gesto previo el
  navegador no deja hablar: el botón «🔊 Activar locución» del player la arranca, y
  después sirve para silenciarla.
- **Privacidad.** La posición no sale del dispositivo ni se guarda. A admira.tv solo
  le llega el tema y la pantalla virtual de la Xperiencia, nunca coordenadas.
  Antes cada visita estrenaba una pantalla `virtual-mapa-<uuid>` y admira.tv daba
  de alta un proyecto en el censo de Yokup por sesión; ahora son seis fijas.
- **Pantalla.** Pide mantener la pantalla encendida (Wake Lock) y, donde el
  navegador lo permite, pantalla completa. Al ocultar la página el GPS se pausa y
  vuelve solo al regresar; «Detener» lo apaga.
- **Abrir en el móvil.** «Abrir player en el móvil» en el mapa enseña un QR
  (`GET /api/ubicacion/player-qr`, con sesión) que solo codifica la URL de la página.

- **Seguir a Luka del mapa.** El player tiene dos fuentes: el GPS del móvil o el Luka
  del simulador. Con «Mover también el móvil» encendido en el mapa, cada vez que se
  suelta a Luka su posición va a `PUT /api/ubicacion/simulacion` (rol admin/editor +
  CSRF) y el móvil la lee cada 2 s con `GET` (cualquier sesión). Se guarda en D1
  (`AUTH_DB`, tabla `mapa_simulacion`, una fila, caduca a las 2 h) y no en KV, que
  tarda hasta 60 s en propagar a otra ubicación. Es una simulación: no entra en el
  histórico de `UBICACIONES` ni en el feed real del SmartTag2. Apagado, el mapa no
  hace ninguna petición.

- **`/demo luka`.** En el modo experto de cualquier web de la suite (admira.tv,
  admira.studio, admira.app, admira.biz, admira.store) abre
  `/pruebas/mapa/?demo=luka`: datos de demo, el player abierto y más grande, las cinco
  oficinas cargadas y Luka recorriéndolas en bucle, 12 s en cada una. El contenido de
  admira.tv cambia con cada oficina. Dentro del mapa, `/demo luka` hace lo mismo sin
  recargar. Arrastrar a Luka o pulsar «Detener recorrido» toma el control.

Pruebas: `test/mapa-player.test.mjs` (API, validación, rev, CSRF, QR, player y Luka simulado) y el
caso de publicación del editor en `test/mapa-simulador.test.mjs`.

## Robot limpiador en lugar de Luka (29-oct-2026)

Modo **Robot 🤖 0,3 m/s** en el simulador (`robot.js`). Con el modo activo, un clic en el mapa o en la barra de Xperiencias marca el destino; el robot conduce hasta allí, la vista de su cámara (simulada, con brazo articulado) muestra la pantalla de la Xperiencia creciendo al acercarse y el player cambia solo al entrar en la zona. El recorrido Demo también funciona a velocidad de robot.

Interfaz para el Roborock real (driver): `goTo(point,{from})`, `stop()`, `onPose(fn)`, `onArrive(fn)`, `cameraURL()`. El driver `createRoborockDriver` habla con un puente HTTP en la red local:

- `POST {base}/goto {x,y}` · coordenadas del plano del robot en mm (el puente llama a `app_goto_target`).
- `POST {base}/stop`
- `GET {base}/pose` → `{x,y,heading?,state}`
- `GET {base}/camera.mjpg` (opcional; si no, cámara simulada).

Se activa guardando en `localStorage['admiranext:mapa:robot']` `{"base":"https://…","pairs":[{"geo":{"lat":…,"lng":…},"robot":{"x":…,"y":…}},{…}],"mirror":true}`. Los dos pares calibran mapa ↔ plano (giro, escala y espejo). El puente debe servirse por HTTPS (p. ej. túnel) porque la página es HTTPS.

## Casa Saros Z70 (encargo 7273)

«Cargar casa Saros» pone cinco salas en el orden de Carlos. Están separadas unos 40 m junto a la dirección fija del Mac mini. Es un esquema, no el plano en milímetros del robot. Cada sala suena con la playlist del Xpacio del mismo número:

1. Cocina → Pixería (Aulèstia i Pijoan), tema creatividad.
2. Terraza → Admira University (Bretón de los Herreros 9), tema negocio.
3. Pasillo → El Garage (Santa Rosa 4), tema devops.
4. Sneaker Store → Sneaker Store (Santa Rosa 19), tema retail.
5. La Nave → La Nave (Planeta 7), tema tecnología.

`?casa=1` abre el simulador ya con las cinco salas. El player virtual de admira.tv cambia al entrar.

`/robot/limpieza/` es la pantalla de limpieza: mapa de la casa, ir a sala, parar y cámara. Usa el robot simulado (`cameraURL` vacío) y, si no hay imagen, muestra «No hay señal de cámara». No llama al puente. El texto nace en castellano y el armazón lo pasa a inglés con el idioma del sitio. En producción la protege el mismo login que `/pruebas` (`functions/robot/limpieza/_middleware.js`): sin sesión responde 401 y no salen el HTML ni los assets. El tag `retorno/pre-robot-limpieza-20261029` (`1fc26ef`) es el commit anterior a la pantalla. El tag `retorno/pre-publicar-robot-7273-20261029` es `main` antes de publicarla (sello `v.29.10.2026.r17.14:15`). Para volver a ese sitio: `git revert --no-commit retorno/pre-publicar-robot-7273-20261029..HEAD`, un commit y push a `main`.

El puente local es `python3 pruebas/mapa/bridge/roborock_bridge.py`. Escucha solo en `127.0.0.1:8765`.

- `POST /goto` con `{"x":mm,"y":mm}` llama a `app_goto_target`.
- `POST /stop` llama a `stop_goto_target`. No lo manda a la base ni arranca una limpieza.
- `GET /pose` devuelve `{x,y,heading,state,battery}` cuando el robot contesta.

Las credenciales las escribe Carlos en `~/.config/admiranext/roborock.json`, modo `0600`, fuera de git. Es UTF-8 con dos campos: `username` (correo de la cuenta Roborock) y `password` (la contraseña, como texto JSON). Si el archivo no está, no es de su usuario o el modo no es `0600`, el proceso arranca igual y `/goto` responde 503 `boveda_sin_credenciales`. No se imprimen ni se copian al repo. La sesión que deja python-roborock queda en `~/.cache/admiranext-roborock/`, fuera del repositorio. Punto de retorno de este archivo local: tag `retorno/pre-roborock-archivo-20261029`. Las cinco salas vuelven con `retorno/pre-casa-cinco-salas-20261029`. Este corte no publica el sitio.
