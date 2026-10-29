/*
 * Locución en castellano de /demo luka (Carlos, 29-oct-2026 · misión DCL-fb1c7a60).
 *
 * Una frase por parada del recorrido, de 5 a 9 s para que quepa en los 12 s de cada oficina.
 * Si hay grabación de la voz de la casa (locucion/<id>.mp3, ElevenLabs) suena esa; si no, la voz
 * en castellano del navegador. Los navegadores no dejan hablar sin un gesto: si la demo llegó
 * sin él (p. ej. /demo luka desde admira.tv), el botón pide «Activar locución».
 */
(function (G, d) {
  'use strict';
  var LINES = {
    intro: 'Esta es Luka. Lleva un SmartTag de Samsung en el collar y, allá donde va, el player de admira.tv se adapta. Empezamos en Pixería: creatividad.',
    pixeria: 'De vuelta en Pixería: contenidos de creatividad.',
    university: 'Luka llega a Admira University. Al instante, el player pasa a contenidos de negocio.',
    garage: 'En el Garage, el player cambia a desarrollo de software.',
    'sneaker-store': 'En la Sneaker Store, contenidos de comercio.',
    'la-nave': 'Y en La Nave, tecnología. Cada Xperiencia tiene su propio player con la lista ya cargada: cuando llega Luka, no hay esperas.'
  };
  // Lines with a recorded file in /pruebas/mapa/locucion/ (house voice). Empty: browser voice.
  var RECORDED = [];

  function lineFor(stop) {
    if (!stop) return null;
    if (stop.index === 0 && stop.lap === 0) return 'intro';
    return LINES[stop.id] ? stop.id : null;
  }
  function pickVoice(voices) {
    var es = (voices || []).filter(function (v) {return /^es([-_]|$)/i.test(v.lang || '');});
    var spain = es.filter(function (v) {return /^es[-_]ES$/i.test(v.lang);});
    return spain.filter(function (v) {return /google/i.test(v.name);})[0] || spain[0] || es[0] || null;
  }

  function create(options) {
    var button = options.button, T = options.T;
    var on = true, unlocked = !!options.activated, pending = null, audio = null, speech = G.speechSynthesis || null;
    function stop() {
      if (audio) {audio.pause();audio = null;}
      if (speech) speech.cancel();
    }
    function render() {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(on && unlocked));
      button.textContent = !on ? T('🔇 Locución','🔇 Voice-over') : unlocked ? T('🔊 Locución','🔊 Voice-over') : T('🔊 Activar locución','🔊 Turn on voice-over');
    }
    function speak(id) {
      stop();
      if (RECORDED.indexOf(id) >= 0) {
        audio = new G.Audio('/pruebas/mapa/locucion/' + id + '.mp3');
        var playing = audio.play();
        if (playing && playing.catch) playing.catch(function () {unlocked = false;pending = id;render();});
        return;
      }
      if (!speech || typeof G.SpeechSynthesisUtterance !== 'function') return;
      var utterance = new G.SpeechSynthesisUtterance(LINES[id]);
      utterance.lang = 'es-ES';utterance.rate = 1.02;
      var voice = pickVoice(speech.getVoices());
      if (voice) utterance.voice = voice;
      speech.speak(utterance);
    }
    // Called by the demo tour on every stop: {id, index, lap}.
    function onStop(stop) {
      var id = lineFor(stop);
      if (!id) return;
      if (!on) return;
      if (!unlocked) {pending = id;render();return;}
      speak(id);
    }
    button.addEventListener('click', function () {
      if (!unlocked) {unlocked = true;on = true;render();if (pending) speak(pending);pending = null;return;}
      on = !on;
      if (!on) stop();
      render();
    });
    render();
    return {onStop:onStop, stop:stop, isOn:function () {return on && unlocked;}};
  }

  G.AdmiraMapaLocucion = {create:create, lines:LINES, lineFor:lineFor, pickVoice:pickVoice, recorded:RECORDED};
})(window, document);
