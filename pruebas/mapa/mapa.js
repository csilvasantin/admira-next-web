(function (G, d) {
  'use strict';

  var TWO_HOURS = 2 * 60 * 60 * 1000;
  var byId = function (id) { return d.getElementById(id); };
  var english = function () { return /^en/i.test(d.documentElement.lang || ''); };
  var T = function (es, en) { return english() ? en : es; };
  var escape = function (value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var state = {demo:false, devices:[], loaded:false, loading:false, lastRead:null, error:null, request:0, controller:null};
  var map, markers, pins = new Map(), fitNext = true;

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
    return {fixed:T('Referencia fija','Fixed reference'),missing:T('Sin avisos','No reports'),stale:T('Desactualizado','Outdated'),fresh:T('Actualizado','Up to date')}[key];
  }

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
      target.innerHTML = '<p class="mapa-loading">' + T('Esperando datos…','Waiting for data…') + '</p>';
      return;
    }
    target.innerHTML = state.devices.length ? state.devices.map(function (device) {
      var key = status(device), positioned = hasPosition(device), last = device.ultimo_aviso || device.ts;
      var info = row(T('Último aviso','Last report'), last ? date(last) + ' · ' + ago(last) : T('Sin avisos recibidos','No reports received'));
      if (positioned) info += row(T('Coordenadas','Coordinates'), device.lat.toFixed(5) + ', ' + device.lon.toFixed(5));
      if (typeof device.precision_m === 'number' && Number.isFinite(device.precision_m)) info += row(T('Precisión','Accuracy'), '± ' + Math.round(device.precision_m) + ' m');
      if (typeof device.bateria === 'number' && Number.isFinite(device.bateria)) info += row(T('Batería','Battery'), Math.round(device.bateria) + ' %');
      if (device.fuente) info += row(T('Fuente','Source'), state.demo ? T('Sintética','Synthetic') : device.fuente);
      var note = device.tipo === 'fijo' ? T('Dirección manual. No necesita avisos automáticos.','Manual address. No automatic reports needed.') : key === 'stale' ? T('Más de 2 h sin recibir una posición.','No position received for over 2 h.') : key === 'missing' ? T('Pendiente del primer aviso del equipo.','Waiting for the first report from this device.') : '';
      if (device.tipo === 'fijo' && !positioned) note += ' ' + T('Sin coordenadas confirmadas; no se dibuja un punto.','No confirmed coordinates; no point is drawn.');
      return '<article class="mapa-device"><div class="mapa-device-top"><div><h3>' + escape(device.nombre || device.equipo) + '</h3><p class="mapa-device-kind">' + (device.tipo === 'fijo' ? T('Fijo · dirección manual','Fixed · manual address') : T('Móvil · actualización automática','Mobile · automatic reports')) + '</p></div><span class="mapa-status is-' + key + '">' + escape(statusText(key)) + '</span></div>' +
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
    G.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);
    markers = G.L.layerGroup().addTo(map);
  }

  function fit() {
    if (!map) return;
    var points = state.devices.filter(hasPosition).map(function (device) { return [device.lat,device.lon]; });
    if (!points.length) return;
    map.fitBounds(G.L.latLngBounds(points), {padding:[45,45],maxZoom:15,animate:false});
  }

  function renderMap() {
    byId('mapa-vacio').hidden = !state.loaded || state.devices.some(hasPosition);
    if (!map) return;
    markers.clearLayers();
    pins.clear();
    state.devices.filter(hasPosition).forEach(function (device) {
      var key = status(device), popup = d.createElement('div');
      popup.className = 'mapa-popup';
      popup.setAttribute('data-yk-no-traducir','');
      popup.innerHTML = '<strong>' + escape(device.nombre || device.equipo) + '</strong><p>' + escape(statusText(key)) + '<br>' + escape(date(device.ultimo_aviso || device.ts)) + '</p>' +
        (state.demo ? '<p class="mapa-popup-demo">' + T('DEMO · Ubicación sintética','DEMO · Synthetic location') + '</p>' : '') +
        (device.direccion ? '<p>' + escape(device.direccion) + '</p>' : '');
      var icon = G.L.divIcon({className:'mapa-marker is-' + key,html:'<span class="mapa-pin"></span>',iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-12]});
      var pin = G.L.marker([device.lat,device.lon], {icon:icon,alt:device.nombre || device.equipo,title:device.nombre || device.equipo}).bindPopup(popup).addTo(markers);
      pins.set(device.equipo,pin);
    });
    if (fitNext) {fit();fitNext = false;}
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
    origin.textContent = state.demo ? T('DEMO · Sintético','DEMO · Synthetic') : T('Datos reales','Real data');
    origin.classList.toggle('is-demo',state.demo);
    origin.setAttribute('data-yk-no-traducir','');
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
    var focus = event.target.closest('[data-mapa-focus]');
    if (focus && map) {
      var pin = pins.get(focus.getAttribute('data-mapa-focus'));
      if (pin) {map.setView(pin.getLatLng(),16,{animate:false});pin.openPopup();byId('mapa-titulo').scrollIntoView({behavior:'smooth',block:'start'});}
    }
  });

  if (typeof MutationObserver === 'function') new MutationObserver(function () {render();}).observe(d.documentElement,{attributes:true,attributeFilter:['lang']});
  G.setInterval(function () {if (state.loaded && !state.loading) render();},30000);
  G.setInterval(function () {if (!state.demo && !d.hidden) refresh();},60000);
  initializeMap();
  refresh();
})(window,document);
