# Marca blanca · Galaxia Admira

**Página:** https://www.admiranext.com/marcablanca

Una sola hoja de estilos para que las cuatro webs de la Galaxia Admira se vistan con la marca de cada cliente:

| Web | Qué hace | `data-mb-plataforma` | Modo nativo |
|---|---|---|---|
| **Admira.Studio** · admira.studio | **crea** los contenidos | `studio` | oscuro |
| **Admira.store** · admira.store | los **distribuye** a cada superficie | `store` | oscuro |
| **Admira.app** · admira.app | los **comercializa** (DOOH por circuito y CPM) | `app` | oscuro |
| **yokup.com** | **mantiene** el IoT (incidencias) | `yokup` | claro |

## Qué hay en esta carpeta

```
marcablanca/
├── marcablanca.css        tokens --mb-* (Admira por defecto) + componentes .mb-* + puentes a cada web
├── marcablanca.js         cargador: elige el cliente y aplica sus tokens, logo, favicon, fuentes y tono
├── marca.js               utilidades compartidas navegador/servidor (crearMarca, propuestaDesdeDatos…)
├── logo-paleta.js         paleta de un logo en el navegador (la comparten /marcablanca y el generador)
├── propuesta.js           «Tu marca · introduce una URL» en la página de demostración
├── clientes/              SEMILLA del catálogo único (estáticos del repo, respaldo si la API cae)
│   ├── index.json         lista de clientes, marca por defecto y mapa dominio → cliente
│   ├── esquema.json       JSON Schema de un cliente
│   ├── admira.json        marca por defecto (con el aspecto nativo de cada web)
│   ├── lumbre.json        EJEMPLO · marca ficticia · cafeterías
│   ├── brumelle.json      EJEMPLO · marca ficticia · moda
│   └── frescaria.json     EJEMPLO · marca ficticia · supermercados
├── logos/                 logos y favicons SVG
├── fuentes/               fuentes OFL autoalojadas (ver LICENCIAS.md)
├── index.html, demo.css, demo.js   la página de demostración
└── README.md              esta guía
```

> Lumbre Café, BRUMELLE y Frescaria Supermercados son **marcas inventadas** para enseñar el sistema.
> No representan a ninguna empresa real. Llevan `"ejemplo": true` en su JSON.

## Adoptarlo en una web (3 pasos)

### 1. Incluir la hoja y el cargador

En el `<head>`, **después** del CSS propio de la web:

```html
<link rel="stylesheet" href="https://www.admiranext.com/marcablanca/marcablanca.css">
<script src="https://www.admiranext.com/marcablanca/marcablanca.js"
        data-mb-plataforma="studio" data-mb-modo="nativo" defer></script>
```

Cambia `studio` por `store`, `app` o `yokup` según la web. Los JSON se sirven con
`Access-Control-Allow-Origin: *`, así que funciona desde cualquier dominio.

### 2. Marcar los huecos de marca

```html
<a class="mb-logo" data-mb-logo href="/" style="height:28px"></a>   <!-- logo del cliente (SVG en línea) -->
<span data-mb-nombre></span>                                       <!-- nombre del cliente -->
<button class="mb-btn mb-btn--primario" data-mb-frase="cta"></button> <!-- texto del tono de voz -->
```

El favicon y el `<meta name="theme-color">` se cambian solos. Las frases disponibles son
`cta`, `vacio`, `error` y `exito` (ver `tono.frases` en cada JSON).

### 3. Elegir el cliente

Por orden de prioridad:

1. `?marca=<id>` en la URL (se recuerda en la pestaña al navegar). Vale cualquier marca del
   **catálogo único**: las semillas y las guardadas después (analizadas por URL o desde el generador).
2. `data-mb-marca="lumbre"` en el `<script>` o en `<html>` (marca fija).
3. **Dominio**: el mapa `dominios` de `clientes/index.json` (p. ej. el dominio propio del cliente)
   o la convención `<cliente>.<web>`: `lumbre.admira.studio`, `lumbre.admira.store`,
   `lumbre.admira.app`, `lumbre.yokup.com`.
4. Si no hay nada: **Admira**.

El modo de color: `?modo=` o `data-mb-modo` = `marca` (el del cliente), `nativo` (el de cada web:
Studio/Store/App oscuro, Yokup claro), `claro`, `oscuro` o `auto` (el del sistema).

## Cómo lo usa cada web sin reescribir su CSS

`marcablanca.css` trae **puentes**: cuando el cargador aplica una marca y la web declara su
plataforma, sus variables de siempre pasan a leer los tokens del cliente.

