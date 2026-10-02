# Armazón cuadrático de admiranext.com (`assets/admira-frame.js` + `.css`)

Canon de la Galaxia (el mismo de admira.app, Pixeria, XpaceOS y Yokup; FLT-101373, 2-oct-2026):

- **☰ Opciones** abre el panel vertical IZQUIERDO: navegación y enlaces que llevan a otra página.
- **▤ Avanzado** abre el panel vertical DERECHO: lo que trabaja sobre la página (acciones, filtros que no son de diario, atajos a secciones).
- **⌘ Experto** abre la franja horizontal INFERIOR: el CLI.
- Paneles **independientes** (pueden estar abiertos a la vez), estado **recordado** entre páginas (`localStorage` `admiranext_frame_panels_v1`; se restaura sólo donde se acoplan, para no tapar un móvil al entrar), **Esc** cierra el panel que tiene el foco o, si no lo tiene ninguno, el último que se abrió. Sin scroll horizontal en móvil.

Hasta el 2-oct los glifos eran ⋯ y ⌄ y abrir un panel cerraba los otros; `test/presentation-gallery-quadratic-ux.test.js` vigila ahora el canon.

### Paneles redimensionables — OBLIGATORIO

Carlos (2-oct-2026): «en la UX cuadrática siempre tienen que ser resizables las ventanas de opciones, avanzado y experto». Toda página con el armazón los tiene sin hacer nada (lo pone `admira-frame.js`, en los dos modos); una interfaz cuadrática que no use el armazón tiene que dar lo mismo.

- Tirador en el borde **interior**: ☰ su borde derecho, ▤ su borde izquierdo, ⌘ su borde superior. Ratón, dedo (`pointer`) y **teclado**: es un `role="separator"` enfocable con `aria-valuenow/min/max`; flechas = 16 px (Mayús = 64), Inicio/Fin = mínimo/máximo, **Intro o doble clic = tamaño por defecto**.
- Límites: laterales de 220 px a `min(760 px, 60 % del ancho)` (en ≤720 px, hasta el 92 %); ⌘ de 120 px hasta el alto de la ventana menos la barra y 60 px.
- El tamaño se **recuerda entre páginas** (`localStorage` `admiranext_frame_sizes_v1`, `{left, right, bottom}` en px) y se recorta, sin olvidarlo, si la ventana encoge. Llega a CSS como `--yk-w-left`, `--yk-w-right` y `--yk-h-bottom` en el `<html>`; sin ellas mandan `--yk-rail-w` / `--yk-rail-h`. Acoplados (modo cabecera, ≥1100 px), el contenido se aparta al nuevo ancho.
- API: `AdmiraFrame.tamano('left'|'right'|'bottom', px|null)` (`null` = por defecto).

### Logotipo — OBLIGATORIO

La marca es el logotipo oficial (`libro-de-estilo.html` §7.4): «ADmira» en blanco y **N** `#FF3366` · **e** `#FFCC00` · **X** `#33FF99` · **T** `#FF33CC`, en una sans gruesa, sobre oscuro. En modo barra lo pinta el armazón; en modo cabecera la página lo trae en su `<a class="brand">` (marcado `yk-wm-*`) y, si no, el armazón lo sustituye. Nada de «admiraNeXT.» en minúscula con punto.

## Modo barra (por defecto) — `/presentaciones/galeria`, el generador (`/presentaciones/`), `/mcp/` y `/mcp/generador`

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
- El **generador** (`functions/presentaciones/generador.js`) no pinta barra propia desde el 2-oct (Carlos, tras el PR #28: «no respeta la fórmula de la UX cuadrática ni el logo»): `assets/presentation-generator-quadratic.js` declara los slots (☰ navegación a otras páginas · ▤ estado de producción, Validar, Copiar configuración e «Ir a» las secciones · ⌘ resumen del motor + CLI con `/validar /config /estado /seccion /galeria /accesos`) y la Function inyecta `admira-frame.js` detrás. `/mcp/generador` hace lo mismo en su HTML (verbos `/seccion /tools /copiar /endpoint /manifest`).

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
- La cabecera se fija arriba y mide su alto en `--yk-bar-h`. En ≥1100 px los paneles se **acoplan**: el `body` se aparta con `--yk-dock-l`, `--yk-dock-r` y `--yk-bottom`, y lo que observe su tamaño (el globo de /analitics, con `ResizeObserver`) se redimensiona. Por debajo se superponen y un clic fuera los cierra (salvo en un control con `data-yk-toggle`).
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
| `presentaciones/generador.html` | excepción | No usa el modo cabecera: adopta el armazón en **modo barra** (como la galería), montado por la Function del generador con `presentation-generator-quadratic.js`. | | |

En webmaster los enlaces `data-yk-admin` nacen ocultos y los muestra la sesión si es de administrador.

Guardián: `test/familia-analitics-cuadratica.test.js`. Descubre la familia (destinos de la puerta de login, Functions que sirven HTML tras exigir sesión, navegación del grupo y cualquier página que diga «Acceso privado») y exige que cada miembro adopte la barra o figure en `EXCEPCIONES` con su motivo; ejecuta el armazón sobre la cabecera real de cada página y comprueba el orden `☰ · marca · nav · acceso · ▤⌘`, la navegación en ☰, que ▤ tenga contenido y que `/help` liste los verbos.
