# Admira Next Web

## Limpieza de cierres de NotebookLM

Los vídeos exportados por NotebookLM pueden terminar con una tarjeta propia. El
limpiador conserva por defecto el último fotograma válido de la presentación y
lo prolonga durante el tramo eliminado, por lo que no cambia la estética ni la
duración del vídeo:

```bash
scripts/replace-notebooklm-ending.sh entrada.mp4 salida.mp4 2
```

El cuarto argumento opcional `card` mantiene disponible el cierre corporativo
anterior. Se reserva para casos en los que se quiera un cambio de estilo
deliberado. La regresión visual se comprueba con:

```bash
scripts/test-replace-notebooklm-ending.sh
```

Las tareas de vídeo creadas por el generador incluyen la política
`postProcess.strategy = freeze-last-clean-frame`, junto con las garantías de
conservar estilo y duración. Así, el mismo criterio viaja en la cola de
producción y no depende de una instrucción informal.

Corporate website for Admira Next, a Robot as a Service and IoT company.

The site is static. The public entry point lets visitors choose:

- Good: direct contact.
- Better: classic corporate web.
- Best: interactive terminal experience.

## Pages

- `index.html`
- `classic.html`
- `404.html`
- `old/*.html` classic corporate web
- `/presentaciones/` workspace privado de presentaciones.
- `/presites/` workspace privado para crear intros previas a una presentación,
  un site o una app.

## Generador de Presites

Presites comparte dominio, acceso interno, almacenamiento KV y lenguaje
cuadrático con el Generador de Presentaciones, pero su producto es una secuencia
audiovisual autónoma. Recupera el espíritu de las intros arcade, VHS y
synthwave de los 80/90 con geometría, tipografía y sonido sintético originales;
no incluye personajes, canciones ni material protegido de terceros.

- `/presites/generador/`: brief, referencias culturales, idioma, duración,
  estilo, destino y tres direcciones Good/Better/Best, con preview full-screen.
- `/presites/<slug>/`: storyboard editable de cinco beats, ritmo global,
  histórico de hasta 20 versiones, restauración y revisión segura.
- `/presites/<slug>/preview`: reproducción aislada. **Skip intro** está visible
  desde el primer fotograma; `Esc` salta, `Enter` entra, pausa y sonido son
  opcionales y `prefers-reduced-motion` muestra una portada estática.
- `/presites/<slug>/export`: HTML autónomo con transición hacia una ruta interna
  o URL HTTPS validada. La exportación no publica, no toca DNS ni reemplaza el
  destino.

`functions/presites/_presite.js` centraliza el modelo v2, la normalización y el
runtime para que una futura pieza de vídeo generada con IA pueda sustituir o
acompañar la animación procedimental sin cambiar rutas, persistencia, editor,
versiones ni salida segura. El sonido parte apagado y solo se crea tras una
interacción. El workspace es `noindex` y no se incluye en `sitemap.xml`.

## Local preview

```sh
python3 -m http.server 4827
```

## Lanzamiento seguro del presentador

La ruta privada `/presentaciones/<cliente>/presentacion` incluye un asistente de
preparación de sala. Desde el panel de ensayo, **Presentar en audiencia** abre una
salida separada con `?audience=1`: esa respuesta no serializa notas del orador ni
inyecta controles de edición, oculta el cursor tras una breve inactividad y solo
recibe navegación por el canal local del mismo origen.

Si el navegador admite Screen Details, el asistente intenta seleccionar una
segunda pantalla y solicitar pantalla completa. Si no está disponible, se deniega
el permiso o el navegador bloquea la ventana, el panel mantiene un aviso explícito
y permite completar manualmente la colocación. Notificaciones, otras ventanas y
No molestar siempre requieren comprobación humana antes de compartir.

### Trazabilidad de fuentes por diapositiva

El `PUT /presentaciones/api/generate` acepta opcionalmente
`sourceTraceability` con este contrato versionado:

```json
{
  "sources": [
    {
      "id": "annual-report",
      "type": "web",
      "label": "Annual report",
      "url": "https://example.com/report",
      "locator": "Section 4"
    },
    {
      "id": "notebook-brief",
      "type": "notebooklm",
      "label": "Notebook de trabajo",
      "fingerprint": "notebooklm_0123456789abcdef",
      "locator": "Answer 7 · source chip 2"
    }
  ],
  "claims": [
    {
      "id": "growth-claim",
      "slideKey": "vision",
      "contentPath": "skeleton.vision.message",
      "sourceIds": ["annual-report", "notebook-brief"]
    }
  ],
  "reviewedSlides": ["cover", "objective", "vision", "closing"]
}
```

