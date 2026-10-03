/* presentation-generator-quadratic.js — el generador dentro de la BARRA DE LA INTRANET.
 *
 * Carlos (3-oct-2026): «que Presentaciones lleve también la barra de la intranet».
 * Hasta hoy el generador montaba el armazón en MODO BARRA (rótulo «GENERADOR» y sus
 * secciones arriba). Ahora lleva la misma cabecera que /proyectos/, /analitics,
 * /webmaster, /usuarios, /xpace/manage y /flota (assets/admira-frame.js en MODO
 * CABECERA):
 *
 *   [☰] ADmiraNeXT · Proyectos · Usuarios · Webmaster · Analitics · Agentes · Presentaciones … ● Acceso privado [▤] [⌘]
 *
 * La cabecera y lo que va a cada panel están en presentaciones/generador.html
 * (data-yk-slot); este script ya NO dibuja barra ni cajones. Sólo:
 *
 *   ☰ Opciones  → nada que hacer: las páginas del generador (galería, control de
 *                 accesos, marca blanca, MCP) son enlaces estáticos del HTML.
 *   ▤ Avanzado  → rellena el estado de producción y el «Ir a» de las secciones, y
 *                 da vida a Validar y Copiar configuración.
 *   ⌘ Experto   → el resumen del motor y los verbos del CLI del armazón.
 *
 * Va al final del <body> (lo inyecta la Function del generador), se ejecuta en el
 * acto y ANTES que el armazón (defer), que es quien muda cada data-yk-slot a su
 * panel y registra los verbos de window.ADMIRA_FRAME_VERBS.
 */
