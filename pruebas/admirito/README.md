# Admirito · llamadas de asistentes

Prueba del contrato pedido por Carlos el 18-oct-2026:

- `/admirito creativo`
- `/admirito arquitecto`
- `/admirito bugito`
- `/admirito supervisor`
- `/admirito help`

`admirito.mjs` instala un único verbo mediante la API `AdmiraExperto.verb` del motor existente, sin interceptar formularios ni volver a interpretar su gramática. La ayuda se pinta en el log de Experto y no ejecuta asistentes. Cada opción delega una sola vez en la acción ya existente con `echo:false,record:false`, conservando los alias antiguos. `/admirito on|off` mantiene los controles explícitos de visibilidad. El texto literal del Creativo viaja en `command.raw`, sin convertir saltos de línea en espacios.

En Studio, Creativo es una acción registrada de la aplicación que abre su ventana. En otros sitios, sin esa acción registrada, la llamada sin encargo abre Studio; con texto no se navega ni se incluye texto privado en una URL. Los otros asistentes conservan sus acciones existentes, incluido el Supervisor y sus controles/permisos de cámara.

La implementación queda bajo `/pruebas/` conforme a AGENTS.md. No modifica `suite/experto.js`, el cargador público, la portada ni el avatar de otras páginas. Para probar localmente, cargar el motor compartido existente y después `installAdmirito(window.AdmiraExperto)`. El preview local de Trinity sirve este módulo en una ruta de ensayo; no expone la zona privada de producción.

La promoción a `/suite/admirito.mjs` y su carga común en todas las verticales es el paso de publicación independiente. Mientras tanto, el cambio está en revisión y no se afirma que esté desplegado en toda la suite.

`promotion.patch` deja concreta la promoción propuesta para cuando Carlos la autorice: añade el módulo común a `/suite/`, lo carga una sola vez desde el motor compartido y reserva el verbo `admirito` para que un adaptador de aplicación no lo sustituya. El parche se comprueba con `git apply --check`, pero no se aplica en esta prueba. La ayuda abre el log de Experto; los hosts con consola propia pueden reaccionar al evento de presentación `admira:assistant-help`, sin interceptar ni ejecutar comandos.
