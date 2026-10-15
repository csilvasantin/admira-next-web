Permisos de playlist local / Venue playlist authorization
Servicio privado v.15.10.2026.r1.13:07 · misión Admira349

ES
POST /pruebas/api/xpace/playlist-permission sólo admite al BFF de Admira Store.
Origin debe ser https://www.admira.store o https://admira.store y la cabecera
X-Admira-Playlist-Service-Key debe coincidir con XPACE_PLAYLIST_SERVICE_KEY.
La clave permanece exclusivamente entre servidores. No habilita otras rutas
de /pruebas ni sustituye una sesión humana en la web.

El BFF valida primero su sesión Google y CSRF. Envía únicamente email de esa
sesión, projectId, venueId y channelId; nunca identidad/rol/destino del cliente.
AdmiraNext vuelve a consultar usuario activo, expiración, app contratada y ACL
commercial:<proyecto>. Viewer recibe sólo read; editor/admin autorizado puede
recibir read/add/remove. Una concesión de software no concede acceso comercial.

Canales: music o screen-<surfaceId>, con surfaceId [a-z0-9][a-z0-9-]{0,47}.
Next valida la gramática; TV verifica además la pertenencia de esa superficie
al inventario del establecimiento antes de crear o modificar una playlist.
No se recibe ni se firma un ID libre de pantalla física. El único alias de demo
Starbucks es demo-starbucks -> alsea-sbux-021; los demás locales son distintos.

Respuesta: scope canónico, proyecto/local, renderer derivado de URL registrada,
capabilities, grant y expiresAt. El grant HS256 dura 60 segundos y tiene
iss=admiranext-playlist-permission, aud=admira.tv:xpace-playlist, sub, scope,
context:{renderer,xpaceUrl,venueName,circuitId}, operations, sv, iat, exp y jti.
Firma: XPACE_PLAYLIST_GRANT_SECRET, sólo Next/TV. El helper compartido verifica
firma, caducidad, destino exacto y coincidencia de contexto/URL/ámbito. Los tokens
antiguos de /api/xpace/context siguen siendo de lectura y no sirven aquí.

Este servicio no guarda contenidos ni acredita entrega física. TV mantiene la
única autoridad D1 por establecimiento y canal. La interfaz está en Store;
la portada pública de AdmiraNext permanece fuera de esta entrega. El sello del
servicio está en serviceVersion; el despliegue global conserva su sello público.

EN
POST /pruebas/api/xpace/playlist-permission is a private Store BFF endpoint.
Canonical Store Origin and X-Admira-Playlist-Service-Key are both required.
The service credential opens no other test route or human web session.
After Store validates Google session and CSRF, Next checks the current active
directory user, expiry, app entitlement and commercial project ACL. Viewers get
read only; authorized editors/admins get read/add/remove. Software grants do not
grant commercial access. Request fields are email/projectId/venueId/channelId.

The HS256 grant lasts 60 seconds and binds the exact canonical venue/channel, operations and
server-derived context. TV separately validates that the surface belongs to the
registered venue inventory; arbitrary physical screen IDs are never accepted.
The signed context URL uses canonical Admira Store and matches project/venue/
circuit. Read-context tokens cannot act as write grants. The two independent
service/signing secrets remain server-side. Every new issue rechecks the current
directory permissions; an issued grant expires within 60 seconds.

This service neither owns playlist content nor confirms a physical player
receipt. TV's existing D1 model remains the single authority. Public Next pages
are unchanged; serviceVersion identifies this private /pruebas release.
