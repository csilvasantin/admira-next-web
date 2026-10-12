# Demo nativa iPhone y Apple Watch

Desde Experto en Studio, Store, TV, App y Biz:

- `/demo ios`: iPhone y Apple Watch virtuales.
- `/demo ios iphone`: solo la ventana del iPhone.
- `/demo ios watch`: solo la ventana del Watch; el iPhone compañero trabaja en segundo plano.
- `/demo ios #musica`: contenidos con ese tag en las playlists asociadas al proyecto. Varios tags exigen todos.
- `/demo ios "nombre de playlist"`: selecciona y asocia esa playlist al proyecto activo; también admite el ID.
- `/help ios` o `/demo ios help`: ayuda en la consola.

Por defecto se elige la playlist asociada más recientemente actualizada del proyecto activo. No se usa una playlist global de otro proyecto. Las playlists antiguas sin metadatos de proyecto se reconocen por su espacio de nombres exacto `proyecto.` (por ejemplo `starbucks.xpacio.hilomusical` pertenece a `starbucks`). Si todavía no hay ninguna asociación ni playlist en ese espacio de nombres, ejecutar una vez el comando con nombre o ID de playlist. Las asociaciones del lanzador persisten entre dominios de la suite.

Requisitos: macOS con el lanzador de protocolo `Admira IOS Demo` instalado, Xcode, runtimes iOS/watchOS 26.5, apps compiladas y pareja de simuladores dedicada. Esta instalación de demostración presenta las ventanas en el Mac libre configurado; no abre ventanas en las pantallas de terminales de Carlos. Los productos del Mac libre están en /tmp y deben reponerse si se limpia. No requiere un iPhone ni un Watch físicos.

Chrome puede pedir permiso para abrir la aplicación externa. Aceptar “Abrir Admira IOS Demo”. Tras actualizar la integración, recargar la pestaña de la suite que ya estaba abierta. “Solicitud enviada” confirma el envío al protocolo, no la instalación ni la reproducción: los errores del lanzador se registran en `demo-launcher.log` del proyecto nativo. “Unknown demo: ios” significa que la pestaña conserva el manejador anterior.

El Watch muestra un previo del contenido reproducido y controles de reproducción. Se usa la variante Watch descargada cuando existe y, en otro caso, una captura del fotograma local. El player reproduce contenidos descargados; omite los pendientes y muestra un punto amarillo mientras descarga. Para una primera sesión sin internet hace falta haber descargado el contenido antes.

MCP: `help {"tema":"demo-ios"}` describe este contrato. El MCP remoto documenta el lanzamiento local; no controla el escritorio ni ejecuta comandos de sistema. La adaptación Apple Watch en Studio/Pixeria se prepara como formato del proyecto, independiente del lanzamiento de simuladores.

Código: csilvasantin/admiranext-player-ios, tools/suite-demo.py y tools/install-suite-demo-bridge.py. Documentación técnica: docs/suite-demo-ios.md. Validación nativa inicial: build 10, iPhone y Watch simulados, con previo real. La publicación en App Store y la validación de este build en dispositivos físicos son trabajos distintos.
