# Motor único de comandos de Admira

Regla de Carlos, 12 de octubre de 2026: Studio, Store, TV, App y Biz deben compartir un único manejador. Fuente actual: `suite/experto.js`; entrada pública `AdmiraExperto.exec(texto, salida, opciones)`. Una consola, un avatar o un adaptador MCP son interfaces de entrada; no deben implementar su propia gramática de los comandos comunes.

## Consolidación realizada

Las tres interceptaciones separadas de idioma, arquitectura y demos se sustituyen por una entrada compartida que llama al ejecutor del registro. La API de demo del avatar delega también en ese ejecutor y conserva su resultado compatible. Se conservan las funciones y alias existentes.

## Migración que todavía falta

Compartir el script o el aspecto de la consola no equivale a tener un único motor para todas las acciones.

- Studio/Pixeria: `assets/expert-cli.js` contiene `execute(command)`, parser y switch propios; además modifica el texto de demos en un listener de documento.
- Store/XpaceOS: `assets/xpace-shell.js` contiene `parseCommand/run` y un registro `pageVerbs`; el gemelo `admira-xp/index.html` contiene `executeTelegramText` y `__xtExec`. Hay que separar las acciones del gemelo y su protocolo remoto de la entrada de Experto.
- TV: la consola montada por el módulo común ya usa su ejecutor; falta auditar las herramientas específicas contra la versión vigente antes de retirar cualquier ruta.
- App y Biz: hace falta verificar los cargadores y registros vigentes. El checkout histórico llamado admira-app apunta a clearchannel-tv y no es prueba del código actual de ambos dominios.

No cambiar las acciones de reproducción, cámara, publicación, pagos o incidencias por una ruta genérica sin preservar sus condiciones y permisos. Registrar las acciones específicas en el motor común, migrar la interfaz y retirar después el parser/listener antiguo. El help debe salir del mismo registro efectivo que ejecuta las acciones; MCP comparte el contrato y sus capacidades.

## Criterio de cierre

Probar en cada una de las cinco aplicaciones: comando común, alias/idioma, comando local, comando desconocido, error asíncrono y entrada de avatar. Cada envío debe producir una sola ejecución; help y MCP deben describir la misma gramática. Hasta terminar esas comprobaciones, la unificación completa está pendiente.
