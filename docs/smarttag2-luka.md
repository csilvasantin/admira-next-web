# Luka · puente SmartTag2 · #7195

## Entregado

El mapa privado `/pruebas/mapa/` reconoce `equipo:luka`, nombre/label `Luka`,
`tipo:smarttag2`. Usa un icono violeta con forma de etiqueta, distinto del móvil
y del ordenador. **Demo** muestra Luka sobre una posición sintética de Barcelona,
con «Dato de prueba». No escribe al KV ni finge avisos, batería o hora del tag.

En Datos reales Luka aparece sin coordenadas hasta recibir la primera medición.
No se dispone en esta entrega de una posición verificada del Fold: la demo no
se presenta como la ubicación del Fold ni como la del perro. Si se obtiene una
referencia del teléfono, debe seguir siendo un mock y no un aviso del SmartTag.

## Contrato listo para el adaptador

`POST /api/ubicacion/smarttag2` · JSON · Bearer `UBICACION_KEY_SMARTTAG2`.
El secreto es independiente del iPhone, de mínimo 32 caracteres, y se configura
como secreto de Pages en el entorno correspondiente. Ausente o incorrecto: 401.
No se ha creado ni rotado ninguna credencial Samsung ni del mapa.

```json
{
  "label": "Luka",
  "tipo": "smarttag2",
  "latitude": 41.3955,
  "longitude": 2.172,
  "accuracy": 35,
  "timestamp": "2026-10-28T20:00:00Z"
}
```

Es un ejemplo sintético del **contrato propio del puente**, no el esquema de una
API Samsung. `battery` es opcional (0–100); `accuracy` es obligatoria: un número
en metros o `null` explícito cuando la fuente no facilita precisión. No omitirla
ni sustituirla por cero o por la precisión de Demo. El feed conserva `null` y la
tarjeta muestra «Precisión: No disponible», sin dibujar un círculo supuesto.
Esto no cambia el contrato del iPhone, que sigue exigiendo precisión numérica.
Las coordenadas son números, no cadenas. `timestamp` debe ser el instante de la
medición real, ISO con zona o Unix (s/ms), con máximo 24 h de retraso y 5 min de
adelanto. No sustituir la fecha de la medición por la fecha de consulta.

`functions/_smarttag2.js` normaliza latitude/longitude a lat/lon del feed, fija
`fuente:smartthings-find` y valida etiqueta/tipo. Se rechazan otros campos.
Éxito: 201 con equipo, label, tipo, ts y recibido_en. Errores: 400 datos,
401 clave, 413 tamaño (>2048 bytes), 415 formato, 503 KV y 405 otro método.

Se reutiliza el histórico inmutable de `UBICACIONES`: avisos desordenados no
pisan el más reciente, caducidad de siete días y aviso desactualizado tras dos
horas. `GET /api/ubicacion` sigue exigiendo sesión del directorio; las claves de
escritura del tag y del iPhone no permiten leer ubicaciones ni escribir por el
otro dispositivo. Todas las respuestas son `private, no-store`.

## Stub de Samsung: pendiente de acceso real

La adquisición autenticada desde Samsung queda pendiente: esta PR no contiene
un cliente que suponga endpoints de SmartThings Find, un scraper ni un token.
La entrada del adaptador es `normalizarSmartTag2(input)` y su salida persiste en
el endpoint anterior. El mock queda exclusivamente en `sample()` de la UI.

La [guía oficial de la API SmartThings](https://developer.smartthings.com/docs/getting-started/quickstart)
documenta PAT para exploración y OAuth para integraciones duraderas. Ese acceso
no demuestra por sí solo que la cuenta permita leer las coordenadas de un
SmartTag2. El [soporte de SmartThings Find](https://support.smartthings.com/hc/en-us/articles/10863369660052-SmartThings-Find)
describe la consulta del tag desde la aplicación; no establece un endpoint
público de ubicación que esta entrega pueda utilizar con certeza.

Checklist antes de conectar datos reales:

- Confirmar en la cuenta Samsung propietaria que Luka está emparejado y tiene
  una posición y fecha visibles en SmartThings Find.
- La API pública de SmartThings no expone la geolocalización de SmartTags,
  según [su soporte de desarrollo](https://community.smartthings.com/t/smartthings-api-how-to-access-device-locations-for-view-in-map/297805).
  Un PAT u OAuth genérico no resuelve este acceso. No crear esas credenciales
  como si fueran una autorización de lectura de Find.
- En Samsung Find, los SmartTags aparecen bajo «Artículos». La ficha web puede
  mostrar dirección y fecha sin ofrecer coordenadas o precisión numéricas;
  «Información del dispositivo» puede limitarse al modelo. El enlace general
  de Google Maps corresponde al área visible y no prueba la posición del tag.
- Verificar una fuente autorizada que entregue las coordenadas del **tag**.
  Un filtro local por identificador no equivale a un permiso Samsung limitado
  a Luka: las sesiones Find o credenciales de clientes no oficiales pueden
  acceder a otros dispositivos. Revisar su alcance antes de crear acceso
  persistente. Conservar los secretos sólo en el Mac, nunca en la web del mapa.
- Probar refresh, revocación, permisos insuficientes, timeout y respuesta sin
  coordenadas. Si no hay una API documentada habilitada, mantener el stub y
  acordar una fuente autorizada antes de programar sondeos.
- Traducir la respuesta real al contrato, conservando timestamp y precisión.
  Un proveedor sin datos no genera avisos ni recurre silenciosamente al mock.
- Configurar `UBICACION_KEY_SMARTTAG2` separada por entorno. El emisor usa HTTPS
  y recibe la clave por un secreto; nunca como argumento de shell o query.
- Verificar POST 201, lectura privada de Luka y marcador sobre esa medición.
  Sólo entonces declarar conectado el circuito Samsung → Silicio.

## Verificación

Pruebas: `node --test test/ubicacion.test.mjs test/mapa-ubicacion-ui.test.mjs test/mapa-5612.test.mjs`.
Incluyen autenticación por dispositivo, validación, retención, orden temporal,
lectura con sesión y render de Luka real/mock. Revisión visual local en IAB:
Luka visible como etiqueta violeta y tarjeta «Dato de prueba», sin cambiar el
tamaño o posición de la ventana. No demuestra una medición del SmartTag físico.
