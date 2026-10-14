# Cabecera común / Shared header

Carlos, 14-10-2026: Studio, Store, TV, App, Biz y sus clones Pixeria, XpaceOS, Yokup y ClearChannel comparten `https://www.admiranext.com/suite/header.js`.

ES: el logo conserva su enlace de inicio y el menú superior oculta el enlace redundante Inicio/Home. Opciones, Avanzado y Experto conservan sus eventos, estado, etiquetas y autenticación; su tamaño visual y de layout se reduce exactamente al 90% (42 px → 37,8 px). No se reduce login ni selector de idioma. Los menús laterales conservan su navegación.

EN: the logo keeps its home link; the top menu hides a redundant Home/Inicio link. Options, Advanced and Expert retain their events, state, labels and authentication; their visual and layout size is 90% (42 px → 37.8 px). Login and language controls keep their size. Side navigation is preserved.

The independent policy is loaded by the existing shared loader, Expert skin, version badge and avatar. It is idempotent, watches regenerated headers and is restricted to the nine named product/clone hosts. It does not create Expert on public pages or change commands, client data, preferences or brand assets. `/suite/*` is served no-store. Reopening an existing page requires reload.

Verified behavior and deployment evidence are recorded in the release PR. Digital twins remain nominal installation trials; this header resource makes no hardware or anamorphic claim.
