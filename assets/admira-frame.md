# Armazón cuadrático de admiranext.com (`assets/admira-frame.js` + `.css`)

Canon de la Galaxia (el mismo de admira.app, Pixeria, XpaceOS y Yokup; FLT-101373, 2-oct-2026):

- **☰ Opciones** abre el panel vertical IZQUIERDO: navegación y enlaces que llevan a otra página.
- **▤ Avanzado** abre el panel vertical DERECHO: lo que trabaja sobre la página (acciones, filtros que no son de diario, atajos a secciones).
- **⌘ Experto** abre la franja horizontal INFERIOR: el CLI.
- Paneles **independientes** (pueden estar abiertos a la vez) que **se superponen** al contenido en cualquier ancho, con su fondo, borde y sombra; **entran cerrados** en cada página; **Esc** cierra el panel que tiene el foco o, si no lo tiene ninguno, el último que se abrió; un clic fuera de ellos los cierra. Sin scroll horizontal en móvil.

### El contenido no se desplaza — OBLIGATORIO

Carlos (3-oct-2026): «el cuerpo central del site (contenido) no se desplaza al abrir las barras opcionales, ni verticales ni la horizontal inferior». Hasta ese día, en ≥1100 px los paneles se **acoplaban** (`--yk-dock-l`, `--yk-dock-r`, `--yk-bottom` apartaban el `<body>` y el globo de /analitics se redimensionaba): en /flota, abrir ☰ empujaba todo a la derecha. Ahora:

- ☰ ▤ ⌘ flotan encima del contenido; el contenido no cambia de posición ni de ancho, sin reflow. El `<body>` sólo baja el alto de la cabecera (`--yk-bar-h`), que no depende de los paneles.
- Ya **no se recuerdan abiertos** entre páginas (antes `localStorage` `admiranext_frame_panels_v1`, que el armazón ahora borra): al superponerse, reabrirlos al entrar taparía la página nada más cargar. Lo que sí se recuerda es su **tamaño**.
- Con ⌘ abierta, el aviso de versión (`.admira-version`, fijo abajo a la derecha) sube por encima de la franja en vez de quedar tapado.
- Guardián: `test/admira-frame-superpuesto.test.js` (ninguna hoja del sitio cambia nada que no sea un panel según `.yk-open-*`; el armazón, ejecutado en una pantalla ancha, no toca el `<body>` ni el contenido al abrir y cerrar cada panel).

### Pie de los paneles: la versión viva

El pie de ☰ y ▤ dice `ADmiraNeXT · v.DD.MM.AAAA.rN.HH:MM` de **`/version.json`** (el manifiesto que genera cada publicación); mientras llega, o si no existe (en local), el `<meta name="admiranext-version">` de la página. Antes leía sólo el meta, que se queda viejo en las páginas que nadie toca (/flota decía `v.02.10.2026.r10` con producción en la r3 del 3-oct).

Hasta el 2-oct los glifos eran ⋯ y ⌄ y abrir un panel cerraba los otros; `test/presentation-gallery-quadratic-ux.test.js` vigila ahora el canon.

### Paneles redimensionables — OBLIGATORIO

Carlos (2-oct-2026): «en la UX cuadrática siempre tienen que ser resizables las ventanas de opciones, avanzado y experto». Toda página con el armazón los tiene sin hacer nada (lo pone `admira-frame.js`, en los dos modos); una interfaz cuadrática que no use el armazón tiene que dar lo mismo.

- Tirador en el borde **interior**: ☰ su borde derecho, ▤ su borde izquierdo, ⌘ su borde superior. Ratón, dedo (`pointer`) y **teclado**: es un `role="separator"` enfocable con `aria-valuenow/min/max`; flechas = 16 px (Mayús = 64), Inicio/Fin = mínimo/máximo, **Intro o doble clic = tamaño por defecto**.
- Límites: laterales de 220 px a `min(760 px, 60 % del ancho)` (en ≤720 px, hasta el 92 %); ⌘ de 120 px hasta el alto de la ventana menos la barra y 60 px.
- El tamaño se **recuerda entre páginas** (`localStorage` `admiranext_frame_sizes_v1`, `{left, right, bottom}` en px) y se recorta, sin olvidarlo, si la ventana encoge. Llega a CSS como `--yk-w-left`, `--yk-w-right` y `--yk-h-bottom` en el `<html>`; sin ellas mandan `--yk-rail-w` / `--yk-rail-h`." Cambiar el tamaño de un panel tampoco mueve el contenido.
- API: `AdmiraFrame.tamano('left'|'right'|'bottom', px|null)` (`null` = por defecto).

