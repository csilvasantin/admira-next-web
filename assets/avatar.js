/* Product header policy also applies before login; it never mounts Expert. */
(function(D){if(!D||!D.createElement||!D.head)return;if(D.querySelector('script[data-admira-header-loader]'))return;var s=D.createElement('script');if(!s||!s.dataset)return;s.src='https://www.admiranext.com/suite/header.js?v=20261014-2';s.dataset.admiraHeaderLoader='';s.defer=true;D.head.appendChild(s);})(typeof document==='undefined'?null:document);
/* AdmiraNeXT · avatar digital compartido (cargador único de la red).
 *
 * Una sola fuente para todos los sitios: https://www.admiranext.com/assets/avatar.js
 * La cara y la voz no se copian: el panel abre la demo viva de digitalavatar.ai
 * (micro, texto, ElevenLabs por brain.digitalavatar.ai, cortar, estados).
 *
 *   /avatar good    Admirito — la nube animada, 2D ligera con lip-sync y vida propia (nube.html)
 *                   (el calvo 3D, better.html, queda como etapa del museo de digitalavatar.ai)
 *   /avatar better  Luna — anfitriona web Ready Player Me (best.html)
 *   /avatar best    Neo — MetaHuman por Pixel Streaming (metahuman.html)
 *   /avatar         estado y las tres opciones
 *   /avatarON /avatarOFF   muestran u ocultan el panel y lo recuerdan
 *   /<personaje> [arg]   PERSONAJES: pieles de Admirito (nube.html?personaje=<id>) con verbo propio. Hoy:
 *                   /bugito — mascota flotante; /bugito full o avanzado — banco de pruebas; [incidencia] — laboratorio.
 *                   En su página (window.Admira<Id>, p. ej. AdmiraBugito) lo muestra u oculta y, con argumento,
 *                   se lo pasa; fuera, abre su página. Añadir otro (arquitecto) = una entrada en PERSONAJES.
 *                   /arquitecto [crear [tipo]|reformar|inventariar] — Admirito con casco de obra, el estudio de admira.biz
 *                   (arquitecto.html) que crea, reforma e inventaría Xpacios y da de alta el inventario ITIL en Yokup.
 *   AdmiraAvatar.setContext({loc, lang, sector, brand, site, city, tier})  contexto del cliente
 *     (tier = nivel que pide la página; /avatar <nivel> del usuario manda en su pestaña)
 *     (la cara lo recibe en la URL y por postMessage; ver levelUrl).
 *   window 'admira-avatar:open' (cancelable, detail {level, context}): antes de abrir el panel;
 *     preventDefault() lo deja cerrado (la página muestra su propio avatar en escena)
 *
 * Precedencia (de más a menos fuerte):
 *   1. Elección del usuario en este sitio y navegador: localStorage
 *      «admira-avatar:override» = "on" | "off" (la escriben /avatarON, /avatarOFF
 *      y /avatar good|better|best).
 *   2. Interruptor del proyecto en admiranext.com (GET /api/avatar/flags?host=…).
 *   3. Apagado.
 * El encendido automático por interruptor NUNCA escribe la elección del usuario:
 * si Carlos apaga el proyecto, desaparece para todos los que no lo forzaron.
 * Con el interruptor sale la burbuja cerrada; /avatarON y /avatar <nivel> abren el panel.
 * Migra el interruptor antiguo por sitio (FLT-101350: «da-avatar:<host>» = 1/0).
 */
