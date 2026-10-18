# Variantes de Admirito — integración común

La prueba protegida se publicó primero con PR #220 · contrato compartido de variantes. Trinity publicó después PR #219 · llamadas unificadas de asistentes, firmado TrinityMacStudio. Su módulo `suite/admirito.mjs` es la fuente única del selector y conserva los textos literales, permisos, acciones y registro único en historial.

La integración añade `/default` y `/admirito default` (también con barra), y hace que `/admirito` sin argumento seleccione siempre el verde estándar sin ocultarse al repetir. Mantiene los alias existentes de Arquitecto, Bugito y Supervisor. Creativo abre la herramienta real de locuciones y música de Studio; fuera de Studio no reenvía texto privado en URLs. `/help admirito` muestra ayuda ES/EN sin cambiar el idioma.

El HTML de la prueba carga las fuentes canónicas; se retiran las dos copias de preparación. Cargadores anteriores se actualizan en su dock existente. El despacho espera a que esté instalado el módulo, para evitar ejecutar el comportamiento antiguo durante la carga.

Validación previa: 56 pruebas de variantes, namespace de Trinity, cargador, Bugito, Arquitecto, Supervisor, transporte e idioma. Navegador real con cargador nuevo y anterior: transición Bugito → verde, invocación repetida y alias. Las pruebas físicas y la versión publicada se documentan al finalizar.