| Web | Variables propias que se redirigen |
|---|---|
| Studio | `--bg --panel --ink --muted --line --line-bright --matrix --matrix-deep --xp` |
| Store / App | `--bg --ink --mut --dim --brand --accent --good --warn --card --card2 --line` |
| Yokup | `--p-paper --p-ink --p-muted --p-dark --p-green --p-accent --p-live --p-red --p-amber --p-line --p-soft --p-sans --p-head` y `--yk-*` |
| Todas | los tokens comunes `--admira-*` de admira-design (`tokens.css`) |

Si una pantalla usa colores escritos a mano (`#00ff41`, `#78f3ff`…), cámbialos por la variable
equivalente o directamente por un token `--mb-*`.

## Tokens

| Token CSS | Clave JSON | Para qué |
|---|---|---|
| `--mb-primario` / `--mb-primario-texto` | `colores.<modo>.primario` / `primarioTexto` | botón principal, enlaces activos |
| `--mb-secundario` / `--mb-secundario-texto` | `secundario` / `secundarioTexto` | botón secundario, subrayados |
| `--mb-acento` / `--mb-acento-texto` | `acento` / `acentoTexto` | marcadores, titulares destacados |
| `--mb-fondo` · `--mb-fondo-alt` | `fondo` · `fondoAlt` | fondo de página y de zonas |
| `--mb-superficie` · `--mb-superficie-alt` | `superficie` · `superficieAlt` | tarjetas y paneles |
| `--mb-borde` | `borde` | líneas y bordes |
| `--mb-texto` · `--mb-texto-suave` · `--mb-texto-tenue` | `texto` · `textoSuave` · `textoTenue` | jerarquía de texto |
| `--mb-ok` · `--mb-aviso` · `--mb-error` · `--mb-info` | `ok` · `aviso` · `error` · `info` | estados (en vivo, en curso, caída, programada) |
| `--mb-fuente-titulos` · `--mb-fuente-texto` · `--mb-fuente-mono` · `--mb-fuente-etiquetas` | `tipografia.*` | tipografías |
| `--mb-peso-titulos` · `--mb-titulos-transform` · `--mb-titulos-tracking` | `tipografia.pesoTitulos` … | carácter de los titulares |
| `--mb-radio-sm/md/lg/boton/pill` | `radios.*` | esquinas |
| `--mb-sombra-sm/md/lg` | `sombras.*` | profundidad |

Derivados automáticos: `--mb-ok-suave`, `--mb-aviso-suave`, `--mb-error-suave`, `--mb-info-suave`,
`--mb-primario-suave`, `--mb-acento-suave`, `--mb-primario-hover` y `--mb-foco`.

Componentes listos: `.mb-btn` (`--primario`, `--secundario`, `--acento`, `--borde`, `--fantasma`,
`--peligro`), `.mb-card` (`--alt`, `--realce`), `.mb-chip` (`--on`), `.mb-estado` (`--ok`, `--aviso`,
`--error`, `--info`), `.mb-input`, `.mb-select`, `.mb-textarea`, `.mb-tabla`, `.mb-nav`,
`.mb-eyebrow`, `.mb-logo` y `.mb-base` (fondo, texto y tipografía de la marca en un contenedor).

## Catálogo único de marcas

Una sola fuente de verdad para `/marcablanca`, el cargador `marcablanca.js` (y con él Studio/Pixeria,
Store/XpaceOS, App/ClearChannel y Yokup) y el generador de presentaciones.

| Pieza | Dónde | Qué guarda |
|---|---|---|
| **Semilla** | `clientes/*.json` (repo) | Admira y los tres ejemplos ficticios. Protegidas: la API nunca las sobrescribe. Se sirven aunque KV esté vacío o caído. |
| **Marcas guardadas** | KV `PRESENTATION_IDEAS`, clave `marca:<id>` | `{version, marca, catalogo}`; la metadata de la clave lleva el resumen para listar sin leer cada marca. |
| **Logos subidos** | R2 `PRESENTATION_MEDIA`, `marcas/<id>/logo.<ext>` | Servidos por `/marcablanca/api/marcas/<id>/logo` (CSP con sandbox, siempre como `<img>`). |

Se reutilizan los bindings que ya existían (no hay recursos nuevos de Cloudflare). Cada entrada
declara `catalogo.origen` (`semilla` · `url` · `generador`), `catalogo.tipo` (`real` · `ejemplo`),
`catalogo.propuesta` (true = propuesta automática, **no** la marca oficial), la web de origen, autor
(si había sesión; el correo no se publica) y fechas.

**API**

