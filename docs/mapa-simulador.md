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

La explicación bajo las coordenadas indica por qué se elige la zona: estar
dentro del círculo, ganar por prioridad en un solapamiento o estar fuera de
todas las zonas. Muestra la distancia al límite o a la zona más cercana.
Durante el arrastre aparece «Al soltar» con oficina y tema previstos; el player
actual se conserva hasta soltar. La vista previa no hace avisos de lector de
pantalla por cada movimiento. Al soltar se actualiza el resultado y sólo se
reinicia el iframe si cambian la zona ganadora o su tema.

Para una lectura real confirmada, la explicación descuenta la precisión de la
distancia al límite: muestra el margen que queda para todo el círculo de
precisión, no sólo para su centro. Una lectura dudosa no presenta la oficina
del punto central como confirmada; conserva el motivo de espera. No se añaden
confirmaciones por repetición: consultar varias veces el mismo aviso no cuenta
como recibir mediciones nuevas y no reinicia una reproducción que sigue válida.

## Seguir Luka con las mismas reglas

«Seguir Luka» utiliza Datos reales y consulta el feed privado cada 60 segundos.
No activa Demo, no permite mover la ubicación recibida, no escribe ubicaciones
y no accede directamente a la cuenta Samsung. La adquisición desde Samsung
todavía está pendiente; mientras no haya una lectura válida muestra el motivo
y mantiene el player en espera.

El arrastre y las lecturas utilizan la misma función de selección de zona y la
misma configuración del editor, incluidos orden y temas. Para una lectura real
se exige `equipo:luka`, `tipo:smarttag2`, `fuente:smartthings-find`, coordenadas
numéricas, fecha con un máximo de cinco minutos de antigüedad (adelanto máximo
de un minuto) y precisión numérica no negativa. Los avisos de prueba, sin
precisión, antiguos o sin coordenadas no activan contenido. Esto es más estricto
que la antigüedad de dos horas del listado general: decidir entre oficinas
cercanas requiere una lectura reciente.

Además, todo el círculo de precisión debe pertenecer a una sola zona ganadora.
Si cruza el límite de una zona prioritaria, se espera una lectura más precisa.
El exterior sólo queda confirmado cuando el círculo no toca ninguna zona.
Un fallo al consultar o una lectura que deja de cumplir estas condiciones
retira el iframe. Repetir una lectura dentro de la misma zona no reinicia el
player. La fecha, precisión y causa de espera aparecen junto a los controles.
Volver a Simular player recupera el marcador arrastrable, sin modificar los
datos reales. Los botones de acceso a zonas se desactivan mientras se sigue Luka.

Verificación: `node --test test/ubicacion.test.mjs test/mapa-ubicacion-ui.test.mjs test/mapa-5612.test.mjs test/mapa-simulador.test.mjs`.

## Editor de zonas y contenido

«Cargar cinco oficinas» incorpora las sedes confirmadas por Carlos, todas en
08012 Barcelona. Es una acción explícita y reversible con Deshacer; al abrir
la página se conservan las zonas guardadas. Tras cargar, «Guardar zonas» las
conserva en este navegador. El marcador «Luka · manual» aparece en Pixería y se
puede arrastrar entre los círculos; los accesos de oficina ofrecen la misma
prueba con teclado. El pin sintético de Luka se oculta durante el arrastre para
que haya un único marcador de Luka en el mapa.

| Oficina | Dirección de referencia | Tema inicial |
| --- | --- | --- |
| Pixería | Aulèstia i Pijoan 21 | Creatividad |
| Admira University | Bretón de los Herreros 9 | Educación |
| Garage | Santa Rosa 4 | Desarrollo de software (`devops`) |
| Sneaker Store | Santa Rosa 19 | Comercio |
| La Nave | Planeta 7 | Emprendimiento |

Los temas son asignaciones de prueba editables; el exterior utiliza Publicidad.
En el catálogo consultado el 29-oct-2026 estos cinco grupos tenían 18, 3, 1, 5 y 5
piezas respectivamente y no compartían ninguna. El catálogo puede cambiar.
El radio inicial de 50 m es una aproximación editable a cada sede, no un plano
del interior. Los cinco centros ganan su propia zona incluso con un margen
de precisión de 10 m; los límites compartidos se tratan como ambiguos para datos
reales. Al iniciar se encuadran las zonas, reservando espacio al player flotante.

Procedencia de centros: ICGC para Aulèstia 21 (41.40300208,2.15095625),
Bretón 9 (41.4023751,2.1519882), Planeta 7 (41.40134534,2.1558339);
GeoBCN para Santa Rosa 4 (41.40316442,2.15276479) y 19
(41.40347899,2.15370648). Son posiciones de direcciones, no mediciones del tag.
Santa Rosa aparece en el callejero actual como Rosa Puig-rodon Pla; se conserva
el nombre antiguo en la referencia visible. El cambio consta en el
[decreto municipal de 28-jun-2024](https://w123.bcn.cat/APPS/egaseta/cercaAvancada.do?publicacionsId=28714&reqCode=downloadFile).
Consultas: [ICGC](https://eines.icgc.cat/geocodificador/cerca?text=Aulestia%20i%20Pijoan%2021%2CBarcelona&layers=address&size=1),
[GeoBCN](https://geoportal.barcelona.cat/geoBCN/serveis/territori?q=Santa%20Rosa%204&out_proj=EPSG%3A4326).
Se descartaron expresamente los resultados de Santa Rosalia (otro barrio).

La referencia opcional `address` se valida como texto y se conserva al guardar,
exportar e importar. Se muestra como referencia original aunque se ajuste el
centro del círculo, para no presentar una dirección como geocodificación inversa.

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

«Subir prioridad» y «Bajar prioridad» mueven la zona seleccionada una posición
en la lista. El editor muestra su prioridad actual y desactiva los movimientos
que exceden la lista; el exterior no se puede reordenar. Se conserva la selección
y se puede deshacer el cambio. El selector y los accesos del mapa reflejan el
mismo orden, que se guarda y se incluye en el archivo de exportación. Las
geometrías, referencias de dirección y contenidos permanecen asociados a su zona.
Cambiar el orden vuelve a evaluar la ubicación manual o recibida de Luka:
sólo reinicia el player si cambia la zona ganadora o su tema.

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
