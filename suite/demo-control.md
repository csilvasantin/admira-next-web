# Demo en vivo · Live platform tour

En [AdmiraNeXT /demo](https://www.admiranext.com/demo/#en-vivo), elige Studio, Store, TV, Biz o App. También puedes escribir `/demo studio`, `/demo store`, `/demo tv`, `/demo biz` o `/demo app` en Experto o en el avatar. El enlace abre la plataforma en la misma pestaña con `ax_demo=<plataforma>` y un `ax_run` nuevo. Tu sesión habitual de esa plataforma sigue siendo necesaria; el enlace no contiene credenciales.

El motor compartido mueve un cursor **dentro de la página**, señala controles reales y ejecuta sólo las acciones locales permitidas del recorrido. No mueve el ratón del sistema operativo. Los campos preparados se restauran al detenerlo siempre que no los hayas modificado después. Pausar, Reanudar, Siguiente, Devolver control y Silenciar demo están disponibles durante el recorrido. Si el navegador bloquea el vídeo con sonido, pulsa Reanudar o Silenciar demo; si falta una vista o un control, el recorrido muestra el problema.

Studio permite revisar y rellenar opciones, sin generar contenido de pago. Store abre los módulos de locución, música, imagen, vídeo y TPV; los vídeos de ensayo preparados explican el resultado y no emiten contenido físico. Biz recorre el mapa, los circuitos y la planificación local sin comprar ni enviar campañas. TV muestra la calle, la ficha y el mapa; el tour DooH preexistente de Vila/Jardinets/Lesseps no se presenta como Starbucks. App abre el portal actual de equipos de Yokup; el inventario requiere una sesión autorizada. El recorrido se detiene si falta acceso y no crea proyectos, informes ni incidencias.

La URL se valida contra los dominios propios de cada plataforma. El estado del recorrido pertenece a esa pestaña y a su identificador de ejecución. Una nueva apertura crea un recorrido nuevo. La carga del motor es explícita y no activa el avatar ni llama al proveedor de voz del avatar.

## English

Choose a platform at [AdmiraNeXT /demo](https://www.admiranext.com/demo/#en-vivo), or enter `/demo studio|store|tv|biz|app` in Expert or the avatar. The same-tab link adds `ax_demo` and a fresh `ax_run`. Your normal platform login still applies; links contain no credentials.

The shared engine moves a **page cursor**, points to actual controls and performs only the tour's allowed local actions. It cannot control the operating system mouse. Pause, Resume, Next, Return control and Mute remain available. Prepared field values are restored on Stop unless you edited them afterwards. Missing controls or blocked audio are reported rather than counted as successful actions.

The tour does not generate paid content, create sales, publish campaigns, send content to physical screens or create professional projects, reports or incidents. Prepared demonstration videos are labelled as rehearsals. TV's existing DooH tour covers Vila/Jardinets/Lesseps, not Starbucks. App opens its current native Yokup equipment portal; inventory requires an authorised session. The tour stops when access is unavailable. Each fresh launch has separate tab-scoped state. Loading the engine does not open the avatar or call its voice provider.
