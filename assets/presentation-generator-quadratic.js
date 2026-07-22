(function(){
  'use strict';
  var STORAGE_KEY='admiranext.generator.shell.v1';
  var modes={
    options:{toggle:'generatorOptionsToggle',panel:'generatorOptionsRail',bodyClass:'gen-options-open'},
    advanced:{toggle:'generatorAdvancedToggle',panel:'generatorAdvancedRail',bodyClass:'gen-advanced-open'},
    expert:{toggle:'generatorExpertToggle',panel:'generatorExpertRail',bodyClass:'gen-expert-open'}
  };
  var state={options:false,advanced:false,expert:false};

  function icon(type){
    if(type==='options')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    if(type==='advanced')return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 15a2 2 0 0 0 .4 2.2l.1.1-2.2 2.2-.1-.1A2 2 0 0 0 15 19l-.3.1V22h-5.4v-2.9L9 19a2 2 0 0 0-2.2.4l-.1.1-2.2-2.2.1-.1A2 2 0 0 0 5 15l-.1-.3H2v-5.4h2.9L5 9a2 2 0 0 0-.4-2.2l-.1-.1 2.2-2.2.1.1A2 2 0 0 0 9 5l.3-.1V2h5.4v2.9L15 5a2 2 0 0 0 2.2-.4l.1-.1 2.2 2.2-.1.1A2 2 0 0 0 19 9l.1.3H22v5.4h-2.9Z"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 7 4 5-4 5M12 17h7"/></svg>';
  }

  function start(){
    var header=document.querySelector('.top'),main=document.querySelector('main.wrap'),form=document.getElementById('generator');
    if(!header||!main||!form||document.getElementById('generatorOptionsToggle'))return;
    document.body.classList.add('generator-quadratic');main.classList.add('generator-shell-main');header.classList.add('generator-shell-top');
    registerSections(form);
    header.innerHTML='<div class="generator-topbar"><a class="generator-top-brand" href="/presentaciones/generador/"><i aria-hidden="true"></i><span>ADmiraNeXT · Generador</span><small>Workspace activo</small></a><div class="generator-top-actions"><div class="generator-mode-buttons" aria-label="Herramientas del generador">'+button('options','Opciones')+button('advanced','Opciones avanzadas')+button('expert','Modo experto')+'</div><a class="generator-back" href="/presentaciones/">Presentaciones</a></div></div>';
    header.insertAdjacentHTML('afterend',drawers());
    restore();renderAll();bind(form);syncDiagnostics(form);
    form.addEventListener('input',function(){syncDiagnostics(form)});form.addEventListener('change',function(){syncDiagnostics(form)});
    new MutationObserver(function(){registerSections(form);syncDiagnostics(form)}).observe(form,{childList:true,subtree:true});
  }

  function button(mode,label){return '<button class="generator-mode-button" id="'+modes[mode].toggle+'" type="button" aria-controls="'+modes[mode].panel+'" aria-expanded="false" aria-label="'+label+'" title="'+label+'">'+icon(mode)+'</button>'}
  function drawers(){return '<aside class="generator-drawer generator-side-drawer left" id="generatorOptionsRail" aria-label="Opciones" hidden><div class="generator-drawer-head"><div><span class="generator-drawer-kicker">Nivel 01 · Opciones</span><h2>Navegación del relato</h2></div><button class="generator-drawer-close" type="button" data-close-generator="options" aria-label="Cerrar Opciones">×</button></div><nav class="generator-nav-list" aria-label="Secciones del generador"><button class="generator-nav-action" type="button" data-generator-target="generatorContext"><span>Contexto del cliente</span><b>01</b></button><button class="generator-nav-action" type="button" data-generator-target="generatorIdentity"><span>Inspiración e identidad</span><b>02</b></button><button class="generator-nav-action" type="button" data-generator-target="generatorAccess"><span>Acceso privado</span><b>03</b></button><button class="generator-nav-action" type="button" data-generator-target="generatorArchitecture"><span>Arquitectura</span><b>04</b></button><button class="generator-nav-action" type="button" data-generator-target="generatorLanguages"><span>Idiomas y entregables</span><b>05</b></button></nav><p class="generator-drawer-note">El raíl organiza el trabajo sin modificar los datos introducidos.</p></aside><aside class="generator-drawer generator-side-drawer right" id="generatorAdvancedRail" aria-label="Opciones avanzadas" hidden><div class="generator-drawer-head"><div><span class="generator-drawer-kicker">Nivel 02 · Avanzadas</span><h2>Estado de producción</h2></div><button class="generator-drawer-close" type="button" data-close-generator="advanced" aria-label="Cerrar Opciones avanzadas">×</button></div><div class="generator-diagnostics"><div class="generator-diagnostic"><span>Cliente</span><output id="generatorDiagClient">—</output></div><div class="generator-diagnostic"><span>URL</span><output id="generatorDiagSlug">—</output></div><div class="generator-diagnostic"><span>Idiomas</span><output id="generatorDiagLanguages">ES</output></div><div class="generator-diagnostic"><span>Nivel visual</span><output id="generatorDiagQuality">Good</output></div><div class="generator-diagnostic"><span>Entregables</span><output id="generatorDiagOutputs">Site</output></div><div class="generator-diagnostic"><span>Formulario</span><output id="generatorDiagValidity">Pendiente</output></div></div><p class="generator-drawer-note">Resumen vivo de la configuración que se enviará al motor.</p></aside><section class="generator-drawer generator-bottom-drawer" id="generatorExpertRail" aria-label="Modo experto" hidden><div class="generator-drawer-head"><div><span class="generator-drawer-kicker">Nivel 03 · Experto</span><h2>Consola del generador</h2></div><button class="generator-drawer-close" type="button" data-close-generator="expert" aria-label="Cerrar Modo experto">×</button></div><div class="generator-expert-layout"><pre class="generator-console" id="generatorExpertConsole" aria-live="polite"></pre><div class="generator-expert-actions"><button type="button" id="generatorValidate">Validar formulario <span>↵</span></button><button type="button" id="generatorCopyConfig">Copiar configuración <span>⌘C</span></button><a href="/presentaciones/control/">Control de accesos <span>↗</span></a><a href="/presentaciones/">Galería <span>↗</span></a></div></div></section>'}

  function registerSections(form){
    var panels=form.querySelectorAll(':scope > .panel');
    if(panels[0])panels[0].id='generatorContext';if(panels[1])panels[1].id='generatorIdentity';if(panels[2])panels[2].id='generatorAccess';
    var architecture=form.querySelector('.sequence-panel');if(architecture)architecture.id='generatorArchitecture';
    var languages=form.querySelector('.language-panel');if(languages)languages.id='generatorLanguages';
  }
  function bind(form){
    Object.keys(modes).forEach(function(mode){document.getElementById(modes[mode].toggle).addEventListener('click',function(){setOpen(mode,!state[mode],'toggle')})});
    document.addEventListener('click',function(event){var close=event.target.closest('[data-close-generator]');if(close){setOpen(close.dataset.closeGenerator,false,'close');return}var target=event.target.closest('[data-generator-target]');if(target){var node=document.getElementById(target.dataset.generatorTarget);if(node){node.scrollIntoView({behavior:'smooth',block:'start'});node.querySelector('input,textarea,select,button')?.focus({preventScroll:true})}}});
    document.addEventListener('keydown',function(event){if(event.key!=='Escape')return;var mode=state.expert?'expert':state.advanced?'advanced':state.options?'options':null;if(mode){event.preventDefault();setOpen(mode,false,'escape')}});
    document.getElementById('generatorValidate').addEventListener('click',function(){var valid=form.reportValidity();syncDiagnostics(form);writeConsole(form,valid?'VALIDACIÓN CORRECTA':'FALTAN CAMPOS OBLIGATORIOS')});
    document.getElementById('generatorCopyConfig').addEventListener('click',async function(){var value=JSON.stringify(configuration(form),null,2);try{await navigator.clipboard.writeText(value);writeConsole(form,'CONFIGURACIÓN COPIADA')}catch(_){writeConsole(form,'NO SE PUDO COPIAR LA CONFIGURACIÓN')}});
  }
  function setOpen(mode,open,source){
    state[mode]=Boolean(open);
    if(innerWidth<760&&open&&(mode==='options'||mode==='advanced'))state[mode==='options'?'advanced':'options']=false;
    renderAll();persist();document.dispatchEvent(new CustomEvent('admira-generator-shell-change',{detail:{mode:mode,open:state[mode],source:source,state:Object.assign({},state)}}));
  }
  function renderAll(){Object.keys(modes).forEach(function(mode){var item=modes[mode],toggle=document.getElementById(item.toggle),panel=document.getElementById(item.panel);document.body.classList.toggle(item.bodyClass,state[mode]);if(toggle)toggle.setAttribute('aria-expanded',String(state[mode]));if(panel){panel.hidden=!state[mode];panel.setAttribute('aria-hidden',String(!state[mode]))}})}
  function configuration(form){var data=Object.fromEntries(new FormData(form).entries());data.languages=[].slice.call(form.querySelectorAll('input[name="language"]:checked')).map(function(input){return input.value});data.outputs=[].slice.call(form.querySelectorAll('input[name="output"]:checked')).map(function(input){return input.value});delete data.password;return data}
  function syncDiagnostics(form){var data=configuration(form),quality=data.beforeQuality||'good';setText('generatorDiagClient',data.displayName||'—');setText('generatorDiagSlug',data.slug||'automática');setText('generatorDiagLanguages',(data.languages||[]).map(function(v){return v.toUpperCase()}).join(' · ')||'—');setText('generatorDiagQuality',quality.charAt(0).toUpperCase()+quality.slice(1));setText('generatorDiagOutputs',(data.outputs||[]).join(' · ')||'—');setText('generatorDiagValidity',form.checkValidity()?'Listo':'Pendiente');writeConsole(form)}
  function writeConsole(form,message){var data=configuration(form),lines=['ADMIRANEXT PRESENTATION ENGINE','version: '+(window.__ADMIRA_GENERATOR_VERSION__||'cargando'),'client: '+(data.displayName||'sin definir'),'slug: '+(data.slug||'automático'),'languages: '+((data.languages||[]).join(', ')||'sin selección'),'outputs: '+((data.outputs||[]).join(', ')||'sin selección'),'form: '+(form.checkValidity()?'ready':'incomplete')];if(message)lines.push('> '+message);setText('generatorExpertConsole',lines.join('\n'))}
  function setText(id,value){var node=document.getElementById(id);if(node)node.textContent=value}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(_){}}
  function restore(){try{var saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');Object.keys(modes).forEach(function(mode){state[mode]=Boolean(saved[mode])})}catch(_){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
