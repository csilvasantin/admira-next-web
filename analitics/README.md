# Analitics del grupo

URL: https://www.admiranext.com/analitics (también desde Webmaster).

Acceso: sesión Google del directorio de AdmiraNeXT; sólo rol admin. La API vuelve a comprobar el usuario activo y su versión de sesión en cada petición. No se entregan estadísticas en archivos estáticos ni a roles con acceso parcial.

Fuente: Cloudflare Web Analytics / GraphQL `rumPageloadEventsAdaptiveGroups`. `count` son páginas vistas; `sum.visits` son entradas desde otro dominio o acceso directo, no personas únicas. Se filtra bot=0, se agrupan www y raíz y se excluyen previews pages.dev/workers.dev. Días naturales UTC incluyendo hoy parcial. Intervalos: última hora (buckets por minuto), 1, 7, 30 días. Última hora usa caché de 30 segundos y refresco cada minuto; es actividad reciente con la latencia de Cloudflare, no personas conectadas. Caché de servidor: 5 minutos; navegador private/no-store; refresco automático sólo mientras la pestaña está visible. Metadatos descubiertos en Pages y RUM, unidos al censo `_proyectos.js`. Nuevos dominios medidos se incorporan automáticamente.

Secretos de Pages existentes: `CF_ACCOUNT_ID`, `CF_API_TOKEN`. El backend admite un `CF_ANALYTICS_API_TOKEN` separado si se configura posteriormente un token de lectura. Nunca enviar esos secretos al navegador. Las respuestas de metadata se reducen a hostname/estado; no se exponen snippets, tokens de beacon ni variables de otros proyectos.

Sin configuración → cifras nulas; configurado sin actividad → 0; errores o permisos insuficientes → error, nunca 0. Si no se puede consultar el inventario de Cloudflare, el informe avisa de cobertura parcial y no afirma que falte medición. La detección histórica consulta 7 y 30 días independientemente del filtro para no marcar sin configurar un site que hoy no tenga visitas. Configuración o actividad histórica no acredita que el beacon esté cargando actualmente. Un registro de medición activo no garantiza que el beacon cargue en todos los navegadores: ausencia de actividad merece revisión. Datos con latencia y posible muestreo. El límite de 1000 grupos se anuncia si se alcanza.

Pruebas: `node --test test/analytics.test.mjs`; suite general `npm test`.
