(function () {
  const form = document.getElementById('demoForm');
  const estado = document.getElementById('estado');
  const comando = document.getElementById('comando');
  const resultado = document.getElementById('resultado');
  const color = document.getElementById('color');
  const colorHex = document.getElementById('colorHex');
  const wrapOtro = document.getElementById('wrapOtro');

  const syncColor = () => { colorHex.textContent = (color.value || '').toUpperCase(); };
  color.addEventListener('input', syncColor); syncColor();

  const syncTipo = () => {
    const t = form.querySelector('input[name="xpacio_tipo"]:checked')?.value;
    wrapOtro.hidden = t !== 'other';
  };
  form.querySelectorAll('input[name="xpacio_tipo"]').forEach((el) => el.addEventListener('change', syncTipo));
  syncTipo();

  document.getElementById('btnLenovo')?.addEventListener('click', () => {
    form.cliente.value = 'Lenovo';
    form.website.value = 'https://www.lenovo.com/';
    color.value = '#E2231A'; syncColor();
    form.querySelector('input[name="xpacio_tipo"][value="demostore"]').checked = true;
    syncTipo();
    form.querySelectorAll('input[name="ciudad"]').forEach((c) => {
      c.checked = ['london', 'newyork', 'barcelona', 'madrid'].includes(c.value);
    });
    form.cierre.value = '20:00';
    estado.textContent = 'Plantilla Lenovo · DemoStore cargada.';
    estado.className = 'estado ok';
  });

  document.getElementById('btnReset')?.addEventListener('click', () => {
    form.reset();
    color.value = '#E2231A'; syncColor(); syncTipo();
    resultado.hidden = true; comando.hidden = true;
    estado.textContent = ''; estado.className = 'estado';
  });

  function leerPayload() {
    const ciudades = [...form.querySelectorAll('input[name="ciudad"]:checked')].map((c) => c.value);
    const idiomas = [...form.querySelectorAll('input[name="idioma"]:checked')].map((c) => c.value);
    const xpacio_tipo = form.querySelector('input[name="xpacio_tipo"]:checked')?.value || 'demostore';
    return {
      cliente: form.cliente.value.trim(),
      website: form.website.value.trim(),
      color: (color.value || '').toUpperCase(),
      xpacio_tipo,
      xpacio_otro: form.xpacio_otro.value.trim(),
      ciudades,
      cierre: form.cierre.value || '20:00',
      idiomas: idiomas.length ? idiomas : ['en', 'es'],
      notas: form.notas.value.trim(),
    };
  }

  function comandoDe(p) {
    let c = `python3 tools/crear-demo/crear_demo.py --cliente "${p.cliente}" --web ${p.website}`;
    if (p.color) c += ` --color '${p.color}'`;
    c += ` --xpacio-tipo ${p.xpacio_tipo}`;
    if (p.xpacio_tipo === 'other' && p.xpacio_otro) c += ` --xpacio-otro "${p.xpacio_otro}"`;
    c += ` --ciudades ${p.ciudades.join(',')} --cierre ${p.cierre} --idiomas ${p.idiomas.join(',')}`;
    return c;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (file.size > 280000) return reject(new Error('Logo demasiado grande (>280 KB).'));
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('No se pudo leer el logo.'));
      r.readAsDataURL(file);
    });
  }

  document.getElementById('btnDry')?.addEventListener('click', () => {
    const p = leerPayload();
    if (!p.cliente || !p.website) {
      estado.textContent = 'Completa compañía y web.';
      estado.className = 'estado err';
      return;
    }
    comando.hidden = false;
    comando.textContent = comandoDe(p);
    estado.textContent = 'Comando listo (no enviado).';
    estado.className = 'estado ok';
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const p = leerPayload();
    if (!p.cliente || !p.website) {
      estado.textContent = 'Completa los campos obligatorios.';
      estado.className = 'estado err';
      return;
    }
    if (!p.ciudades.length) {
      estado.textContent = 'Elige al menos una ciudad.';
      estado.className = 'estado err';
      return;
    }
    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;
    estado.textContent = 'Encolando…';
    estado.className = 'estado';
    resultado.hidden = true;
    try {
      const logoFile = form.logo.files?.[0];
      if (logoFile) p.logo = await fileToDataUrl(logoFile);
      const r = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(p),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      comando.hidden = false;
      comando.textContent = data.comando_sugerido || comandoDe(p);
      resultado.hidden = false;
      resultado.innerHTML = `<h3>Solicitud en cola</h3>
        <p>Id <code>${esc(data.id)}</code> · tipo <code>${esc(p.xpacio_tipo)}</code> · notify <code>${esc(data.notify || 'kv')}</code></p>
        <p>${esc(data.mensaje || '')}</p>
        <p>Procesado por Mac Mini: <code>procesar_cola.py</code> → <code>crear_demo.py --xpacio-tipo ${esc(p.xpacio_tipo)}</code></p>`;
      estado.textContent = 'Encolada.';
      estado.className = 'estado ok';
    } catch (e) {
      estado.textContent = e.message || String(e);
      estado.className = 'estado err';
    } finally {
      btn.disabled = false;
    }
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
})();