Los orígenes admitidos son `web`, `notebooklm` y `document`. Web exige URL
HTTPS y localizador; NotebookLM y documentos exigen un fingerprint opaco y un
localizador verificable. El sistema falla cerrado ante identificadores
duplicados, fuentes desconocidas o rutas de contenido inválidas. Nunca guarda
el cuerpo del documento, citas textuales, tokens ni respuestas de NotebookLM.

Si no se aporta el contrato, solo se registra la web oficial como posible
origen: ninguna afirmación se da por respaldada y todas las diapositivas quedan
pendientes de revisión. El asistente privado muestra ese aviso antes de
presentar. El contrato y su script de revisión no se serializan en
`?audience=1`.

### Laboratorio de compatibilidad

Cada presentación nueva conserva `compatibilityLab` con una matriz por deck para
PowerPoint, Keynote, Google Slides, PDF y web. Los resultados nunca confunden
una inferencia con una prueba:

- `structural`: análisis determinista de layout, fuentes, controles y multimedia;
  declara expresamente que la aplicación destino no se ejecutó.
- `unavailable`: el entregable o runner no está disponible e incluye un fallback
  accionable.
- `executed`: solo se admite desde un adaptador que aporte estado, versión,
  entorno, fecha real, SHA-256 del artefacto y una URL HTTPS de evidencia sin
  credenciales ni query string.

El endpoint privado `GET /presentaciones/<cliente>/api/compatibility` devuelve el
informe. Un `PUT` same-origin incorpora una ejecución o indisponibilidad:

```json
{
  "kind": "execution",
  "deckId": "proposal:demo",
  "target": "powerpoint",
  "status": "passed_with_differences",
  "adapter": "powerpoint-win",
  "adapterVersion": "1.4.0",
  "artifactSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "evidenceUrl": "https://evidence.example/compat/powerpoint.json",
  "environment": "PowerPoint 2026 · Windows 11",
  "executedAt": "2026-07-24T09:58:00.000Z",
  "differences": [
    {
      "severity": "warning",
      "area": "fonts",
      "detail": "Se utilizó una fuente fallback.",
      "fallback": "Embeber la fuente aprobada antes de distribuir."
    }
  ]
}
```

El informe solo guarda metadatos acotados y enlaces a evidencia; no acepta logs,
archivos ni capturas embebidas. El preflight privado resume cuántas comprobaciones
fueron ejecutadas, estructurales o no disponibles. La salida de audiencia no
recibe el laboratorio.

### Calibración visual de sala

El panel privado del presentador incluye un patrón técnico para ajustar margen
seguro, contraste, gamma y escala en la pantalla real de la sala. Los cambios se
previsualizan al instante; **Guardar perfil de pantalla** los conserva para la
combinación actual de resolución y densidad, y **Restablecer esta pantalla**
elimina solo ese perfil y recupera valores seguros.

Los perfiles viven exclusivamente en `localStorage`, bajo la clave versionada
`admira.presenter.calibration.v1`. Solo contienen los cuatro valores numéricos de
calibración: nunca notas, cliente, subtítulos, glosario ni transcripciones. Si el
almacenamiento no está disponible o contiene datos inválidos, el presentador usa
valores acotados por defecto y mantiene una vista previa funcional sin afirmar
que se ha guardado.

La salida `?audience=1` corta la inicialización antes de leer perfiles o construir
el panel y el patrón; tampoco se transmiten valores de calibración por el canal
local. La calibración afecta únicamente a la guía técnica superpuesta en el
control privado y no aplica filtros ni oculta el contenido de las diapositivas.

### Subtítulos y traducción local

El mismo panel privado ofrece subtítulos en vivo mediante Web Speech Recognition.
El presentador elige el idioma de entrada, el idioma de salida y puede editar un
glosario con una equivalencia por línea (`término = sustitución`). Micrófono,
selector y glosario nunca aparecen en la salida de audiencia.

