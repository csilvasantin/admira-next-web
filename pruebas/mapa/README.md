# Mapa privado de equipos · fase 1

Encargo #5594. Implementación en una rama de `admira-next-web`, con una PR sin
fusionar. La interfaz vive únicamente en `/pruebas/mapa/`; este trabajo no publica
el mapa en producción ni modifica su navegación pública.

Preview de la rama: <https://mapa-5594.admiranext.pages.dev/pruebas/mapa/>.
La preview está desplegada; sin sesión el mapa devuelve `401`. El emisor debe
usar **el mismo host**: `https://mapa-5594.admiranext.pages.dev/api/ubicacion`.

Ruta prevista tras una futura fusión y publicación autorizadas:
`https://www.admiranext.com/pruebas/mapa/`, con el emisor en
`https://www.admiranext.com/api/ubicacion`. Estas direcciones de producción no
forman parte de la entrega actual: también requerirían provisionar el secreto
de producción. No apuntar todavía el atajo a ellas.

## Acceso y alcance

- Todo `/pruebas/**`, incluidos HTML, scripts y datos de demo, pasa por la sesión
  Google y el directorio existentes de `functions/_webmaster-gate.js`.
- `POST /api/ubicacion` es una Pages Function para el equipo. Usa exclusivamente
  su Bearer; no necesita una cookie Google. Sin clave válida devuelve `401`.
- `GET /api/ubicacion` exige la sesión Google. El Bearer del iPhone no autoriza
  leer posiciones. Sin sesión responde `401` y no devuelve coordenadas.
- Respuestas del mapa y de la API: `private, no-store`, sin caché CDN y fuera de
  buscadores. No hay claves en HTML, JavaScript, URLs ni el repositorio.
- Preview dispone de `AUTH_DB`, firma de sesión y KV de ubicaciones separados.
  El callback Google existente apunta a `www.admiranext.com/webmaster`: una
  sesión de producción no abre por sí sola el host de preview. Hasta disponer
  de un callback autorizado para ese host, una sesión de prueba demuestra el
  control de acceso, pero no equivale a validar el login Google completo allí.

