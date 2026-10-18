# Variantes de Admirito — preparación pendiente de contrato

Encargo #6492 · contrato de variantes de Admirito, dirigido a Trinity, pendiente de acuse.
Misión FLT-102556 · variantes de Admirito en Experto: sigue abierta.

Esta preparación usa una copia de prueba del motor compartido y su cargador, sin modificar el motor público. Antes de promover, integrar únicamente el cambio en las fuentes canónicas `suite/experto.js` y `assets/avatar.js` y retirar las copias de prueba. No crear manejadores por dominio.

- `/admirito`, `/default`, `/admirito default` y `/admirito /default`: selección explícita del verde estándar, sin alternar ocultación.
- Arquitecto, Bugito y Supervisor delegan en sus acciones existentes.
- Ayuda ES/EN: `/help admirito` y `/admirito help`.
- Creativo sigue sin contrato ni recurso confirmado. La preparación informa del pendiente y no simula otra variante.

Validación: cuatro pruebas nuevas de contrato y siete pruebas existentes de Supervisor pasan. Dos pruebas existentes de Arquitecto fallan sin modificación de las fuentes canónicas: esperan una URL anterior sin parámetros contract/langui y una versión antigua exacta del cargador.

Pendiente: respuesta de Trinity; versión Creativo real; carga/actualización de un cargador anterior; comprobación visual con sesión de la prueba; promoción y verificación real en todos los Expertos y móviles. No desplegado ni comprobado globalmente.
