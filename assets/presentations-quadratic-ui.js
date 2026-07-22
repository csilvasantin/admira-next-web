(function () {
  'use strict';

  var STORAGE_KEY = 'admiranext.presentations.quadratic-ui.v1';
  var CHANGE_EVENT = 'admira-presentations-ui-change';
  var keys = ['options', 'advanced', 'expert'];
  var config = {
    options: { toggleId: 'ykOptionsToggle', panelId: 'ykOptionsPanel' },
    advanced: { toggleId: 'ykAdvancedToggle', panelId: 'ykAdvancedPanel' },
    expert: { toggleId: 'ykExpertToggle', panelId: 'ykExpertPanel' }
  };

  function start() {
    var elements = {};
    var state = readState();

    keys.forEach(function (key) {
      elements[key] = {
        toggle: document.getElementById(config[key].toggleId),
        panel: document.getElementById(config[key].panelId)
      };
    });

    if (!keys.some(function (key) {
      return elements[key].toggle || elements[key].panel;
    })) return;

    normalizeState(state);
    render(state, elements);

    keys.forEach(function (key) {
      var toggle = elements[key].toggle;
      if (!toggle) return;

      toggle.setAttribute('aria-controls', config[key].panelId);
      toggle.addEventListener('click', function () {
        setOpen(key, !state[key], state);
        commit(state, elements, 'toggle', key);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;

      var keyToClose = state.expert
        ? 'expert'
        : state.advanced
          ? 'advanced'
          : state.options
            ? 'options'
            : null;

      if (!keyToClose) return;
      event.preventDefault();
      setOpen(keyToClose, false, state);
      commit(state, elements, 'escape', keyToClose);
    });

    document.addEventListener('click', function (event) {
      if (!state.options && !state.advanced && !state.expert) return;
      if (isInsideUi(event, elements)) return;

      state.options = false;
      state.advanced = false;
      state.expert = false;
      commit(state, elements, 'outside-click', null);
    });
  }

  function setOpen(key, shouldOpen, state) {
    state[key] = shouldOpen;

    if (shouldOpen && key === 'advanced') {
      state.options = true;
    }

    if (shouldOpen && key === 'expert') {
      state.options = true;
      state.advanced = true;
    }

    if (!shouldOpen && key === 'options') {
      state.advanced = false;
      state.expert = false;
    }

    if (!shouldOpen && key === 'advanced') {
      state.expert = false;
    }
  }

  function normalizeState(state) {
    state.options = Boolean(state.options);
    state.advanced = Boolean(state.advanced);
    state.expert = Boolean(state.expert);

    if (state.expert) {
      state.advanced = true;
      state.options = true;
    } else if (state.advanced) {
      state.options = true;
    }
  }

  function commit(state, elements, source, changedControl) {
    normalizeState(state);
    render(state, elements);
    writeState(state);
    emitChange(state, source, changedControl);
  }

  function render(state, elements) {
    keys.forEach(function (key) {
      var pair = elements[key];

      if (pair.toggle) {
        pair.toggle.setAttribute('aria-expanded', String(state[key]));
        pair.toggle.setAttribute('aria-controls', config[key].panelId);
        pair.toggle.classList.toggle('is-active', state[key]);
      }

      if (pair.panel) {
        pair.panel.hidden = !state[key];
        pair.panel.classList.toggle('is-open', state[key]);
        pair.panel.setAttribute('aria-hidden', String(!state[key]));
      }
    });

    if (document.documentElement) {
      document.documentElement.dataset.presentationUiMode = currentMode(state);
    }
  }

  function isInsideUi(event, elements) {
    var path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [event.target];

    return keys.some(function (key) {
      var pair = elements[key];
      return (pair.toggle && path.indexOf(pair.toggle) !== -1) ||
        (pair.panel && path.indexOf(pair.panel) !== -1);
    });
  }

  function currentMode(state) {
    if (state.expert) return 'expert';
    if (state.advanced) return 'advanced';
    if (state.options) return 'options';
    return 'default';
  }

  function emitChange(state, source, changedControl) {
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
      detail: {
        mode: currentMode(state),
        source: source,
        changedControl: changedControl,
        open: {
          options: state.options,
          advanced: state.advanced,
          expert: state.expert
        }
      }
    }));
  }

  function readState() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return { options: false, advanced: false, expert: false };
      var parsed = JSON.parse(stored);
      return {
        options: parsed.options,
        advanced: parsed.advanced,
        expert: parsed.expert
      };
    } catch (_error) {
      return { options: false, advanced: false, expert: false };
    }
  }

  function writeState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        options: state.options,
        advanced: state.advanced,
        expert: state.expert
      }));
    } catch (_error) {
      // Storage can be unavailable in private or hardened browsing contexts.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}());
