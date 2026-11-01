# Laboratorio de conexión con AINimation

Nueva funcionalidad confinada a `/pruebas/ainimation-presentaciones/`, bajo la
verja de sesión existente de `/pruebas`. Los GET del catálogo y del guion pasan
por sus rutas privadas originales y sus permisos de `/presentaciones`.
La página no añade un acceso ni modifica presentaciones guardadas.

Con sesión en el generador: Cargar mis presentaciones → elegir presentación e
idioma → Ver en AINimation. No crea un cliente nuevo. Lee el catálogo antes de
elegir y transfiere solo el guion de audiencia del idioma guardado; una
traducción ausente produce un error, sin recurrir silenciosamente al español.
La demo es ficticia. Puede descargarse el paquete para abrirlo en AINimation.

No exporta notas, brief, claves, medios, decks, embeds ni control remoto.
La película de Director es independiente: no hay guardado de vuelta al generador.
La vista cinematográfica y la película nativa mantienen el texto, pero no
prometen reproducir el diseño de los decks adjuntos.

Se necesita primero el receptor `/presentaciones/` de AINimation. La comunicación
valida origen, iframe y canal. El laboratorio avisa tras 15 segundos si no hay
confirmación; una descarga sigue estando disponible. La copia de contract.mjs
debe mantenerse compatible con la versión del receptor.

Prueba local: servir este checkout en 127.0.0.1:9135 y AINimation en
127.0.0.1:9134; abrir `/pruebas/ainimation-presentaciones/?localPlayer=1`.
Ese parámetro solo cambia el reproductor en loopback; producción usa siempre
https://www.ainimation.studio. Un servidor estático local muestra la demo pero
no emula la sesión ni las APIs privadas del generador.

Pruebas: `node --test test/ainimation-presentations.test.mjs test/pruebas-zona.test.mjs`.