(function (root) {
  'use strict';

  var ORIGIN = 'https://www.admiranext.com';
  var FLAGS_URL = ORIGIN + '/api/avatar/flags';
  var CENTRAL_BRAIN = ORIGIN + '/api/avatar-ask';
  var LEVELS = {
    good: 'https://digitalavatar.ai/nube.html?dock=1&contract=20261016-180',
    better: 'https://digitalavatar.ai/best.html?dock=1&contract=20261016-180&kiosk=0',
    best: 'https://digitalavatar.ai/metahuman.html?dock=1'
  };
  // PERSONAJES (Carlos, 14-oct-2026: «Bugito es una adaptación de Admirito»): la misma cara con otra piel
  // (nube.html?personaje=<id>), por el mismo camino que /admirito. No son niveles: nunca pasan a ser la cara
  // por defecto de un sitio. Cada uno: su página (pagina), el gancho que esa página registra (gancho) y el
  // aviso al abrirla. Añadir el Arquitecto = una entrada más aquí (y su verbo en suite/experto.js).
  var CARA_PERSONAJE = 'https://digitalavatar.ai/nube.html?dock=1&contract=20261016-180&personaje=';
  var CARA_ORIGIN = 'https://digitalavatar.ai';   // también en el camino de mejora de un cargador anterior
  var PERSONAJES = {
    bugito: {pagina: 'https://www.admira.biz/bugito.html', gancho: 'AdmiraBugito', param: 'incidencia',
      es: 'Bugito: abriendo su banco de pruebas en admira.biz (player virtual a la izquierda, Bugito a la derecha)…',
      en: 'Bugito: opening his test bench on admira.biz (virtual player on the left, Bugito on the right)…',
      lanzaEs: 'Bugito: lanzando «%s» en el banco…', lanzaEn: 'Bugito: launching “%s” on the bench…',
      falloEs: 'Bugito no ha podido hacerlo: mira el estado del banco.', falloEn: 'Bugito could not do it: check the bench status.'},
    // El Arquitecto (Carlos, 14-oct-2026, DCL-66d9ae0d5e756d0067127f24: «/arquitecto … admirito se disfrace de arquitecto»).
    // Sin argumento, su estudio lo saca y explica las tres órdenes; con «crear [tipo]», «reformar» o «inventariar», abre
    // esa orden (?arg=crear-cafeteria; dentro del estudio, AdmiraArquitecto.lanzar).
    arquitecto: {pagina: 'https://www.admira.biz/arquitecto.html', gancho: 'AdmiraArquitecto', param: 'arg',
      es: 'El Arquitecto: abriendo su estudio en admira.biz. Órdenes: /arquitecto crear [tipo] · /arquitecto reformar · /arquitecto inventariar.',
      en: 'The Architect: opening his studio on admira.biz. Commands: /arquitecto crear [type] · /arquitecto reformar · /arquitecto inventariar.',
      lanzaEs: 'El Arquitecto: abriendo «%s» en el estudio…', lanzaEn: 'The Architect: opening “%s” in the studio…',
      falloEs: 'El Arquitecto no ha podido hacerlo: mira el estudio.', falloEn: 'The Architect could not do it: check the studio.'},
    // El Supervisor (Carlos, 18-oct-2026): la tercera mascota del ⌘ Experto, la Insta360 del MacMini que vigila el MBP16
    // y abre incidencias en admira.app/supervisor; su cara es la nube con gorra de vigilante y ojo de cámara. Sólo cara
    // (soloCara): su verbo /supervisor es de la suite (cámara en Admira Live y parte), así que decide() no lo reclama.
    // La suite la saca con AdmiraAvatar.cara('supervisor', …) junto a la cámara. Contrato: mcp/SUPERVISOR.md.
    supervisor: {soloCara: true, pagina: 'https://www.admira.app/supervisor', gancho: 'AdmiraSupervisor', param: 'arg',
      es: 'El Supervisor: abriendo su tablero en admira.app.', en: 'The Supervisor: opening his board on admira.app.',
      lanzaEs: 'El Supervisor: «%s»…', lanzaEn: 'The Supervisor: “%s”…',
      falloEs: 'El Supervisor no ha podido hacerlo: mira su tablero.', falloEn: 'The Supervisor could not do it: check his board.'}
  };
  var BUGITO = CARA_PERSONAJE + 'bugito';
  var BUGITO_BANCO = PERSONAJES.bugito.pagina;
  // Categorías públicas (Carlos, 7-oct-2026): avatar = good (Admirito), human = better (Luna),
  // metahuman = best (Neo). good/better/best siguen como alias.
  var CATEGORY_LEVEL = { avatar: 'good', human: 'better', metahuman: 'best', admirito: 'good', luna: 'better', neo: 'best' };
  var KEY = 'admira-avatar:override';
  var LEVEL_KEY = 'admira-avatar:nivel';
  var SIZE_KEY = 'admira-avatar:size';
  var CACHE = 'admira-avatar:flags';
  var CACHE_MS = 60000;
  var TIMEOUT_MS = 2500;
  var ON = /^(on|encender|mostrar|show|abrir|open)$/i;
  var OFF = /^(off|apagar|ocultar|hide|cerrar|close)$/i;
  var RESET = /^(reset|auto|proyecto|project|default)$/i;

  // ─── Piezas puras (se prueban en node: test/avatar-loader.test.mjs) ───
  // null si el texto no es un comando del avatar.
  // 'on' | 'off' | 'toggle' | 'mascota' | 'reset' | 'status' | 'good' | 'better' | 'best' | 'bad'.
  // 'mascota' alterna la presencia de Admirito (burbuja nube), no el panel.
  function decide(text) {
    var raw = String(text == null ? '' : text).trim();
    var m = raw.match(/^\/?([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    var verb = m[1].toLowerCase();
    var rest = String(m[2] || '').trim().split(/\s+/).filter(Boolean);
    if (verb === 'avataron') return 'on';
    if (verb === 'avataroff') return 'off';
    if (Object.prototype.hasOwnProperty.call(PERSONAJES, verb) && !PERSONAJES[verb].soloCara) return verb;   // /bugito → 'bugito'
    // Admirito, la mascota nube (Carlos, 5-oct-2026): /avatarDigital, /avatar Digital y /admirito
    // la muestran u ocultan (alternan); con on/off la fijan.
    if (verb === 'admirito' || (verb === 'avatar' && /^digital$/i.test(rest[0] || ''))) {
      var a0 = String((verb === 'admirito' ? rest[0] : rest[1]) || '').toLowerCase();
      return !a0 ? 'mascota' : ON.test(a0) ? 'on' : OFF.test(a0) ? 'off' : 'bad';
    }
    if (verb === 'avatardigital' && !rest.length) return 'mascota';
    if (verb === 'cli') {
      if (!/^(ayudante|helper)$/i.test(rest[0] || '')) return null;
      rest = rest.slice(1);
    } else if (verb !== 'avatar' && verb !== 'avatardigital' && verb !== 'digitalavatar') {
      return null;
    }
    var arg = (rest[0] || '').toLowerCase();
    if (!arg) return verb === 'cli' ? 'toggle' : 'status';
    if (ON.test(arg)) return 'on';
    if (OFF.test(arg)) return 'off';
    if (RESET.test(arg)) return 'reset';
    arg = CATEGORY_LEVEL[arg] || arg;
    if (verb !== 'cli' && LEVELS[arg]) return arg;
    return 'bad';
  }

  // «/bugito girar» → 'girar' · «/bugito» → '' · otro verbo → null. La página del personaje traduce el alias.
  function personajeArg(id, text) {
    if (!Object.prototype.hasOwnProperty.call(PERSONAJES, id)) return null;
    var m = String(text == null ? '' : text).trim().match(/^\/?([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!m || m[1].toLowerCase() !== id) return null;
    if(id==='bugito'&&/^(error|fallo|fault|restaurar|restore)\s+/i.test(String(m[2]||'').trim()))return String(m[2]).trim();
    return String(m[2] || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  // La cara del personaje (la nube de Admirito con ?personaje=<id>), con el idioma de la página.
  function personajeUrl(id, ctx) {
    if (!Object.prototype.hasOwnProperty.call(PERSONAJES, id)) return '';
    var c = cleanContext(ctx);
    return CARA_PERSONAJE + id + (c.lang ? '&lang=' + c.lang : '') + '&tier=good';
  }
  // Su página, con el argumento sólo preseleccionado (Bugito: la incidencia no se lanza sola).
  function personajePagina(id, arg, lang) {
    if (!Object.prototype.hasOwnProperty.call(PERSONAJES, id)) return '';
    var q = [];
    if (lang === 'es' || lang === 'en') q.push('lang=' + lang);
    if (arg && /^[a-z0-9-]{1,40}$/.test(arg)) q.push((PERSONAJES[id].param || 'arg') + '=' + arg);
    return PERSONAJES[id].pagina + (q.length ? '?' + q.join('&') : '');
  }
  function personajeMode(id,arg){return id==='bugito'&&/^(?:on|off)?$/.test(arg||'')?'floating':id==='bugito'&&/^(?:full|avanzado|advanced)$/.test(arg||'')?'full':'action';}
  // Mensaje del anfitrión a la cara de un personaje ({type:'da-<id>'}): sólo los campos del contrato, acotados.
  // null si el personaje no existe o el estado no es una palabra. La cara decide si el estado es suyo.
  function caraMensaje(id, msg) {
    if (!Object.prototype.hasOwnProperty.call(PERSONAJES, id) || !msg || typeof msg !== 'object') return null;
    var estado = String(msg.estado || '');
    if (!/^[a-z][a-z-]{0,23}$/.test(estado)) return null;
    var out = {type: 'da-' + id, estado: estado};
    if (/^[a-z-]{1,24}$/.test(String(msg.espera || ''))) out.espera = msg.espera;
    var ticket = typeof msg.ticket === 'string' ? msg.ticket : msg.incidencia && typeof msg.incidencia === 'object' ? msg.incidencia.id : '';
    if (/^[A-Z]{3}-[A-Z0-9]{3,16}$/.test(String(ticket || ''))) out.ticket = ticket;
    if (typeof msg.texto === 'string' && msg.texto.trim()) out.texto = msg.texto.trim().slice(0, 240);
    if (msg.silencio === true) out.silencio = true;
    if (msg.lang === 'es' || msg.lang === 'en') out.lang = msg.lang;
    return out;
  }
  // Orden de la cara al anfitrión ({type:'da-<id>-orden', orden, texto}): null si no es de ese personaje o no es una palabra.
  function caraOrden(id, d) {
    if (!d || d.type !== 'da-' + id + '-orden' || !/^[a-z]{1,20}$/.test(String(d.orden || ''))) return null;
    return {orden: d.orden, texto: typeof d.texto === 'string' ? d.texto.slice(0, 500) : '', lang: d.lang === 'en' ? 'en' : 'es'};
  }
  // ¿Dónde cabe la cara sin tapar lo que la página protege (Supervisor: la cámara de Admira Live, con sus controles)?
  // zona y panel: rectángulos {left, top, right, bottom}; vista: {w}. 'libre' si no se tocan; 'estrecha' con el ancho que
  // queda a la derecha de la zona (el panel va anclado a 16 px del borde derecho), si llega a CARA_MIN; si no, 'plegada'.
  var CARA_MIN = 220, CARA_MARGEN = 12;
  function caraHueco(zona, panel, vista) {
    if (!zona || !panel) return {modo: 'libre'};
    var corta = zona.left < panel.right && panel.left < zona.right && zona.top < panel.bottom && panel.top < zona.bottom;
    if (!corta) return {modo: 'libre'};
    var ancho = Math.floor(((vista && vista.w) || 1280) - 16 - zona.right - CARA_MARGEN);
    return ancho >= CARA_MIN ? {modo: 'estrecha', ancho: ancho} : {modo: 'plegada'};
  }
  function bugitoArg(text) { return personajeArg('bugito', text); }
  function bugitoUrl(ctx) { return personajeUrl('bugito', ctx); }
  function bugitoBanco(arg, lang) { return personajePagina('bugito', arg, lang); }

  // override 'on'|'off'|null, flag true|false|null → {on, open:false, source}
  function resolve(override, flag) {
    if (override === 'on') return {on: true, source: 'usuario'};
    if (override === 'off') return {on: false, source: 'usuario'};
    if (flag === true) return {on: true, source: 'proyecto'};
    return {on: false, source: flag === false ? 'proyecto' : 'defecto'};
  }

  function legacyValue(v) {
    return v === '1' ? 'on' : v === '0' ? 'off' : null;
  }

  function message(kind, en, arg) {
    if (kind === 'on') return en ? 'Digital avatar on' : 'Avatar digital activado';
    if (kind === 'off') return en ? 'Digital avatar off' : 'Avatar digital desactivado';
    if (kind === 'good') return en ? 'Avatar: Admirito, the animated cloud (moves its lips and lives on its own).' : 'Avatar: Admirito, la nube animada (mueve los labios y hace cosas sola).';
    if (kind === 'better') return en ? 'Human: Luna, the web host (Ready Player Me).' : 'Human: Luna, la anfitriona web (Ready Player Me).';
    if (kind === 'best') return en ? 'Metahuman: Neo, MetaHuman.' : 'Metahuman: Neo, MetaHuman.';
    if (kind === 'status') return en
      ? 'Digital avatar. /avatar avatar · Admirito, the animated cloud. /avatar human · Luna, the web host. /avatar metahuman · Neo, MetaHuman (good, better and best still work). /avatarON shows it, /avatarOFF hides it.'
      : 'Avatar digital. /avatar avatar · Admirito, la nube animada. /avatar human · Luna, la anfitriona web. /avatar metahuman · Neo, MetaHuman (good, better y best siguen valiendo). /avatarON lo muestra, /avatarOFF lo oculta.';
    if (kind === 'mascota-on') return en ? 'Admirito shown. /avatarDigital or /admirito hides it again.' : 'Admirito visible. /avatarDigital o /admirito lo vuelve a ocultar.';
    if (kind === 'mascota-off') return en ? 'Admirito hidden. /avatarDigital or /admirito shows it again.' : 'Admirito oculto. /avatarDigital o /admirito lo vuelve a mostrar.';
    var pj = /^(.+)-(ir|lanza|fallo)$/.exec(String(kind || ''));
    if (pj && Object.prototype.hasOwnProperty.call(PERSONAJES, pj[1])) {
      var P = PERSONAJES[pj[1]];
      if (pj[2] === 'lanza') return (en ? P.lanzaEn : P.lanzaEs).replace('%s', String(arg || ''));
      if (pj[2] === 'fallo') return en ? P.falloEn : P.falloEs;
      return en ? P.en : P.es;
    }
    if (kind === 'reset-on') return en ? 'Digital avatar follows the project switch (on)' : 'El avatar sigue el interruptor del proyecto (encendido)';
    if (kind === 'reset-off') return en ? 'Digital avatar follows the project switch (off)' : 'El avatar sigue el interruptor del proyecto (apagado)';
    return en
      ? 'Use /avatar avatar, /avatar human or /avatar metahuman. /avatar alone shows the status. /avatarON and /avatarOFF show or hide it.'
      : 'Usa /avatar avatar, /avatar human o /avatar metahuman. /avatar solo muestra el estado. /avatarON y /avatarOFF lo muestran o lo ocultan.';
  }

  // El asa está arriba a la izquierda y el panel sigue anclado abajo a la
  // derecha: arrastrar hacia arriba-izquierda agranda. El borde superior no
  // pasa de 64 px (o del borde inferior de la barra, si queda más abajo).
  function clampPanelSize(w, h, view) {
    view = view || {};
    var vw = isFinite(view.w) ? view.w : 1280;
    var vh = isFinite(view.h) ? view.h : 800;
    var top = isFinite(view.top) ? view.top : 64;
    if (top < 64) top = 64;
    var bottom = isFinite(view.bottom) ? view.bottom : 20;
    var maxW = Math.max(1, Math.floor(vw - 32));
    var maxH = Math.max(1, Math.floor(vh - bottom - top));
    var minW = Math.min(240, maxW);
    var minH = Math.min(180, maxH);
    var nw = Number(w), nh = Number(h);
    if (!isFinite(nw) || nw <= 0) nw = Math.min(400, maxW);
    if (!isFinite(nh) || nh <= 0) nh = Math.min(680, maxH);
    return {
      w: Math.round(Math.max(minW, Math.min(maxW, nw))),
      h: Math.round(Math.max(minH, Math.min(maxH, nh)))
    };
  }
  function panelSizeAfterDrag(start, point, origin, view) {
    var dx = (point && point.x || 0) - (origin && origin.x || 0);
    var dy = (point && point.y || 0) - (origin && origin.y || 0);
    return clampPanelSize((start && start.w || 0) - dx, (start && start.h || 0) - dy, view);
  }

  // ─── Contexto del cliente (avatar por sector · 6-oct-2026 · GrokBot · MacMini) ───
  // El panel abre la cara con ?loc, lang, sector, brand, site, city y tier (= nivel:
  // good, better o best). digitalavatar.ai/assets/da-context.js lo lee y lo manda al
  // cerebro; los cambios posteriores viajan por postMessage {type:'da-context'}.
  var CTX_KEYS = ['loc', 'lang', 'sector', 'brand', 'site', 'city'];
  function cleanContext(ctx) {
    var out = {};
    ctx = ctx || {};
    for (var i = 0; i < CTX_KEYS.length; i++) {
      var k = CTX_KEYS[i], v = ctx[k];
      if (v == null) continue;
      v = String(v).replace(/\s+/g, ' ').trim().slice(0, 120);
      if (k === 'lang') v = /^en/i.test(v) ? 'en' : /^es/i.test(v) ? 'es' : '';
      if (k === 'brand' && /^(admira|off|none)$/i.test(v)) v = '';
      if (v) out[k] = v;
    }
    return out;
  }
  // Nivel de la cara: elección explícita del usuario en esta pestaña (/avatar good|better|best)
  // > nivel que pide la página (p. ej. el gemelo: Good 8 bits → good, Better 16 → better,
  // Best 32 y Matrix 64 → best) > último nivel guardado > good.
  function pickLevel(explicit, page, stored) {
    return LEVELS[explicit] ? explicit : LEVELS[page] ? page : LEVELS[stored] ? stored : 'good';
  }
  var TIER_AVATAR = { good: 'admirito', better: 'luna', best: 'neo' };
  function levelUrl(level, ctx) {
    var lv = LEVELS[level] ? level : 'good';
    var c = cleanContext(ctx), q = [];
    for (var i = 0; i < CTX_KEYS.length; i++) if (c[CTX_KEYS[i]]) q.push(CTX_KEYS[i] + '=' + encodeURIComponent(c[CTX_KEYS[i]]));
    q.push('tier=' + lv);
    q.push('avatar=' + (TIER_AVATAR[lv] || 'luna'));
    return LEVELS[lv] + '&' + q.join('&');
  }

  // Pastilla de categoría (Carlos, 7-oct-2026): pulsar sube avatar → human → metahuman → avatar;
  // deslizar/→ sube uno, deslizar/← baja uno (también cíclico).
  var CYCLE = ['good', 'better', 'best'];
  var CATEGORY_NAME = {good: ['AVATAR', 'Admirito'], better: ['HUMAN', 'Luna'], best: ['METAHUMAN', 'Neo']};
  function nextLevel(level, dir) {
    var i = CYCLE.indexOf(LEVELS[level] ? level : 'good');
    if (i < 0) i = 0;
    var n = CYCLE.length;
    return CYCLE[((i + (dir < 0 ? -1 : 1)) % n + n) % n];
  }
  function categoryLabel(level) {
    var c = CATEGORY_NAME[level] || CATEGORY_NAME.good;
    return c[0] + ' · ' + c[1];
  }

  var api = {decide: decide, personajeMode: personajeMode, personajeArg: personajeArg, personajeUrl: personajeUrl, personajePagina: personajePagina, PERSONAJES: PERSONAJES, caraMensaje: caraMensaje, caraOrden: caraOrden, caraHueco: caraHueco,
    bugitoArg: bugitoArg, bugitoUrl: bugitoUrl, bugitoBanco: bugitoBanco, BUGITO: BUGITO, BUGITO_BANCO: BUGITO_BANCO, nextLevel: nextLevel, categoryLabel: categoryLabel, resolve: resolve, legacyValue: legacyValue, message: message,
    clampPanelSize: clampPanelSize, panelSizeAfterDrag: panelSizeAfterDrag, cleanContext: cleanContext, levelUrl: levelUrl, pickLevel: pickLevel,
    KEY: KEY, LEVEL_KEY: LEVEL_KEY, SIZE_KEY: SIZE_KEY, LEVELS: LEVELS, FLAGS_URL: FLAGS_URL, CENTRAL_BRAIN: CENTRAL_BRAIN};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  var previousAvatar=root.AdmiraAvatar&&root.AdmiraAvatar.handle?root.AdmiraAvatar:null;
  if(previousAvatar&&previousAvatar.floatingCharacters)return;

  var doc = document;
  var script = doc.currentScript;
  var data = (script && script.dataset) || {};
  var host = (root.location && root.location.host) || '';
  function store() { try { return root.localStorage; } catch (_) { return null; } }
  function session() { try { return root.sessionStorage; } catch (_) { return null; } }
  function get(k) { var s = store(); try { return s ? s.getItem(k) : null; } catch (_) { return null; } }
  function set(k, v) { var s = store(); try { if (s) { if (v == null) s.removeItem(k); else s.setItem(k, v); } } catch (_) {} }
  function en() { return String(doc.documentElement.lang || '').toLowerCase().indexOf('en') === 0; }

  // Migración del interruptor por sitio (una vez).
  (function migrate() {
    if(previousAvatar)return;
    var oldKey = 'da-avatar:' + host;
    var old = legacyValue(get(oldKey));
    if (old && !get(KEY)) set(KEY, old);
    if (get(oldKey) != null) set(oldKey, null);
  })();

  function override() { var v = get(KEY); return v === 'on' || v === 'off' ? v : null; }

  function brainUrl() {
    var b = String(data.brain || '').trim();
    if (!b) return root.location.origin === ORIGIN ? '/api/avatar-ask' : CENTRAL_BRAIN;
    if (b === 'local') b = '/avatar-ask';
    if (b.charAt(0) === '/') return root.location.origin + b;
    return /^https:\/\//.test(b) ? b : CENTRAL_BRAIN;
  }

  // ─── Elevación sobre las barras «Experto» de cada sitio ───
  function ensureLift() {
    if (doc.getElementById('admira-avatar-lift')) return;
    var style = doc.createElement('style');
    style.id = 'admira-avatar-lift';
    style.textContent = '#da-suite{right:16px !important;bottom:var(--da-lift,20px) !important;top:auto !important;z-index:25 !important}';
    (doc.head || doc.documentElement).appendChild(style);
  }
  function barHeight(el) {
    if (!el) return 0;
    var cs = root.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    var r = el.getBoundingClientRect();
    if (r.height < 24 || r.bottom < root.innerHeight - 40 || r.top > root.innerHeight - 8) return 0;
    return Math.round(root.innerHeight - r.top + 16);
  }
  function applyLift() {
    var h = 20;
    ['xsExpert', 'telegramDock', 'expert-panel', 'yk-rail-bottom'].forEach(function (id) { h = Math.max(h, barHeight(doc.getElementById(id))); });
    doc.querySelectorAll('.xs-expert, .yk-rail-bottom, .pf-cli').forEach(function (el) { h = Math.max(h, barHeight(el)); });
    doc.documentElement.style.setProperty('--da-lift', h + 'px');
    if (!resizing) fitPanel();
  }
  var liftTimer = null;
  function watchLift() {
    ensureLift();
    applyLift();
    root.addEventListener('resize', applyLift);root.addEventListener('admira:expert-resize',applyLift);
    // Las barras se abren y cierran sin avisar: se reajusta con un sondeo barato.
    if (!liftTimer) liftTimer = root.setInterval(applyLift, 1500);
  }

  // ─── Panel: una sola cara, la de digitalavatar.ai, en un iframe ───
  function node() { return doc.getElementById('da-suite'); }
  function visible() { var n = node(); return !!n && n.style.display !== 'none' && n.classList.contains('open'); }
  // Admirito está «presente» si la burbuja (o el panel) se ve, abierto o no.
  function present() { var n = node(); return !!n && n.style.display !== 'none'; }
  function storedLevel() {
    var v = get(LEVEL_KEY);
    return LEVELS[v] ? v : 'good';
  }
  var CHOICE_KEY = 'admira-avatar:nivel-elegido';   // sessionStorage: solo /avatar <nivel>
  function explicitLevel() { var s = session(); try { var v = s && s.getItem(CHOICE_KEY); return LEVELS[v] ? v : ''; } catch (_) { return ''; } }
  function pageTier() {
    var t = CTX.tier;
    if (!LEVELS[t]) { var g = root.AdmiraAvatarContext; t = g && typeof g === 'object' ? g.tier : ''; }
    t = CATEGORY_LEVEL[t] || t;
    return LEVELS[t] ? t : '';
  }
  function currentLevel() { return pickLevel(explicitLevel(), pageTier(), get(LEVEL_KEY)); }
  var resizing = null;
  function viewBox() {
    var top = 64;
    var bar = doc.getElementById('topBar') || doc.querySelector('.yk-bar');
    if (bar && bar.getBoundingClientRect) {
      var edge = bar.getBoundingClientRect().bottom;
      if (isFinite(edge)) top = Math.max(64, Math.round(edge) + 8);
    }
    var raw = doc.documentElement.style.getPropertyValue('--da-lift') || '';
    var lift = parseInt(raw, 10);
    var bottom = isFinite(lift) ? lift : 20;
    doc.documentElement.style.setProperty('--da-top', top + 'px');
    return {w: root.innerWidth || 1280, h: root.innerHeight || 800, top: top, bottom: bottom};
  }
  function readSize() {
    try { var s = JSON.parse(get(SIZE_KEY) || 'null'); if (s && isFinite(s.w) && isFinite(s.h)) return s; } catch (e) {}
    return null;
  }
  function fitPanel() {
    var panel = doc.getElementById('da-suite-panel');
    if (!panel || resizing) return;
    var stored = readSize();
    var s = clampPanelSize(stored && stored.w, stored && stored.h, viewBox());
    panel.style.width = (caraTope ? Math.min(s.w, caraTope) : s.w) + 'px';   // la cara se estrecha para no tapar la cámara
    panel.style.height = s.h + 'px';
    if (stored && (stored.w !== s.w || stored.h !== s.h)) set(SIZE_KEY, JSON.stringify(s));
  }
  function bindResize(handle) {
    function frameEl() { return doc.getElementById('da-suite-frame'); }
    function releasePointer() {
      var frame = frameEl();
      if (frame) frame.style.removeProperty('pointer-events');
      var wrap = node();
      if (wrap) wrap.classList.remove('da-resizing');
    }
    function end(e) {
      if (!resizing || (e && e.pointerId != null && e.pointerId !== resizing.id)) return;
      var panel = doc.getElementById('da-suite-panel');
      if (panel) {
        var rect = panel.getBoundingClientRect();
        var s = clampPanelSize(rect.width, rect.height, viewBox());
        panel.style.width = s.w + 'px';
        panel.style.height = s.h + 'px';
        set(SIZE_KEY, JSON.stringify(s));
      }
      releasePointer();
      resizing = null;
    }
    handle.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var panel = doc.getElementById('da-suite-panel');
      if (!panel) return;
      var rect = panel.getBoundingClientRect();
      resizing = {id: e.pointerId, x: e.clientX, y: e.clientY, w: rect.width, h: rect.height};
      var frame = frameEl();
      if (frame) frame.style.setProperty('pointer-events', 'none');
      var wrap = node();
      if (wrap) wrap.classList.add('da-resizing');
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!resizing || e.pointerId !== resizing.id) return;
      var s = panelSizeAfterDrag({w: resizing.w, h: resizing.h}, {x: e.clientX, y: e.clientY}, {x: resizing.x, y: resizing.y}, viewBox());
      var panel = doc.getElementById('da-suite-panel');
      if (panel) {
        panel.style.width = s.w + 'px';
        panel.style.height = s.h + 'px';
      }
      e.preventDefault();
    });
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  // Mascota: la nube del imagotipo de Admira (contorno #689840 de admira-logo_green.svg) en cartoon,
  // con ojos, mejillas y sonrisa; parpadea y bota al pasar el ratón (sin movimiento si reduced-motion).
  var NUBE = '<svg class="da-nube" viewBox="-6 6 289 186" width="62" height="40" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g class="da-nube-cuerpo"><path d="M213.31,59.13c-1,0-1.9.1-2.85.15a83,83,0,0,0-144,0c-1-.05-1.89-.15-2.85-.15A58.22,58.22,0,1,0,90.81,168.79a82.72,82.72,0,0,0,95.29,0A58.21,58.21,0,1,0,213.31,59.13Z" fill="#f3f9e8"/><path d="M213.31,59.13c-1,0-1.9.1-2.85.15a83,83,0,0,0-144,0c-1-.05-1.89-.15-2.85-.15A58.22,58.22,0,1,0,90.81,168.79a82.72,82.72,0,0,0,95.29,0A58.21,58.21,0,1,0,213.31,59.13Zm0,99.81a41.75,41.75,0,0,1-28.06-11,67.09,67.09,0,0,1-13.39,10.21,65.93,65.93,0,0,1-66.81,0A67.09,67.09,0,0,1,91.66,148,41.56,41.56,0,1,1,59,76a43.33,43.33,0,0,1,4.58-.26A41.39,41.39,0,0,1,76.11,77.7a66.43,66.43,0,0,1,124.69,0,41.39,41.39,0,0,1,12.51-1.93,43.33,43.33,0,0,1,4.58.26,41.58,41.58,0,0,1-4.58,82.91Z" fill="#689840"/><ellipse cx="92" cy="138" rx="15" ry="9" fill="#f5a3a3" opacity=".75"/><ellipse cx="185" cy="138" rx="15" ry="9" fill="#f5a3a3" opacity=".75"/><g class="da-nube-ojos"><ellipse cx="111" cy="110" rx="12.5" ry="17" fill="#1d2b12"/><ellipse cx="166" cy="110" rx="12.5" ry="17" fill="#1d2b12"/><circle cx="115.5" cy="103" r="5" fill="#fff"/><circle cx="170.5" cy="103" r="5" fill="#fff"/></g><path class="da-nube-boca" d="M122,135 Q138.5,153 155,135" fill="none" stroke="#1d2b12" stroke-width="8" stroke-linecap="round"/><path class="da-nube-risa" d="M121,131 Q138.5,162 156,131 Z" fill="#1d2b12" stroke="#1d2b12" stroke-width="4" stroke-linejoin="round"/><path class="da-nube-risa" d="M129,145 Q138.5,154 148,145 Q138.5,141 129,145Z" fill="#e8706f"/></g></svg>';
  // La burbuja del Supervisor (cara plegada junto a la cámara): la nube en menta y teal con su gorra y su ojo de cámara.
  var NUBE_SUPERVISOR = NUBE.replace('viewBox="-6 6 289 186"', 'viewBox="-6 -22 289 214"').replace(/#f3f9e8/g, '#eefcf6').replace(/#689840/g, '#1f8a70').replace(/#1d2b12/g, '#0b2d27')
    .replace('</g></svg>', '<path d="M84 42 C78 30 66 14 64 6 C62 -6 96 -16 138.5 -16 C181 -16 215 -6 213 6 C211 14 199 30 193 42 Z" fill="#165a4c" stroke="#04120f" stroke-width="6"/>'
      + '<path d="M78 55 Q138.5 43 199 55 Q205 65 190 69 Q138.5 59 87 69 Q72 65 78 55 Z" fill="#06100e"/><path d="M138.5 1 L152 6.5 L151 20 Q149 30 138.5 35 Q128 30 126 20 L125 6.5 Z" fill="#f2c94c"/>'
      + '<circle cx="166" cy="110" r="21" fill="none" stroke="#0b2d27" stroke-width="7"/><circle cx="181" cy="95" r="5" fill="#ff4d4d"/></g></svg>');
  var NOMBRE_MASCOTA = {bugito: 'Bugito', supervisor: 'Supervisor'};
  var floatingPersonaje='';
  // Older product loaders may be cached. Upgrade their existing API and dock,
  // preserving its listeners, iframe, project context and configured avatar level.
  if(previousAvatar){upgradeFloating(previousAvatar);return;}
  function paintMascot(id){
    floatingPersonaje=id||'';var wrap=node(),bubble=doc.getElementById('da-suite-bubble');if(!wrap||!bubble)return;
    var nombre=NOMBRE_MASCOTA[id]||'Admirito';
    wrap.setAttribute('data-personaje',floatingPersonaje);bubble.setAttribute('aria-label',nombre);bubble.title=nombre;
    bubble.innerHTML=id==='supervisor'?NUBE_SUPERVISOR:id==='bugito'?NUBE.replace('viewBox="-6 6 289 186"','viewBox="-18 -15 325 220"').replace(/#f3f9e8/g,'#ee3434').replace(/#689840/g,'#510b0b').replace('<g class="da-nube-cuerpo">','<g class="da-nube-cuerpo"><path d="M92 66 L65 2 L124 46 M179 46 L233 2 L211 71" fill="#ad1515" stroke="#510b0b" stroke-width="9" stroke-linejoin="round"/><path d="M244 146 Q296 177 280 107 M269 118 L280 97 L289 118" fill="none" stroke="#ee3434" stroke-width="8" stroke-linecap="round"/>'):NUBE;
  }
  function openPersonajePanel(id){
    var wrap=ensureDock(),frame=doc.getElementById('da-suite-frame');if(!wrap||!frame)return;
    frame.src=personajeUrl(id,previousAvatar&&previousAvatar.context?previousAvatar.context():context());frame.title=id==='bugito'?'Bugito':id;wrap.style.display='';wrap.classList.add('open');var label=doc.getElementById('da-suite-label');var text=label&&label.querySelector('.da-pill-txt');if(text)text.textContent=id.toUpperCase();fitPanel();applyLift();
  }
  function floatingShow(){if(previousAvatar)previousAvatar.show(false);else show(false);}
  function floatingHide(){if(previousAvatar)previousAvatar.hide();else hide();}
  function floatingCharacter(id,arg){
    if(arg==='off'){if(floatingPersonaje===id)floatingHide();return en()?'Bugito hidden.':'Bugito oculto.';}
    var on=arg==='on'||floatingPersonaje!==id||!present();
    if(on){floatingShow();paintMascot(id);set(KEY,'on');if(previousAvatar){var b=doc.getElementById('da-suite-bubble');if(b&&!b.hasAttribute('data-floating-upgrade')){b.setAttribute('data-floating-upgrade','');b.addEventListener('click',function(e){if(!floatingPersonaje)return;e.preventDefault();e.stopImmediatePropagation();openPersonajePanel(floatingPersonaje);},true);}applyLift();}}else{floatingHide();set(KEY,'off');}
    return en()?(on?'Bugito is floating on this page. Use /bugito full for the test bench.':'Bugito hidden.'):(on?'Bugito está flotando en esta página. Usa /bugito full para el banco de pruebas.':'Bugito oculto.');
  }
  function upgradeFloating(A){
    var oldHandle=A.handle,oldRun=A.run,oldPersonaje=A.personaje;
    function restore(text){var mode=decide(text);if(!floatingPersonaje)return null;if(mode==='mascota'){paintMascot('');A.show(false);set(KEY,'on');return message('mascota-on',en());}if(LEVELS[mode])paintMascot('');return null;}
    A.handle=function(text){if(decide(text)==='bugito')return personajeHandle('bugito',personajeArg('bugito',text)||'');var msg=restore(text);return msg!==null?Promise.resolve(msg):oldHandle.call(A,text);};
    A.run=function(text){if(decide(text)==='bugito')return personajeRun('bugito',personajeArg('bugito',text)||'');var msg=restore(text);return msg!==null?msg:oldRun?oldRun.call(A,text):oldHandle.call(A,text);};
    A.personaje=function(id){return id==='bugito'?{url:function(ctx){return personajeUrl(id,ctx||(A.context?A.context():{}));},pagina:function(arg,lang){return personajePagina(id,arg,lang);},run:function(arg){return personajeRun(id,arg||'');}}:oldPersonaje?oldPersonaje.call(A,id):null;};
    A.bugito=A.personaje('bugito');A.floatingCharacters=true;if(!A.cara)A.cara=cara;
    if(root.AvatarDigital)root.AvatarDigital.handle=A.handle;
    root.addEventListener('admira:expert-resize',applyLift);
  }
  function ensureDock() {
    if (node()) return node();
    watchLift();
    var wrap = doc.createElement('div');
    wrap.id = 'da-suite';
    wrap.setAttribute('style', 'position:fixed;right:16px;bottom:20px;z-index:25;font-family:ui-monospace,SFMono-Regular,Menlo,monospace');
    wrap.innerHTML = '<button type="button" id="da-suite-bubble" title="' + (en() ? 'Digital avatar' : 'Avatar digital') + '" style="width:64px;height:64px;padding:0;border-radius:50%;border:0;background:transparent;cursor:pointer">' + NUBE + '</button>'
      + '<div id="da-suite-panel" style="position:relative;box-sizing:border-box;background:#05080f;border:1px solid rgba(120,243,255,.35);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55);flex-direction:column">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px 6px 48px;color:#dff8ff;font-size:11px;letter-spacing:.12em"><button type="button" id="da-suite-label" class="da-pill"><span class="da-pill-txt">AVATAR · Admirito</span><span class="da-pill-chev" aria-hidden="true">›</span></button><button type="button" id="da-suite-x" style="background:none;border:0;color:#75aab9;cursor:pointer;font-size:15px">✕</button></div>'
      + '<iframe id="da-suite-frame" title="Avatar digital" style="flex:1;width:100%;min-height:0;border:0;background:#05080f" allow="autoplay; microphone; camera; fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>'
      + '<button type="button" id="da-suite-resize" aria-label="' + (en() ? 'Resize avatar' : 'Redimensionar el avatar') + '"></button></div>';
    doc.body.appendChild(wrap);
    var style = doc.getElementById('admira-avatar-open');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'admira-avatar-open';
      style.textContent = '#da-suite-panel{display:none}#da-suite.open #da-suite-bubble{display:none}#da-suite.open #da-suite-panel{display:flex}'
        + '#da-suite-bubble{display:grid;place-items:center}#da-suite.open #da-suite-bubble{display:none}'
        + '#da-suite-bubble .da-nube{display:block;overflow:visible;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))}'
        + '#da-suite-bubble .da-nube-cuerpo{transform-box:fill-box;transform-origin:50% 100%}'
        + '#da-suite-bubble .da-nube-ojos{transform-box:fill-box;transform-origin:50% 50%;animation:da-parpadeo 5s infinite}'
        + '#da-suite-bubble .da-nube-risa{opacity:0;transition:opacity .15s}'
        + '#da-suite-bubble .da-nube-boca{transition:opacity .15s}'
        + '#da-suite-bubble:hover .da-nube-risa,#da-suite-bubble:focus-visible .da-nube-risa{opacity:1}'
        + '#da-suite-bubble:hover .da-nube-boca,#da-suite-bubble:focus-visible .da-nube-boca{opacity:0}'
        + '#da-suite-bubble:hover .da-nube-cuerpo{animation:da-bote .6s ease-out}'
        + '#da-suite-bubble:focus-visible{outline:2px solid #689840;outline-offset:2px}'
        + '@keyframes da-parpadeo{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}'
        + '@keyframes da-bote{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-14%) scale(.97,1.04)}55%{transform:translateY(0) scale(1.05,.94)}75%{transform:translateY(-4%) scale(1,1)}100%{transform:translateY(0) scale(1,1)}}'
        + '@media (prefers-reduced-motion:reduce){#da-suite-bubble .da-nube-ojos,#da-suite-bubble:hover .da-nube-cuerpo{animation:none}}'
        + '#da-suite-panel{max-width:calc(100vw - 32px);max-height:calc(100vh - var(--da-top,64px) - var(--da-lift,20px))}'
        + '#da-suite-frame{position:relative;z-index:1}'
        + '#da-suite-resize{position:absolute;left:0;top:0;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:nwse-resize;touch-action:none;z-index:6}'
        + '#da-suite-resize:before{content:"";position:absolute;left:8px;top:8px;width:14px;height:14px;border-left:2px solid rgba(120,243,255,.9);border-top:2px solid rgba(120,243,255,.9)}'
        + '#da-suite.da-resizing{z-index:2147483646 !important}'
        + '.da-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid rgba(120,243,255,.45);background:rgba(120,243,255,.08);color:#dff8ff;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;cursor:pointer;touch-action:pan-y;user-select:none;transition:background .15s,border-color .15s}'
        + '.da-pill:hover,.da-pill:focus-visible{background:rgba(120,243,255,.18);border-color:#78f3ff;outline:none}'
        + '.da-pill-chev{font-size:14px;opacity:.75;transition:transform .2s}.da-pill:hover .da-pill-chev{transform:translateX(2px)}'
        + '#da-suite-frame{transition:opacity .22s ease}#da-suite.da-fading #da-suite-frame{opacity:0}'
        + '@media (prefers-reduced-motion:reduce){#da-suite-frame{transition:none}}';
      (doc.head || doc.documentElement).appendChild(style);
    }
    fitPanel();
    bindResize(wrap.querySelector('#da-suite-resize'));
    wrap.querySelector('#da-suite-frame').addEventListener('load', postContext);
    wrap.querySelector('#da-suite-bubble').addEventListener('click', function () { if(floatingPersonaje)openPersonajePanel(floatingPersonaje);else requestOpen(currentLevel()); });
    // El idioma de la página manda: si cambia, la cara recibe el nuevo (chips e idioma de respuesta).
    try { new MutationObserver(postContext).observe(doc.documentElement, {attributes: true, attributeFilter: ['lang']}); } catch (_) {}
    root.addEventListener('storage', function (e) { if (e && e.key === 'admiranext_expert_lang') postContext(); });
    wrap.querySelector('#da-suite-x').addEventListener('click', function () { wrap.classList.remove('open'); });
    bindPill(wrap.querySelector('#da-suite-label'));
    return wrap;
  }
  function paintPill(lv) {
    var pill = doc.getElementById('da-suite-label');
    if (!pill) return;
    var txt = pill.querySelector('.da-pill-txt');
    if (txt) txt.textContent = categoryLabel(lv);
    var tip = en() ? 'Tap to change avatar (swipe or ←/→)' : 'Pulsa para cambiar de avatar (desliza o ←/→)';
    pill.title = tip;
    pill.setAttribute('aria-label', categoryLabel(lv) + ' — ' + tip);
  }
  // Elección por la pastilla = misma memoria que /avatar <categoría> (localStorage + pestaña).
  function chooseLevel(lv) {
    paintMascot('');
    if (!LEVELS[lv]) return;
    set(LEVEL_KEY, lv);
    var ss = session(); try { if (ss) ss.setItem(CHOICE_KEY, lv); } catch (_) {}
    set(KEY, 'on');
    var wrap = node();
    if (!wrap || !visible()) { show(true, lv); return; }
    paintPill(lv);
    wrap.classList.add('da-fading');
    root.setTimeout(function () {
      openLevel(lv);
      var frame = wrap.querySelector('#da-suite-frame');
      var done = function () { wrap.classList.remove('da-fading'); };
      if (frame) frame.addEventListener('load', done, {once: true});
      root.setTimeout(done, 1500);
    }, 200);
  }
  function stepLevel(dir) { chooseLevel(nextLevel(openedLevel || currentLevel(), dir)); }
  function bindPill(pill) {
    if (!pill) return;
    var start = null, swiped = false;
    pill.addEventListener('pointerdown', function (e) { start = {x: e.clientX, y: e.clientY}; swiped = false; });
    pill.addEventListener('pointerup', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) { swiped = true; stepLevel(dx > 0 ? 1 : -1); }
    });
    pill.addEventListener('pointercancel', function () { start = null; });
    pill.addEventListener('click', function (e) { e.preventDefault(); if (swiped) { swiped = false; return; } stepLevel(1); });
    pill.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); stepLevel(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); stepLevel(-1); }
    });
  }
  var DA_ORIGIN = 'https://digitalavatar.ai';
  var CTX = {};
  var openedLevel = '';
  // Por defecto: ?loc de la página, idioma de ⌘ Experto (admiranext_expert_lang) o del
  // documento, marca blanca de la pestaña (mb:marca), data-loc/data-sector del script y
  // window.AdmiraAvatarContext. setContext() manda sobre todo eso.
  function defaultContext() {
    var c = {};
    try { var q = new URLSearchParams(root.location.search); if (q.get('loc')) c.loc = q.get('loc'); } catch (_) {}
    c.lang = get('admiranext_expert_lang') || String(doc.documentElement.lang || '').slice(0, 2);
    var s = session(); try { var m = s && s.getItem('mb:marca'); if (m) c.brand = m; } catch (_) {}
    if (data.loc) c.loc = data.loc;
    if (data.sector) c.sector = data.sector;
    var g = root.AdmiraAvatarContext;
    if (g && typeof g === 'object') for (var k in g) if (Object.prototype.hasOwnProperty.call(g, k)) c[k] = g[k];
    return c;
  }
  function context() {
    var c = defaultContext();
    for (var k in CTX) if (Object.prototype.hasOwnProperty.call(CTX, k)) { if (CTX[k] == null || CTX[k] === '') delete c[k]; else c[k] = CTX[k]; }
    return cleanContext(c);
  }
  function postContext() {
    var n = node(), frame = n && n.querySelector('#da-suite-frame');
    if (!frame || !frame.contentWindow || !frame.getAttribute('src')) return;
    var msg = context(); msg.type = 'da-context'; msg.tier = openedLevel || currentLevel();
    try { frame.contentWindow.postMessage(msg, DA_ORIGIN); } catch (_) {}
    postSubdemos(frame);
  }
  // Subdemos locales de la plataforma (admira.studio / pixeria.com: /demo 1…5 son voz, música, imagen, vídeo y adaptar).
  // La cara las recibe para presentar la que se pida; al acabar de hablar devuelve {type:'da-demo', texto}
  // y aquí la enseña el mismo motor del ⌘ Experto (AdmiraExperto.demo).
  function postSubdemos(frame) {
    var X = root.AdmiraExperto;
    if (!X || typeof X.subdemos !== 'function') return;
    Promise.resolve(X.listo && X.listo()).then(function () {
      var m = X.subdemos();
      if (!m || !m.subdemos) return;
      try {
        frame.contentWindow.postMessage({type: 'da-subdemos', plataforma: m.plataforma, nombre: m.nombre || '', subdemos: m.subdemos.map(function (d, k) {
          return {n: k + 1, id: d.id, nombre: d.nombre, desc: d.desc || '', aliases: (d.aliases || []).slice()};
        })}, DA_ORIGIN);
      } catch (_) {}
    });
  }
  function setContext(partial) {
    if (partial && typeof partial === 'object') for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k) && (CTX_KEYS.indexOf(k) >= 0 || k === 'tier')) CTX[k] = partial[k];
    // Si la página cambia de nivel (p. ej. el gemelo pasa a Matrix) y el usuario no eligió uno,
    // el panel abierto cambia de cara; si no, el contexto viaja por postMessage.
    var lv = currentLevel();
    if (visible() && openedLevel && lv !== openedLevel) openLevel(lv); else postContext();
    return context();
  }
  function openLevel(level) {
    var wrap = ensureDock();
    var frame = wrap.querySelector('#da-suite-frame');
    var lv = LEVELS[level] ? level : 'good';
    // Cambiar de nivel recarga la cara; con el mismo nivel, el contexto viaja por postMessage.
    if (!frame.getAttribute('src') || openedLevel !== lv) { openedLevel = lv; frame.setAttribute('src', levelUrl(lv, context())); }
    else postContext();
    paintPill(lv);
    wrap.style.display = '';
    wrap.classList.add('open');
    applyLift();
  }
  // Antes de abrir el panel por orden del usuario se emite 'admira-avatar:open' (cancelable) en
  // window: una página con su propio avatar en escena (p. ej. el gemelo en Matrix, que lo proyecta
  // en la pared) puede llevarlo allí con preventDefault() y el panel no se abre.
  function requestOpen(level) {
    var lv = LEVELS[level] ? level : 'good';
    try {
      if (typeof root.CustomEvent === 'function' && root.dispatchEvent) {
        var ev = new root.CustomEvent('admira-avatar:open', {cancelable: true, detail: {level: lv, context: context()}});
        if (!root.dispatchEvent(ev)) { var n = node(); if (n) { n.style.display = ''; n.classList.remove('open'); } return false; }
      }
    } catch (_) {}
    openLevel(lv);
    return true;
  }
  function show(open, level) {
    var lv = LEVELS[level] ? level : currentLevel();
    if (LEVELS[level]) set(LEVEL_KEY, lv);
    ensureDock();
    if (open) requestOpen(lv);
    else {
      var n = node();
      if (n) { n.style.display = ''; n.classList.remove('open'); }
      applyLift();
    }
    return Promise.resolve(true);
  }
  function hide() {
    var n = node();
    if (n) { n.classList.remove('open'); n.style.display = 'none'; var frame = n.querySelector('iframe'); if (frame) frame.removeAttribute('src'); openedLevel = ''; }
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (_) {}
  }

  // ─── Interruptor del proyecto ───
  function readCache() {
    var s = session();
    try { var c = JSON.parse((s && s.getItem(CACHE)) || 'null'); if (c && c.host === host && Date.now() - c.t < CACHE_MS) return c.on; } catch (_) {}
    return null;
  }
  function projectFlag() {
    var cached = readCache();
    if (cached !== null) return Promise.resolve(cached);
    if (typeof fetch !== 'function') return Promise.resolve(null);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? root.setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    return fetch(FLAGS_URL + '?host=' + encodeURIComponent(host), {credentials: 'omit', cache: 'default', signal: ctl ? ctl.signal : undefined})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var on = !!(d && d.on === true);
        var s = session();
        try { if (s) s.setItem(CACHE, JSON.stringify({t: Date.now(), host: host, on: on, project: d && d.project})); } catch (_) {}
        return on;
      })
      .catch(function () { return null; })
      .then(function (v) { if (timer) root.clearTimeout(timer); return v; });
  }

  // Devuelve el texto de la respuesta para la consola. Síncrono en lo que importa:
  // la elección se guarda antes de volver.
  function run(text) {
    var mode = decide(text);
    if (mode == null) return null;
    var english = en();
    if (mode === 'bad') return message('bad', english);
    if (mode === 'status') {
      var now = currentLevel();
      var seen = visible() ? (english ? 'open' : 'abierto') : (english ? 'hidden' : 'oculto');
      return message('status', english) + (english ? ' Now: ' : ' Ahora: ') + categoryLabel(now) + ' · ' + seen + '.';
    }
    if (mode === 'reset') {
      set(KEY, null);
      projectFlag().then(function (flag) { if (flag) show(false); else hide(); });
      return message(readCache() ? 'reset-on' : 'reset-off', english);
    }
    if (LEVELS[mode]) {
      paintMascot('');
      set(LEVEL_KEY, mode);
      var ss = session(); try { if (ss) ss.setItem(CHOICE_KEY, mode); } catch (_) {}
      set(KEY, 'on');
      show(true, mode);
      return message(mode, english);
    }
    if (Object.prototype.hasOwnProperty.call(PERSONAJES, mode)) return personajeRun(mode, personajeArg(mode, text) || '');
    if (mode === 'mascota') {
      var vis = !!floatingPersonaje||!present();paintMascot('');
      set(KEY, vis ? 'on' : 'off');
      if (vis) show(false); else hide();
      return message(vis ? 'mascota-on' : 'mascota-off', english);
    }
    var on = mode === 'toggle' ? !visible() : mode === 'on';
    set(KEY, on ? 'on' : 'off');
    if (on) show(true); else hide();
    return message(on ? 'on' : 'off', english);
  }
  // /<personaje>: en su página (que registra window.Admira<Id>, p. ej. AdmiraBugito) lo muestra u oculta o le
  // pasa el argumento (Bugito: lanza ese fallo); en cualquier otra página de la red abre la suya.
  // La acción: texto, o promesa de texto cuando la página lanza algo asíncrono (Bugito manda la orden al mando).
  function personajeAccion(id, arg) {
    if(id==='bugito'&&/^(error|fallo|fault|restaurar|restore)\s+/i.test(arg))return bugitoEngine().then(function(X){return X.exec('/bugito '+arg,doc.createElement('ul'),{echo:false});});
    var B = root[PERSONAJES[id].gancho], english = en(),mode=personajeMode(id,arg);
    if(mode==='floating')return floatingCharacter(id,arg);
    if(mode==='full'){root.location.assign(personajePagina(id,'',english?'en':'es'));return message(id+'-ir',english);}
    if (B && typeof B.toggle === 'function' && typeof B.lanzar === 'function') {
      try { return arg ? B.lanzar(arg) : B.toggle(); } catch (_) { return message(id + '-fallo', english); }
    }
    root.location.assign(personajePagina(id, arg, english ? 'en' : 'es'));
    return message(id + '-ir', english);
  }
  var bugitoEngineLoading=null;
  function bugitoEngine(){
    if(root.AdmiraExperto&&root.AdmiraExperto.bugitoPhysical)return Promise.resolve(root.AdmiraExperto);
    if(bugitoEngineLoading)return bugitoEngineLoading;
    bugitoEngineLoading=new Promise(function(resolve,reject){
      var script=doc.createElement('script');script.src=ORIGIN+'/suite/experto.js?v=20261015-bugito-command-1';script.dataset.commandsOnly='1';
      var timer=root.setTimeout(function(){reject(Error('Command engine unavailable'));},15000);
      script.onload=function(){root.clearTimeout(timer);root.AdmiraExperto&&root.AdmiraExperto.bugitoPhysical?resolve(root.AdmiraExperto):reject(Error('Command engine unavailable'));};
      script.onerror=function(){root.clearTimeout(timer);reject(Error('Command engine unavailable'));};(doc.head||doc.body).appendChild(script);
    });return bugitoEngineLoading;
  }
  // run() es síncrono: si la acción es una promesa, queda atendida (nunca un rechazo suelto) y se devuelve el
  // aviso inmediato; handle() espera y devuelve el texto final.
  function personajeRun(id, arg) {
    var r = personajeAccion(id, arg);
    if (r && typeof r.then === 'function') { r.then(null, function () {}); return message(id + '-lanza', en(), arg); }
    return r == null ? '' : String(r);
  }
  function personajeHandle(id, arg) {
    var english = en();
    var r;
    try { r = personajeAccion(id, arg); } catch (_) { r = message(id + '-fallo', english); }
    return Promise.resolve(r).then(function (m) { return m == null || m === '' ? message(id + '-lanza', english, arg) : String(m); },
      function () { return message(id + '-fallo', english); });
  }
  function personaje(id) {
    if (!Object.prototype.hasOwnProperty.call(PERSONAJES, id)) return null;
    return {url: function (ctx) { return personajeUrl(id, ctx || context()); }, pagina: function (arg, lang) { return personajePagina(id, arg, lang); }, run: function (arg) { return personajeRun(id, arg || ''); }};
  }
  // La cara de un personaje junto a lo que la página ya enseña (Supervisor, 18-oct-2026: la cámara de Admira Live sigue
  // abierta y su cara sale en el panel). Abre el panel con nube.html?personaje=<id> (si ya es esa cara, no la recarga)
  // y devuelve {enviar(msg), cerrar()}. enviar manda {type:'da-<id>', estado, …} (caraMensaje) en cuanto la cara avisa
  // 'da-<id>-listo', y lo repite si se recarga; opts.orden recibe sus órdenes ('da-<id>-orden': {orden, texto, lang}).
  // Sólo se habla con el iframe propio y con el origen de digitalavatar.ai. Contrato: mcp/SUPERVISOR.md.
  var caraActual = null, escuchandoCaras = false, caraTope = 0;
  function cara(id, opts) {
    if (!Object.prototype.hasOwnProperty.call(PERSONAJES, id)) return null;
    escucharCaras();
    if (!caraViva(caraActual, id)) {
      caraActual = {id: id, listo: false, ultimo: null, orden: null, src: '', evitar: '', modo: ''};
      caraTope = 0; openPersonajePanel(id); openedLevel = '';
      var frame = doc.getElementById('da-suite-frame');
      caraActual.src = frame ? frame.getAttribute('src') || '' : '';
    } else { var wrap = node(); if (wrap) { wrap.style.display = ''; wrap.classList.add('open'); } applyLift(); }
    if (opts && typeof opts.orden === 'function') caraActual.orden = opts.orden;
    // opts.evitar: selector de lo que la cara no debe tapar (Jobs, 18-oct-2026: «que no tape ningún control de la cámara;
    // si los tapa, que se pliegue o se aparte»). Se estrecha a la derecha de esa zona o se pliega en su burbuja.
    if (opts && typeof opts.evitar === 'string' && opts.evitar.length <= 100) caraActual.evitar = opts.evitar;
    caraApartar(caraActual);
    var mia = caraActual;
    return {
      modo: function () { return mia.modo; },
      enviar: function (msg) {
        var m = caraMensaje(id, msg);
        if (!m || caraActual !== mia || !caraViva(mia, id)) return false;
        mia.ultimo = m;
        if (mia.listo) caraPost(m);
        return true;
      },
      cerrar: function () { if (caraActual === mia) { caraActual = null; var n = node(); if (n) n.classList.remove('open'); } }
    };
  }
  function caraApartar(c) {
    var wrap = node(), panel = doc.getElementById('da-suite-panel'), zona = null;
    caraTope = 0; fitPanel();
    try { zona = c && c.evitar ? doc.querySelector(c.evitar) : null; } catch (_) { zona = null; }
    if (!zona || !wrap || !panel || !wrap.classList.contains('open')) { if (c) c.modo = 'libre'; return 'libre'; }
    var h = caraHueco(zona.getBoundingClientRect(), panel.getBoundingClientRect(), {w: root.innerWidth || 1280});
    if (h.modo === 'estrecha') { caraTope = h.ancho; fitPanel(); }
    else if (h.modo === 'plegada') { wrap.classList.remove('open'); paintMascot(c.id); applyLift(); }
    c.modo = h.modo;
    return h.modo;
  }
  // ¿Sigue en el panel la cara que se abrió? (/avatar good u ocultar el panel la quitan.)
  function caraViva(c, id) {
    var frame = doc.getElementById('da-suite-frame');
    return !!c && c.id === id && !!frame && !!c.src && frame.getAttribute('src') === c.src;
  }
  function caraPost(m) {
    var frame = doc.getElementById('da-suite-frame');
    try { if (frame && frame.contentWindow) frame.contentWindow.postMessage(m, CARA_ORIGIN); } catch (_) {}
  }
  function escucharCaras() {
    if (escuchandoCaras) return;
    escuchandoCaras = true;
    // Si cambia la ventana, la cara vuelve a buscar su sitio junto a la zona que no debe tapar.
    root.addEventListener('resize', function () { var c = caraActual, n = node(); if (c && c.evitar && caraViva(c, c.id) && n && n.classList.contains('open')) caraApartar(c); });
    root.addEventListener('message', function (ev) {
      var d = ev && ev.data, frame = doc.getElementById('da-suite-frame'), c = caraActual;
      if (!c || !caraViva(c, c.id) || !d || typeof d !== 'object' || ev.origin !== CARA_ORIGIN || !frame || ev.source !== frame.contentWindow) return;
      if (d.type === 'da-' + c.id + '-listo') { c.listo = true; if (c.ultimo) caraPost(c.ultimo); return; }
      var o = caraOrden(c.id, d);
      if (o && c.orden) { try { c.orden(o); } catch (_) {} }
    });
  }
  function handle(text) {
    var pmode = decide(text);
    if (pmode && Object.prototype.hasOwnProperty.call(PERSONAJES, pmode)) return personajeHandle(pmode, personajeArg(pmode, text) || '');
    var out = run(text);
    return Promise.resolve(out == null ? message('bad', en()) : out);
  }
  function state() {
    return {override: override(), visible: visible(), present: present(), level: currentLevel(), host: host, brain: brainUrl(), context: context()};
  }

  // ─── /demo desde el avatar (Carlos, 7-oct-2026, demo Alsea) ───
  // La cara (digitalavatar.ai) presenta la solución y, al acabar de hablar, manda
  // {type:'da-demo', id}. Aquí se abre su demo con el mismo catálogo del ⌘ Experto
  // (AdmiraExperto.parseDemo, suite/experto.js); sin Experto en la página, estas URL.
  var DEMO_URL = {
    studio: 'https://www.admira.studio/',
    store: 'https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es&demo=tpv#tpv',
    tv: 'https://admira.tv/adcelerate/demo/?view=human&site=starbucks',
    app: 'https://www.admira.app/retailer?marca=starbucks',
    biz: 'https://www.admira.biz/'
  };
  var NATIVE_HOSTS = {
    studio: ['admira.studio', 'pixeria.com'], store: ['admira.store', 'xpaceos.com'],
    tv: ['admira.tv'], biz: ['admira.biz', 'clearchannel.tv'], app: ['admira.app', 'yokup.com']
  };
  function nativeHost(id, hostname) {
    return !!NATIVE_HOSTS[id] && NATIVE_HOSTS[id].indexOf(String(hostname || '').toLowerCase().replace(/^www\./, '')) !== -1;
  }
  function demoUrl(id) {
    id = String(id || '').toLowerCase();
    if (!NATIVE_HOSTS[id]) return '';
    var X = root.AdmiraExperto, p = X && typeof X.parseDemo === 'function' ? X.parseDemo('/demo ' + id) : null;
    try {
      var url = new URL((p && p.url) || DEMO_URL[id]);
      if (url.protocol !== 'https:' || url.username || url.password || !nativeHost(id, url.hostname)) return '';
      if (id === 'store') {
        if (url.searchParams.get('demo') === 'tpv') url.searchParams.delete('demo');
        if (url.hash === '#tpv') url.hash = '';
      }
      var language = en() ? 'en' : 'es';
      try { var requestedLanguage = new URL(root.location.href).searchParams.get('lang'); if (/^(es|en)$/.test(requestedLanguage || '')) language = requestedLanguage; } catch (_) {}
      url.searchParams.set('lang', language);
      url.searchParams.set('ax_demo', id);
      url.searchParams.set('ax_run', root.crypto && typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
      return url.href;
    } catch (_) { return ''; }
  }
  // Native URL activation is independent of opening the avatar. Never bootstrap
  // from localhost previews, unrelated hosts or user supplied script URLs.
  function funcionDemoHost(hostname) {
    var h = String(hostname || '').toLowerCase().replace(/^www\./, '');
    return ['admiranext.com','admira.biz','clearchannel.tv','admira.store','xpaceos.com','admira.studio','pixeria.com','admira.tv','admira.app','yokup.com'].indexOf(h) !== -1;
  }
  function bootNativeDemo() {
    var url, id;
    try { url = new URL(root.location.href); id = url.searchParams.get('ax_demo'); } catch (_) { return; }
    var funcion = id === 'hoy';
    if (url.protocol !== 'https:' || !(funcion ? funcionDemoHost(url.hostname) : nativeHost(id, url.hostname))) return;
    if (root.AdmiraExperto || root.__admiraNativeDemoLoading) return;
    root.__admiraNativeDemoLoading = new Promise(function (resolve, reject) {
      var script = doc.querySelector('script[data-admira-demo-engine]') || doc.querySelector('script[src^="https://www.admiranext.com/suite/experto.js"]'), created = false;
      if (!script) {
        script = doc.createElement('script');
        script.src = ORIGIN + '/suite/experto.js?v=20261009-demo-5446';
        script.defer = true; script.dataset.admiraDemoEngine = '1'; script.dataset.pata = id;
        created = true;
      }
      if (root.AdmiraExperto) { resolve(root.AdmiraExperto); return; }
      var timer = root.setTimeout(function () { reject(new Error('Native demo engine did not load.')); }, 15000);
      script.addEventListener('load', function () { root.clearTimeout(timer); root.AdmiraExperto ? resolve(root.AdmiraExperto) : reject(new Error('Native demo engine unavailable.')); }, {once: true});
      script.addEventListener('error', function () { root.clearTimeout(timer); reject(new Error('Native demo engine failed to load.')); }, {once: true});
      if (created) (doc.head || doc.body || doc.documentElement).appendChild(script);
    });
    root.__admiraNativeDemoLoading.catch(function () {
      if (root.console && typeof root.console.warn === 'function') root.console.warn('Native demo engine unavailable. Reload the platform to retry.');
    });
  }
  function openDemo(id) {
    var url = demoUrl(id);
    if (!url) return false;
    root.location.assign(url);
    return true;
  }
  // Requests are scoped to the owned frame window; re-delivery returns the
  // original confirmation rather than running a control (for example next) twice.
  var demoRequests = new WeakMap();
  function demoReply(source, payload) {
    try { source.postMessage(payload, DA_ORIGIN); } catch (_) {}
  }
  function demoState(X) {
    var raw = X && typeof X.demoEstado === 'function' ? X.demoEstado() : null;
    if (!raw || typeof raw !== 'object') return null;
    var safe = {};
    ['activo', 'pausado', 'demo', 'fase', 'fases', 'numero', 'total'].forEach(function (key) {
      if (typeof raw[key] === 'boolean' || (typeof raw[key] === 'number' && Number.isFinite(raw[key]))) safe[key] = raw[key];
      else if (typeof raw[key] === 'string') safe[key] = raw[key].slice(0, 200);
    });
    return safe;
  }
  root.addEventListener('message', function (ev) {
    var d = ev && ev.data, frame = doc.getElementById('da-suite-frame');
    if (!d || typeof d !== 'object' || d.type !== 'da-demo' || ev.origin !== DA_ORIGIN || !frame || ev.source !== frame.contentWindow) return;
    var requested = Object.prototype.hasOwnProperty.call(d, 'requestId');
    if (requested && (typeof d.requestId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(d.requestId))) return;
    var text = typeof d.texto === 'string' ? d.texto.trim() : '';
    var id = typeof d.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(d.id) ? d.id : '';
    if (!text && id) text = '/demo ' + id;
    var valid = /^\/?demo(?:\s|$)/i.test(text) && text.length <= 200 && !/[\r\n]/.test(text);
    var cache, existing;
    if (requested) {
      cache = demoRequests.get(ev.source);
      if (!cache) { cache = new Map(); demoRequests.set(ev.source, cache); }
      existing = cache.get(d.requestId);
      if (existing) {
        if (existing.text !== text) { demoReply(ev.source, {type: 'da-demo-result', requestId: d.requestId, ok: false, message: 'Request identifier already used for another command.'}); return; }
        existing.promise.then(function (ack) { demoReply(ev.source, ack); }); return;
      }
      if (cache.size >= 128) {
        // Do not evict confirmed IDs: an old duplicate must never execute again.
        demoReply(ev.source, {type: 'da-demo-result', requestId: d.requestId, ok: false, message: 'Command limit reached. Reload the page before sending more commands.'}); return;
      }
    }
    var entry = {text: text};
    entry.promise = Promise.resolve().then(function () {
      if (!valid) return {ok: false, message: 'Invalid demo command.'};
      var X = root.AdmiraExperto, log = doc.createElement('div');
      if (X && typeof X.demo === 'function') {
        return Promise.resolve(typeof X.listo === 'function' ? X.listo() : null).then(function () { return X.demo(text, log); }).then(function (result) {
          var message = (log.textContent || '').trim().slice(0, 4000), error = !!log.querySelector('.err');
          var ok = !error && (result != null || !!message);
          if (!ok && !error && id) ok = openDemo(id);
          var ack = {ok: ok, message: message || (ok ? 'Demo command completed.' : 'Demo command was not handled.'), estado: demoState(X)};
          if (result != null) {
            try { var encoded = JSON.stringify(result); if (encoded.length <= 8192) ack.result = JSON.parse(encoded); } catch (_) {}
          }
          return ack;
        });
      }
      var opened = !!id && openDemo(id);
      return {ok: opened, message: opened ? 'Opening demo.' : 'Local demo engine unavailable.'};
    }).catch(function () { return {ok: false, message: 'Demo command failed.'}; }).then(function (ack) {
      if (requested) { ack.type = 'da-demo-result'; ack.requestId = d.requestId; }
      return ack;
    });
    if (requested) { cache.set(d.requestId, entry); entry.promise.then(function (ack) { demoReply(ev.source, ack); }); }
  });

  root.AdmiraAvatar = {floatingCharacters:true,run: run, handle: handle, personaje: personaje, cara: cara, bugito: personaje('bugito'), demo: openDemo, demoUrl: demoUrl, next: function () { stepLevel(1); }, prev: function () { stepLevel(-1); }, decide: decide, show: show, hide: hide, state: state, setContext: setContext, context: context,
    reset: function () { set(KEY, null); }, flag: projectFlag};
  // Compatibilidad con los CLI que ya llamaban a AvatarDigital (FLT-101350).
  root.AvatarDigital = {handle: handle, decide: decide, show: function () { set(KEY, 'on'); return show(true); },
    hide: function () { set(KEY, 'off'); hide(); }, storedOn: function () { return override() === 'on'; }};

  function boot() {
    bootNativeDemo();
    var o = override();
    if (o === 'on') { show(false); return; }
    if (o === 'off') return;
    projectFlag().then(function (flag) {
      if (override() !== null) return;          // el usuario decidió mientras tanto
      if (visible()) return;                    // o algo abrió el panel (p. ej. la cara del Supervisor): no se pliega
      if (resolve(null, flag).on) show(false);   // burbuja cerrada; no se guarda nada
    });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window === 'undefined' ? globalThis : window);
