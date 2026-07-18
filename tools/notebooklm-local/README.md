# NotebookLM local producer

Productor local de audio, vídeo e infografía para el generador de presentaciones.
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
