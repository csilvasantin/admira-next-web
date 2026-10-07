# Demostración autónoma de Alsea

En la presentación de Alsea, **Demo global** permite iniciar un recorrido completo Biz → Studio → Store. Presenta 15 funciones y sus muestras, durante 8 minutos por defecto; también se pueden elegir 5 o 12 minutos. El ponente puede hablar mientras avanza.

- **Pausar / Reanudar** conserva el paso y el tiempo restante.
- **Detener** cancela los avances y pausa los medios.
- **Espacio** pausa o reanuda; **Escape** detiene.
- Las muestras van sin sonido por defecto. **Escuchar las muestras** activa su audio.
- Elegir una función o avanzar manualmente devuelve el control al ponente.
- Cambiar de pestaña pausa el recorrido para no perder pasos.

El mismo recorrido está en el ZIP privado de Alsea: descomprimir la carpeta completa y abrir `index.html`, manteniendo `media/` junto a los archivos. Funciona sin conexión ni servidor.

## Dentro de cada plataforma

En el Experto, `/demo help` lista las cinco funciones locales. `/demo 1`…`/demo 5` o su nombre abre un ensayo de esa función. `/demo auto` (también `/demo todas`) encadena las funciones del catálogo local. `/demo pausa`, `/demo reanudar`, `/demo siguiente` y `/demo stop` controlan el recorrido.

En Store, `/demo tpv` conserva la demostración del muffin en el gemelo. Sus órdenes `/demo estado`, `/demo off` y `/demo stop` siguen atendiendo el TPV cuando no está activo un ensayo del catálogo. `/demo 5` o `/demo caja` corresponde a la gestión del TPV del catálogo.

Los recorridos del catálogo muestran datos y resultados preparados. No ejecutan altas, generación, ventas ni publicación a dispositivos. Las operaciones reales se realizan en la plataforma con conexión y sesión autorizada.

## Confirmación de comandos desde el avatar

El iframe propio de `https://digitalavatar.ai` puede enviar `{type:"da-demo", texto:"/demo auto", requestId:"da-demo-..."}`. La página espera el catálogo, ejecuta el motor una vez y responde al mismo iframe/origen con `{type:"da-demo-result", requestId, ok, message, estado, result?}`. `message` es texto, nunca HTML. La ayuda se confirma por su registro aunque el motor devuelva `null`; los controles muestran el estado real, incluido `{activo:false}` si no hay recorrido.

Los mensajes anteriores sin `requestId` siguen funcionando. Los identificadores repetidos reciben la misma confirmación; reutilizarlos con otro comando se rechaza. El registro por iframe conserva hasta 128 identificadores y rechaza nuevas peticiones al alcanzar el límite, sin expulsar los anteriores ni repetirlos. Recargar la página inicia una sesión nueva. El canal específico de Store responde desde su propio puente; esta validación central corresponde al iframe flotante `#da-suite-frame`.
