(function(){
  'use strict';
  const body = document.body;
  const client = body.dataset.client || location.pathname.split('/').filter(Boolean)[1].toLowerCase();
  const displayName = body.dataset.name || client;
  const apiUrl = new URL(`./api/ideas`, location.href).pathname;
  const defaultUrl = `${apiUrl}?base=1`;
  const $ = (id) => document.getElementById(id);
  let model = null;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function idFor(value, index){
    const clean = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return clean || `idea-${index + 1}`;
  }
  function setStatus(message, type){
    const el = $('status'); el.textContent = message; el.className = `status${type ? ' '+type : ''}`;
  }
  async function getJson(url){
    const response = await fetch(url, { headers:{'accept':'application/json'}, cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function load(){
    body.classList.add('loading');
    try {
      try { model = await getJson(apiUrl); setStatus('Versión guardada en producción cargada.', 'ok'); }
      catch (_) { model = await getJson(defaultUrl); setStatus('Copia base cargada. Guarda para publicarla.', ''); }
      render();
    } catch (error){ setStatus(`No se pudo cargar: ${error.message}`, 'error'); }
    finally { body.classList.remove('loading'); }
  }
  function field(id, value){ $(id).value = value || ''; }
  function render(){
    document.querySelectorAll('[data-client-name]').forEach(node => { node.textContent = model.displayName || displayName; });
    field('displayName', model.displayName || displayName);
    field('eyebrow', model.hero?.eyebrow);
    field('title', model.hero?.title);
    field('summary', model.hero?.summary);
    field('objective', model.objective);
    field('closingTitle', model.closing?.title);
    field('closingAction', model.closing?.action);
    field('notes', model.notes);
    renderIdeas();
    syncRaw();
  }
  function renderIdeas(){
    const host = $('ideas'); host.innerHTML = '';
    (model.skeleton || []).forEach((idea, index) => {
      const node = document.createElement('article'); node.className = 'idea'; node.dataset.index = index;
      node.innerHTML = `<div class="idea-top"><span class="handle">${String(index+1).padStart(2,'0')} · BLOQUE</span><label class="check"><input type="checkbox" data-key="enabled" ${idea.enabled !== false ? 'checked' : ''}>Visible</label><div class="idea-actions"><button class="btn icon" type="button" data-action="up" title="Subir">↑</button><button class="btn icon" type="button" data-action="down" title="Bajar">↓</button><button class="btn icon danger" type="button" data-action="remove" title="Eliminar">×</button></div></div><div class="grid"><div class="field"><label>Título del bloque</label><input data-key="title" value="${esc(idea.title)}"></div><div class="field"><label>Idea principal</label><input data-key="message" value="${esc(idea.message)}"></div><div class="field full"><label>Detalle / argumentos</label><textarea data-key="detail">${esc(idea.detail)}</textarea></div></div>`;
      host.appendChild(node);
    });
  }
  function readForm(){
    const ideas = [...document.querySelectorAll('.idea')].map((node, index) => {
      const value = (key) => node.querySelector(`[data-key="${key}"]`);
      return { id:idFor(value('title').value,index), title:value('title').value, message:value('message').value, detail:value('detail').value, enabled:value('enabled').checked };
    });
    return {
      schemaVersion:1, client,
      displayName:$('displayName').value,
      hero:{eyebrow:$('eyebrow').value,title:$('title').value,summary:$('summary').value},
      objective:$('objective').value,
      skeleton:ideas,
      closing:{title:$('closingTitle').value,action:$('closingAction').value},
      notes:$('notes').value
    };
  }
  function syncRaw(){ $('raw').value = JSON.stringify(readForm(), null, 2); }
  function addIdea(){
    model = readForm();
    model.skeleton.push({id:`idea-${model.skeleton.length+1}`,title:'Nueva idea',message:'Mensaje principal',detail:'Argumentos y detalles que deben aparecer en la presentación.',enabled:true});
    renderIdeas(); syncRaw();
    document.querySelector('.idea:last-child input[data-key="title"]').focus();
  }
  function move(index, delta){
    model = readForm(); const target = index + delta;
    if (target < 0 || target >= model.skeleton.length) return;
    [model.skeleton[index], model.skeleton[target]] = [model.skeleton[target], model.skeleton[index]];
    renderIdeas(); syncRaw();
  }
  async function save(){
    model = readForm();
    if (!model.hero.title.trim() || !model.skeleton.length){ setStatus('Falta el título o al menos una idea.', 'error'); return; }
    body.classList.add('loading'); setStatus('Guardando y regenerando la presentación…', '');
    try {
      const response = await fetch(apiUrl, {method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(model)});
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      model = result.data; render();
      setStatus(`Publicado · ${new Date(model.updatedAt).toLocaleString('es-ES')}`, 'ok');
    } catch (error){ setStatus(`No se pudo guardar: ${error.message}`, 'error'); }
    finally { body.classList.remove('loading'); }
  }
  async function restore(){
    if (!confirm('¿Volver a la copia base? Podrás revisarla antes de guardar.')) return;
    try { model = await getJson(defaultUrl); render(); setStatus('Copia base restaurada. Pulsa Guardar para publicarla.', ''); }
    catch (error){ setStatus(`No se pudo restaurar: ${error.message}`, 'error'); }
  }
  function applyRaw(){
    try { model = JSON.parse($('raw').value); render(); setStatus('JSON aplicado al formulario. Falta guardar.', ''); }
    catch (error){ setStatus(`JSON no válido: ${error.message}`, 'error'); }
  }
  $('ideas').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const node = button.closest('.idea'); const index = Number(node.dataset.index); const action = button.dataset.action;
    if (action === 'up') move(index,-1); else if (action === 'down') move(index,1); else if (action === 'remove') { model=readForm(); model.skeleton.splice(index,1); renderIdeas(); syncRaw(); }
  });
  document.addEventListener('input', (event) => { if (event.target.id !== 'raw') syncRaw(); });
  $('addIdea').addEventListener('click', addIdea);
  $('save').addEventListener('click', save);
  $('restore').addEventListener('click', restore);
  $('applyRaw').addEventListener('click', applyRaw);
  load();
})();
