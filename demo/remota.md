# Demo remota: presentación narrada

En `/demo/#remota`, Cargar obtiene la presentación protegida en modo público de audiencia (sin notas del ponente) y el snapshot de sus demos. No crea ni actualiza presentaciones. Iniciar muestra cada diapositiva real y, en su diapositiva correspondiente, cada paso de ensayo guardado. Las muestras y casos son preparados; no se ejecutan altas, ventas, generación ni emisión.

La versión inicial ofrece español, idioma del snapshot de los ensayos. No anuncia traducciones que la presentación no contiene. La voz preparada se lee de `PRESENTATION_MEDIA` mediante el endpoint protegido `remote-audio`; cada segmento debe coincidir con el SHA256 del texto normalizado (NFC, espacios simples, sin enlaces, controles, pies ni notas). Se verifican todos los hashes antes de habilitar Iniciar. Un único elemento Audio conserva la autorización del primer clic durante el recorrido. Si falta voz preparada, se busca una voz española del navegador. Un fallo detiene el avance y ofrece continuar explícitamente sin voz con temporización.

Cada diapositiva permanece al menos cuatro segundos y cada fase al menos dos y medio, también cuando su voz es breve. Pausa y Reanudar conservan el segmento; Detener cancela narración, temporización y muestras. Siguiente toma el control y omite un segmento: ese recorrido no muestra la oferta final de grabación. En la última fase, la narración termina antes de empezar el vídeo completo de esa función. El recorrido espera el evento final real del vídeo; un fallo de acceso, formato o reproducción detiene el avance y permite reintentar. Pausa conserva la posición del clip. Las muestras originales se mantienen como consulta manual con el recorrido detenido.

Al completar todas las diapositivas y pasos sin saltos, aparece la pregunta sobre grabar un vídeo. El botón solo registra la intención en la interfaz. No graba pantalla ni descarga un archivo; el respaldo se prepara después de la aceptación del usuario.

## English

Remote Demo displays the entire authenticated audience deck, with its saved rehearsal steps inserted at the matching function slides. The initial release supports Spanish saved content. It verifies prepared narration hashes before Start and reuses one Audio element for autonomous playback after the initial click. Browser speech is a fallback; missing speech produces a visible error and an explicit timed alternative. Prepared clips are audible by default; narration, clip sound and global mute are independent controls. Pause, resume and stop control the owned narration. Recording is offered only after the complete, unskipped presentation and requires a separate confirmed workflow.

## Contrato de audio preparado

`presentations/<client>/remote/audio/manifest-es.json` contiene `version:1`, `lang:"es"`, `source:"macOS say"`, y hasta 200 segmentos `{id,duration,textHash}`. Los IDs son `s001` para diapositivas y `d-studio-voz-p01` para fases. Los archivos son `<lang>-<id>.m4a`, AAC. No se publica el texto en el manifiesto; el endpoint devuelve solo los campos validados y su URL protegida. Admite rangos de audio y las mismas sesiones de sala/editor que la presentación. No existe acceso anónimo.

## Vídeos preparados y controles de sonido / Prepared videos and sound controls

Una subdemo puede añadir `video` sin sustituir su `muestra`, sus pasos o su caso. El contrato admite únicamente estos campos:

```json
{
  "version": 1,
  "tipo": "video",
  "url": "https://example.com/prepared/demo.mp4",
  "poster": "https://example.com/prepared/demo.jpg",
  "duracion": 80,
  "audio": true,
  "idioma": "es",
  "descripcion": "Ensayo preparado de esta función",
  "fuente": "ensayo-local"
}
```

`poster` y `duracion` son opcionales. Las URLs requieren HTTPS, sin credenciales y con un máximo de 2048 caracteres; la duración, si existe, es un número finito mayor que cero y no superior a 300 segundos. `audio` es booleano, `idioma` admite `es`, `en` o `ca`, y `descripcion` admite hasta 1000 caracteres. Los demás campos del ejemplo son obligatorios; campos desconocidos o contratos incompatibles se rechazan antes de guardar.

Las quince funciones principales tienen un vídeo de ensayo preparado por defecto. Un `video` válido lo sustituye; omitirlo o usar `null` conserva ese vídeo por defecto. Una subdemo personalizada requiere una definición válida en el catálogo del proyecto y puede añadir su propio vídeo HTTPS. El editor permite modificar URL, póster y si incluye audio preparado, conserva los demás metadatos existentes y mantiene la muestra original. Vaciar la URL elimina la definición opcional. Guardar actúa en el navegador e Importar/Exportar transporta el catálogo; el editor no genera ni sube archivos. El snapshot guarda la definición y no altera el catálogo global ni los textos y hashes de la narración.

En Demo remota, Narración (`remote-narration`) y Sonido de los clips (`remote-sound`) están activados inicialmente; Silenciar todo (`remote-mute`) silencia ambos sin modificar esas elecciones. El recorrido global tiene Escuchar los vídeos (`auto-sound`) y el mismo control global de silencio (`auto-mute`). El clic de Iniciar autoriza la reproducción. En el recorrido global, Ágil/Normal/Pausado ajustan el ritmo de lectura; la duración total también incluye los vídeos completos. Las preferencias se comparten en este navegador mediante `admira-demo-audio-v1`, inicialmente `{"narration":true,"samples":true,"muted":false}`; `aria-pressed` indica si el silencio global está activo. Un vídeo con `audio:false` permanece silenciado aunque se active el sonido de clips.

Prepared video is an optional, validated HTTPS definition separate from the original sample, steps and case. Poster and duration are optional; duration must be finite and within `(0, 300]` seconds. URLs are limited to 2048 characters and cannot contain credentials. Language is `es`, `en` or `ca`; description is limited to 1000 characters. Unknown fields and incompatible contracts are rejected. All fifteen core functions retain their prepared fallback video when `video` is absent or `null`; a valid override replaces it. Custom functions require a valid project catalog definition. Editor changes and JSON import/export preserve original samples and existing video metadata, without generating or uploading media or changing narration text hashes.

Remote narration and clip sound are enabled initially. Global mute silences both while retaining their individual settings; videos marked `audio:false` remain silent. The global tour also starts with video sound enabled. Start provides the playback gesture. Both players share browser preferences under `admira-demo-audio-v1` with defaults `{"narration":true,"samples":true,"muted":false}`.
