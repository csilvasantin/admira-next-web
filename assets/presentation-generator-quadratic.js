/* presentation-generator-quadratic.js — el generador adopta el ARMAZÓN DE LA CASA.
 *
 * Carlos (2-oct-2026, tras el PR #28): «no respeta la fórmula de la UX cuadrática ni
 * el logo de AdmiraNeXT». Hasta aquí el generador pintaba su propia barra
 * («ADMIRANEXT · GENERADOR» en texto plano y los tres iconos ≡ ⚙ >_ juntos a la
 * derecha), cuando el canon (assets/admira-frame.md) dice:
 *
 *   [☰] ADmiraNeXT · GENERADOR · secciones …                         [▤] [⌘]
 *
 *   ☰ Opciones  → panel IZQUIERDO: navegación y enlaces que llevan a otra página.
 *   ▤ Avanzado  → panel DERECHO: lo que trabaja sobre la página (estado, acciones,
 *                 atajos a secciones).
 *   ⌘ Experto   → franja INFERIOR: el CLI.
 *
 * Ahora este script NO dibuja barra ni cajones: declara qué va a cada lado con
 * data-yk-slot y lo monta assets/admira-frame.js en MODO BARRA, el mismo armazón (y
 * el mismo logotipo oficial) que /presentaciones/galeria. Se ejecuta en el acto
 * (va al final del <body>, con el formulario ya leído) y ANTES que el armazón, que
 * la Function del generador inyecta justo detrás.
 */
