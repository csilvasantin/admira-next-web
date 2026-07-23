(function () {
  'use strict';
  const site = window.__PRESITE__;
  const form = document.getElementById('presiteStudio');
  const frame = document.getElementById('presitePreview');
  const status = document.getElementById('studioStatus');
  const versions = document.getElementById('versionList');
  if (!site || !form || !frame) return;
  const endpoint = `/presites/${encodeURIComponent(site.slug)}/api/site`;
  const message = (text, type = '') => {
    status.className = 'ps-status ' + type;
    status.textContent = text;
  };
  function storyboard() {
    return [...form.querySelectorAll('.ps-block')].map(node => Object.fromEntries(
      [...node.querySelectorAll('.ps-block-fields input,.ps-block-fields textarea')]
        .map(control => [control.name, control.name === 'duration' ? Number(control.value) : control.value])
    ));
  }
  function settings() {
    const data = new FormData(document.getElementById('presiteSettings'));
    return {
      language: data.get('language'),
      quality: data.get('quality'),
      destination: {type: data.get('destinationType'), url: data.get('destinationUrl')},
      experience: {
        style: data.get('style'),
        duration: Number(data.get('duration')) || 18,
        autoAdvance: data.get('autoAdvance') === 'true'
      }
    };
  }
  async function save(action) {
    message(action ? 'Preparando revisión segura…' : 'Guardando una nueva versión del montaje…');
    const payload = action ? {action} : {...settings(), storyboard: storyboard()};
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar');
    Object.assign(site, data.site);
    frame.src = frame.src.split('?')[0] + '?v=' + Date.now();
    document.getElementById('presiteState').textContent = site.status === 'review-ready' ? 'Revisión preparada' : 'Borrador';
    message(action ? 'Revisión preparada sin publicar ni modificar el destino.' : 'Montaje guardado y versionado.', 'ok');
  }
  document.getElementById('saveStoryboard').addEventListener('click', () => save('').catch(error => message(error.message, 'error')));
  document.getElementById('simulatePublish').addEventListener('click', () => save('simulate-publish').catch(error => message(error.message, 'error')));
  document.querySelectorAll('[data-device]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-device]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    frame.className = 'ps-preview-frame ' + (button.dataset.device === 'desktop' ? '' : button.dataset.device);
  }));
  document.getElementById('loadVersions').addEventListener('click', async () => {
    versions.hidden = false;
    versions.innerHTML = '<div class="ps-version">Cargando versiones…</div>';
    try {
      const response = await fetch(`/presites/${encodeURIComponent(site.slug)}/api/versions`, {headers: {accept: 'application/json'}, cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      versions.innerHTML = '';
      data.versions.forEach(item => {
        const row = document.createElement('div');
        row.className = 'ps-version';
        const label = document.createElement('span');
        label.textContent = `${item.label} · ${new Intl.DateTimeFormat('es-ES', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(item.createdAt))}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Restaurar';
        button.addEventListener('click', () => restore(item.id));
        row.append(label, button);
        versions.appendChild(row);
      });
      if (!data.versions.length) versions.innerHTML = '<div class="ps-version">Sin versiones todavía.</div>';
    } catch (error) {
      versions.textContent = '';
      const row = document.createElement('div');
      row.className = 'ps-version';
      row.textContent = String(error.message || error);
      versions.appendChild(row);
    }
  });
  async function restore(id) {
    if (!confirm('¿Restaurar esta versión? La versión actual se conservará en el histórico.')) return;
    const response = await fetch(`/presites/${encodeURIComponent(site.slug)}/api/versions`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({id})
    });
    const data = await response.json();
    if (!response.ok) {
      message(data.error || 'No se pudo restaurar', 'error');
      return;
    }
    location.reload();
  }
})();
