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

## Editor de zonas y contenido

«Editar zonas y contenido» muestra las zonas guardadas y un selector de temas
del catálogo público de admira.tv. Cada tema reproduce las piezas que llevan
esa etiqueta; los recuentos corresponden a la respuesta actual del catálogo.
No es un selector de un vídeo individual ni modifica la programación de otras
pantallas. Si falla la consulta se conservan los temas ya cargados.

Se pueden mover el centro y el borde de la zona seleccionada directamente en
el mapa. El radio también se puede escribir (50–5000 m), y «Situar zona en el
simulador» ofrece una alternativa al arrastre del centro. Admite hasta ocho
zonas, nombres propios, añadir, eliminar, deshacer y restaurar los ejemplos.
En un solapamiento manda la primera zona de la lista. El exterior tiene su
propia asignación de contenido y no tiene centro ni radio.

Cambiar un tema actualiza el player aunque el simulador siga en la misma zona.
Cambiar sólo el nombre no reinicia la reproducción. Las ediciones se aplican
en la sesión y «Guardar zonas» persiste en este navegador mediante la clave
`admiranext:mapa:zonas:v1`. No se sincronizan entre navegadores ni se publican en
el servidor. Un fallo al guardar muestra el error; una configuración corrupta
o fuera de límites vuelve al ejemplo sin ejecutar ni cargar destinos ajenos.

## Llevar las zonas a otro navegador

1. En el editor, «Exportar zonas» descarga `admira-zonas.json` con la configuración
   actual, incluidos los cambios todavía sin guardar.
2. En otro navegador, abrir el mapa con sesión y activar Simular player → Editar
   zonas y contenido → Importar zonas. Elegir el archivo descargado.
3. Revisar el mapa y pulsar «Guardar zonas» para conservarla en ese navegador.

El archivo conserva el orden y los identificadores de las zonas, nombres,
centros, radios, temas asignados y tema del exterior. Usa el mismo esquema
`version:1` que el editor. No copia los archivos multimedia: el player utiliza
los temas del catálogo vigente de admira.tv. No contiene claves ni identidad
de pantalla, y no se envía a un servidor al exportar o importar.

La importación admite un máximo de 16 KiB y valida todo antes de sustituir la
configuración. Un archivo inválido, incompatible, demasiado grande o ilegible
conserva configuración, almacenamiento e historial anteriores. Una importación
válida se puede deshacer y no se guarda de forma permanente hasta pulsar
«Guardar zonas». Una lectura que termina tras cerrar el simulador o tras elegir
un segundo archivo no sobrescribe la configuración más reciente.