| Método y ruta | Acceso | Qué hace |
|---|---|---|
| `GET /marcablanca/api/marcas` | público (CORS `*`) | índice con el formato de `clientes/index.json` + `catalogo` por marca; `?completo=1` añade cada marca entera |
| `GET /marcablanca/api/marcas/<id>` | público (CORS `*`) | la marca con el esquema de `clientes/esquema.json` + `catalogo` |
| `POST /marcablanca/api/analizar` `{url}` | público, mismo origen, 12 análisis / 10 min por IP | propuesta de marca a partir de una web; **no guarda nada** |
| `GET /presentaciones/api/marcas` | sesión del generador | dice si quien mira puede guardar |
| `POST /presentaciones/api/marcas` `{marca, origen, tipo?, web?}` | sesión del generador (owner/editor, maestra/editor o token MCP de deepagent) | crea; 409 si ya existe o si es una semilla |
| `PUT /presentaciones/api/marcas` | ídem | actualiza una marca guardada (nunca una semilla) |

La escritura vive bajo `/presentaciones` porque la sesión del generador (cookie `pres_owner`) tiene
esa ruta: la valida el mismo `_middleware.js` que el resto de APIs del generador, sin contraseñas ni
puertas nuevas. Se valida contra el esquema, el id se normaliza a slug, el cuerpo máximo es 320 KB y
el logo solo puede ser `https://` o una imagen subida (`data:image`, ≤ 160 KB, que va a R2).

El cargador pide primero la API y, si no responde, los estáticos de `clientes/`. El panel
**Prospect** del generador lista desde la API y, al **Generar** con una «nueva marca», la guarda
también en el catálogo (origen `generador`); sin prospect, el generador no lee ni escribe el catálogo.

## «Tu marca · introduce una URL»

En el bloque **Elige un cliente** de `/marcablanca` se escribe la web de una marca y se pulsa
*Analizar*:

1. `POST /marcablanca/api/analizar` lee la web con el **mismo analizador** del generador
   (`functions/presentaciones/_inspiration.js`): logo (SVG de la cabecera o imagen, que se descarga
   y se devuelve como `data:`), color de tema, paleta de su CSS, fondo, modo, fuente y nombre
   (`og:site_name` o el trozo del `<title>` que casa con el dominio).
2. `marca.js → datosDesdeInspiracion()` y `propuestaDesdeDatos()` crean la **propuesta**: logo,
   primario, secundario, acento, fondo, tipografía (la OFL del catálogo más parecida a la detectada),
   modo y nombre, con contrastes legibles garantizados.
3. Se aplica al momento a las maquetas de las 4 patas y se puede ver como presentación
   (`POST /marcablanca/presentacion`, borrador sin guardar).
4. Se retoca a mano (nombre, colores, fondo, tipografía, modo), se descarga como JSON o, con sesión
   del generador, **Guardar en el catálogo** la deja con `?marca=<id>` en las 4 patas y en el generador.
   Sin sesión, el botón explica que hace falta entrar en el generador.

`/marcablanca/?web=https://www.marca.com` abre la página ya analizando esa web (no guarda nada).

Siempre consta como «Propuesta generada automáticamente a partir de &lt;url&gt;. No es la marca
oficial de &lt;marca&gt;»: en la página, en la descripción del JSON y en `catalogo.aviso`.

**Defensas del analizador** (`fetchPublico` en `_inspiration.js`, también para el generador):
solo `https` y puerto 443, sin credenciales en la URL; nunca IPs literales ni nombres locales o de
metadatos (`localhost`, `*.local`, `*.internal`, `metadata`…); el dominio se resuelve por DNS sobre
HTTPS y se corta si apunta a una red privada, de enlace local, CGNAT o reservada; redirecciones
seguidas a mano (máx. 4) revalidando cada salto; plazo total de 8 s y tope de 900 KB de HTML,
220 KB por hoja de estilos y 120 KB de logo. Si la web bloquea a los analizadores (401/403/429 o un
muro antibots) se dice tal cual, con el código HTTP: el analizador se identifica como
`ADmiraNeXT Inspiration Analyzer` y no se disfraza de navegador.

## Alta de un cliente nuevo

Lo normal ahora: analiza su web arriba y **Guardar en el catálogo** (o créala como «nueva marca» en
el generador). Para una marca fija del repo (semilla, protegida):

1. Copia `clientes/lumbre.json` a `clientes/<id>.json` (id en minúsculas, sin espacios).
2. Cambia nombre, colores de los dos modos (o solo uno), tipografías, radios, sombras y tono.
3. Sube su logo a `logos/<id>.svg` (mejor con `currentColor` en el texto) y su favicon.
4. Si usa una fuente propia, súbela a `fuentes/` y decláralo en `tipografia.fuentes`.
5. Añádelo a `clientes/index.json` (`clientes` y, si tiene dominio propio, `dominios`).
6. Pruébalo en https://www.admiranext.com/marcablanca/?marca=<id> (añadiéndolo al selector) o en cualquier web con `?marca=<id>`.