La fase 1 admite avisos sólo de `iphone-carlos` (iPhone 17 Pro Max de Carlos).
El Mac mini figura como `fijo`, con la dirección manual «Gran de Gràcia 51,
Barcelona», con la referencia cartográfica manual de OpenStreetMap
[nodo 11967748167](https://www.openstreetmap.org/node/11967748167):
`41.3993419, 2.1559172`. No es una medición GPS ni un aviso automático. Los móviles
son `movil` en el contrato JSON. El inventario se define en
`functions/_ubicacion.js`.

## Contrato del emisor

`POST /api/ubicacion`, `Content-Type: application/json`,
`Authorization: Bearer <UBICACION_KEY_IPHONE>`.

| Campo | Contrato |
| --- | --- |
| `equipo` | Obligatorio, exactamente `iphone-carlos`; otro equipo devuelve `401`. |
| `lat` | Número finito entre −90 y 90. |
| `lon` | Número finito entre −180 y 180. |
| `precision_m` | Número finito entre 0 y 100000, en metros. |
| `bateria` | Opcional; número finito entre 0 y 100, porcentaje. Omitir si no está disponible. |
| `fuente` | Texto obligatorio, de 1 a 64 caracteres, sin caracteres de control. Por ejemplo `atajo-ios`. |
| `ts` | Instante de la medición: ISO 8601 con zona horaria, o Unix numérico en segundos/milisegundos. Máximo 24 h de retraso y 5 min de adelanto. |

No se admiten otros campos, números escritos como cadenas, valores `null` en
campos obligatorios ni un cuerpo mayor de 2048 bytes. Se valida la clave antes
de leer el JSON. La clave configurada debe tener al menos 32 caracteres.

Éxito: `201` con `{ok:true,equipo,ts,recibido_en}`. `ts` y `recibido_en` se
normalizan a ISO UTC. Errores: `400` para datos/JSON inválidos, `401` para clave
o equipo no autorizado, `413` para tamaño, `415` para Content-Type, `503` si KV
no está disponible y `405` para métodos distintos de GET/POST. No se devuelve
ni registra la clave.

## Clave y ejemplo técnico seguro

El valor existente está en el Llavero de macOS del MacBook Pro 16, servicio
`UBICACION_KEY_IPHONE`, cuenta `TrinityMBP16`, y se provisiona como secreto de
Cloudflare Pages **preview**, con el mismo nombre. Para recuperarlo localmente,
se captura la salida de
`security find-generic-password -a TrinityMBP16 -s UBICACION_KEY_IPHONE -w`
en memoria; no se imprime ni se pasa como argumento visible de `curl`.

La escritura de ese mismo valor en la Cúpula devolvió `403 forbidden-need-admin`
con la credencial administrativa disponible. Por tanto, **no se afirma que esté
guardado en el vault**. Cuando se actualice dicha credencial y se confirme el
almacenamiento, la lectura desde otro equipo será
`bash ~/Claude/admira-vault/vault-get.sh UBICACION_KEY_IPHONE`, capturando su salida
sin imprimirla. No rotar ni inventar otra clave para completar este paso.

Este ejemplo envía deliberadamente una **posición sintética de prueba al
preview**. Su fuente la identifica; no demuestra que el iPhone haya informado.
Se ejecuta sólo cuando se quiera registrar ese ensayo en el KV de preview:

```bash
python3 - <<'PY'
import datetime, json, subprocess

key = subprocess.run(
    ['security', 'find-generic-password', '-a', 'TrinityMBP16',
     '-s', 'UBICACION_KEY_IPHONE', '-w'],
    check=True, capture_output=True, text=True,
).stdout.strip()
payload = {
    'equipo': 'iphone-carlos', 'lat': 41.40, 'lon': 2.16,
    'precision_m': 25, 'bateria': 80, 'fuente': 'prueba-sintetica-codex',
    'ts': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
}
config = '\n'.join([
    'url = "https://mapa-5594.admiranext.pages.dev/api/ubicacion"',
    'request = "POST"',
    'header = "Content-Type: application/json"',
    'header = ' + json.dumps('Authorization: Bearer ' + key),
    'data-binary = ' + json.dumps(json.dumps(payload)),
]) + '\n'
result = subprocess.run(
    ['curl', '--silent', '--show-error', '--fail-with-body',
     '--max-time', '20', '--config', '-'],
    input=config, capture_output=True, text=True,
)
body = json.loads(result.stdout)
print(json.dumps({k: body[k] for k in
                 ['ok', 'equipo', 'ts', 'recibido_en', 'error'] if k in body}))
raise SystemExit(result.returncode)
PY
```

El secreto viaja a `curl` por su configuración en stdin; no queda en un archivo
ni en su lista de argumentos. No usar `set -x`, `curl -v` ni copiar el valor a una
URL, captura, informe o ejemplo de código.

## Persistencia y lectura

Binding KV: `UBICACIONES`. Cada medición se guarda como evento inmutable bajo
`ubicacion:v1:iphone-carlos:…`, con tiempo invertido para consultar primero la
medición más reciente. Un aviso atrasado no sustituye a una medición posterior.
La última posición se calcula desde esos eventos; no hay una copia permanente
que sobreviva al histórico.

Cada evento expira como máximo siete días después de su medición y nunca más de
siete días desde su recepción si el reloj del emisor va adelantado. La lectura
también excluye mediciones fuera de plazo. KV tiene consistencia eventual: un
POST aceptado puede tardar en aparecer al leer desde otra región. Actualizar
la página o repetir la lectura posteriormente; no atribuir esa demora a un nuevo
aviso del iPhone. Referencia: [consistencia de Workers KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

`GET /api/ubicacion` devuelve `ok`, `generado_en`, `retencion_dias:7`,
`desactualizado_tras_h:2` y `equipos`. Cada equipo incluye su identidad, `tipo`,
coordenadas/precisión/batería/fuente, `ts`, `ultimo_aviso`, `recibido_en`,
`desactualizado` y `estado`. Los móviles sin aviso válido aparecen como
`sin_datos`; si la medición tiene **más de** dos horas, como `desactualizado`.
Los campos de posición ausentes son `null`. Un fijo usa `fuente:'manual'` y
`estado:'fijo'`; no inventa un «último aviso» de GPS.

## Interfaz y verificación pendiente

La página reutiliza el armazón cuadrático de AdmiraNeXT: ☰ Opciones, ▤ Avanzado,
⌘ Experto, `/marca` y `/idioma ES` / `/idioma EN`. `/demo mapa` y el botón Demo
usan datos sintéticos señalados como tales; no escriben en el endpoint. `/demo
off` vuelve a consultar datos reales. Leaflet se sirve desde `/pruebas/mapa/vendor/`.

Son comprobaciones distintas: prueba automática del contrato, POST técnico al
preview, lectura privada del dato recibido, demo sintética y aviso real desde
el teléfono. Sólo la última valida el circuito completo del dispositivo.

Las capturas de revisión del preview usan una **sesión fixture válida y de corta
duración**, sobre el directorio aislado de pruebas. Se identifica expresamente
como fixture y se revoca después de la captura. Esto comprueba el perímetro y
permite revisar la interfaz; no acredita un login real con Google ni una
ubicación enviada desde el teléfono. Las evidencias y los resultados concretos
se adjuntan a la PR para revisión antes de cualquier fusión.

Wozniak tiene pendiente preparar/activar el atajo real de iOS y verificarlo con
Carlos en el iPhone. Debe enviar ubicación y precisión disponibles, batería si
la hay, `fuente:'atajo-ios'` y la hora real de la medición al endpoint de preview.
Hasta recibir ese aviso y comprobarlo en la lectura privada, la integración
real del teléfono sigue pendiente. La configuración de una automatización y
su frecuencia se verifica en el propio iPhone; la demo no la sustituye.

## Resultado de la comprobación técnica

En Cloudflare preview: POST sin clave `401`; POST con la clave del Llavero
`201`; GET y las cuatro variantes de página/assets sin sesión `401`; GET con
sesión fixture `200` y lectura del aviso `fixture-no-iphone-5594`. No se ha
recibido una posición del iPhone real. La sesión fixture se revoca al cerrar QA.

En esta conexión, las IP `188.114.*` que resuelve `pages.dev` agotaron el plazo.
La comprobación usó otro edge de Cloudflare (`104.21.66.96`), conservando el
host original y la validación TLS. Esto no garantiza la conectividad del
dominio desde todas las redes móviles. No se modificó DNS ni producción.
