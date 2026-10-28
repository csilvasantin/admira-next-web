# Simulador de ubicación y player de admira.tv

En `/pruebas/mapa/`, «Simular player» activa Demo y añade un marcador arrastrable
y un player flotante. Se puede arrastrar y soltar el marcador, tocar otro punto
del mapa o usar los botones de zonas (también con teclado).

Dos círculos sintéticos de 450 m definen los ejemplos: Gràcia selecciona la
etiqueta `retail`, Eixample `tecnologia` y el exterior `creatividad`. Los centros
son posiciones de demostración, no mediciones de Samsung ni una geocerca real
de Luka. Las etiquetas se eligieron tras consultar el catálogo público vigente.

El iframe utiliza el player oficial `https://admira.tv/canal.html`, con
`embed=mupi`, `fit=screen`, `playerType=virtual`, `mode=local`, `modeLock=1`,
`sincro=0`, `stream=1`, audio silenciado y una etiqueta de contenido por zona.
`screen` y `circuit` llevan una identidad virtual aleatoria por instancia;
no se reutiliza una pantalla física. El canal conserva su propia reproducción
y telemetría del player virtual. No se modifica el código de admira.tv.

Sólo se carga otro iframe al soltar en una zona distinta. Moverse dentro de una
misma zona conserva la reproducción. Durante el arrastre se actualizan las
coordenadas simuladas, sin reiniciar vídeos en cada movimiento. Los avisos del
player se aceptan únicamente del iframe actual y del origen admira.tv. Si no
llega confirmación, se muestra el estado pendiente y un enlace para abrirlo.
La disponibilidad de contenido depende del catálogo y la red de admira.tv.

Las coordenadas simuladas no se transmiten al player y no se escribe en ninguna
API de ubicaciones. Volver a «Datos reales» cierra el iframe y retira el marcador
y las zonas simuladas. El acceso sigue protegido por la sesión de `/pruebas`.
La adquisición real desde Samsung permanece pendiente y es independiente de
esta demostración.

Verificación: `node --test test/ubicacion.test.mjs test/mapa-ubicacion-ui.test.mjs test/mapa-5612.test.mjs test/mapa-simulador.test.mjs`.
