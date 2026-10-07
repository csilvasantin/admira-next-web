# Subdemos Store y Biz

En la propia plataforma, Experto y avatar comparten `/demo 1`…`/demo 5`, los nombres y `/demo help`. Store y Biz muestran un recorrido preparado con guion; Store puede reproducir los contenidos de ejemplo. «Ensayar paso a paso» abre un caso editable durante la sesión; «Abrir la función» lleva a la plataforma para revisar el alta o la activación real.

| Número | admira.store | Alias | admira.biz | Alias |
|---|---|---|---|---|
| 1 | Gestión de locuciones | `/demo locucion` | Alta de proyecto | `/demo proyecto` |
| 2 | Gestión de música | `/demo musica` | Circuito, puntos DooH y vuelo | `/demo circuito` |
| 3 | Gestión de imágenes | `/demo imagenes` | Gemelo digital Retail Media | `/demo gemelo` |
| 4 | Gestión de vídeo | `/demo video` | Pantallas, altavoces, cámaras y tótems IoT | `/demo iot` |
| 5 | Gestión del TPV | `/demo tpv` | Inventario tecnológico ITIL | `/demo itil` |

Las fechas, ubicaciones, IDs y dispositivos del ensayo son datos preparados. El circuito incluye tres puntos y un vuelo con inicio/fin, franjas, duración y frecuencia. El alta en sistemas reales se revisa dentro de su plataforma: el ensayo no afirma haber creado esos recursos. Los controles nativos `/demo off`, `/demo stop`, `/demo estado` y `/demo status` de Store conservan su ruta al gemelo.

Los manifiestos canónicos están en `/subdemos/store.subdemos.json` y `/subdemos/biz.subdemos.json`. `negocio.mjs` y la copia de `suite/experto.js` mantienen el mismo catálogo para disponibilidad sin red. La validación compara sus definiciones, casos y guiones. Las seis antiguas definiciones Store siguen resolviéndose para guiones guardados, separadas de las cinco nuevas.

El editor `/subdemos/` permite añadir, editar y quitar una definición individual, y seleccionar qué se enseña en cada proyecto. Guarda cambios en este navegador; Exportar incluye proyectos y manifiestos, e Importar los lleva a otro. No publica esos cambios en todos los navegadores. Al generar una presentación desde ese editor, el catálogo editado se envía como `demoProject.catalogo`, se valida y se captura con la presentación. Las definiciones desconocidas sin catálogo válido se rechazan.