(function(){
  'use strict';
  var doc=document;
  var form=null;

  // Atajos a las secciones del formulario (▤ «Ir a» y /seccion): los ids los pone registerSections.
  var SECCIONES=[
    {id:'generatorContext',n:'01',titulo:'Contexto del cliente',claves:['contexto','cliente']},
    {id:'generatorIdentity',n:'02',titulo:'Inspiración e identidad',claves:['identidad','inspiracion','tesis']},
    {id:'generatorEmbeds',n:'03',titulo:'Soluciones vivas',claves:['soluciones','embebidos','embeds']},
    {id:'generatorAccess',n:'04',titulo:'Acceso privado',claves:['acceso','clave']},
    {id:'generatorArchitecture',n:'05',titulo:'Arquitectura',claves:['arquitectura','esqueleto','secuencia']},
    {id:'generatorLanguages',n:'06',titulo:'Idiomas y entregables',claves:['idiomas','entregables','idioma']}
  ];
  var DIAGNOSTICO=[['Cliente','generatorDiagClient','—'],['URL','generatorDiagSlug','—'],['Idiomas','generatorDiagLanguages','ES'],['Nivel visual','generatorDiagQuality','Good'],['Entregables','generatorDiagOutputs','Site'],['Formulario','generatorDiagValidity','Pendiente']];

  // ⌘ Experto: los verbos del generador, registrados ANTES de que cargue el armazón.
  // /ir es del armazón (la navegación del grupo), así que /seccion ya no lo usa de alias.
  function verbos(){return [
    {id:'validar',aliases:['v'],ayuda:'Valida el formulario y dice qué falta',run:function(_a,ctx){if(!form){ctx.error('El formulario del generador no está en esta página');return}var ok=form.reportValidity();syncDiagnostics();var faltan=[].slice.call(form.querySelectorAll(':invalid')).filter(function(n){return n.name}).map(function(n){return n.name});ctx.imprimir(ok?'Validación correcta: listo para generar.':'Faltan campos obligatorios: '+faltan.join(', '));writeConsole(ok?'VALIDACIÓN CORRECTA':'FALTAN CAMPOS OBLIGATORIOS')}},
    {id:'config',aliases:['cfg'],uso:'[copiar]',ayuda:'Muestra (o copia) la configuración que se enviará al motor, sin la clave',run:function(args,ctx){var data=configuration();if(args[0]==='copiar'){return copiar(data).then(function(ok){ctx.imprimir(ok?'Configuración copiada.':'No se pudo copiar la configuración.')})}ctx.json(data)}},
    {id:'estado',aliases:['st'],ayuda:'Resumen del motor: versión, cliente, idiomas, entregables',run:function(_a,ctx){lineas().forEach(function(l){ctx.imprimir(l)})}},
    {id:'seccion',aliases:['s'],uso:'<01-06|nombre>',ayuda:'Salta a una sección del formulario: '+SECCIONES.map(function(s){return s.claves[0]}).join(', '),run:function(args,ctx){var q=quitarAcentos(args.join(' ').toLowerCase());var s=SECCIONES.filter(function(x){return q&&(x.n===q.padStart(2,'0')||x.claves.some(function(c){return c.indexOf(q)===0}))})[0];if(!s){ctx.error('Uso: /seccion <01-06|nombre> · '+SECCIONES.map(function(x){return x.n+' '+x.claves[0]}).join(' · '));return}if(!irA(s.id)){ctx.error('La sección «'+s.titulo+'» no está en este formulario');return}ctx.imprimir('→ '+s.titulo)}},
    {id:'galeria',aliases:['catalogo'],ayuda:'Abre la galería de presentaciones',run:function(_a,ctx){ctx.imprimir('Abriendo la galería…');location.href='/presentaciones/galeria'}},
    {id:'accesos',aliases:['control'],ayuda:'Abre el control de accesos',run:function(_a,ctx){ctx.imprimir('Abriendo el control de accesos…');location.href='/presentaciones/control/'}}
  ]}
  window.ADMIRA_FRAME_VERBS=(window.ADMIRA_FRAME_VERBS||[]).concat(verbos());

  function mount(){
    var f=doc.getElementById('generator');
    // Sin el <form> del generador no hay nada que rellenar (y dos montajes, tampoco).
    if(!f||!f.elements||f.dataset.generatorQuadratic)return;
    form=f;form.dataset.generatorQuadratic='1';
    var main=doc.querySelector('main.wrap');if(main)main.classList.add('generator-shell-main');
    registerSections(form);
    pintarDiagnostico();pintarIrA();
    bind();syncDiagnostics();
    form.addEventListener('input',syncDiagnostics);form.addEventListener('change',syncDiagnostics);
    new MutationObserver(function(){registerSections(form);syncDiagnostics()}).observe(form,{childList:true,subtree:true});
  }

  // ▤ Avanzado: el estado vivo y los atajos a secciones (los contenedores están en el HTML).
  function pintarDiagnostico(){var caja=doc.getElementById('generatorAdvancedSlot');if(!caja)return;caja.innerHTML=DIAGNOSTICO.map(function(d){return '<div class="generator-diagnostic"><span>'+d[0]+'</span><output id="'+d[1]+'">'+d[2]+'</output></div>'}).join('')}
  function pintarIrA(){var caja=doc.getElementById('generatorGoto');if(!caja)return;caja.innerHTML=SECCIONES.map(function(s){return '<button class="generator-nav-action" type="button" data-generator-target="'+s.id+'"><span>'+s.titulo+'</span><b>'+s.n+'</b></button>'}).join('')}

  function quitarAcentos(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'')}
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
    var validar=doc.getElementById('generatorValidate'),copia=doc.getElementById('generatorCopyConfig');
    if(validar)validar.addEventListener('click',function(){var valid=form.reportValidity();syncDiagnostics();writeConsole(valid?'VALIDACIÓN CORRECTA':'FALTAN CAMPOS OBLIGATORIOS')});
    if(copia)copia.addEventListener('click',function(){copiar(configuration()).then(function(ok){writeConsole(ok?'CONFIGURACIÓN COPIADA':'NO SE PUDO COPIAR LA CONFIGURACIÓN')})});
  }
  function configuration(){if(!form)return {};var data=Object.fromEntries(new FormData(form).entries());data.languages=[].slice.call(form.querySelectorAll('input[name="language"]:checked')).map(function(input){return input.value});data.outputs=[].slice.call(form.querySelectorAll('input[name="output"]:checked')).map(function(input){return input.value});delete data.password;return data}
  function syncDiagnostics(){if(!form)return;var data=configuration(),quality=data.beforeQuality||'good';setText('generatorDiagClient',data.displayName||'—');setText('generatorDiagSlug',data.slug||'automática');setText('generatorDiagLanguages',(data.languages||[]).map(function(v){return v.toUpperCase()}).join(' · ')||'—');setText('generatorDiagQuality',quality.charAt(0).toUpperCase()+quality.slice(1));setText('generatorDiagOutputs',(data.outputs||[]).join(' · ')||'—');setText('generatorDiagValidity',form.checkValidity()?'Listo':'Pendiente');writeConsole()}
  function lineas(){var data=configuration();return ['ADMIRANEXT PRESENTATION ENGINE','version: '+(window.__ADMIRA_GENERATOR_VERSION__||'cargando'),'client: '+(data.displayName||'sin definir'),'slug: '+(data.slug||'automático'),'languages: '+((data.languages||[]).join(', ')||'sin selección'),'outputs: '+((data.outputs||[]).join(', ')||'sin selección'),'form: '+(form&&form.checkValidity()?'ready':'incomplete')]}
  function writeConsole(message){var l=lineas();if(message)l.push('> '+message);setText('generatorExpertConsole',l.join('\n'))}
  function setText(id,value){var node=doc.getElementById(id);if(node)node.textContent=value}

  mount();
})();