### Logotipo — OBLIGATORIO

La marca es el logotipo oficial (`libro-de-estilo.html` §7.4): «ADmira» en blanco y **N** `#FF3366` · **e** `#FFCC00` · **X** `#33FF99` · **T** `#FF33CC`, en una sans gruesa, sobre oscuro. En modo barra lo pinta el armazón; en modo cabecera la página lo trae en su `<a class="brand">` (marcado `yk-wm-*`) y, si no, el armazón lo sustituye. Nada de «admiraNeXT.» en minúscula con punto.

## Modo barra (por defecto) — `/mcp/` y `/mcp/generador` (y, en modo automático, el resto del sitio)

Hasta el 3-oct-2026 también `/presentaciones/` (el generador) y `/presentaciones/galeria`: ahora llevan la barra de la intranet (modo cabecera, ver «La familia de /analitics»).

El armazón crea su propia barra fija: `[☰] ADmiraNeXT · RÓTULO · secciones … [▤] [⌘]`. La página declara qué va a cada lado:

```html
<body data-yk-title="PRESENTACIONES" data-yk-rail-left="OPCIONES" data-yk-rail-right="AVANZADO">
  <section data-yk-slot="left">…</section>     <!-- ☰ -->
  <section data-yk-slot="right">…</section>    <!-- ▤ -->
  <section data-yk-slot="bottom">…</section>   <!-- ⌘ -->
  <nav data-yk-slot="nav" hidden><a href="…">…</a></nav>  <!-- secciones en la barra -->
```

- **Logotipo**: la marca de la barra es el logotipo oficial (`libro-de-estilo.html` §7.4, el de la portada `.titlebar-brand`): «ADmira» en blanco y **N** `#FF3366` · **e** `#FFCC00` · **X** `#33FF99` · **T** `#FF33CC`, en una sans gruesa, sin efectos. Hasta el 2-oct era texto plano «ADmiraNeXT» en monoespaciada.
- `<body data-yk-cli="on">` añade el CLI a ⌘ también en modo barra; los verbos se registran igual que en modo cabecera (`window.ADMIRA_FRAME_VERBS`).
- `/mcp/generador` declara sus slots en su HTML (verbos `/seccion /tools /copiar /endpoint /manifest`).

## Modo automático — el resto de admiranext.com (`<body data-yk-auto="on">`)

Ronda 3 del PR #34 (Carlos, 2-oct-2026): toda página de admiranext.com con cabecera propia pasa al armazón. Es el modo barra sin escribir slots:

```html
<html lang="es" class="yk-framed">            <!-- opcional: evita el salto al cargar; el armazón la pone igual -->
<link rel="stylesheet" href="/assets/admira-frame.css?v=<sello>">
<body data-yk-title="ACADEMIA" data-yk-auto="on">
  …   <!-- sin cabecera de marca propia: la marca es la de la barra -->
  <script defer src="/assets/admira-frame.js?v=<sello>"></script>
```

- **☰ Opciones**: el mapa del sitio (`SITIO` en `admira-frame.js`; la página puede sustituirlo con `window.ADMIRA_FRAME_SITIO`), con la página actual marcada. La home no se repite: su camino es la marca. Lo que la página declare en `data-yk-slot="left"` (los enlaces de su antigua cabecera, en bloques `.yk-auto-blk`) va delante.
- **▤ Avanzado**: «Acciones», un botón por cada `[data-yk-accion="Rótulo"]` de la página que pulsa el original (presupuestos: Nuevo, Duplicar…; benchmarks: Descargar PDF), y «Ir a», los `<h2>` del contenido (`data-yk-secciones` cambia el selector), rehecho cada vez que se abre ▤ porque hay páginas que pintan sus secciones después de cargar.
- **⌘ Experto**: el CLI, con `/ir <página>`, `/seccion <n|texto>` y `/arriba` además de `/help` y `/limpiar`.
- Paleta oscura fija (`html.yk-auto`): el logotipo oficial va siempre sobre oscuro, aunque la página sea de papel (impacto, benchmarks). Al imprimir, el armazón no sale.
- Lo que una página tenga pegado arriba (`position: sticky; top: 0`) baja a `top: var(--yk-bar-h)`.

