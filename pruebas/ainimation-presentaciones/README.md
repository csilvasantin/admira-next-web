# Editor conectado de AINimation

La interfaz permanece bajo `/pruebas/ainimation-presentaciones/`. Reutiliza la
sesión de directorio y, para agentes, una cookie de una hora limitada a este
laboratorio. Cada petición comprueba la revocación y los permisos de edición.
Las APIs de lectura y escritura conservan el perímetro original del generador.

Cargar catálogo → elegir presentación e idioma → Abrir para afinar abre el
inspector en AINimation. Las muestras y el contenido real se identifican por
separado. El origen mantiene las credenciales; al inspector sólo se envía una
proyección de textos visibles y referencias de revisión, mediante origen,
ventana y canal exactos. Una URL sola no concede acceso ni edición.

Guardar en el generador relee el origen, reconstruye los campos admitidos y
convierte el changeset a la API original `inline-edit`. Esta API sincroniza los
idiomas y captura una versión anterior y posterior para las peticiones del
conector. La confirmación requiere una segunda lectura con la nueva revisión
y todos los valores guardados. Un error o conflicto conserva el borrador.
El control de concurrencia es optimista sobre la revisión de KV; no se promete
una transacción distribuida ni una escritura CAS.

El conector real guarda textos (hasta 20 ajustes por operación). Color y posición
siguen siendo campos de las muestras; no se anuncian como ajustes guardables del
generador. El preview es de contenido y no sustituye el diseño original ni sus
medios, decks, notas o comportamientos. Ningún dato real está en el repositorio.

`refinement/project.mjs` y `refinement/generator.mjs` se mantienen idénticos al
núcleo y al adaptador del repositorio AINimation. Las pruebas cubren proyección,
identidades, confirmación por relectura, conflictos y alcance de la sesión.

Prueba local: servir AINimation en 127.0.0.1:9134 y este checkout con sus APIs
ficticias en 127.0.0.1:9135; `?localPlayer=1` sólo funciona en loopback. La prueba
real utiliza los endpoints privados y permisos existentes, sin crear clientes.
