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
├── clientes/
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

1. `?marca=lumbre` en la URL (se recuerda en la pestaña al navegar).
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

## Alta de un cliente nuevo

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
3. Elige una marca de `clientes/*.json` (Lumbre Café, BRUMELLE, Frescaria…) o **Nueva marca**:
   nombre, logo (subida ≤ 120 KB o URL `https://`), primario, secundario, acento, tipografía y modo.
   *Extraer paleta del logo* y *Extraer de la web* rellenan los colores solos; *Descargar JSON de
   cliente* genera el fichero con el esquema de `clientes/esquema.json` para darlo de alta aquí.
4. *Vista previa de la presentación* abre la demo con esa marca; **Generar** guarda la marca con la
   presentación (`presentation.prospect` en KV; el logo subido va a R2).

**Qué se adapta**: colores (todas las calidades good/better/best), tipografías, logo (botón y
portada «Marca × ADmiraNeXT»), fondos, gráficos, una maqueta de Studio, Store, App o Yokup en cada
diapositiva que habla de esa plataforma y una diapositiva final «Su galaxia» con las cuatro.

**Demo pública** (misma presentación, contenido fijo): `/marcablanca/presentacion?marca=lumbre`,
`?marca=brumelle`, `?marca=frescaria` y `?marca=admira` (sin prospect). En una presentación real,
`?marca=<id de catálogo>` previsualiza otra marca y `?marca=admira` la muestra en Admira.

**Código**: `marca.js` (tokens compartidos navegador/servidor), `maquetas.js|css` (maquetas de las
cuatro webs), `functions/presentaciones/_prospect.js` (resolución, guardado y render),
`assets/presentation-prospect.js|css` (panel). Retorno: `retorno/pre-presentaciones-prospect-20261001`.
