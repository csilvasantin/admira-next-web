# Armazón cuadrático de admiranext.com (`assets/admira-frame.js` + `.css`)

Canon de la Galaxia (el mismo de admira.app, Pixeria, XpaceOS y Yokup; FLT-101373, 2-oct-2026):

- **☰ Opciones** abre el panel vertical IZQUIERDO: navegación y enlaces que llevan a otra página.
- **▤ Avanzado** abre el panel vertical DERECHO: lo que trabaja sobre la página (acciones, filtros que no son de diario, atajos a secciones).
- **⌘ Experto** abre la franja horizontal INFERIOR: el CLI.
- Paneles **independientes** (pueden estar abiertos a la vez), estado **recordado** entre páginas (`localStorage` `admiranext_frame_panels_v1`; se restaura sólo donde se acoplan, para no tapar un móvil al entrar), **Esc** cierra el panel que tiene el foco o, si no lo tiene ninguno, el último que se abrió. Sin scroll horizontal en móvil.

Hasta el 2-oct los glifos eran ⋯ y ⌄ y abrir un panel cerraba los otros; `test/presentation-gallery-quadratic-ux.test.js` vigila ahora el canon.

## Modo barra (por defecto) — `/presentaciones/`

El armazón crea su propia barra fija: `[☰] ADmiraNeXT · RÓTULO · secciones … [▤] [⌘]`. La página declara qué va a cada lado:

```html
<body data-yk-title="PRESENTACIONES" data-yk-rail-left="OPCIONES" data-yk-rail-right="AVANZADO">
  <section data-yk-slot="left">…</section>     <!-- ☰ -->
  <section data-yk-slot="right">…</section>    <!-- ▤ -->
  <section data-yk-slot="bottom">…</section>   <!-- ⌘ -->
  <nav data-yk-slot="nav" hidden><a href="…">…</a></nav>  <!-- secciones en la barra -->
```

## Modo cabecera — `/analitics` y sus derivadas

La página conserva SU cabecera y el armazón inserta los iconos en su sitio:

```
[☰] admiraNeXT · Analitics · Webmaster · Proyectos · … ● Acceso privado [▤] [⌘]
```

```html
<link rel="stylesheet" href="/assets/admira-frame.css?v=<sello>">   <!-- después del CSS de la página -->
<script defer src="/assets/admira-frame.js?v=<sello>"></script>
…
<body data-yk-frame="cabecera">
<header class="yk-head" data-yk-head>
  <a class="brand" href="/">admira<span>NeXT</span><i></i></a>          <!-- único enlace a la home -->
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
| `presentaciones/generador.html` | excepción | Armazón propio del generador (`presentation-generator-quadratic.js`). | | |

En webmaster los enlaces `data-yk-admin` nacen ocultos y los muestra la sesión si es de administrador.

Guardián: `test/familia-analitics-cuadratica.test.js`. Descubre la familia (destinos de la puerta de login, Functions que sirven HTML tras exigir sesión, navegación del grupo y cualquier página que diga «Acceso privado») y exige que cada miembro adopte la barra o figure en `EXCEPCIONES` con su motivo; ejecuta el armazón sobre la cabecera real de cada página y comprueba el orden `☰ · marca · nav · acceso · ▤⌘`, la navegación en ☰, que ▤ tenga contenido y que `/help` liste los verbos.
