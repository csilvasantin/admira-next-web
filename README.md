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

Regresión automatizada:

```sh
node --test test/*.test.js
```
