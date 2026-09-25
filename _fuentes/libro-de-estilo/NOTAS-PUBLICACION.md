# Notas de publicación · Libro de estilo en admiranext.com

> Borrador · 25-09-2026 · **no se ha publicado ni ejecutado nada**. Solo lectura de la web pública y del repositorio.

## 1. Qué hay hoy en admiranext.com (observado)

- **Hosting: Cloudflare Pages**, proyecto `admiranext`, con dominio propio `www.admiranext.com` y espejo en `admiranext.pages.dev`. Las cabeceras de respuesta llevan `server: cloudflare` y `cf-ray`. `deploy.sh` del repositorio dice que Cloudflare Pages es el origen desde el 10-07-2026 (`HANDOFF.md` aún habla de GitHub Pages: está desactualizado).
- **Repositorio:** `github.com/csilvasantin/admira-next-web` (lo cita la propia web en `/mcp/llms.txt`). Es un sitio estático en la raíz (`pages_build_output_dir: "."` en `wrangler.jsonc`) con Functions y enlaces a D1, KV, R2 y un servicio (Pixeria).
- **Cómo se publican las páginas:** un archivo `.html` en la raíz se sirve con URL limpia (`/filosofia` sirve `filosofia.html`; `/filosofia.html` redirige con 308). Así están `/filosofia`, `/mandamientos`, `/normativa`, `/presentar`, `/status`. También hay carpetas con `index.html` (`/creditos/`, `/impacto/`…).
- **No existe** página de marca ni de estilo: `/estilo`, `/libro-de-estilo`, `/marca` y `/brand` devuelven 404. No hay `_redirects`; `_headers` solo fija la caché (`max-age=0, must-revalidate`; `/status` sin caché).
- **Páginas cercanas en contenido:** `/filosofia` (Máximas y «14 Mandamientos»), `/mandamientos` (dice «15 Mandamientos»: hay una incoherencia entre las dos páginas) y `/normativa` (el contrato operativo del equipo). El libro de estilo es la puerta para público general; esas tres son la doctrina interna.
- **Identidad de la portada:** ventana de terminal con tres puntos, JetBrains Mono (local, `assets/fonts/jetbrains-mono.woff2`), fondo `#1a1a2e`, logo ADmiraNeXT con N·e·X·T en neón, vídeo de fondo desenfocado. Menú en inglés (Platform, Robots, About us, Contact) con lema en español. `sitemap.xml` lista 10 URL.
- **Sello de versión:** cada página lleva `<meta name="admiranext-version" content="v.DD.MM.AAAA.rN.HH:MM">` (`HANDOFF.md` describe otro formato, `v.AA.MM.DD.rN`: conviene confirmar cuál manda).

## 2. Propuesta

| Paso | Detalle |
|---|---|
| Ruta | **`/libro-de-estilo`** (archivo `libro-de-estilo.html` en la raíz del repositorio, mismo patrón que `filosofia.html`). Alias corto opcional **`/estilo`** con un `_redirects` nuevo: `/estilo  /libro-de-estilo  301`. |
| Archivo | Copiar `index.html` de esta carpeta como `libro-de-estilo.html`. Es autocontenido: solo depende de Google Fonts y de `/favicon-96x96.png`, que ya existe. |
| Sello | Añadir en `<head>` el `<meta name="admiranext-version">` con la versión del día, como el resto de páginas. |
| Fuente de JetBrains Mono | Opcional: usar la copia local `/assets/fonts/jetbrains-mono.woff2` con `preload` y dejar Google Fonts solo para Chakra Petch y VT323, como pide la dirección de arte. |
| Sitemap | Añadir `<url><loc>https://www.admiranext.com/libro-de-estilo</loc>…<priority>0.7</priority></url>` en `sitemap.xml`. |
| Enlaces | Enlazar desde el pie o «About us» de la portada y, en sentido inverso, desde `/filosofia`. Añadir `og:image` (por ejemplo, `capturas/escritorio-pantalla1.png` recortada a 1200×630). |
| Publicación | Commit a `main` y `./deploy.sh` desde un árbol limpio (el script comprueba rama, conflictos, ritmo máximo de cuatro publicaciones por hora, firma del responsable en `release-signature.json` y despliega con `wrangler pages deploy`). Lo ejecuta el agente responsable de la web, con el sí de Carlos. |
| Tests | El repositorio tiene `test/*.test.js` (`node --test test/*.test.js`); pasarlos antes de publicar por si alguno exige sello o entrada en el sitemap para cada página. |

## 3. Comprobaciones antes de publicar

- Revisión de textos por Carlos (ver dudas en el informe).
- Validar en `admiranext.pages.dev` (o una vista previa de rama) antes del dominio principal.
- Revisar contraste con una herramienta automática (Lighthouse o axe) y la vista con «reducir movimiento» activado.
- Confirmar que no aparece ningún dato personal, correo ni detalle interno (el borrador no los incluye).
