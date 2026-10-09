# Subdemos Store y Biz

En la propia plataforma, Experto y avatar comparten `/demo 1`…`/demo 5`, los nombres y `/demo help`. Store y Biz muestran un recorrido preparado con guion; Store puede reproducir los contenidos de ejemplo. «Ensayar paso a paso» abre un caso editable durante la sesión; «Abrir la función» lleva a la plataforma para revisar el alta o la activación real.

| Número | admira.store | Alias | admira.biz | Alias |
|---|---|---|---|---|
| 1 | Gestión de locuciones | `/demo locucion` | Alta de proyecto | `/demo proyecto` |
| 2 | Gestión de música | `/demo musica` | Circuito, puntos DooH y vuelo | `/demo circuito` |
| 3 | Gestión de imágenes | `/demo imagenes` | Gemelo digital Retail Media | `/demo gemelo` |
| 4 | Gestión de vídeo | `/demo video` | Pantallas, altavoces, cámaras y tótems IoT | `/demo iot` |
| 5 | Gestión del TPV | `/demo caja` | Inventario tecnológico ITIL | `/demo itil` |

Las fechas, ubicaciones, IDs y dispositivos del ensayo son datos preparados. El circuito incluye tres puntos y un vuelo con inicio/fin, franjas, duración y frecuencia. El alta en sistemas reales se revisa dentro de su plataforma: el ensayo no afirma haber creado esos recursos. `/demo tpv` conserva el arranque directo del recorrido nativo. El ensayo de gestión se abre con `/demo 5` o `/demo caja`. Los controles nativos `/demo off`, `/demo stop`, `/demo estado` y `/demo status` de Store conservan su ruta al gemelo.

Los manifiestos canónicos están en `/subdemos/store.subdemos.json` y `/subdemos/biz.subdemos.json`. `negocio.mjs` y la copia de `suite/experto.js` mantienen el mismo catálogo para disponibilidad sin red. La validación compara sus definiciones, casos y guiones. Las seis antiguas definiciones Store siguen resolviéndose para guiones guardados, separadas de las cinco nuevas.

El editor `/subdemos/` permite añadir, editar y quitar una definición individual, y seleccionar qué se enseña en cada proyecto. Guarda cambios en este navegador; Exportar incluye proyectos y manifiestos, e Importar los lleva a otro. No publica esos cambios en todos los navegadores. Al generar una presentación desde ese editor, el catálogo editado se envía como `demoProject.catalogo`, se valida y se captura con la presentación. Las definiciones desconocidas sin catálogo válido se rechazan.

## Demo global y entrega sin conexión

Cada presentación con `demoProject` puede abrir su recorrido guiado privado en
`/presentaciones/<cliente>/demo`. Lee la instantánea capturada en la presentación,
conserva el contexto del proyecto y reproduce muestras sin generar ni publicar.

`/presentaciones/<cliente>/api/demo-project` permite consultar esa instantánea y
actualizarla con PUT de editor, sin reconstruir las diapositivas. Admite
`expectedUpdatedAt` para detectar una edición posterior.

El empaquetador `scripts/build-presentation-offline.cjs` requiere Node, Playwright
y la clave de máquina del generador (resuelta en memoria). Ejemplo:

```sh
node scripts/build-presentation-offline.cjs --client alsea-starbucks --output /ruta/alsea-starbucks-offline
```

Produce una carpeta autónoma, un ZIP y un PDF. Extraer el ZIP y abrir `index.html`
en el navegador del ordenador. La presentación, las quince funciones seleccionadas
y sus muestras están dentro. No hay servidor, sesión, generación ni escritura remota.
Las funciones online mantienen sus enlaces explícitos y requieren red y autorización.
La copia tiene fecha y cliente y se comparte como material de reunión.

La descarga privada `/presentaciones/<cliente>/offline?format=zip` (o `pdf`) sirve
el archivo R2 `presentations/<cliente>/offline/paquete.zip` (o `.pdf`). El
empaquetador no publica automáticamente. Si cambia el material, se vuelve a
empaquetar y verificar antes de reemplazar la entrega. No se publican los ZIP,
PDF o backups del cliente como archivos estáticos en Git.


## Pixeria · novedades / Pixeria updates (2026-10-09)
ES: `/demo pixeria novedades` abre el recorrido preparado de ocho capítulos con narración y vídeo hasta el gemelo 360. La demo queda en el editor hasta que Carlos quiera eliminarla. Eliminar la entrada Studio sólo retira la definición y sus referencias en este navegador; otras demos, borradores y la campaña se conservan. Exportar primero permite recuperarla.
EN: `/demo pixeria updates` opens the prepared eight-chapter narrated tour and video through the 360 twin. The demo stays in the editor until Carlos deletes it. Deleting the Studio entry removes only that definition and its references in this browser; other demos, drafts and the campaign remain. Export first for recovery.
Demo: https://www.admiranext.com/demo/pixeria-novedades/
Guide/tutorial ES/EN: https://www.admiranext.com/demo/pixeria-novedades/README.md
Manifest: https://www.admiranext.com/demo/pixeria-novedades/studio.subdemos.json
MCP: existing `help {tema:"novedades"}`. Public GET /mcp (Accept application/json) returns demoUpdates metadata. No generation or new credentials.