(function(){
  'use strict';
  var doc=document,body=doc.body;
  var form=doc.getElementById('generator');
  if(!body||!form||doc.getElementById('generatorOptionsSlot'))return;

  // Atajos a las secciones del formulario (▤): los ids los pone registerSections.
  var SECCIONES=[
    {id:'generatorContext',n:'01',titulo:'Contexto del cliente',claves:['contexto','cliente']},
    {id:'generatorIdentity',n:'02',titulo:'Inspiración e identidad',claves:['identidad','inspiracion','tesis']},
    {id:'generatorEmbeds',n:'03',titulo:'Soluciones vivas',claves:['soluciones','embebidos','embeds']},
    {id:'generatorAccess',n:'04',titulo:'Acceso privado',claves:['acceso','clave']},
    {id:'generatorArchitecture',n:'05',titulo:'Arquitectura',claves:['arquitectura','esqueleto','secuencia']},
    {id:'generatorLanguages',n:'06',titulo:'Idiomas y entregables',claves:['idiomas','entregables','idioma']}
  ];

  function mount(){
    var root=doc.documentElement;
    root.classList.add('yk-framed');
    body.classList.add('generator-quadratic');
    body.dataset.ykTitle=body.dataset.ykTitle||'GENERADOR';
    body.dataset.ykRailLeft=body.dataset.ykRailLeft||'OPCIONES';
    body.dataset.ykRailRight=body.dataset.ykRailRight||'AVANZADO';
    body.dataset.ykCli='on';
    var main=doc.querySelector('main.wrap');if(main)main.classList.add('generator-shell-main');
    // La cabecera propia del HTML («ADmiraNeXT · Generador» + «Catálogo») sobra: la
    // barra del armazón es la única, y su marca el único enlace a la home.
    var vieja=doc.querySelector('header.top');if(vieja)vieja.remove();
    registerSections(form);
    // Sin envoltorio: admira-frame.js MUDA cada data-yk-slot a su raíl, y un contenedor
    // propio se quedaría vacío en la página (lo que ya pasó en la galería).
    var plantilla=doc.createElement('template');
    plantilla.innerHTML=navSlot()+optionsSlot()+advancedSlot()+expertSlot();
    body.insertBefore(plantilla.content,body.firstChild);
    window.ADMIRA_FRAME_VERBS=(window.ADMIRA_FRAME_VERBS||[]).concat(verbos());
    bind();syncDiagnostics();
    form.addEventListener('input',syncDiagnostics);form.addEventListener('change',syncDiagnostics);
    new MutationObserver(function(){registerSections(form);syncDiagnostics()}).observe(form,{childList:true,subtree:true});
  }

  function ico(path){return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'+path+'</svg>'}
  // Secciones en la barra: las mismas que /presentaciones/galeria, más el generador.
  function navSlot(){return '<nav data-yk-slot="nav" hidden>'+
    '<a href="/presentaciones/" aria-label="Generador" title="Generador">'+ico('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/>')+'<span class="yk-lbl">Generador</span></a>'+
    '<a href="/presentaciones/galeria" aria-label="Presentaciones" title="Presentaciones">'+ico('<rect x="4" y="3" width="16" height="18"/><path d="M8 8h8M8 12h8M8 16h5"/>')+'<span class="yk-lbl">Presentaciones</span></a>'+
    '<a href="/presentaciones/control/" aria-label="Gestión de usuarios" title="Gestión de usuarios">'+ico('<circle cx="9" cy="8" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M17 8h4M19 6v4"/>')+'<span class="yk-lbl">Usuarios</span></a>'+
    '</nav>'}
  // ☰ Opciones: navegación, enlaces que llevan a otra página.
  function optionsSlot(){return '<section class="progressive-panel generator-slot" id="generatorOptionsSlot" data-yk-slot="left">'+
    '<p class="panel-kicker">Nivel 01 · Opciones</p><h2>Navegación</h2><p>Las páginas del generador y sus herramientas.</p>'+
    '<div class="panel-actions generator-links">'+
    '<a class="panel-action" href="/presentaciones/galeria">Galería de presentaciones <output>→</output></a>'+
    '<a class="panel-action" href="/presentaciones/control/">Control de accesos <output>→</output></a>'+
    '<a class="panel-action" href="/marcablanca/">Marca blanca <output>→</output></a>'+
    '<a class="panel-action" href="/mcp/generador">MCP del generador <output>↗</output></a>'+
    '</div></section>'}
  // ▤ Avanzado: lo que trabaja sobre la página: estado vivo, acciones y atajos.
  function advancedSlot(){
    var diag=[['Cliente','generatorDiagClient','—'],['URL','generatorDiagSlug','—'],['Idiomas','generatorDiagLanguages','ES'],['Nivel visual','generatorDiagQuality','Good'],['Entregables','generatorDiagOutputs','Site'],['Formulario','generatorDiagValidity','Pendiente']];
    return '<section class="progressive-panel generator-slot" id="generatorAdvancedSlot" data-yk-slot="right">'+
    '<p class="panel-kicker">Nivel 02 · Avanzado</p><h2>Estado de producción</h2>'+
    '<div class="generator-diagnostics">'+diag.map(function(d){return '<div class="generator-diagnostic"><span>'+d[0]+'</span><output id="'+d[1]+'">'+d[2]+'</output></div>'}).join('')+'</div>'+
    '<div class="panel-actions generator-actions"><button type="button" class="panel-action" id="generatorValidate">Validar formulario <output>↵</output></button><button type="button" class="panel-action" id="generatorCopyConfig">Copiar configuración <output>⌘C</output></button></div>'+
    '<p class="panel-kicker generator-goto-k">Ir a</p><nav class="generator-nav-list" aria-label="Secciones del generador">'+
    SECCIONES.map(function(s){return '<button class="generator-nav-action" type="button" data-generator-target="'+s.id+'"><span>'+s.titulo+'</span><b>'+s.n+'</b></button>'}).join('')+
    '</nav></section>'}
  // ⌘ Experto: el resumen del motor; el CLI lo añade el armazón (data-yk-cli="on").
  function expertSlot(){return '<section class="progressive-panel generator-slot" id="generatorExpertSlot" data-yk-slot="bottom">'+
    '<pre class="generator-console" id="generatorExpertConsole" aria-live="polite"></pre></section>'}

  function verbos(){return [
    {id:'validar',aliases:['v'],ayuda:'Valida el formulario y dice qué falta',run:function(_a,ctx){var ok=form.reportValidity();syncDiagnostics();var faltan=[].slice.call(form.querySelectorAll(':invalid')).filter(function(n){return n.name}).map(function(n){return n.name});ctx.imprimir(ok?'Validación correcta: listo para generar.':'Faltan campos obligatorios: '+faltan.join(', '));writeConsole(ok?'VALIDACIÓN CORRECTA':'FALTAN CAMPOS OBLIGATORIOS')}},
    {id:'config',aliases:['cfg'],uso:'[copiar]',ayuda:'Muestra (o copia) la configuración que se enviará al motor, sin la clave',run:function(args,ctx){var data=configuration();if(args[0]==='copiar'){return copiar(data).then(function(ok){ctx.imprimir(ok?'Configuración copiada.':'No se pudo copiar la configuración.')})}ctx.json(data)}},
    {id:'estado',aliases:['st'],ayuda:'Resumen del motor: versión, cliente, idiomas, entregables',run:function(_a,ctx){lineas().forEach(function(l){ctx.imprimir(l)})}},
    {id:'seccion',aliases:['s','ir'],uso:'<01-06|nombre>',ayuda:'Salta a una sección del formulario: '+SECCIONES.map(function(s){return s.claves[0]}).join(', '),run:function(args,ctx){var q=quitarAcentos(args.join(' ').toLowerCase());var s=SECCIONES.filter(function(x){return q&&(x.n===q.padStart(2,'0')||x.claves.some(function(c){return c.indexOf(q)===0}))})[0];if(!s){ctx.error('Uso: /seccion <01-06|nombre> · '+SECCIONES.map(function(x){return x.n+' '+x.claves[0]}).join(' · '));return}if(!irA(s.id)){ctx.error('La sección «'+s.titulo+'» no está en este formulario');return}ctx.imprimir('→ '+s.titulo)}},
    {id:'galeria',aliases:['catalogo'],ayuda:'Abre la galería de presentaciones',run:function(_a,ctx){ctx.imprimir('Abriendo la galería…');location.href='/presentaciones/galeria'}},
    {id:'accesos',aliases:['control'],ayuda:'Abre el control de accesos',run:function(_a,ctx){ctx.imprimir('Abriendo el control de accesos…');location.href='/presentaciones/control/'}}
  ]}

  function quitarAcentos(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
  function irA(id){var node=doc.getElementById(id);if(!node)return false;node.scrollIntoView({behavior:'smooth',block:'start'});var campo=node.querySelector('input,textarea,select,button');if(campo)campo.focus({preventScroll:true});return true}
  function copiar(data){var value=JSON.stringify(data,null,2);try{return navigator.clipboard.writeText(value).then(function(){return true},function(){return false})}catch(_){return Promise.resolve(false)}}

  function registerSections(form){
    var panels=form.querySelectorAll(':scope > .panel');
    // Por TÍTULO, no por posición (FLT-100792 b): el tercer panel es «Soluciones que se enseñan
    // vivas» y el acceso es el cuarto, así que «Acceso privado» del raíl llevaba a los embeds.
    var porTitulo=function(texto){return [].find.call(panels,function(panel){var h=panel.querySelector('h2');return h&&h.textContent.indexOf(texto)>=0})};
    var contexto=porTitulo('Contexto del cliente'),identidad=porTitulo('identidad'),embebidos=porTitulo('Soluciones que se enseñan vivas'),acceso=porTitulo('Acceso privado');
    if(contexto)contexto.id='generatorContext';if(identidad)identidad.id='generatorIdentity';if(embebidos)embebidos.id='generatorEmbeds';if(acceso)acceso.id='generatorAccess';
    var architecture=form.querySelector('.sequence-panel');if(architecture)architecture.id='generatorArchitecture';
    var languages=form.querySelector('.language-panel');if(languages)languages.id='generatorLanguages';
  }
  function bind(){
    doc.addEventListener('click',function(event){var target=event.target.closest&&event.target.closest('[data-generator-target]');if(target)irA(target.dataset.generatorTarget)});
    doc.getElementById('generatorValidate').addEventListener('click',function(){var valid=form.reportValidity();syncDiagnostics();writeConsole(valid?'VALIDACIÓN CORRECTA':'FALTAN CAMPOS OBLIGATORIOS')});
    doc.getElementById('generatorCopyConfig').addEventListener('click',function(){copiar(configuration()).then(function(ok){writeConsole(ok?'CONFIGURACIÓN COPIADA':'NO SE PUDO COPIAR LA CONFIGURACIÓN')})});
  }
  function configuration(){var data=Object.fromEntries(new FormData(form).entries());data.languages=[].slice.call(form.querySelectorAll('input[name="language"]:checked')).map(function(input){return input.value});data.outputs=[].slice.call(form.querySelectorAll('input[name="output"]:checked')).map(function(input){return input.value});delete data.password;return data}
  function syncDiagnostics(){var data=configuration(),quality=data.beforeQuality||'good';setText('generatorDiagClient',data.displayName||'—');setText('generatorDiagSlug',data.slug||'automática');setText('generatorDiagLanguages',(data.languages||[]).map(function(v){return v.toUpperCase()}).join(' · ')||'—');setText('generatorDiagQuality',quality.charAt(0).toUpperCase()+quality.slice(1));setText('generatorDiagOutputs',(data.outputs||[]).join(' · ')||'—');setText('generatorDiagValidity',form.checkValidity()?'Listo':'Pendiente');writeConsole()}
  function lineas(){var data=configuration();return ['ADMIRANEXT PRESENTATION ENGINE','version: '+(window.__ADMIRA_GENERATOR_VERSION__||'cargando'),'client: '+(data.displayName||'sin definir'),'slug: '+(data.slug||'automático'),'languages: '+((data.languages||[]).join(', ')||'sin selección'),'outputs: '+((data.outputs||[]).join(', ')||'sin selección'),'form: '+(form.checkValidity()?'ready':'incomplete')]}
  function writeConsole(message){var l=lineas();if(message)l.push('> '+message);setText('generatorExpertConsole',l.join('\n'))}
  function setText(id,value){var node=doc.getElementById(id);if(node)node.textContent=value}

  mount();
})();