| Página | Qué se hizo con su cabecera |
|---|---|
| `academia`, `consejero`, `mandamientos`, `normativa`, `help/`, `marcablanca/` (+ `propuesta/`), `telegram/`, `tiktok/publicar/`, `credits-generator`, `filosofia`, `businessplan/` | cabecera de contenido (hero): se queda; se quita el «← admiranext.com» duplicado |
| `consejo/`, `informes/`, `presites/` (+ `generador/`), `tiktok/` (+ `xtore.html`), `presentar`, `informes/handon-…` | barra de marca propia fuera; sus enlaces a ☰ |
| `creditos/`, `impacto/` | barra fuera; su aviso, la campaña y el botón de idioma (se mueve con su id) a ▤ |
| `presupuestos/` | sin marca; la barra de herramientas se queda bajo la del armazón y sus botones se repiten en ▤ |
| `signage-benchmarks` | barra «digital signage benchmarks.» fuera; «Descargar PDF» a ▤ |

**Excepciones** (guardián: `test/admira-frame-sitio.test.js`):

- `/status` tiene su propio marco de cuatro barras (3.800 líneas, columnas en flujo que reencuadran el canvas). Conserva el marco, pero con el logotipo oficial, los glifos del canon (▤ ⌘ en vez de ⚙ >_) y sus asas, que ya se arrastraban y restauraban con doble clic, ahora también por teclado (`role="separator"`, flechas, Inicio/Fin, Intro). Sus tamaños siguen en `admira_pf_w_left/_right/_h_bottom`.
- `/game/` (Xpacio del Consejo) es un juego a pantalla completa que escucha WASD, E y M en todo el documento: un CLI encima movería al personaje al escribir. Sólo cambia el logotipo de su HUD (y la marca pasa a ser el enlace a la home).
- Fuera de alcance: la portada, el libro de estilo, los decks y presentaciones de clientes (`presentaciones/*`, `presentations/*`, las Functions `presentaciones/[client]`, `presites/[site]` y el mando), las redirecciones (`bots/`, `classic.html`) y la web clásica (`old/`).

## Modo cabecera — `/analitics` y sus derivadas

La página conserva SU cabecera y el armazón inserta los iconos en su sitio:

```
[☰] ADmiraNeXT · Analitics · Webmaster · Proyectos · … ● Acceso privado [▤] [⌘]
```

```html
<link rel="stylesheet" href="/assets/admira-frame.css?v=<sello>">   <!-- después del CSS de la página -->
<script defer src="/assets/admira-frame.js?v=<sello>"></script>
…
<body data-yk-frame="cabecera">
<header class="yk-head" data-yk-head>
  <a class="brand" href="/" aria-label="ADmiraNeXT · Inicio"><span class="yk-wm-admira">ADmira</span><span class="yk-wm-next"><span class="yk-wm-n">N</span><span class="yk-wm-e">e</span><span class="yk-wm-x">X</span><span class="yk-wm-t">T</span></span></a>  <!-- único enlace a la home -->
  <nav aria-label="Navegación del grupo">
    <a href="/analitics" data-yk-admin>Analitics</a><a href="/webmaster">Webmaster</a><a href="/proyectos/">Proyectos</a>
    <a href="/usuarios" data-yk-admin data-yk-rail-only>Usuarios</a>      <!-- data-yk-rail-only: sólo en ☰ -->
    …
  </nav>
  <span class="private" data-yk-access="privado">●<span class="yk-access-txt"> Acceso privado</span></span>
</header>
<div class="yk-slots" hidden>
  <div data-yk-slot="right" data-yk-label="Acciones">…</div>            <!-- data-yk-label: rótulo del bloque -->
</div>
```

- ☰ va antes de la marca; ▤ y ⌘ justo después de `[data-yk-access]`. La página actual se marca con `aria-current="page"`.
- La navegación de la cabecera se copia en ☰; en ≤720 px la barra la esconde y deja ☰, la marca, el punto de acceso, ▤ y ⌘.
- La cabecera se fija arriba y mide su alto en `--yk-bar-h`. Los paneles se **superponen** en cualquier ancho (el contenido no se mueve, ver «El contenido no se desplaza») y un clic fuera los cierra (salvo en un control con `data-yk-toggle`).
- `data-yk-access="publico"` («○ Página pública») para las páginas que se sirven sin sesión: la barra no dice «privado» de lo que no lo es.
- Los nodos con `data-yk-slot` se **mueven** (no se copian): conservan sus ids y manejadores.

### ⌘ Experto: el CLI

En modo cabecera (o con `<body data-yk-cli="on">`) la franja inferior trae un CLI: salida, línea de órdenes, historial ↑/↓ (`admiranext_frame_cli_history_v1`) y Tab para completar. Verbos comunes: `/help` (se genera del registro), `/limpiar`, `/ir <página>` (navegación del grupo). La página añade los suyos:

