# Analitics del grupo

URL: https://www.admiranext.com/analitics (también desde Webmaster).

Acceso: sesión Google del directorio de AdmiraNeXT; sólo rol admin. La API vuelve a comprobar el usuario activo y su versión de sesión en cada petición. No se entregan estadísticas en archivos estáticos ni a roles con acceso parcial.

Fuente: Cloudflare Web Analytics / GraphQL `rumPageloadEventsAdaptiveGroups`. `count` son páginas vistas; `sum.visits` son entradas desde otro dominio o acceso directo, no personas únicas. Se filtra bot=0, se agrupan www y raíz y se excluyen previews pages.dev/workers.dev. Días naturales UTC incluyendo hoy parcial. Intervalos: última hora (buckets por minuto), 1, 7, 30 días. Última hora usa caché de 30 segundos y refresco cada minuto; es actividad reciente con la latencia de Cloudflare, no personas conectadas. Caché de servidor: 5 minutos; navegador private/no-store; refresco automático sólo mientras la pestaña está visible. Metadatos descubiertos en Pages y RUM, unidos al censo `_proyectos.js`. Nuevos dominios medidos se incorporan automáticamente.

Secretos de Pages existentes: `CF_ACCOUNT_ID`, `CF_API_TOKEN`. El backend admite un `CF_ANALYTICS_API_TOKEN` separado si se configura posteriormente un token de lectura. Nunca enviar esos secretos al navegador. Las respuestas de metadata se reducen a hostname/estado; no se exponen snippets, tokens de beacon ni variables de otros proyectos.

Sin configuración → cifras nulas; configurado sin actividad → 0; errores o permisos insuficientes → error, nunca 0. Si no se puede consultar el inventario de Cloudflare, el informe avisa de cobertura parcial y no afirma que falte medición. La detección histórica consulta 7 y 30 días independientemente del filtro para no marcar sin configurar un site que hoy no tenga visitas. Configuración o actividad histórica no acredita que el beacon esté cargando actualmente. Un registro de medición activo no garantiza que el beacon cargue en todos los navegadores: ausencia de actividad merece revisión. Datos con latencia y posible muestreo. El límite de 1000 grupos se anuncia si se alcanza.

Pruebas: `node --test test/analytics.test.mjs`; suite general `npm test`.

## Ahora — presencia propia

GET /api/presence: lectura privada, sesión admin, sin caché. POST /api/presence: sólo orígenes HTTPS exactos del censo + digitalsignage.ai; datos públicos del cliente pueden ser simulados y no acreditan identidad. SDK /assets/live-presence.js: sessionStorage UUID por sesión de pestaña y UUID por documento. Página visible envía ping cada 15 s; cambio de ruta en hasta 1 s; ocultar/salir borra el documento. Caduca a los 45 s sin ping; lectura cada 5 s. Agrupación por dominio+sesión, no personas únicas entre dominios. País aproximado de Cloudflare y móvil/ordenador. Sin cookies, fingerprint, IP guardada, query/hash ni identificación de usuarios. Respeta DNT/GPC. La limpieza al recibir señales y al consultar elimina registros caducados; si cesan ambas actividades, no se garantiza borrado físico a los 45 s. Las copias de seguridad de D1 siguen su retención habitual.

Migración no destructiva: migrations/0005_live_presence.sql en AUTH_DB. Instrumentación inicial: portada y Webmaster de AdmiraNeXT y las cinco páginas de digitalsignage.ai. Para otros sites añadir `<script defer src="https://www.admiranext.com/assets/live-presence.js?v=1"></script>` (permitir origen del SDK en script-src y www.admiranext.com en connect-src donde haya CSP). El panel queda excluido para no contar al operador como visitante. Un site sin SDK no aparece como conectado ni su ausencia significa que no tenga visitantes.

## Globo del tráfico / Traffic globe

ES: Globo interactivo en Ahora, Última hora, Hoy, 7 y 30 días, respetando el filtro por dominio. Acumulados por país de Cloudflare RUM: rayos en escala lineal común dentro del periodo elegido, altura proporcional a visitas (no páginas vistas). Recorrido automático de países; en Ahora recorre sesiones anónimas y muestra su ruta. Arrastrar, flechas del teclado, zoom, anterior/siguiente, pausa y selección por país. País sin coordenadas se declara sin ubicar; no se inventa una ciudad. Coordenadas representativas del país, no posición exacta. Movimiento reducido detiene el recorrido automático. Sin nuevas claves, cookies ni almacenamiento de geolocalización.

EN: Interactive globe in Now and historical periods, following the selected site filter. Cloudflare RUM country totals drive rays with a shared linear height scale proportional to visits. Automatic country tour, or anonymous session tour with current page in Now. Drag, keyboard arrows, zoom, previous/next, pause and country selection. Unknown countries stay unlocated. Representative country coordinates are approximate; no individual position or city is inferred. Reduced motion disables automatic touring. No new credentials, cookies or geolocation storage.

Assets served locally: D3 7.9.0 (ISC), Natural Earth public-domain land from the existing Admira globe, world-countries 5.1.0 (ODbL; country-centres.json derives from its latlng/name data). Licenses under analitics/vendor. No remote map server receives visits. API geography includes all group hosts or the chosen site, excluding Pages/Workers previews; the 1,000-row limit is reported. Tests: test/traffic-globe.test.mjs, test/analytics.test.mjs, test/presence.test.mjs.
