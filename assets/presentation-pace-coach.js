(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdmiraPresentationPaceCoach = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finite(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.round(finite(seconds, 0)));
    var minutes = Math.floor(seconds / 60);
    return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function createRunOfShow(items, totalSeconds) {
    items = Array.isArray(items) ? items : [];
    totalSeconds = Math.max(60, finite(totalSeconds, 60));
    var prepared = items.map(function (item, index) {
      item = item || {};
      var explicit = finite(item.seconds, 0);
      var weight = Math.max(0.2, finite(item.weight, 1));
      return {
        index: index,
        title: String(item.title || 'Diapositiva ' + (index + 1)),
        role: String(item.role || 'content'),
        optional: Boolean(item.optional),
        weight: weight,
        explicitSeconds: explicit > 0 ? explicit : 0
      };
    });
    var explicitTotal = prepared.reduce(function (sum, item) { return sum + item.explicitSeconds; }, 0);
    var flexible = prepared.filter(function (item) { return item.explicitSeconds === 0; });
    var flexibleWeight = flexible.reduce(function (sum, item) { return sum + item.weight; }, 0) || 1;
    var explicitScale = explicitTotal > totalSeconds ? totalSeconds / explicitTotal : 1;
    var flexibleSeconds = Math.max(0, totalSeconds - explicitTotal * explicitScale);
    return prepared.map(function (item) {
      return {
        index: item.index,
        title: item.title,
        role: item.role,
        optional: item.optional,
        plannedSeconds: item.explicitSeconds > 0
          ? item.explicitSeconds * explicitScale
          : flexibleSeconds * item.weight / flexibleWeight
      };
    });
  }

  function sampleScale(samples) {
    samples = Array.isArray(samples) ? samples.filter(function (sample) {
      return finite(sample && sample.plannedSeconds, 0) > 0 && finite(sample && sample.actualSeconds, -1) >= 0;
    }) : [];
    if (samples.length < 2) return null;
    var planned = samples.reduce(function (sum, sample) { return sum + finite(sample.plannedSeconds, 0); }, 0);
    var actual = samples.reduce(function (sum, sample) { return sum + finite(sample.actualSeconds, 0); }, 0);
    if (planned <= 0) return null;
    return clamp(actual / planned, 0.45, 2.5);
  }

  function neutral(runOfShow, index, elapsed, totalSeconds, reason) {
    var plannedRemaining = runOfShow.slice(index).reduce(function (sum, item) { return sum + item.plannedSeconds; }, 0);
    return {
      mode: 'learning',
      label: 'Calibrando ritmo',
      detail: reason || 'Avanza dos diapositivas para obtener una predicción fiable.',
      scale: null,
      plannedRemaining: plannedRemaining,
      availableRemaining: Math.max(0, totalSeconds - elapsed),
      predictedRemaining: null,
      predictedFinish: null,
      varianceSeconds: null,
      skipIndex: null,
      skipTitle: ''
    };
  }

  function assess(input) {
    input = input || {};
    var runOfShow = Array.isArray(input.runOfShow) ? input.runOfShow : [];
    var totalSeconds = Math.max(60, finite(input.totalSeconds, 60));
    var elapsed = Math.max(0, finite(input.elapsedSeconds, 0));
    if (!runOfShow.length) return neutral([], 0, elapsed, totalSeconds, 'No hay escaleta disponible.');
    var index = clamp(Math.floor(finite(input.index, 0)), 0, runOfShow.length - 1);
    var currentEnteredAt = clamp(finite(input.currentEnteredAt, elapsed), 0, elapsed);
    var scale = sampleScale(input.samples);
    if (scale === null) return neutral(runOfShow, index, elapsed, totalSeconds);

    var current = runOfShow[index];
    var currentElapsed = Math.max(0, elapsed - currentEnteredAt);
    var currentPlanLeft = Math.max(0, current.plannedSeconds - currentElapsed / scale);
    var futurePlan = runOfShow.slice(index + 1).reduce(function (sum, item) { return sum + item.plannedSeconds; }, 0);
    var plannedRemaining = currentPlanLeft + futurePlan;
    var predictedRemaining = Math.max(0, plannedRemaining * scale);
    var predictedFinish = elapsed + predictedRemaining;
    var variance = predictedFinish - totalSeconds;
    var material = Math.max(30, totalSeconds * 0.04);
    var critical = Math.max(90, totalSeconds * 0.1);
    var skip = runOfShow.slice(index + 1, -1).find(function (item) { return item.optional; }) || null;
    var mode = 'on-time';
    var label = 'Mantén el ritmo';
    var detail = 'La escaleta apunta a un cierre dentro del tiempo previsto.';

    if (index === runOfShow.length - 1) {
      mode = 'closing';
      label = 'Cierra con claridad';
      detail = 'Estás en el cierre; protege la llamada a la acción.';
      skip = null;
    } else if (variance < -material) {
      mode = 'expand';
      label = 'Puedes ampliar';
      detail = 'Dispones de unos ' + formatTime(Math.abs(variance)) + ' para desarrollar un ejemplo o aceptar preguntas.';
    } else if (variance > critical && skip) {
      mode = 'skip';
      label = 'Conviene saltar';
      detail = 'Salta «' + skip.title + '» para proteger el cierre previsto.';
    } else if (variance > material) {
      mode = 'summarize';
      label = 'Resume este bloque';
      detail = 'Recorta unos ' + formatTime(variance) + ' y conserva la idea principal.';
    }

    return {
      mode: mode,
      label: label,
      detail: detail,
      scale: scale,
      plannedRemaining: plannedRemaining,
      availableRemaining: Math.max(0, totalSeconds - elapsed),
      predictedRemaining: predictedRemaining,
      predictedFinish: predictedFinish,
      varianceSeconds: variance,
      skipIndex: skip ? skip.index : null,
      skipTitle: skip ? skip.title : ''
    };
  }

  function stabilizeAdvice(next, previous, now, cooldownMs) {
    now = Math.max(0, finite(now, 0));
    cooldownMs = Math.max(0, finite(cooldownMs, 8000));
    if (!previous || previous.mode === 'learning' || next.mode === previous.mode || now - finite(previous.changedAt, 0) >= cooldownMs) {
      return Object.assign({}, next, {changedAt: next.mode === previous?.mode ? finite(previous.changedAt, now) : now});
    }
    return previous;
  }

  return {
    createRunOfShow: createRunOfShow,
    assess: assess,
    stabilizeAdvice: stabilizeAdvice,
    formatTime: formatTime
  };
}));
