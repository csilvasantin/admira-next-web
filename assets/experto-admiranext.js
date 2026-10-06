/* ⌘ EXPERTO en admiranext.com (06-10-2026).
 * admiranext.com no es una plataforma, pero tiene el mismo modo Experto que las cinco
 * (admira.studio, admira.store, admira.tv, admira.app, admira.biz): la piel compartida
 * /suite/experto.js + /suite/experto.css, que vive aquí mismo.
 *
 *  · Páginas con el armazón (admira-frame.js lo inyecta): la piel reviste el raíl «⌘ EXPERTO · CLI»
 *    del armazón (ficha del motor a la izquierda, CLI a la derecha) y el CLI del armazón gana los
 *    verbos de la suite: /marca, /idioma (/language, /languague, idiomaESP…), /estado, /version, /avatar…
 *  · Home y páginas sin armazón (<script> propio): la piel monta su CLI anclado abajo (modo propio),
 *    y el terminal de la home reenvía /marca y /idioma al Experto.
 *
 * Idioma persistente (06-10-2026): /idioma o /language en una página guardan admiranext_expert_lang y
 * la siguiente página que se abra (con armazón o la home) arranca en ese idioma. Los cambios hechos con
 * los botones propios de una página (ESP/ENG de la home, EN/ES de /impacto…) también se guardan.
 *
 * /marca <id>: marca blanca del catálogo único (assets/marca-blanca.js, la misma lógica y la misma
 * clave sessionStorage «mb:marca» que las plataformas). /idioma guarda admiranext_expert_lang (experto.js).
 * Cache-busting: STAMP viaja en el ?v= de experto.js/.css y marca-blanca.js; al cambiar cualquiera, súbelo. */