```js
// antes de cargar el armazón (script en línea, o defer colocado antes de admira-frame.js)
window.ADMIRA_FRAME_VERBS = (window.ADMIRA_FRAME_VERBS || []).concat([
  {id: 'periodo', aliases: ['p'], uso: '<ahora|hora|hoy|7|30>', ayuda: 'Cambia el periodo', run(args, ctx) { … ctx.imprimir('…'); }}
]);
// o después: AdmiraFrame.verbo({...})
```

`ctx` ofrece `imprimir`, `error`, `json`, `abrir(lado, valor)` y `limpiar`. `window.AdmiraFrame` expone `verbo`, `ejecutar`, `abrir`, `abierto` y `glifos`.

## La familia de /analitics

| Página | Estado | ☰ Opciones (además del grupo) | ▤ Avanzado | ⌘ verbos propios |
|---|---|---|---|---|
| `analitics/index.html` | adopta · privada | Cómo mide Cloudflare ↗ | Carbono/Silicio, Actualizar, globo, JSON, Ir a | `/periodo /ahora /site /audiencia /refrescar /buscar /globo /estado /json` |
| `webmaster.html` | adopta · privada | — | Sesión + Salir, ordenar la tabla, Ir a | `/ordenar /seccion /proyectos /sesion` |
| `usuarios.html` | adopta · privada | — | Cerrar sesión, Ir a | `/buscar /rol /estado /alta /cuenta` |
| `xpace/manage.html` | adopta · privada | Backoffice ↗, API ↗ | Ir a | `/proyecto /locales` |
| `proyectos/index.html` | adopta · pública | /help, /mcp, Yokup ↗ | Ir a, volver a leer el censo | `/buscar /censo /seccion` |
| `flota.html` | adopta · pública | Yokup marcador ↗, misiones ↗ | Refrescar, Ir a | `/refrescar /misiones /seccion` |
| `/github` | excepción | HTML generado por `functions/github.js`, sin scripts (zona militarizada). | | |
| `presentaciones/generador.html` (`/presentaciones/`) | adopta · privada | bloque «Presentaciones»: Generador, Galería, Control de accesos, Marca blanca, MCP del generador ↗ | Estado de producción, Validar, Copiar configuración, Ir a (secciones del formulario) | `/validar /config /estado /seccion /galeria /accesos` |
| `presentaciones/index.html` (`/presentaciones/galeria`) | adopta · privada | bloque «Presentaciones»: Generador, Galería, Gestión de usuarios · accesos; «Vista del repositorio» | Control editorial | `/buscar /vista /fecha /pestana /generador /accesos` |

En webmaster los enlaces `data-yk-admin` nacen ocultos y los muestra la sesión si es de administrador.

### Presentaciones (3-oct-2026)

Carlos: «que Presentaciones lleve también la barra de la intranet» y «la coherencia: la barra superior tiene que ser igual en todas las páginas de un sitio». El generador y la galería dejaron el modo barra (rótulo «GENERADOR», pestañas propias, sin «Acceso privado») y llevan la cabecera de la familia carácter a carácter (la de /analitics; la de /proyectos/ sólo cambia en «○ Página pública»), con «Presentaciones» marcada en las dos.

- Sus enlaces propios (antes pestañas de la barra y «Nivel 01 · Navegación») van a **☰**, en el bloque `data-yk-label="Presentaciones"` **bajo la navegación del grupo**, como «Cómo mide Cloudflare» en /analitics. No como `data-yk-rail-only` en la nav: la nav del grupo es idéntica en todas las páginas y el guardián lo exige.
- Generador: la cabecera y los contenedores de los paneles están en `presentaciones/generador.html`; `assets/presentation-generator-quadratic.js` (inyectado por `functions/presentaciones/generador.js` antes que el armazón) rellena ▤ y registra los verbos de ⌘. La puerta (`functions/presentaciones/_middleware.js`), la propuesta automática, el panel prospect y el bundle no cambian.
- Las presentaciones de cliente (`/presentaciones/<slug>/…`) siguen sin barra.

Guardián: `test/familia-analitics-cuadratica.test.js`. Descubre la familia (destinos de la puerta de login, Functions que sirven HTML tras exigir sesión —también las de `functions/presentaciones/` tras su puerta propia—, navegación del grupo y cualquier página que diga «Acceso privado») y exige que cada miembro adopte la barra o figure en `EXCEPCIONES` con su motivo; ejecuta el armazón sobre la cabecera real de cada página y comprueba el orden `☰ · marca · nav · acceso · ▤⌘`, la navegación en ☰, que ▤ tenga contenido y que `/help` liste los verbos. Las páginas que sirve una Function (el generador) se comprueban tal como las entrega. Un test aparte compara la cabecera del generador y de la galería con la de /analitics y /proyectos/.
