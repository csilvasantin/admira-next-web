# NotebookLM local producer

Productor local de audio, vídeo, PDF, PowerPoint e infografía para el generador de presentaciones.
Usa un perfil de Chrome dedicado dentro de `.runtime/`; nunca lee cookies ni perfiles
del navegador de trabajo.

1. `pnpm install` (o `npm install`).
2. `pnpm setup` y acceder una sola vez con `csilvasantin@gmail.com`.
3. `pnpm start` para procesar continuamente o `pnpm once` para una sola presentación.

El token se obtiene de `PRESENTATION_WORKER_TOKEN`, de `admira-vault` o del llavero
de macOS (`admiranext-presentations / notebooklm-local`). El servicio
solo recibe guiones de la cola interna autenticada y publica los archivos en el R2
privado de la presentación.

Antes de publicar, conserva la duración del vídeo, elimina su tarjeta final, cubre
la firma del proveedor con la identidad AdmiraNeXT y limpia la firma de la
infografía. Los idiomas se producen por separado (`es`, `ca`, `en`) y el estilo
visual se deriva de la referencia y el tema guardados en cada presentación.

Antes de abrir NotebookLM, captura dos pantallas de la web inspiradora y crea una
guía visual con el modelo local `gemma4:31b` de Ollama. La guía se guarda por
generación y se reutiliza en vídeo, deck e infografía. Si Ollama no está disponible,
el trabajo continúa con una guía determinista. Los decks se descargan como PDF y
PPTX; la guía visual exige el logo oficial en todas las diapositivas. Para decks heredados que no lo incorporen puede forzarse una segunda capa con `NOTEBOOKLM_DECK_LOGO_MODE=overlay`.

Variables opcionales: `VISUAL_BRIEF_MODEL`, `VISUAL_BRIEF_OLLAMA_URL` y
`VISUAL_BRIEF_MODE=off` para desactivar temporalmente el análisis visual.
`NOTEBOOKLM_CLIENT=portaventura` y `NOTEBOOKLM_OUTPUTS=pdf,powerpoint` permiten
procesar un caso o unos entregables concretos durante una prueba sin reclamar el
resto de la cola.
