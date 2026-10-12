# Atajo de iOS: ubicación horaria de Carlos

Envía la posición del iPhone a AdmiraNeXT cada hora. Alimenta el mapa de Silicio
y el parte horario.

## La clave

La clave es `UBICACION_KEY_IPHONE`. **No está escrita aquí.** Vive en el Llavero
del Mac mini, servicio `UBICACION_KEY_IPHONE`. Para copiarla sin mostrarla:

```bash
security find-generic-password -s UBICACION_KEY_IPHONE -w | pbcopy
```

(No la pegues en chats, notas ni capturas. Si se filtra, hay que rotarla en
Cloudflare y en el Llavero.)

## Crear el atajo

1. Abre **Atajos** → pestaña **Automatización** → **+** → **Hora del día**.
2. Hora: cualquiera; **Repetir: cada hora** (si tu iOS solo ofrece diario, crea
   una por hora o usa «Cuando llegue/salga de…»). Marca **Ejecutar inmediatamente**.
3. Acción **Obtener ubicación actual**.
4. Acción **Obtener detalles de ubicaciones** → *Latitud*, y otra para *Longitud*
   (variables `lat` y `lon`). Opcional: *Nivel de batería* con **Obtener nivel de batería**.
5. Acción **Obtener contenido de URL**:
   - URL: `https://www.admiranext.com/api/ubicacion`
   - Método: **POST**
   - Cabeceras:
     - `Authorization` = `Bearer ` + la clave pegada desde el Llavero
     - `Content-Type` = `application/json`
   - Cuerpo de la solicitud: **JSON** con estos campos:
     - `equipo` (texto): `iphone-carlos`
     - `lat` (número): variable `lat`
     - `lon` (número): variable `lon`
     - `precision_m` (número): `10` (o la precisión que dé iOS)
     - `bateria` (número, opcional): nivel de batería (0-100)
     - `fuente` (texto): `atajo-ios`
     - `ts` (texto): **Fecha actual** con formato **ISO 8601**
6. Desactiva **Preguntar antes de ejecutar** y guarda.

`lat`, `lon` y `precision_m` deben ser **números**, no texto, o la API responde
`400`. El `ts` no puede ser anterior a 24 h ni adelantarse más de 5 min.

## Probar

Ejecuta el atajo a mano. Respuesta correcta: `201` con `{"ok":true,...}`.
`401` = clave incorrecta; `400` con `*_invalido` = un campo mal formado.

## Lectura para el parte (solo servidor)

`GET /api/ubicacion/ultima` con `Authorization: Bearer <UBICACION_KEY_PARTE>`
(clave distinta, solo lectura). Devuelve `lat`, `lon`, `ciudad`, `hora`,
`antiguedad_min` y `estado`, o `estado:"sin_datos"`.