(function (G) {
  'use strict';
  if (G.__axAdmiranext || typeof document === 'undefined') return;
  G.__axAdmiranext = true;
  try { if (G.self !== G.top) return; } catch (e) { return; }
  var d = document;
  var STAMP = '20261006-idioma-paginas-5';
  var EXPERTO_JS = '/suite/experto.js?v=' + STAMP;
  var EXPERTO_CSS = '/suite/experto.css?v=' + STAMP;
  var MARCA_JS = '/assets/marca-blanca.js?v=' + STAMP;
  var ENGINE = 'ADMIRANEXT ENGINE';
  var lang = function () { return String(d.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es'; };
  var T = function (es, en) { return lang() === 'en' ? en : es; };

  // ── Marca blanca (mismo cargador y misma clave que las plataformas) ─────────
  var mbPromise = null;
  function quiereMarca() {
    try {
      var q = new URLSearchParams(location.search).get('marca');
      if (q != null && String(q).trim()) return true;
      if (sessionStorage.getItem('mb:marca')) return true;
    } catch (e) { /* sin almacenamiento */ }
    return false;
  }
  function cargarMarca() {
    if (G.AdmiraMarca) return Promise.resolve(G.AdmiraMarca);
    if (mbPromise) return mbPromise;
    mbPromise = new Promise(function (resolve) {
      var s = d.createElement('script');
      s.src = MARCA_JS;
      s.async = true;
      s.setAttribute('data-admira-marca', '');
      s.onload = function () { resolve(G.AdmiraMarca || null); };
      s.onerror = function () { s.remove(); mbPromise = null; resolve(null); };
      (d.head || d.documentElement).appendChild(s);
    });
    return mbPromise;
  }
  function etiqueta(b) {
    return b && b.propuesta ? T(' · propuesta automática, no es la marca oficial', ' · automatic proposal, not the official brand')
      : b && b.ejemplo ? T(' · marca ficticia de ejemplo', ' · fictional sample brand') : '';
  }
  function runMarca(args, write) {
    var arg = (args || []).join(' ').trim();
    return cargarMarca().then(function (M) {
      if (!M) { write(T('Marca blanca no disponible.', 'White label unavailable.'), 'err'); return; }
      var lista = function () {
        return M.listar ? M.listar().then(function (l) {
          if (l && l.length) write(T('Catálogo: ', 'Catalogue: ') + l.map(function (x) { return x.id; }).join(' · '));
        }).catch(function () { write(T('El catálogo de marcas no responde.', 'The brand catalogue is not answering.'), 'err'); }) : null;
      };
      if (!arg || /^(lista|list|catalogo|catálogo)$/i.test(arg)) {
        var cur = M.actual && M.actual();
        if (!arg || cur) write(cur ? T('Marca activa: ', 'Active brand: ') + cur.nombre + ' (' + cur.id + ')' + etiqueta(cur) + T('. /marca off vuelve a Admira.', '. /marca off returns to Admira.')
          : T('Sin marca blanca: ves ADmiraNeXT. Prueba /marca 365', 'No white label: you see ADmiraNeXT. Try /marca 365'));
        return lista();
      }
      if (M.isOff && M.isOff(arg)) {
        var r0 = M.desactivar();
        write(r0 && r0.changed ? T('Vuelta a Admira.', 'Back to Admira.') : T('No había ninguna marca blanca activa.', 'No white label was active.'));
        return;
      }
      if (/[.:/]/.test(arg) && M.analizar) {
        var ra = M.analizar(arg);
        write(ra.ok ? T('Abriendo el analizador de marca blanca: ', 'Opening the white-label analyser: ') + ra.href : T('URL no válida', 'Invalid URL'), ra.ok ? '' : 'err');
        return;
      }
      write(T('Aplicando la marca ', 'Applying brand ') + arg + '…');
      return M.activar(arg).then(function (r) {
        if (r.ok && r.off) write(T('Vuelta a Admira.', 'Back to Admira.'));
        else if (r.ok) write(T('Marca «', 'Brand «') + (r.nombre || r.id) + T('» aplicada', '» applied') + etiqueta(r) + T('. Se recuerda en esta pestaña; /marca off vuelve a Admira.', '. Remembered in this tab; /marca off returns to Admira.'));
        else if (r.reason === 'unknown') { write(T('No hay marca «', 'No brand «') + arg + T('» en el catálogo.', '» in the catalogue.'), 'err'); return lista(); }
        else write(T('No se pudo aplicar «', 'Could not apply «') + arg + '» (' + (r.reason || 'error') + ').', 'err');
        if (G.AdmiraExperto && G.AdmiraExperto.paint) G.AdmiraExperto.paint();
      });
    });
  }
  if (quiereMarca()) cargarMarca();
  // La ficha del motor muestra la versión publicada (/version.json), no la meta de cada página,
  // que puede llevar el sello de su última edición.
  try {
    fetch('/version.json', {cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.version) d.documentElement.dataset.version = j.version; }).catch(function () {});
  } catch (e) { /* sin fetch */ }
  // La ficha del Experto lee el cliente de AdmiraMarca: se repinta al cambiar la marca.
  d.addEventListener('admira:marca', function () { if (G.AdmiraExperto && G.AdmiraExperto.paint) G.AdmiraExperto.paint(); });

  // ── Idioma guardado: se reaplica al cargar cualquier página ─────────────────
  var CLAVE_IDIOMA = 'admiranext_expert_lang', CLAVE_HOME = 'admiranext_lang';
  var norm = function (l) { l = String(l || '').slice(0, 2).toLowerCase(); return l === 'en' || l === 'es' ? l : ''; };
  function idiomaGuardado() {
    try { return norm(localStorage.getItem(CLAVE_IDIOMA)) || norm(localStorage.getItem(CLAVE_HOME)); } catch (e) { return ''; }
  }
  function guardarIdioma(l) {
    if (!(l = norm(l))) return;
    try { localStorage.setItem(CLAVE_IDIOMA, l); localStorage.setItem(CLAVE_HOME, l); } catch (e) { /* sin almacenamiento */ }
  }
  var idiomaInicial = norm(d.documentElement.lang) || 'es';
  var idiomaQuerido = idiomaGuardado();
  // Antes de pintar la ficha: html.lang ya en el idioma guardado (la piel y el CLI hablan en él).
  if (idiomaQuerido && idiomaQuerido !== idiomaInicial) d.documentElement.lang = idiomaQuerido;
  // Con la piel cargada: si la página traía otro idioma, se aplica entero (la piel llama a
  // setLanguage/setLang de la página si los tiene: home, /businessplan, /impacto…). Después, cualquier
  // cambio de idioma (Experto o botón propio de la página) queda guardado para la siguiente página.
  function sincronizarIdioma(X) {
    if (idiomaQuerido && idiomaQuerido !== idiomaInicial && X && X.setLanguage) {
      try { X.setLanguage(idiomaQuerido); } catch (e) { /* la página no deja */ }
    } else if (idiomaQuerido && typeof G.setLang === 'function' && norm(G.currentLang) && norm(G.currentLang) !== idiomaQuerido) {
      try { G.setLang(idiomaQuerido); } catch (e) { /* la home no deja */ }
    }
    try {
      new MutationObserver(function () { guardarIdioma(d.documentElement.lang); })
        .observe(d.documentElement, {attributes: true, attributeFilter: ['lang']});
    } catch (e) { /* sin observador */ }
  }

  // ── Carga de la piel ─────────────────────────────────────────────────────
  function hoja() {
    if (d.querySelector('link[data-ax-experto-css]')) return;
    var l = d.createElement('link');
    l.rel = 'stylesheet'; l.href = EXPERTO_CSS; l.setAttribute('data-ax-experto-css', '');
    (d.head || d.documentElement).appendChild(l);
    // Ajustes del raíl del armazón bajo la piel: los paneles propios de la página siguen a la vista
    // y los errores del CLI del armazón salen en el color de error de la suite.
    var st = d.createElement('style');
    st.id = 'ax-admiranext';
    st.textContent = 'html[data-ax-experto] .ax-experto [data-yk-slot="bottom"]{flex:0 0 min(30%,380px);min-width:0;overflow:auto}' +
      'html[data-ax-experto] .ax-experto .yk-cli-line.yk-cli-err{color:var(--ax-err)!important}' +
      'html[data-ax-experto] .ax-experto .yk-cli-line.yk-cli-cmd{color:var(--ax-cyan)!important;font-weight:700}';
    (d.head || d.documentElement).appendChild(st);
  }
  function piel(attrs, listo) {
    if (G.AdmiraExperto) { listo(G.AdmiraExperto); return; }
    hoja();
    var s = d.createElement('script');
    s.src = EXPERTO_JS;
    s.defer = true;
    s.setAttribute('data-ax-admiranext', '');
    Object.keys(attrs).forEach(function (k) { s.setAttribute('data-' + k, attrs[k]); });
    s.onload = function () { if (G.AdmiraExperto) listo(G.AdmiraExperto); };
    (d.head || d.documentElement).appendChild(s);
  }
  // /marca de la piel → la marca blanca real (como en las plataformas, no solo la ficha).
  function marcaReal(X) {
    X.verb({name: 'marca', alias: ['brand', 'marcablanca'], args: '<id>|off|lista|<web>', desc: [
      'marca blanca del catálogo de admiranext.com/marcablanca (p. ej. /marca 365); off vuelve a Admira',
      'white label from the admiranext.com/marcablanca catalogue (e.g. /marca 365); off returns to Admira'
    ], run: function (a, log) { return runMarca(a, escribirEn(log)); }});
    // Atajos de las pieles de cine (FLT-101666 a, b y #5256): /81…/89 son /marca 81…/marca 89.
    PIELES_CINE.forEach(function (p) {
      X.verb({name: p.id, alias: [], args: '', desc: [
        'atajo de /marca ' + p.id + ': piel de cine ' + p.anio + ' (' + p.es + '); /marca off vuelve a Admira',
        'shortcut for /marca ' + p.id + ': ' + p.anio + ' movie skin (' + p.en + '); /marca off returns to Admira'
      ], run: function (a, log) { return runMarca([p.id], escribirEn(log)); }});
    });
  }
  var PIELES_CINE = [
    {id: '81', anio: '1981', es: 'arena, cuero y mapas antiguos', en: 'sand, leather and old maps'},
    {id: '82', anio: '1982', es: 'neón magenta y cian bajo la lluvia', en: 'magenta and cyan neon in the rain'},
    {id: '83', anio: '1983', es: 'noche de barrio, luna y rojo cálido', en: 'suburban night, moon and warm red'},
    {id: '84', anio: '1984', es: 'acero, negro y rojo infrarrojo', en: 'steel, black and infrared red'},
    {id: '85', anio: '1985', es: 'noche violeta, llamarada naranja y chispa azul', en: 'violet night, orange flame and blue spark'},
    {id: '86', anio: '1986', es: 'atardecer de aviación y dorado de aviador', en: 'aviation sunset and aviator gold'},
    {id: '87', anio: '1987', es: 'cromo, azul patrulla y HUD', en: 'chrome, patrol blue and HUD'},
    {id: '88', anio: '1988', es: 'cine negro con rojo de dibujo animado', en: 'noir with cartoon red'},
    {id: '89', anio: '1989', es: 'negro gótico y amarillo de reflector', en: 'gothic black and searchlight yellow'}
  ];
  function escribirEn(log) {
    return function (t, cls) {
      var li = d.createElement('li');
      li.className = cls || '';
      li.textContent = t;
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
    };
  }

  // ── Páginas con el armazón: piel sobre el raíl «⌘ EXPERTO · CLI» ──────────
  function conArmazon(rail) {
    var hd = rail.querySelector('.yk-rail-navhd');
    if (hd && !hd.querySelector('strong')) {
      var tit = d.createElement('strong');
      tit.textContent = hd.textContent;
      hd.textContent = '';
      hd.appendChild(tit);
    }
    piel({
      engine: ENGINE, pata: 'admiranext.com', cli: 'admiranext.com',
      panel: '#' + rail.id, header: '.yk-rail-navhd', title: '.yk-rail-navhd strong', body: '.yk-expert',
      form: '.yk-cli-form', input: '.yk-cli-input', log: '.yk-cli-out', hint: '.ax-sin-pista',
      extras: '', chrome: '', dock: 'off', toggle: ''
    }, function (X) {
      marcaReal(X);
      sincronizarIdioma(X);
      var F = G.AdmiraFrame, out = rail.querySelector('.yk-cli-out');
      // Un solo saludo: el de la piel (sigue al idioma); el del armazón sobra.
      var hola = out && out.querySelector('.yk-cli-hola');
      if (hola && out.querySelector('.ax-hello')) hola.parentNode.removeChild(hola);
      if (!F || !F.verbo || !X.list) return;
      // El CLI del armazón delega en la piel los verbos que no tiene (la página manda si ya los tiene).
      X.list().forEach(function (v) {
        if (/^(help|limpiar|ir)$/.test(v.name)) return;
        if (v.name !== 'marca' && F.tiene && F.tiene(v.name)) return;
        F.verbo({
          id: v.name, aliases: v.alias || [], uso: v.args || '',
          ayuda: v.desc[0] + ' · ⌘ Experto', ayudaEn: (v.desc[1] || v.desc[0]) + ' · ⌘ Expert',
          run: function (args, ctx, limpio) { return X.exec(limpio || ('/' + v.name + (args.length ? ' ' + args.join(' ') : '')), out, {echo: false}); }
        });
      });
    });
  }

  // ── Home y páginas sin armazón: CLI propio anclado abajo ──────────────────
  function sinArmazon() {
    var host = d.getElementById('axAdmiranextExperto');
    if (!host) {
      host = d.createElement('section');
      host.id = 'axAdmiranextExperto';
      host.setAttribute('aria-label', 'Experto');
      host.innerHTML = '<div class="ax-host-bd"></div>';
      d.body.appendChild(host);
    }
    piel({engine: ENGINE, pata: 'admiranext.com', cli: 'admiranext.com', mount: '#axAdmiranextExperto', 'mount-body': '.ax-host-bd'}, function (X) {
      marcaReal(X);
      sincronizarIdioma(X);
      // El terminal de la home (#cmdInput) reenvía /marca y /idioma (/language, typos y pegados) al Experto.
      d.addEventListener('keydown', function (e) {
        var t = e.target;
        if (e.key !== 'Enter' || !t || t.id !== 'cmdInput') return;
        var v = String(t.value || '').trim();
        var esIdioma = X.parseLangCommand && X.parseLangCommand(v);
        var esMarca = /^\/?(marca|brand|marcablanca)(\s|$)/i.test(v) || /^\/8[1-9]$/.test(v);
        if (!esIdioma && !esMarca) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        t.value = '';
        if (X.open) X.open();
        X.run(v);
      }, true);
    });
  }

  function arrancar() {
    var rail = d.getElementById('ykExpertRail');
    if (rail && rail.querySelector('.yk-cli-form')) conArmazon(rail);
    else if (!d.querySelector('script[src*="admira-frame.js"]') || d.body.hasAttribute('data-ax-propio')) sinArmazon();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', arrancar, {once: true});
  else arrancar();
  G.AdmiraExpertoAdmiranext = {stamp: STAMP, marca: runMarca, cargarMarca: cargarMarca, idiomaGuardado: idiomaGuardado};
})(window);
