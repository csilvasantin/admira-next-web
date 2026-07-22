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

Regresión automatizada:

```sh
node --test test/*.test.js
```
