/* analitics/expert.js — lo que /analitics pone en los paneles del armazón.
 *
 * FLT-101373 (2-oct-2026). Carga ANTES de /assets/admira-frame.js: deja sus verbos
 * en window.ADMIRA_FRAME_VERBS y el armazón los registra al montar ⌘ Experto (el
 * /help sale de ese registro). Los verbos no reimplementan nada: pulsan los mismos
 * controles de la página (periodo, sitio, Carbono/Silicio, Actualizar, globo), así
 * que panel.js, live.js y globe.js siguen siendo los únicos que cargan y pintan.
 * Los datos que /json vuelca son los que la página ya tiene en memoria: la página
 * sólo la sirve el middleware a un administrador.
 *
 * FLT-101380: detalle, registros HTTP y tabla de sites se cargan al desplegar su bloque.
 * /json los pide bajo demanda (a la misma API, con la sesión de admin) antes de volcar;
 * /buscar despliega «Rendimiento por site»; /estado dice qué bloques hay cargados.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var PERIODOS = {ahora: -1, directo: -1, live: -1, '-1': -1, hora: 0, '1h': 0, '0': 0, hoy: 1, '1': 1, '24h': 1, '7': 7, '7d': 7, semana: 7, '30': 30, '30d': 30, mes: 30};
  var NOMBRE_PERIODO = {'-1': 'Ahora', '0': 'Última hora', '1': 'Hoy', '7': '7 días', '30': '30 días'};

  function periodoActual() {
    var b = document.querySelector('.period .selected');
    return b ? Number(b.dataset.days) : 7;
  }
  function audiencia() {
    var c = $('carbono').checked, s = $('silicio').checked;
    return c && s ? 'Carbono + Silicio' : c ? 'Carbono' : s ? 'Silicio' : 'Sin selección';
  }
  function pintarChip() {
    var chip = $('audienceChip');
    if (!chip) return;
    $('audienceChipText').textContent = audiencia();
    chip.classList.toggle('filtered', !($('carbono').checked && $('silicio').checked));
  }
  function elegirPeriodo(dias) {
    var b = document.querySelector('[data-days="' + dias + '"]');
    if (b) b.click();
    return !!b;
  }
  function datosActuales() {
    // panel.js declara data/selected/days en el ámbito global de los scripts clásicos.
    /* global data, selected, days */
    return {
      periodo: NOMBRE_PERIODO[String(periodoActual())],
      sitio: (typeof selected !== 'undefined' && selected) || 'Todo el grupo',
      audiencia: audiencia(),
      historico: typeof data !== 'undefined' ? data : null,
      partes: window.analiticsPartes ? window.analiticsPartes.vigentes() : null,
      directo: periodoActual() === -1 ? (window.trafficSnapshot || null) : undefined
    };
  }

  var verbos = [
    {id: 'periodo', aliases: ['p'], uso: '<ahora|hora|hoy|7|30>', ayuda: 'Cambia el periodo del panel', run: function (args, ctx) {
      var clave = String(args[0] || '').toLowerCase();
      if (!(clave in PERIODOS)) { ctx.error('Uso: /periodo ahora | hora | hoy | 7 | 30'); return; }
      elegirPeriodo(PERIODOS[clave]);
      ctx.imprimir('Periodo: ' + NOMBRE_PERIODO[String(PERIODOS[clave])]);
    }},
    {id: 'ahora', aliases: ['live', 'directo'], ayuda: 'Presencia en vivo: sesiones activas ahora mismo', run: function (args, ctx) {
      elegirPeriodo(-1);
      ctx.imprimir('Ahora · sesiones con señal en los últimos 45 s (lectura cada 5 s)');
    }},
    {id: 'site', aliases: ['sitio'], uso: '<host|todo>', ayuda: 'Filtra por un site del grupo (o vuelve a todo el grupo)', run: function (args, ctx) {
      var sel = $('site'), buscado = String(args.join(' ') || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      if (!buscado) { ctx.error('Uso: /site <host> · /site todo'); return; }
      var valor = null;
      if (buscado === 'todo' || buscado === 'todos' || buscado === 'grupo') valor = '';
      else {
        var opciones = Array.prototype.slice.call(sel.options).map(function (o) { return o.value; }).filter(Boolean);
        var exacto = opciones.filter(function (h) { return h.replace(/^www\./, '') === buscado; });
        var parecidos = opciones.filter(function (h) { return h.indexOf(buscado) >= 0; });
        if (exacto.length) valor = exacto[0];
        else if (parecidos.length === 1) valor = parecidos[0];
        else if (parecidos.length > 1) { ctx.error('Varios sites coinciden: ' + parecidos.slice(0, 8).join(', ')); return; }
        else { ctx.error('No hay ningún site «' + buscado + '» en el censo cargado'); return; }
      }
      sel.value = valor;
      sel.dispatchEvent(new Event('change'));
      ctx.imprimir('Site: ' + (valor || 'Todo el grupo'));
    }},
    {id: 'audiencia', aliases: ['tipo'], uso: '<carbono|silicio|ambos>', ayuda: 'Carbono (humanos), Silicio (bots) o ambos', run: function (args, ctx) {
      var a = String(args[0] || '').toLowerCase();
      var mapa = {carbono: [true, false], humanos: [true, false], silicio: [false, true], bots: [false, true], ambos: [true, true], todo: [true, true]};
      if (!mapa[a]) { ctx.error('Uso: /audiencia carbono | silicio | ambos'); return; }
      $('carbono').checked = mapa[a][0];
      $('silicio').checked = mapa[a][1];
      $('carbono').dispatchEvent(new Event('change'));
      pintarChip();
      ctx.imprimir('Tipo de visitante: ' + audiencia());
    }},
    {id: 'refrescar', aliases: ['actualizar', 'r'], ayuda: 'Vuelve a consultar Cloudflare (o la presencia, en Ahora)', run: function (args, ctx) {
      var b = $('refresh');
      if (b.disabled) { ctx.imprimir('Ya hay una consulta en curso'); return; }
      b.click();
      ctx.imprimir('Consultando…');
    }},
    {id: 'buscar', aliases: ['dominio'], uso: '<texto>', ayuda: 'Despliega «Rendimiento por site» y filtra su tabla', run: function (args, ctx) {
      var q = $('search');
      if (periodoActual() === -1 || $('comparison').hidden) ctx.imprimir('La tabla de sites se ve con un periodo histórico y «Todo el grupo» (/periodo 7 · /site todo)');
      else if (window.analiticsPartes) window.analiticsPartes.abrir('sites');
      q.value = args.join(' ');
      q.dispatchEvent(new Event('input'));
      ctx.imprimir(q.value ? 'Tabla filtrada por «' + q.value + '»' : 'Tabla sin filtro');
    }},
    {id: 'globo', uso: '<pausa|seguir|global|siguiente|anterior|+|->', ayuda: 'Controla el globo del tráfico', run: function (args, ctx) {
      var orden = String(args[0] || '').toLowerCase();
      var botones = {global: 'globeReset', reset: 'globeReset', siguiente: 'globeNext', next: 'globeNext', anterior: 'globePrev', prev: 'globePrev', '+': 'globeZoomIn', '-': 'globeZoomOut'};
      if (orden === 'pausa' || orden === 'seguir' || orden === 'play') {
        var tour = $('globeTour'), activo = tour.getAttribute('aria-pressed') === 'true';
        if ((orden === 'pausa') === activo) tour.click();
        ctx.imprimir('Recorrido: ' + (tour.getAttribute('aria-pressed') === 'true' ? 'en marcha' : 'en pausa'));
        return;
      }
      if (!botones[orden]) { ctx.error('Uso: /globo pausa | seguir | global | siguiente | anterior | + | -'); return; }
      $(botones[orden]).click();
      ctx.imprimir($('globeCountry').textContent + ' · ' + $('globeValue').textContent + ' ' + $('globeUnit').textContent);
    }},
    {id: 'estado', aliases: ['status'], ayuda: 'Resumen de lo que se está mirando', run: function (args, ctx) {
      var d = datosActuales();
      ctx.imprimir('Periodo: ' + d.periodo + ' · Site: ' + d.sitio + ' · ' + d.audiencia);
      ctx.imprimir($('visits').closest('article').querySelector('p').textContent + ': ' + $('visits').textContent + ' · ' +
        $('views').closest('article').querySelector('p').textContent + ': ' + $('views').textContent + ' · Conexión: ' + $('connection').textContent);
      ctx.imprimir($('message').textContent);
      if (window.analiticsPartes && periodoActual() !== -1) {
        ctx.imprimir([['detalle', 'Cómo llegan'], ['http', 'Registros HTTP'], ['sites', 'Rendimiento por site']].map(function (b) {
          var p = window.analiticsPartes.parte(b[0]);
          return b[1] + ': ' + (p.abierta ? 'desplegado' : 'plegado') + ' · ' + ({'sin-cargar': 'sin cargar', cargando: 'cargando', ok: 'cargado', error: 'error', desactualizada: 'desactualizado'})[p.estado];
        }).join(' · '));
      }
    }},
    {id: 'json', aliases: ['datos'], uso: '[copiar]', ayuda: 'Vuelca los datos del panel (carga bajo demanda los bloques plegados)', run: function (args, ctx) {
      function volcar() {
        var d = datosActuales();
        if (!d.historico && !d.directo) { ctx.error('Todavía no hay datos cargados'); return; }
        ctx.json(d);
        if (String(args[0] || '').toLowerCase() === 'copiar' && navigator.clipboard) {
          navigator.clipboard.writeText(JSON.stringify(d, null, 2)).then(function () { ctx.imprimir('Copiado al portapapeles'); }, function () { ctx.error('El navegador no dejó copiar'); });
        }
      }
      var partes = window.analiticsPartes;
      if (!partes || periodoActual() === -1) { volcar(); return; }
      var vigentes = partes.vigentes(), faltan = ['detalle', 'http', 'sites'].filter(function (n) { return !vigentes[n]; });
      if (!faltan.length) { volcar(); return; }
      ctx.imprimir('Cargando bajo demanda: ' + faltan.join(', ') + '…');
      return Promise.all(faltan.map(function (n) {
        return partes.cargar(n).then(null, function (e) { ctx.error(n + ': ' + (e && e.message || e)); });
      })).then(volcar);
    }}
  ];
  window.ADMIRA_FRAME_VERBS = (window.ADMIRA_FRAME_VERBS || []).concat(verbos);

  // ▤ Avanzado: las acciones repiten los controles de la página; la pastilla del
  // filtro dice qué tipo de visitante se mira y abre ▤, donde se cambia.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-an-action]');
    if (b) {
      var accion = b.dataset.anAction;
      if (accion === 'refresh') $('refresh').click();
      else if (accion === 'tour') $('globeTour').click();
      else if (accion === 'globe-reset') $('globeReset').click();
      else if (accion === 'json' && window.AdmiraFrame) { window.AdmiraFrame.abrir('bottom', true); window.AdmiraFrame.ejecutar('/json'); }
      return;
    }
    if (e.target.closest && e.target.closest('#audienceChip') && window.AdmiraFrame) {
      window.AdmiraFrame.abrir('right', !window.AdmiraFrame.abierto('right'));
    }
  });
  ['carbono', 'silicio'].forEach(function (id) { $(id).addEventListener('change', pintarChip); });
  pintarChip();
})();
