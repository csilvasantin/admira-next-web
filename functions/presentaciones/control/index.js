export async function onRequestGet(){
  const html=`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#070a10">
  <meta name="admiranext-presentation-control-version" content="v.2026.07.18.r1">
  <title>Control de presentaciones · ADmiraNeXT</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/assets/presentation-control.css?v=20260718-1">
</head>
<body>
  <a class="skip-link" href="#mainContent">Saltar al contenido</a>

  <header class="quad-header" aria-label="Menú superior">
    <div class="header-side header-left">
      <button class="quad-toggle" id="toggleOptions" type="button" aria-expanded="false" aria-controls="panelOptions" aria-label="Abrir opciones" aria-keyshortcuts="O" title="Opciones · tecla O">
        <span aria-hidden="true">☰</span><span class="toggle-label">Opciones</span>
      </button>
    </div>
    <div class="header-center">
      <div class="header-primary">
        <a class="brand" href="/presentaciones/" aria-label="Volver a presentaciones">ADmira<b>NeXT</b></a>
        <span class="header-title">Control de presentaciones</span>
      </div>
      <div class="header-status" id="headerStatus" role="status" aria-live="polite">
        <span class="live-dot" aria-hidden="true"></span><span id="headerPulse">Conectando…</span>
      </div>
    </div>
    <div class="header-side header-right">
      <button class="quad-toggle" id="toggleAdvanced" type="button" aria-expanded="false" aria-controls="panelAdvanced" aria-label="Abrir ajustes avanzados" aria-keyshortcuts="A" title="Avanzado · tecla A">
        <span aria-hidden="true">⚙</span><span class="toggle-label">Avanzado</span>
      </button>
      <button class="quad-toggle expert-toggle" id="toggleExpert" type="button" aria-expanded="false" aria-controls="panelExpert" aria-label="Abrir consola experta" aria-keyshortcuts="E" title="Experto · tecla E">
        <span aria-hidden="true">&gt;_</span><span class="toggle-label">Experto</span>
      </button>
    </div>
  </header>

  <div class="panel-scrim" id="panelScrim" aria-hidden="true"></div>

  <aside class="quad-panel panel-left" id="panelOptions" aria-labelledby="optionsTitle" aria-hidden="true">
    <button class="panel-close" type="button" data-close-panel="options" aria-label="Cerrar opciones">×</button>
    <h2 id="optionsTitle">Opciones</h2>
    <p class="panel-kicker">Vista</p>
    <nav class="view-menu" aria-label="Vistas del control">
      <button class="view-button active" type="button" data-view="overview" aria-current="page"><span aria-hidden="true">◫</span><span><b>Resumen</b><small>Indicadores y actividad</small></span></button>
      <button class="view-button" type="button" data-view="activity"><span aria-hidden="true">≋</span><span><b>Actividad</b><small>Registro completo</small></span></button>
      <button class="view-button" type="button" data-view="presentations"><span aria-hidden="true">▦</span><span><b>Presentaciones</b><small>Rendimiento por cliente</small></span></button>
    </nav>
    <div class="panel-section shortcuts">
      <p class="panel-kicker">Acceso universal</p>
      <dl>
        <div><dt>O</dt><dd>Opciones</dd></div>
        <div><dt>A</dt><dd>Avanzado</dd></div>
        <div><dt>E</dt><dd>Experto</dd></div>
        <div><dt>/</dt><dd>Buscar</dd></div>
        <div><dt>R</dt><dd>Actualizar</dd></div>
        <div><dt>Esc</dt><dd>Cerrar panel</dd></div>
      </dl>
    </div>
    <div class="panel-version">v.2026.07.18.r1 · cuadrática</div>
  </aside>

  <aside class="quad-panel panel-right" id="panelAdvanced" aria-labelledby="advancedTitle" aria-hidden="true">
    <button class="panel-close" type="button" data-close-panel="advanced" aria-label="Cerrar avanzado">×</button>
    <h2 id="advancedTitle">Avanzado</h2>
    <form id="filterForm" autocomplete="off">
      <div class="control-field">
        <label for="search">Buscar</label>
        <input class="field" id="search" type="search" aria-keyshortcuts="/" placeholder="Nombre, correo, cliente o recurso…">
      </div>
      <div class="control-field">
        <label for="client">Cliente</label>
        <select class="field" id="client"><option value="">Todos los clientes</option></select>
      </div>
      <div class="control-field">
        <label for="type">Evento</label>
        <select class="field" id="type">
          <option value="">Todos los eventos</option>
          <option value="page_view">Visitas</option>
          <option value="download">Descargas</option>
          <option value="media_play">Reproducciones</option>
          <option value="login_success">Inicios de sesión</option>
          <option value="login_failed">Accesos fallidos</option>
          <option value="language_change">Cambios de idioma</option>
          <option value="look_change">Cambios de look &amp; feel</option>
          <option value="fullscreen">Pantalla completa</option>
        </select>
      </div>
      <div class="control-field split-field">
        <div>
          <label for="days">Periodo</label>
          <select class="field" id="days">
            <option value="1">24 horas</option><option value="7">7 días</option><option value="30" selected>30 días</option><option value="90">90 días</option><option value="180">180 días</option>
          </select>
        </div>
        <div>
          <label for="autoRefresh">Autoactualizar</label>
          <select class="field" id="autoRefresh">
            <option value="0">No</option><option value="30">30 s</option><option value="60" selected>60 s</option><option value="300">5 min</option>
          </select>
        </div>
      </div>
      <button class="primary-action" id="refresh" type="button" aria-keyshortcuts="R">Actualizar datos</button>
    </form>

    <div class="panel-section preferences">
      <p class="panel-kicker">Lectura y privacidad</p>
      <label class="check-row"><input type="checkbox" id="largeText"><span>Texto ampliado</span></label>
      <label class="check-row"><input type="checkbox" id="highContrast"><span>Contraste reforzado</span></label>
      <label class="check-row"><input type="checkbox" id="reduceMotion"><span>Reducir movimiento</span></label>
      <label class="check-row"><input type="checkbox" id="compactMode"><span>Densidad compacta</span></label>
      <label class="check-row"><input type="checkbox" id="maskTechnical"><span>Ocultar IP y datos técnicos</span></label>
      <button class="text-action" id="resetPreferences" type="button">Restaurar preferencias</button>
    </div>
  </aside>

  <section class="quad-panel panel-bottom" id="panelExpert" aria-labelledby="expertTitle" aria-hidden="true">
    <button class="panel-close" type="button" data-close-panel="expert" aria-label="Cerrar consola experta">×</button>
    <div class="expert-heading">
      <div><h2 id="expertTitle">Experto</h2><p>Consulta local · no ejecuta acciones remotas</p></div>
      <button class="text-action" id="clearConsole" type="button">Limpiar</button>
    </div>
    <div class="cli-shell">
      <label class="sr-only" for="cliInput">Comando de consola</label>
      <span class="prompt" aria-hidden="true">admiranext:/presentaciones$</span>
      <input id="cliInput" type="text" autocomplete="off" spellcheck="false" placeholder="help · resumen · vista · filtro · cliente · tipo · dias · exportar">
    </div>
    <div class="cli-output" id="cliOutput" role="log" aria-live="polite" aria-relevant="additions"></div>
  </section>

  <main class="control-main" id="mainContent" tabindex="-1">
    <section class="hero" aria-labelledby="pageTitle">
      <div>
        <p class="eyebrow">Actividad privada · acceso universal</p>
        <h1 id="pageTitle">Control de presentaciones</h1>
        <p class="lead">Quién entra, cuándo accede y cómo utiliza cada material.</p>
      </div>
      <div class="hero-actions">
        <button class="secondary-action" id="openFilters" type="button">Filtrar</button>
        <button class="secondary-action" id="export" type="button">Exportar CSV</button>
      </div>
    </section>

    <div class="notice" id="notice" role="status" aria-live="polite">Cargando actividad…</div>

    <section class="view-section" id="overviewView" data-view-section="overview" aria-labelledby="metricsTitle">
      <h2 class="sr-only" id="metricsTitle">Resumen de actividad</h2>
      <div class="metrics">
        <article class="metric"><span>Personas</span><strong id="visitors">—</strong><small>identidades únicas</small></article>
        <article class="metric"><span>Visitas</span><strong id="views">—</strong><small>páginas abiertas</small></article>
        <article class="metric"><span>Descargas</span><strong id="downloads">—</strong><small>materiales guardados</small></article>
        <article class="metric"><span>Reproducciones</span><strong id="plays">—</strong><small>audio y vídeo</small></article>
        <article class="metric"><span>Últimas 24 h</span><strong id="last24h">—</strong><small>eventos recientes</small></article>
        <article class="metric"><span>Total</span><strong id="events">—</strong><small>eventos del periodo</small></article>
      </div>
      <div class="dashboard-grid">
        <section class="content-panel activity-panel" aria-labelledby="recentTitle">
          <div class="content-heading"><div><p class="section-index">01</p><h2 id="recentTitle">Actividad reciente</h2></div><span id="resultCount">Cargando…</span></div>
          <div class="table-wrap compact-table"><table><caption class="sr-only">Últimos eventos de acceso a presentaciones</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Persona</th><th scope="col">Cliente</th><th scope="col">Acción</th><th scope="col">Recurso</th></tr></thead><tbody id="overviewRows"></tbody></table><div class="empty" id="overviewEmpty" hidden>No hay actividad con estos filtros.</div></div>
        </section>
        <aside class="content-panel clients-panel" aria-labelledby="clientSummaryTitle">
          <div class="content-heading"><div><p class="section-index">02</p><h2 id="clientSummaryTitle">Por presentación</h2></div><span id="stamp"></span></div>
          <div class="clients" id="overviewClients"></div>
        </aside>
      </div>
    </section>

    <section class="view-section content-panel" id="activityView" data-view-section="activity" aria-labelledby="activityTitle" hidden>
      <div class="content-heading"><div><p class="section-index">01</p><h2 id="activityTitle">Actividad completa</h2></div><span id="activityCount">—</span></div>
      <div class="table-wrap"><table><caption class="sr-only">Registro completo de eventos de acceso a presentaciones</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Persona</th><th scope="col">Cliente</th><th scope="col">Acción</th><th scope="col">Recurso</th><th scope="col">Ubicación</th></tr></thead><tbody id="activityRows"></tbody></table><div class="empty" id="activityEmpty" hidden>No hay actividad con estos filtros.</div></div>
    </section>

    <section class="view-section content-panel" id="presentationsView" data-view-section="presentations" aria-labelledby="presentationsTitle" hidden>
      <div class="content-heading"><div><p class="section-index">01</p><h2 id="presentationsTitle">Presentaciones</h2></div><span id="presentationsCount">—</span></div>
      <div class="presentation-grid" id="presentationClients"></div>
    </section>

    <footer class="control-footer">
      <span>ADmiraNeXT · control privado</span>
      <span>O opciones · A avanzado · E experto · / buscar · R actualizar</span>
    </footer>
  </main>

  <script src="/assets/presentation-control.js?v=20260718-1" defer></script>
</body>
</html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'}});
}
