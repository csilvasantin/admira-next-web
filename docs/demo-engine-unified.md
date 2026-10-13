# Motor único de demos / Unified demo engine

ES: Studio (Pixeria), Store (XpaceOS), TV, App y Biz comparten `AdmiraExperto.exec`. Cada aplicación registra sus acciones con `registerAdapter`; el motor interpreta la entrada una vez. La consola de páginas interiores utiliza el mismo registro. El chat remoto de agentes conserva su canal propio.

EN: Studio (Pixeria), Store (XpaceOS), TV, App and Biz share `AdmiraExperto.exec`. Applications register actions through `registerAdapter`; the engine interprets input once. Interior-page consoles use the same registry. Remote agent chat retains its own channel.

- `/demo lista` / `/demo list`: catálogo publicado / published catalogue.
- `/demo editor`: https://www.admiranext.com/demos/editor/ . Guardar y publicar exige sesión editor/admin / Saving and publishing require an editor/admin session.
- `/demo studio`, `/demo store`, `/demo tv`, `/demo app`, `/demo biz`: ejecutar el recorrido publicado / run the published walkthrough.
- `/demo 1` o `/demo sitio/pieza`: pieza del catálogo del sitio / site catalogue piece.
- `/demo ios`, `/demo ios iphone`, `/demo ios watch`, `/demo ios #musica`: lanzador nativo instalado en el Mac, con contexto del proyecto / installed native Mac launcher, preserving project context.

ES: Fuente de ejecución: `https://www.admiranext.com/api/demos` y `/api/demos/<id>/run`. Borradores privados en `/api/demos?view=editor` con sesión y CSRF. Guardar un borrador conserva la última publicación; eliminar una demo no recupera su semilla del repositorio. Las copias locales antiguas son respaldo cuando el catálogo no responde. El botón Publicar del editor hace efectiva la versión para todas las aplicaciones; recargar o volver a la pestaña actualiza el catálogo.

EN: Execution source: `https://www.admiranext.com/api/demos` and `/api/demos/<id>/run`. Private drafts use `/api/demos?view=editor` with session and CSRF. Saving a draft keeps the last published version; deletion does not resurrect repository seeds. Historical local copies are a fallback when the catalogue is unavailable. Publish makes the editor version effective across applications; reload or focus refreshes the catalogue.

Engine: https://www.admiranext.com/suite/experto.js . Existing-console loader: https://www.admiranext.com/suite/loader.js . A loader never creates Expert on a login/presite page.

## Alsea · presentación web

ES: `/demo alsea` abre la sala de Alsea del generador mediante `/pruebas/alsea/`, con sesión y conservando ES/EN. Studio, Store, TV, App y Biz usan el mismo despacho. Abrir la presentación no ejecuta demos, generación, ventas ni publicación de contenido. El enlace de audiencia se obtiene del generador; la ruta protegida es el lanzador interno de pruebas.

EN: `/demo alsea` opens the generator's Alsea presentation through authenticated `/pruebas/alsea/`, retaining ES/EN. All five platforms share this dispatch. Opening the presentation does not start walkthroughs, generation, sales or content publication. Obtain the audience link from the generator; the protected route is the internal staging launcher.

Brief y ensayo se mantienen en el generador privado, fuera del repositorio público. / Brief and rehearsal remain in the private generator, outside the public source repository. Five 15-minute blocks, plus a 2-minute opening and 3-minute close. Save the presentation in the existing generator before release; a missing presentation is reported, never silently generated.