Comprueba el contraste: `primarioTexto` sobre `primario` y `texto` sobre `fondo` deben leerse bien
(mínimo 4,5:1 para texto normal).

## API del cargador (`window.MarcaBlanca`)

```js
MarcaBlanca.aplicar('lumbre', { plataforma: 'yokup', modo: 'nativo' });       // toda la página
MarcaBlanca.aplicar('brumelle', { objetivo: document.querySelector('#vista') }); // solo un contenedor
MarcaBlanca.variables('frescaria', { modo: 'oscuro' }).then(console.log);      // { '--mb-primario': … }
MarcaBlanca.listar().then(console.log);                                          // clientes de index.json
document.addEventListener('marcablanca:aplicada', (e) => console.log(e.detail.id, e.detail.modo));
```

Con `data-mb-auto="false"` en el `<script>` el cargador no se aplica solo (útil para previsualizar).

## Presentaciones para un prospect (generador de presentaciones)

El generador de `/presentaciones/` puede vestir una presentación entera con la marca del
**destinatario** (cliente potencial). Sin prospect, todo sigue exactamente igual: marca Admira.

**Uso**

1. Abre `/presentaciones/` y rellena el contexto del cliente como siempre.
2. En el panel **Prospect · marca del destinatario**, activa *Presentación para un prospect*.
3. Elige una marca del catálogo único (Lumbre Café, BRUMELLE, Frescaria y las guardadas) o **Nueva marca**:
   nombre, logo (subida ≤ 120 KB o URL `https://`), primario, secundario, acento, tipografía y modo.
   *Extraer paleta del logo* y *Extraer de la web* rellenan los colores solos; *Descargar JSON de
   cliente* genera el fichero con el esquema de `clientes/esquema.json`.
4. *Vista previa de la presentación* abre la demo con esa marca; **Generar** guarda la marca con la
   presentación (`presentation.prospect` en KV; el logo subido va a R2) y, si es nueva, también en
   el catálogo único (`marca:<id>`), con su logo público en `marcas/<id>/`.

**Qué se adapta**: colores (todas las calidades good/better/best), tipografías, logo (botón y
portada «Marca × ADmiraNeXT»), fondos, gráficos, una maqueta de Studio, Store, App o Yokup en cada
diapositiva que habla de esa plataforma y una diapositiva final «Su galaxia» con las cuatro.

**Demo pública** (misma presentación, contenido fijo): `/marcablanca/presentacion?marca=lumbre`,
`?marca=brumelle`, `?marca=frescaria`, cualquier `?marca=<id>` del catálogo y `?marca=admira` (sin prospect). En una presentación real,
`?marca=<id de catálogo>` previsualiza otra marca y `?marca=admira` la muestra en Admira.

**Código**: `marca.js` (tokens compartidos navegador/servidor), `maquetas.js|css` (maquetas de las
cuatro webs), `functions/presentaciones/_prospect.js` (resolución, guardado y render),
`assets/presentation-prospect.js|css` (panel). Retorno: `retorno/pre-presentaciones-prospect-20261001`.
Catálogo único y análisis por URL (FLT-101330): `functions/marcablanca/_catalogo.js`,
`functions/marcablanca/api/`, `functions/presentaciones/api/marcas.js`, `marcablanca/propuesta.js`.
Retorno: `retorno/pre-catalogo-marcas-20261001`.

## Propuesta comercial automática (FLT-101369)

Encargo de Carlos (02-10-2026): *«lanzar propuestas comerciales automatizadas al detectar una
oportunidad: se introduce una marca o idea, se hace un estudio de la compañía y se personaliza la
presentación y la plataforma con su desarrollo de marca en las 4 soluciones (Studio, Store, App y Biz)»*.

**Entradas** (las tres llaman a la misma API y exigen la sesión del generador):

- `/marcablanca` → sección **Lanzar propuesta**: un campo «marca, web o idea» y un botón; enseña el
  progreso por pasos (marca → estudio → presentación → plataforma) y el resultado. Sin sesión del
  generador explica que hay que entrar.
- `/presentaciones/` (generador) → panel **Propuesta automática**, equivalente.
- MCP de admiranext.com → `lanzar_propuesta {url?, marca?, idea?, idioma?, destinatario?, rehacer?}` y
  `estado_propuesta {id}` (ayuda: `help` tema `propuesta`), autenticadas con el token `anmcp_…` como el
  resto. HTTP directo: `POST /presentaciones/api/propuesta` con el mismo token o con la clave de máquina.

