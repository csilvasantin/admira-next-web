(function (G, d) {
  'use strict';

  var TWO_HOURS = 2 * 60 * 60 * 1000;
  var byId = function (id) { return d.getElementById(id); };
  var english = function () { return /^en/i.test(d.documentElement.lang || ''); };
  var T = function (es, en) { return english() ? en : es; };
  var escape = function (value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var state = {demo:false, devices:[], loaded:false, loading:false, lastRead:null, error:null, request:0, controller:null};
  var map, markers, tiles, pins = new Map(), halos = [], fitNext = true, temaTicket = 0;

  function hasPosition(device) {
    return typeof device.lat === 'number' && Number.isFinite(device.lat) && Math.abs(device.lat) <= 90 &&
      typeof device.lon === 'number' && Number.isFinite(device.lon) && Math.abs(device.lon) <= 180;
  }

  function timestamp(value) {
    if (!value) return null;
    var time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }

  function status(device) {
    if (device.tipo === 'fijo') return 'fixed';
    var time = timestamp(device.ultimo_aviso || device.ts);
    if (time == null) return 'missing';
    return Date.now() - time > TWO_HOURS ? 'stale' : 'fresh';
  }

  function statusText(key) {
    return {fixed:T('Referencia fija','Fixed reference'),missing:T('Sin avisos','No reports'),stale:T('Desactualizado','Outdated'),fresh:T('Actualizado','Up to date'),prueba:T('Dato de prueba','Test data')}[key];
  }

  function esPrueba(device) {
    if (state.demo) return true;
    var blob = [device && device.fuente, device && device.equipo, device && device.nombre].join(' ');
    return /demo|fixture|prueba|sint[eé]t|ejemplo|\btest\b|sample/i.test(blob);
  }

  function nombreCorto(device) {
    if (!device) return '';
    if (device.tipo === 'movil' || /iphone/i.test(device.equipo || '')) return 'iPhone';
    if (device.equipo === 'mac-mini') return 'Mac mini';
    var name = String(device.nombre || device.equipo || '').split('·')[0].trim();
    return name.length > 18 ? name.slice(0, 18).trim() : name;
  }

  var GLYPH = {
    movil: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="18.2" r="0.8" fill="currentColor"/></svg>',
    fijo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  function date(value) {
    var time = timestamp(value);
    return time == null ? '—' : new Intl.DateTimeFormat(english() ? 'en-GB' : 'es-ES', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(time));
  }

  function ago(value) {
    var time = timestamp(value);
    if (time == null) return '';
    var minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    var amount = minutes < 1 ? T('ahora','just now') : minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' h';
    return minutes < 1 ? amount : T('hace ','') + amount + T('',' ago');
  }

  function sample() {
    var now = Date.now();
    return [
      {equipo:'iphone-carlos',nombre:T('iPhone 17 Pro Max · ejemplo','iPhone 17 Pro Max · example'),tipo:'movil',lat:41.3918,lon:2.1645,precision_m:14,bateria:78,fuente:'demo',ts:new Date(now - 4 * 60000).toISOString(),ultimo_aviso:new Date(now - 4 * 60000).toISOString()},
      {equipo:'mac-mini',nombre:T('Mac mini · ejemplo','Mac mini · example'),tipo:'fijo',direccion:T('Dirección y coordenadas de ejemplo, Barcelona','Example address and coordinates, Barcelona'),lat:41.4015,lon:2.1582,precision_m:null,bateria:null,fuente:'demo',ts:null,ultimo_aviso:null}
    ];
  }

  function row(label, value) { return '<div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>'; }

  function renderDevices() {
    var target = byId('equipos-lista');
    target.setAttribute('data-yk-no-traducir', '');
    byId('equipos-numero').textContent = state.loaded ? String(state.devices.length) : '—';
    if (!state.loaded) {
      var waiting = state.error === 'session'
        ? T('Inicia sesión para ver los equipos.','Sign in to see the devices.')
        : T('Esperando datos…','Waiting for data…');
      target.innerHTML = '<p class="mapa-loading">' + waiting + '</p>';
      return;
    }
    target.innerHTML = state.devices.length ? state.devices.map(function (device) {
      var prueba = esPrueba(device), key = prueba ? 'prueba' : status(device), positioned = hasPosition(device), last = device.ultimo_aviso || device.ts;
      var info = row(T('Último aviso','Last report'), prueba ? T('Dato de prueba','Test data') : last ? date(last) + ' · ' + ago(last) : T('Sin avisos recibidos','No reports received'));
      if (positioned) info += row(T('Coordenadas','Coordinates'), device.lat.toFixed(5) + ', ' + device.lon.toFixed(5));
      if (typeof device.precision_m === 'number' && Number.isFinite(device.precision_m)) info += row(T('Precisión','Accuracy'), '± ' + Math.round(device.precision_m) + ' m');
      if (typeof device.bateria === 'number' && Number.isFinite(device.bateria)) info += row(T('Batería','Battery'), Math.round(device.bateria) + ' %');
      if (device.fuente) info += row(T('Fuente','Source'), prueba ? T('Dato de prueba','Test data') : device.fuente);
      var note = prueba ? T('Dato de prueba. No es un aviso del equipo.','Test data. This is not a device report.') : device.tipo === 'fijo' ? T('Dirección manual. No necesita avisos automáticos.','Manual address. No automatic reports needed.') : key === 'stale' ? T('Más de 2 h sin recibir una posición.','No position received for over 2 h.') : key === 'missing' ? T('Pendiente del primer aviso del equipo.','Waiting for the first report from this device.') : '';
      if (!prueba && device.tipo === 'fijo' && !positioned) note += ' ' + T('Sin coordenadas confirmadas; no se dibuja un punto.','No confirmed coordinates; no point is drawn.');
      return '<article class="mapa-device' + (prueba ? ' is-prueba' : '') + '" data-equipo="' + escape(device.equipo) + '"><div class="mapa-device-top"><div><h3>' + escape(device.nombre || device.equipo) + '</h3><p class="mapa-device-kind">' + (device.tipo === 'fijo' ? T('Fijo · dirección manual','Fixed · manual address') : T('Móvil · actualización automática','Mobile · automatic reports')) + '</p></div><span class="mapa-status is-' + key + '">' + escape(statusText(key)) + '</span></div>' +
        (device.direccion ? '<p class="mapa-address">' + escape(device.direccion) + '</p>' : '') + '<dl>' + info + '</dl>' +
        (note ? '<p class="mapa-device-note">' + escape(note) + '</p>' : '') +
        (positioned ? '<button type="button" data-mapa-focus="' + escape(device.equipo) + '">' + T('Ver en el mapa','Show on map') + '</button>' : '') + '</article>';
    }).join('') : '<p class="mapa-loading">' + T('No hay equipos disponibles.','No devices available.') + '</p>';
  }

  function initializeMap() {
    if (!G.L) {
      byId('mapa').textContent = T('No se ha podido cargar el mapa. La lista de equipos sigue disponible.','The map could not load. The device list is still available.');
      return;
    }
    map = G.L.map('mapa', {scrollWheelZoom:false}).setView([41.394,2.164], 13);
    aplicarCapa();
    markers = G.L.layerGroup().addTo(map);
    if (map.on) map.on('zoomend', refrescarHalos);
  }

  function temaClaro() {
    return !!(d.documentElement.getAttribute && d.documentElement.getAttribute('data-mapa-tema') === 'claro');
  }

  function aplicarCapa() {
    if (!map || !G.L) return;
    // CARTO Dark Matter y Positron exigen clave desde el 25-sep-2026; sin ella
    // la tesela es la marca de agua. El lienzo gris de Esri pinta calles y
    // nombres, sin iconos de servicios: oscuro en el tema oscuro, claro con una marca clara.
    var url = temaClaro()
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    if (tiles && map.removeLayer) map.removeLayer(tiles);
    tiles = G.L.tileLayer(url, {
      maxZoom:16,
      attribution:'&copy; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);
  }

  function enlazar(equipo, on) {
    var card = d.querySelector && d.querySelector('.mapa-device[data-equipo="' + String(equipo).replace(/["\\]/g, '') + '"]');
    if (card) card.classList.toggle('is-linked', on);
    var pin = pins.get(equipo);
    var el = pin && pin.getElement && pin.getElement();
    if (el) el.classList.toggle('is-linked', on);
    if (on && pin && pin.openPopup) pin.openPopup();
  }

  function fit() {
    if (!map) return;
    var points = state.devices.filter(hasPosition).map(function (device) { return [device.lat,device.lon]; });
    if (!points.length) return;
    map.fitBounds(G.L.latLngBounds(points), {padding:[45,45],maxZoom:15,animate:false});
  }

  function radioHalo(metros, lat) {
    if (typeof metros !== 'number' || !(metros > 0)) return metros;
    var zoom = map && typeof map.getZoom === 'function' ? map.getZoom() : null;
    if (zoom == null) return metros;
    var metrosPorPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    if (!Number.isFinite(metrosPorPx) || metrosPorPx <= 0) return metros;
    // El marcador mide 32 px. Un radio de 24 px deja el anillo visible alrededor.
    return Math.max(metros, 24 * metrosPorPx);
  }

  function refrescarHalos() {
    halos.forEach(function (item) {
      if (item.circle && item.circle.setRadius) item.circle.setRadius(radioHalo(item.metros, item.lat));
    });
  }

  function renderMap() {
    byId('mapa-vacio').hidden = !state.loaded || state.devices.some(hasPosition);
    if (!map) return;
    markers.clearLayers();
    pins.clear();
    halos = [];
    state.devices.filter(hasPosition).forEach(function (device) {
      var prueba = esPrueba(device), key = prueba ? 'prueba' : status(device), popup = d.createElement('div');
      popup.className = 'mapa-popup';
      popup.setAttribute('data-yk-no-traducir','');
      popup.innerHTML = '<strong>' + escape(nombreCorto(device)) + '</strong><p>' + escape(statusText(key)) + '<br>' + escape(prueba ? T('Dato de prueba','Test data') : date(device.ultimo_aviso || device.ts)) + '</p>' +
        (prueba ? '<p class="mapa-popup-demo">' + T('Dato de prueba · DEMO','Test data · DEMO') + '</p>' : '') +
        (device.direccion ? '<p>' + escape(device.direccion) + '</p>' : '');
      if (typeof device.precision_m === 'number' && device.precision_m > 0 && G.L.circle) {
        var color = prueba ? '#ffbd69' : '#63e6d5';
        var circle = G.L.circle([device.lat,device.lon], {radius:radioHalo(device.precision_m, device.lat), color:color, weight:2, fillColor:color, fillOpacity:0.12, interactive:false}).addTo(markers);
        halos.push({circle:circle, metros:device.precision_m, lat:device.lat});
      }
      var tipo = device.tipo === 'fijo' ? 'fijo' : 'movil';
      var icon = G.L.divIcon({
        className:'mapa-marker is-' + tipo + (prueba ? ' is-prueba' : key === 'stale' ? ' is-stale' : ''),
        html:'<span class="mapa-pin">' + GLYPH[device.tipo === 'fijo' ? 'fijo' : 'movil'] + '</span><span class="mapa-pin-nombre">' + escape(nombreCorto(device)) + '</span>',
        iconSize:[32,32], iconAnchor:[16,16], popupAnchor:[0,-18]
      });
      var pin = G.L.marker([device.lat,device.lon], {icon:icon,alt:nombreCorto(device),title:nombreCorto(device)}).bindPopup(popup).addTo(markers);
      if (pin.on) {
        pin.on('mouseover', function () { enlazar(device.equipo, true); });
        pin.on('mouseout', function () { enlazar(device.equipo, false); });
      }
      pins.set(device.equipo,pin);
    });
    if (fitNext) {fit();fitNext = false;}
    refrescarHalos();
  }

  function renderError() {
    var target = byId('mapa-error');
    target.setAttribute('data-yk-no-traducir','');
    target.hidden = !state.error;
    if (!state.error) {target.textContent = '';return;}
    if (state.error === 'session') {
      target.innerHTML = T('La sesión ha caducado. ','Your session has expired. ') + '<a href="/pruebas/mapa/">' + T('Volver a iniciar sesión con Google','Sign in again with Google') + '</a>.';
    } else {
      target.textContent = state.error === 'storage' ? T('El servicio de ubicaciones aún no está disponible. Prueba de nuevo en unos minutos.','The location service is not yet available. Try again in a few minutes.') : T('No se han podido consultar las ubicaciones. Revisa la conexión y vuelve a actualizar.','Locations could not be loaded. Check your connection and refresh.');
      if (state.loaded) target.textContent += ' ' + T('Se muestran los últimos datos recibidos.','The last received data is shown.');
    }
  }

  function render() {
    byId('demo-aviso').hidden = !state.demo;
    byId('modo-real').setAttribute('aria-pressed',String(!state.demo));
    byId('modo-demo').setAttribute('aria-pressed',String(state.demo));
    var origin = byId('mapa-origen');
    if (origin) {
      origin.textContent = state.demo ? T('DEMO · Sintético','DEMO · Synthetic') : T('Datos reales','Real data');
      origin.classList.toggle('is-demo',state.demo);
      origin.setAttribute('data-yk-no-traducir','');
    }
    var summary = byId('mapa-estado');
    summary.setAttribute('data-yk-no-traducir','');
    summary.textContent = state.demo ? T('Vista de demostración · sin datos reales','Demo view · no real data') : state.loading ? T('Consultando ubicaciones…','Loading locations…') : state.lastRead ? T('Última consulta: ','Last checked: ') + date(state.lastRead) + T(' · cada 60 s',' · every 60 s') : T('Sin datos recibidos','No data received');
    byId('refrescar').disabled = state.loading;
    renderError();
    renderDevices();
    renderMap();
  }

  async function refresh() {
    if (state.demo) {state.devices = sample();render();return;}
    if (state.loading) return;
    var request = ++state.request;
    state.controller = new AbortController();
    state.loading = true;
    state.error = null;
    render();
    try {
      var response = await G.fetch('/api/ubicacion', {method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'},signal:state.controller.signal});
      if (request !== state.request || state.demo) return;
      if (!response.ok) {
        state.error = response.status === 401 ? 'session' : response.status === 503 ? 'storage' : 'network';
        if (response.status === 401) {state.devices = [];state.loaded = false;state.lastRead = null;}
        return;
      }
      var data = await response.json();
      if (request !== state.request || state.demo) return;
      if (!data || data.ok !== true || !Array.isArray(data.equipos)) throw new Error('invalid_response');
      state.devices = data.equipos.filter(function (device) { return device && typeof device.equipo === 'string' && (device.tipo === 'fijo' || device.tipo === 'movil'); });
      state.loaded = true;
      state.lastRead = new Date().toISOString();
    } catch (err) {
      if (request === state.request && !state.demo && err.name !== 'AbortError') state.error = 'network';
    } finally {
      if (request === state.request && !state.demo) {state.loading = false;state.controller = null;render();}
    }
  }

  function setMode(demo) {
    if (state.demo === demo && (demo || state.loading)) return;
    ++state.request;
    if (state.controller) state.controller.abort();
    state.controller = null;
    state.demo = demo;
    state.loading = false;
    state.error = null;
    state.lastRead = null;
    state.devices = demo ? sample() : [];
    state.loaded = demo;
    fitNext = true;
    render();
    if (demo) fit();
    if (!demo) refresh();
  }

  byId('modo-real').addEventListener('click',function () {setMode(false);});
  byId('modo-demo').addEventListener('click',function () {setMode(true);});
  byId('refrescar').addEventListener('click',refresh);
  byId('centrar').addEventListener('click',fit);
  d.addEventListener('click',function (event) {
    if (!event.target.closest) return;
    var action = event.target.closest('[data-mapa-action]');
    if (action) {
      var what = action.getAttribute('data-mapa-action');
      if (what === 'real' || what === 'demo') setMode(what === 'demo');
      if (what === 'refrescar') refresh();
      if (what === 'centrar') fit();
    }
    var card = event.target.closest('.mapa-device');
    if (card && card.getAttribute('data-equipo')) enlazar(card.getAttribute('data-equipo'), true);
    var focus = event.target.closest('[data-mapa-focus]');
    if (focus && map) {
      var pin = pins.get(focus.getAttribute('data-mapa-focus'));
      if (pin) {map.setView(pin.getLatLng(),16,{animate:false});pin.openPopup();byId('mapa-titulo').scrollIntoView({behavior:'smooth',block:'start'});}
    }
  });

  d.addEventListener('mouseover', function (event) {
    if (!event.target.closest) return;
    var card = event.target.closest('.mapa-device');
    if (card && card.getAttribute('data-equipo')) enlazar(card.getAttribute('data-equipo'), true);
  });
  d.addEventListener('mouseout', function (event) {
    if (!event.target.closest) return;
    var card = event.target.closest('.mapa-device');
    if (card && card.getAttribute('data-equipo')) enlazar(card.getAttribute('data-equipo'), false);
  });
  function canales(value) {
    var s = String(value || '').trim();
    var hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      var h = hex[1];
      if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var rgb = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
  }

  function esFondoClaro(value) {
    var c = canales(value);
    if (!c) return false;
    var lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]) >= 0.45;
  }

  function fondoAplicado() {
    if (!G.getComputedStyle) return '';
    try { return G.getComputedStyle(d.documentElement).getPropertyValue('--mb-fondo').trim(); }
    catch (err) { return ''; }
  }

  function modoPedido() {
    try {
      var q = new URLSearchParams(G.location.search).get('modo');
      return q === 'claro' || q === 'oscuro' ? q : '';
    } catch (err) { return ''; }
  }

  var PINTADOS = ['--mb-fondo','--mb-fondo-alt','--mb-superficie','--mb-superficie-alt','--mb-borde','--mb-texto','--mb-texto-suave','--mb-primario','--mb-secundario','--mb-acento','--mb-aviso','--mb-ok','--mbx-ink','--mbx-mut','--mbx-brand'];

  function setTema(claro) {
    var root = d.documentElement;
    if (!root || !root.setAttribute) return;
    if (claro) root.setAttribute('data-mapa-tema', 'claro');
    else if (typeof root.removeAttribute === 'function') root.removeAttribute('data-mapa-tema');
  }

  function limpiarPintura() {
    var root = d.documentElement;
    if (!root.getAttribute || root.getAttribute('data-mapa-pintado') !== '1' || !root.style || !root.style.removeProperty) return;
    PINTADOS.forEach(function (name) { root.style.removeProperty(name); });
    if (typeof root.removeAttribute === 'function') root.removeAttribute('data-mapa-pintado');
  }

  function pintarClaro(pal) {
    var root = d.documentElement;
    if (!root.style || !root.style.setProperty) return;
    var put = function (name, value) { if (value) root.style.setProperty(name, value); };
    put('--mb-fondo', pal.fondo);
    put('--mb-fondo-alt', pal.fondoAlt);
    put('--mb-superficie', pal.superficie);
    put('--mb-superficie-alt', pal.superficieAlt);
    put('--mb-borde', pal.borde);
    put('--mb-texto', pal.texto);
    put('--mb-texto-suave', pal.textoSuave);
    put('--mb-primario', pal.primario);
    put('--mb-secundario', pal.secundario);
    put('--mb-acento', pal.acento);
    put('--mb-aviso', pal.aviso);
    put('--mb-ok', pal.ok);
    put('--mbx-ink', pal.texto);
    put('--mbx-mut', pal.textoSuave);
    put('--mbx-brand', pal.primario);
    root.setAttribute('data-mapa-pintado', '1');
  }

  function paletaClara(json) {
    var colores = json && (json.colores || json.paleta) || {};
    return colores.claro || colores.light || null;
  }

  async function aplicarTema() {
    var root = d.documentElement;
    var marca = root.getAttribute ? root.getAttribute('data-mb-marca') : '';
    var ticket = ++temaTicket;
    if (!marca) { limpiarPintura(); setTema(false); return false; }
    var pedido = modoPedido();
    var claro = false;
    if (pedido !== 'oscuro') {
      var fondo = fondoAplicado();
      claro = pedido === 'claro' || root.getAttribute('data-mb-modo') === 'claro' || esFondoClaro(fondo);
      if (!claro || (pedido === 'claro' && !esFondoClaro(fondo))) {
        try {
          var response = await G.fetch('/marcablanca/clientes/' + encodeURIComponent(marca) + '.json', {cache:'force-cache'});
          if (ticket !== temaTicket) return false;
          if (response && response.ok) {
            var json = await response.json();
            var pal = paletaClara(json);
            var colores = json && (json.colores || json.paleta) || {};
            if (pal && esFondoClaro(pal.fondo) && (pedido === 'claro' || json.modo === 'claro' || !colores.oscuro)) {
              pintarClaro(pal);
              claro = true;
            }
          }
        } catch (err) {}
      }
    }
    if (ticket !== temaTicket) return false;
    if (!claro) limpiarPintura();
    setTema(claro);
    return claro;
  }

  var leyendaBtn = d.querySelector && d.querySelector('.mapa-legend-toggle');
  if (leyendaBtn && leyendaBtn.addEventListener) leyendaBtn.addEventListener('click', function () {
    var abierto = leyendaBtn.getAttribute('aria-expanded') === 'true';
    leyendaBtn.setAttribute('aria-expanded', abierto ? 'false' : 'true');
    var caja = leyendaBtn.parentNode;
    if (caja && caja.classList) caja.classList.toggle('is-open', !abierto);
  });
  if (typeof MutationObserver === 'function') new MutationObserver(function (records) {
    render();
    var marca = !records || records.some(function (record) { return record.attributeName === 'data-mb-marca' || record.attributeName === 'data-mb-modo'; });
    if (marca) aplicarTema().then(function () { aplicarCapa(); });
  }).observe(d.documentElement,{attributes:true,attributeFilter:['lang','data-mb-marca','data-mb-modo']});
  G.setInterval(function () {if (state.loaded && !state.loading) render();},30000);
  G.setInterval(function () {if (!state.demo && !d.hidden) refresh();},60000);
  initializeMap();
  aplicarTema().then(function () { aplicarCapa(); });
  refresh();
})(window,document);
