# Demo remota: presentación narrada

En `/demo/#remota`, Cargar obtiene la presentación protegida en modo público de audiencia (sin notas del ponente) y el snapshot de sus demos. No crea ni actualiza presentaciones. Iniciar muestra cada diapositiva real y, en su diapositiva correspondiente, cada paso de ensayo guardado. Las muestras y casos son preparados; no se ejecutan altas, ventas, generación ni emisión.

La versión inicial ofrece español, idioma del snapshot de los ensayos. No anuncia traducciones que la presentación no contiene. La voz preparada se lee de `PRESENTATION_MEDIA` mediante el endpoint protegido `remote-audio`; cada segmento debe coincidir con el SHA256 del texto normalizado (NFC, espacios simples, sin enlaces, controles, pies ni notas). Se verifican todos los hashes antes de habilitar Iniciar. Un único elemento Audio conserva la autorización del primer clic durante el recorrido. Si falta voz preparada, se busca una voz española del navegador. Un fallo detiene el avance y ofrece continuar explícitamente sin voz con temporización.

Cada diapositiva permanece al menos cuatro segundos y cada fase al menos dos y medio, también cuando su voz es breve. Pausa y Reanudar conservan el segmento; Detener cancela narración, temporización y muestras. Siguiente toma el control y omite un segmento: ese recorrido no muestra la oferta final de grabación. Las muestras de vídeo conservan su posición entre fases; la última fase espera el tiempo restante, con límite de 30 segundos. Los errores de muestras quedan visibles para revisión.

Al completar todas las diapositivas y pasos sin saltos, aparece la pregunta sobre grabar un vídeo. El botón solo registra la intención en la interfaz. No graba pantalla ni descarga un archivo; el respaldo se prepara después de la aceptación del usuario.

## English

Remote Demo displays the entire authenticated audience deck, with its saved rehearsal steps inserted at the matching function slides. The initial release supports Spanish saved content. It verifies prepared narration hashes before Start and reuses one Audio element for autonomous playback after the initial click. Browser speech is a fallback; missing speech produces a visible error and an explicit timed alternative. Samples stay muted. Pause, resume and stop control the owned narration. Recording is offered only after the complete, unskipped presentation and requires a separate confirmed workflow.

## Contrato de audio preparado

`presentations/<client>/remote/audio/manifest-es.json` contiene `version:1`, `lang:"es"`, `source:"macOS say"`, y hasta 200 segmentos `{id,duration,textHash}`. Los IDs son `s001` para diapositivas y `d-studio-voz-p01` para fases. Los archivos son `<lang>-<id>.m4a`, AAC. No se publica el texto en el manifiesto; el endpoint devuelve solo los campos validados y su URL protegida. Admite rangos de audio y las mismas sesiones de sala/editor que la presentación. No existe acceso anónimo.