La audiencia recibe el texto original por `BroadcastChannel` y lo muestra de
inmediato. `AdmiraPresenterCaptions` intenta después traducirlo con la Translator
API del propio navegador; al terminar sustituye el original y aplica el glosario.
Si Web Speech o Translator no están disponibles, la interfaz lo indica y conserva
el original sin fingir una traducción. Las revisiones obsoletas se descartan.

Transcripción y glosario viven solo en memoria: no se envían por red, no se guardan
en `localStorage`/`sessionStorage` y se eliminan al detener o cerrar la sesión. La
única comunicación es el canal efímero y local entre el control y la audiencia.

### Guardián de pantalla compartida

El panel privado incorpora un guardián de salida con un espejo seguro de
`?audience=1`, heartbeat de la ventana pública y avisos cuando la salida se
cierra, deja de responder o una pista de audio/vídeo queda silenciada o termina.
El espejo y los mensajes operativos no transportan notas, texto de diapositivas,
identidad del cliente ni credenciales.

La captura se inicia únicamente desde un gesto explícito. Primero se abre y
verifica la ventana de audiencia; en una segunda acción el navegador muestra su
selector nativo mediante `getDisplayMedia`. El usuario debe elegir esa ventana:
la Web solo puede informar de la superficie declarada por el navegador y no
puede comprobar otras ventanas, notificaciones ni garantizar por sí sola qué ve
el público. Si la API no está disponible o el permiso se cancela, el panel lo
declara y mantiene el procedimiento manual sin afirmar una verificación.

### Backchannel privado de producción

Dos superficies privadas de la misma presentación pueden coordinar al operador y
al ponente sin usar un servidor. En una de ellas, **Activar modo operador** muestra
el compositor; la otra permanece en modo presentador. Cada cue tiene prioridad
normal, alta o urgente, una caducidad entre 5 y 300 segundos y un acuse explícito
de lectura. Para evitar confundir sesiones, el canal se deriva de la ruta exacta
de la presentación.

El texto viaja únicamente por `BroadcastChannel` entre pestañas del mismo origen
y se conserva en memoria hasta el acuse, la caducidad o el cierre de la página.
No se envía por red ni se escribe en `localStorage` o `sessionStorage`. La salida
`?audience=1` no carga el motor, no construye el panel y no recibe cues. La
interfaz inserta los mensajes con `textContent` y el motor valida roles, campos,
tamaños, prioridades e identificadores antes de aceptar un sobre.

Si `BroadcastChannel` no existe o falla, el panel declara **Canal seguro
limitado** y desactiva el envío. El fallback solo intercambia señales de control
opacas mediante memoria, `postMessage` de mismo origen y escrituras efímeras de
almacenamiento; nunca degrada la privacidad enviando el texto por esos canales.
La presentación y la salida pública continúan funcionando sin backchannel.

### Relevo seguro entre ponentes

El control privado permite ordenar una cola de ponentes y transferir el control
mediante una solicitud explícita, una cuenta atrás de 10 segundos y acciones para
aceptar o cancelar. Al completar el relevo, el ponente entrante recupera su última
diapositiva, sus notas, la posición de lectura y el estado del teleprompter; el
ponente saliente vuelve a la cola para poder retomar después.

El estado de cada ponente se guarda únicamente en `localStorage`, aislado por la
ruta canónica de la presentación, con un máximo de 96 KiB y una caducidad de ocho
horas. La salida `?audience=1` no carga el motor de relevo ni recibe cola, nombres,
notas, referencias privadas o propietario del control. Los snapshots públicos del
motor usan una allowlist y nunca incluyen notas ni referencias de recuperación.

Si el almacenamiento no está disponible o el estado guardado es inválido, el
presentador continúa con una sesión nueva. Los nombres se insertan con
`textContent`, los cambios de cola preservan el foco de teclado y todos los
controles declaran estado y mensajes mediante regiones accesibles.

Regresión automatizada:

```sh
node --check assets/presentation-production-backchannel.js
node --check assets/presentation-speaker-handoff.js
node --test test/presentation-production-backchannel.test.js test/presentation-speaker-handoff.test.js test/presentation-speaker-handoff-integration.test.js test/presentation-presenter-mode.test.js
node --test test/*.test.js
git diff --check
```

Para Presites:

```sh
node --check assets/presites-generator.js
node --check assets/presites-studio.js
node --test test/presites.test.js
```
