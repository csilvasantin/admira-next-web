# Revisión de conflictos · incremento en borrador

El controlador conserva el proyecto abierto y su changeset. Una revisión
distinta antes del guardado devuelve un `RefinementConflict` sin llamar al
escritor. Un 409 permite una lectura de diagnóstico; una revisión distinta
en esa lectura devuelve la misma comparación, sin reintentar la escritura.
Los fallos ordinarios o una lectura no disponible conservan el error original.

Si una respuesta OK y la lectura posterior corresponden a revisiones distintas,
se conserva el borrador y se identifica el guardado como no confirmado. El
escritor pudo haberse aplicado; el panel pide revisar el historial. Una lectura
todavía igual a la revisión original mantiene el error normal de confirmación,
sin presentarla como una revisión nueva.

El laboratorio responde inmediatamente con `admiranext:refinement:conflict`.
La proyección de audiencia queda separada del original pendiente; no contiene
notas ni credenciales. Las imágenes acotadas llegan luego con
`admiranext:refinement:conflict-assets`, usando el destinatario, canal, petición
y revisión capturados para esa operación. Cambiar de ventana o presentación
no redirige una respuesta antigua al proyecto nuevo.

El consumidor valida esas identidades y mantiene su borrador. Esta versión
prepara una comparación de lectura: la resolución manual queda pendiente.
Los ensayos y las capturas de este incremento sólo usan datos ficticios.