**Cuándo usarla**: siempre a petición de alguien o con un criterio comercial claro (una oportunidad
concreta detectada por una persona o por un agente). **Nunca en bucle, por lotes ni «por si acaso»**.
No hay ningún disparo automático en segundo plano: «detectar la oportunidad» es cosa de quien llama.

**Pasos** (`functions/presentaciones/_propuesta.js`; idempotentes por id: relanzar continúa donde iba y
no repite lo hecho; `rehacer:true` lo rehace todo):

1. **Marca** — con web: el mismo analizador de «Tu marca · URL» (`analizarMarca` → `propuestaDesdeDatos`);
   con un id del catálogo: esa marca tal cual; con solo un nombre: prueba `www.<nombre>.com|.es` y solo
   la acepta si su título contiene el nombre (queda como *web deducida*); si no, o con solo una idea,
   **marca neutra pendiente de logo**. Se guarda en el catálogo con `catalogo.origen = "propuesta"` y
   `propuesta: true`. Nunca pisa una semilla ni una marca curada: **admira.com → id `admira-com`**, que
   la UI presenta como la marca corporativa de admira.com, distinta de `admira` (la marca por defecto
   de la plataforma).
2. **Estudio** (`functions/presentaciones/_estudio.js`) — portada y hasta 4 páginas internas (quiénes
   somos, soluciones, clientes, contacto/tiendas) con el mismo `fetchPublico` endurecido (≤ 400 KB y
   8 s la portada, 6 s cada interna). Lo sintetiza **xAI** (`XAI_TEXT_MODEL`, la clave que ya usa el
   generador; sin proveedores ni claves nuevas) con salida JSON de esquema cerrado: resumen, sector,
   propuesta de valor, presencia, público, canales, retos probables y una oportunidad por solución
   (Studio contenido · Store distribución e inventario · App comercialización y circuitos DOOH · Biz
   mantenimiento y comercios/instaladores). Cada afirmación es `hecho` **solo si cita una URL leída**;
   lo demás es `hipotesis` (los retos, siempre). Confianza = la del modelo, como mucho la que permiten
   las fuentes. KV `estudio:<id>` con fecha. Si xAI falla: «estudio pendiente» honesto (como los
   `FALLBACK_*` del generador), reintentable hasta 3 veces.
3. **Presentación** — el `onRequestPut` de `/presentaciones/api/generate` tal cual (contraseña propia,
   versiones, traducción, prospect) con `prospect = la marca` y 7 láminas del estudio: contexto, retos,
   Studio, Store, App, Biz (cada una con su maqueta vestida) y piloto, y después «Su galaxia» y el
   cierre. Slug = id (o `<id>-propuesta` si ya hay una presentación ajena con ese nombre).
4. **Plataforma** — `https://www.admira.studio/?marca=<id>` (o pixeria.com), `admira.store` (xpaceos.com),
   `admira.app` (clearchannel.tv) y `admira.biz` (yokup.com), más `/marcablanca/?marca=<id>`.

**Página de la propuesta**: `/marcablanca/propuesta/<id>` — privada (los datos solo los da
`GET /presentaciones/api/propuesta?id=<id>` detrás de la puerta del generador): resumen del estudio
con fuentes y confianza, la marca (logo y paleta, con enlace para editarla en /marcablanca), la
presentación (URL y clave) y las 4 soluciones con su maqueta y su enlace.

**Coste y control**: cada propuesta hace **1 llamada a xAI para el estudio** (2 si la primera falla
rápido; ~5-7 k tokens de entrada con 5 páginas y ~1-1,5 k de salida) y **1 de traducción** en el alta
de la presentación (la misma que cualquier alta del generador). El guion no gasta llamada: las láminas
salen del estudio. Las lecturas de la web no tienen coste de IA. Precio: el de la tarifa vigente de
xAI para `XAI_TEXT_MODEL`. **Límite: 20 lanzamientos por usuario y día** (KV `propuesta-cupo:`;
continuar una propuesta ya lanzada no cuenta). Cada lanzamiento queda registrado (quién, cuándo, para
quién, por qué canal) en KV `propuesta-registro:<fecha>:<id>` (400 días) y en el log del worker
(`evento: propuesta-lanzada`).

**Local**: sin clave real, `XAI_API_URL=http://127.0.0.1:<puerto>/v1/responses` apunta a un simulador
(solo se acepta localhost/127.0.0.1; en producción se ignora). Retorno:
`retorno/pre-propuesta-automatica-20261002`.
