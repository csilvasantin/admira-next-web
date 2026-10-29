/*
 * «Mover también el móvil» (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * Con el interruptor encendido, cada vez que se suelta a Luka en el simulador su posición se
 * publica en /api/ubicacion/simulacion, y el player del móvil (/pruebas/mapa/player/, fuente
 * «Seguir a Luka») cambia de contenido con ella. Apagado no hace ninguna petición. Nunca escribe
 * en el histórico de ubicaciones ni en el feed real del SmartTag2.
 */
(function (G, d) {
  'use strict';
  var URL_SIM = '/api/ubicacion/simulacion';

  function create() {
    var byId = function (id) {return d.getElementById(id);};
    var T = function (es,en) {return /^en/i.test(d.documentElement.lang || '') ? en : es;};
    var on = false, csrf = '', pending = null, busy = false, last = null, state = 'off', sentAt = null;

    function render() {
      var button = byId('simulador-remoto');
      button.setAttribute('aria-pressed', String(on));
      button.textContent = on ? T('Moviendo también el móvil','Also moving the phone') : T('Mover también el móvil','Also move the phone');
      var time = sentAt ? new Date(sentAt).toLocaleTimeString(T('es-ES','en-GB')) : '';
      byId('simulador-remoto-estado').textContent = ({
        off:T('En el móvil, elige «Seguir a Luka» en el player y enciende esto para moverlo desde aquí.','On the phone, choose “Follow Luka” in the player, then switch this on to move it from here.'),
        idle:T('Suelta a Luka en una oficina y el móvil cambiará en unos segundos.','Drop Luka on an office and the phone will change within seconds.'),
        sending:T('Enviando a Luka al móvil…','Sending Luka to the phone…'),
        sent:T('Luka enviado al móvil · ','Luka sent to the phone · ') + time,
        forbidden:T('Tu rol no permite mover el móvil: hace falta editor o admin.','Your role cannot move the phone: editor or admin is required.'),
        session:T('La sesión ha caducado. Vuelve a entrar para mover el móvil.','Your session has expired. Sign in again to move the phone.'),
        error:T('No se pudo enviar. Se intentará de nuevo al mover a Luka.','Could not send. It will retry when Luka moves.')
      })[state] || '';
    }
    async function readToken() {
      var response = await G.fetch(URL_SIM, {method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
      if (response.status === 401) throw new Error('session');
      var data = null;try {data = await response.json();} catch (_) {}
      if (!response.ok || !data || data.ok !== true) throw new Error('error');
      if (data.puede_publicar !== true || typeof data.csrf !== 'string') throw new Error('forbidden');
      csrf = data.csrf;
    }
    async function flush() {
      if (busy || !pending || !on) return;
      busy = true;
      var point = pending;pending = null;state = 'sending';render();
      try {
        if (!csrf) await readToken();
        var response = await G.fetch(URL_SIM, {method:'PUT',cache:'no-store',credentials:'same-origin',
          headers:{'Content-Type':'application/json',Accept:'application/json','X-Admira-CSRF':csrf},
          body:JSON.stringify({equipo:'luka',lat:point.lat,lon:point.lng})});
        var data = null;try {data = await response.json();} catch (_) {}
        if (response.status === 401) throw new Error('session');
        if (response.status === 403) {csrf = '';throw new Error(data && data.error === 'sin_permiso' ? 'forbidden' : 'session');}
        if (!response.ok || !data || data.ok !== true) throw new Error('error');
        state = 'sent';sentAt = Date.now();
      } catch (error) {state = /^(session|forbidden)$/.test(error.message) ? error.message : 'error';}
      finally {busy = false;render();if (pending) flush();}
    }
    // Only the latest drop matters: a burst of moves sends one request after another, never a queue.
    function publish(point) {
      last = point;
      if (!on) return;
      pending = point;flush();
    }
    byId('simulador-remoto').addEventListener('click', function () {
      on = !on;state = on ? 'idle' : 'off';render();
      if (on && last) publish(last);
    });
    d.addEventListener('admira:languagechange', render);
    render();
    return {publish:publish, isOn:function () {return on;}};
  }

  G.AdmiraMapaLukaRemoto = {create:create};
})(window, document);
