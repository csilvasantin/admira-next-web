# Admirito · llamadas de asistentes

Carlos autoriza publicar el 18-oct-2026 las llamadas `/admirito creativo`, `/admirito arquitecto`, `/admirito bugito`, `/admirito supervisor` y `/admirito help`, necesarias para la publicación y las pruebas de Admira Studio. La prueba previa queda como reexportación del mismo módulo público.

La implementación única es `/suite/admirito.mjs`, cargada desde `suite/experto.js`. Registra un verbo, reservado frente a adaptadores de aplicaciones, y delega una sola vez en las acciones existentes con `echo:false,record:false`. La ayuda abre el log y muestra opciones sin ejecutar asistentes. Los hosts con consola propia pueden reaccionar al evento de presentación `admira:assistant-help`, sin ejecutar ni interceptar comandos.

Studio registra su acción del Creativo; el módulo común conserva `command.raw` y la aplicación recibe texto literal con espacios y saltos de línea. En otros sitios, la llamada sin encargo abre Studio; con texto y sin adaptador no navega ni incluye texto privado en la URL. Los alias antiguos y `/admirito on|off` siguen compatibles. Supervisor conserva sus permisos y controles de cámara.

No se añade Experto a presites ni se cambia la portada, salvo la actualización obligatoria del sello de publicación.
