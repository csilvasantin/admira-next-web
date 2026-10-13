# Alsea · presentación web y lanzador compartido

Preparado para el viernes 16 de octubre de 2026. No genera PowerPoint.

- `/demo alsea` se interpreta en `suite/experto.js`, la misma entrada de consola y avatar para Studio, Store, TV, App y Biz.
- Abre `https://www.admiranext.com/pruebas/alsea/?lang=es|en`. La verja existente de `/pruebas` exige sesión.
- Esa ruta consulta `presentation:alsea-starbucks` y redirige a la sala del generador `/presentaciones/alsea-starbucks/presentacion`. No crea otra presentación, no inicia una macrodemo ni ejecuta altas, ventas o publicaciones. Si falta la presentación devuelve 404 y explica cómo abrir el catálogo.
- El destinatario recibe el enlace de la sala del generador con sus controles de acceso existentes; la ruta de pruebas es el lanzador interno.

## Contenido

El brief privado se guarda únicamente en el generador. Studio, Store, TV, App y Biz tienen 15 minutos cada una; apertura 2 y cierre 3. El generador también anexa la documentación de las 20 funciones seleccionadas, con enlaces a sus plataformas.

El guion de ensayo privado contiene instrucciones del presentador, cinco encargos a agentes, evidencias que comprobar, fuentes y límites del ensayo. Este material no se mezcla con la copia comercial de las láminas.

La plantilla canónica de tres actos sigue intacta. Los `slides[]` personalizados aceptan también TV y Biz. Los snapshots de presentación incorporan las definiciones canónicas v2 de App y TV; las selecciones antiguas conservan sus referencias.

## Antes de publicar

1. Entrar en el generador y consultar el catálogo. Reutilizar el destino Alsea existente; resolver su slug si difiere de `alsea-starbucks` antes de desplegar este lanzador.
2. Guardar/mejorar ese destino con el brief, conservando contenido o permisos previos que deban mantenerse. No regenerar ni sobrescribir sin revisar el destino existente.
3. Ensayar las cinco plataformas: en particular TV solo tiene una entrada general en el catálogo publicado, y Biz contiene fechas de ejemplo del 8 al 15 de octubre.
4. Publicar primero la ruta protegida `/pruebas/alsea`. El lanzamiento público o un cambio de destino es una revisión aparte conforme a AGENTS.md.
5. Comprobar `/demo alsea` desde las cinco ventanas con sesión y que abre una sola sala, con el idioma elegido. No afirmar que está disponible en producción por pasar las pruebas locales.

## Validación

`node --test test/demo-alsea-route.test.mjs test/experto-demo.test.mjs test/presentation-demo-project-api.test.mjs test/presentation-demo-documentation.test.mjs test/subdemos-editor.test.mjs`

La prueba histórica `test/admiranext-structure-4295.test.js` comprueba todavía la versión MCP literal 1.8.0 aunque el servidor ya declara 1.8.2. Ese fallo previo es independiente del lanzador.
