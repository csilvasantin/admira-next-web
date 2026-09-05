# NotebookLM local producer

Productor local de audio, vídeo, PDF, PowerPoint e infografía para el generador de presentaciones.
Usa un perfil de Chrome dedicado dentro de `.runtime/`; nunca lee cookies ni perfiles
del navegador de trabajo.

1. `pnpm install` (o `npm install`).
2. `pnpm setup` y acceder una sola vez con `csilvasantin@gmail.com`.
3. `pnpm start` para procesar continuamente o `pnpm once` para una sola presentación.

El token se obtiene de `PRESENTATION_WORKER_TOKEN`, de
`.runtime/notebooklm-local/worker.token` (modo `0600`), de `admira-vault` o del
llavero de macOS (`admiranext-presentations / notebooklm-local`). El fichero privado
permite ejecutar el LaunchAgent de forma desatendida cuando macOS no da acceso al
llavero desde una sesión remota. El servicio
solo recibe guiones de la cola interna autenticada y publica los archivos en el R2
privado de la presentación.

Antes de publicar, el puente de fidelidad conserva la duración del vídeo y
reemplaza únicamente la tarjeta final por el último fotograma limpio, sin añadir
overlays. En infografía clona el fondo adyacente sobre la firma sin ampliar el
lienzo. En PowerPoint elimina exclusivamente shapes identificados como
NotebookLM/Gemini (o imágenes cuyo SHA-256 esté en una allowlist) y verifica que
tema, masters, layouts, tipografías y partes no objetivo permanecen idénticos.
Cuando NotebookLM devuelve el deck rasterizado —una única imagen PNG a página
completa por diapositiva—, el productor usa la procedencia autenticada del
proveedor para reconstruir solo la esquina firmada clonando la franja de fondo
adyacente. El PDF recibe la misma reparación sobre cada página, sin rasterizar el
resto del documento ni alterar su tamaño. Así el ciclo es realmente bidireccional:
encargo, espera, descarga, limpieza conservadora y publicación privada.
Los idiomas se producen por separado (`es`, `ca`, `en`) y el estilo visual se
deriva de la referencia y el tema guardados en cada presentación.

Antes de abrir NotebookLM, captura dos pantallas de la web inspiradora y crea una
guía visual con el modelo local `gemma4:31b` de Ollama. La guía se guarda por
generación y se reutiliza en vídeo, deck e infografía. Si Ollama no está disponible,
el trabajo continúa con una guía determinista. Los decks se descargan como PDF y
PPTX. El texto que entra en NotebookLM incluye un manifiesto de fuentes, el hash
de la narrativa y un contrato explícito de fidelidad. El overlay de logo queda
solo como compatibilidad heredada opt-in con
`NOTEBOOKLM_DECK_LOGO_MODE=overlay`; no es el comportamiento predeterminado.
`NOTEBOOKLM_WATERMARK_HASHES` admite una lista separada por comas de SHA-256 para
marcas gráficas verificadas que no contengan texto identificable.
La limpieza de vídeo e infografía es conservadora: solo actúa cuando el SHA-256
de la tarjeta final o de la esquina coincide con
`NOTEBOOKLM_VIDEO_ENDING_HASHES` o
`NOTEBOOKLM_INFOGRAPHIC_WATERMARK_HASHES`. Sin coincidencia, el archivo se
publica byte a byte sin modificar y el informe registra el fingerprint observado.

Variables opcionales: `VISUAL_BRIEF_MODEL`, `VISUAL_BRIEF_OLLAMA_URL` y
`VISUAL_BRIEF_MODE=off` para desactivar temporalmente el análisis visual.
`NOTEBOOKLM_CLIENT=portaventura` y `NOTEBOOKLM_OUTPUTS=pdf,powerpoint` permiten
procesar un caso o unos entregables concretos durante una prueba sin reclamar el
resto de la cola.
