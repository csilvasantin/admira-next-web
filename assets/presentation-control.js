(function(){
  'use strict';

  const state={data:null,events:[],view:'overview',refreshTimer:null,panelStack:[]};
  const labels={page_view:'Visita',download:'Descarga',media_play:'Reproducción',login_success:'Acceso correcto',login_failed:'Acceso fallido',identity_confirmed:'Identidad',language_change:'Idioma',external_link:'Enlace externo',fullscreen:'Pantalla completa'};
  const preferenceIds=['largeText','highContrast','reduceMotion','compactMode','maskTechnical'];
  const preferenceClasses={largeText:'large-text',highContrast:'high-contrast',reduceMotion:'reduce-motion',compactMode:'compact',maskTechnical:'mask-technical'};
  const panelNames={options:['Abrir opciones','Cerrar opciones'],advanced:['Abrir ajustes avanzados','Cerrar ajustes avanzados'],expert:['Abrir consola experta','Cerrar consola experta']};
  const $=id=>document.getElementById(id);

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function formatDate(value){
    if(!value)return '—';
    try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));}catch(_){return value;}
  }
  function notice(message,error){
    $('notice').textContent=message;
    $('notice').classList.toggle('error',Boolean(error));
    $('headerStatus').classList.toggle('error',Boolean(error));
  }
  function eventMatches(event,query){
    if(!query)return true;
    return [event.name,event.email,event.client,event.target,event.path,event.type,event.city,event.country].some(value=>String(value||'').toLowerCase().includes(query));
  }
  function countLabel(value,singular,plural){return value+' '+(value===1?singular:plural);}
  function eventRow(event,full){
    const technical='<span class="technical technical-detail">'+esc(event.ip||'')+'</span>';
    const location=esc([event.city,event.country].filter(Boolean).join(', ')||'—')+technical;
    const cells=[
      '<td>'+esc(formatDate(event.timestamp))+'</td>',
      '<td class="who"><b>'+esc(event.name||'Sin identificar')+'</b><span>'+esc(event.email||event.visitorId||'—')+'</span></td>',
      '<td><b>'+esc(event.client||'—')+'</b><span class="technical">'+esc((event.language||'').toUpperCase())+'</span></td>',
      '<td><span class="pill '+esc(event.type)+'">'+esc(labels[event.type]||event.type||'Evento')+'</span></td>',
      '<td>'+esc(event.target||event.path||'—')+'</td>'
    ];
    if(full)cells.push('<td>'+location+'</td>');
    return '<tr>'+cells.join('')+'</tr>';
  }
  function clientCard(client,max){
    const width=Math.max(4,Math.round(client.events/max*100));
    return '<article class="client-card"><div class="client-row"><div><b>'+esc(client.client)+'</b><div class="client-meta">'+countLabel(client.visitors,'persona','personas')+' · '+countLabel(client.views,'visita','visitas')+' · '+countLabel(client.downloads,'descarga','descargas')+'</div></div><small>'+esc(formatDate(client.lastAccess))+'</small></div><div class="bar" aria-label="'+countLabel(client.events,'evento','eventos')+'"><i style="width:'+width+'%"></i></div></article>';
  }
  function presentationCard(client,max){
    const width=Math.max(4,Math.round(client.events/max*100));
    return '<article class="presentation-card"><h3>'+esc(client.client)+'</h3><p>Último acceso · '+esc(formatDate(client.lastAccess))+'</p><div class="presentation-stats"><div><b>'+client.visitors+'</b><span>Personas</span></div><div><b>'+client.views+'</b><span>Visitas</span></div><div><b>'+client.downloads+'</b><span>Descargas</span></div></div><div class="bar" aria-label="'+countLabel(client.events,'evento','eventos')+'"><i style="width:'+width+'%"></i></div></article>';
  }

  function render(){
    if(!state.data)return;
    const query=$('search').value.trim().toLowerCase();
    state.events=(state.data.events||[]).filter(event=>eventMatches(event,query));
    const rows=state.events.map(event=>eventRow(event,true)).join('');
    const recent=state.events.slice(0,12).map(event=>eventRow(event,false)).join('');
    $('activityRows').innerHTML=rows;
    $('overviewRows').innerHTML=recent;
    $('activityEmpty').hidden=state.events.length>0;
    $('overviewEmpty').hidden=state.events.length>0;
    $('resultCount').textContent=countLabel(state.events.length,'evento','eventos');
    $('activityCount').textContent=countLabel(state.events.length,'evento','eventos');
    const clients=state.data.clients||[];
    const max=Math.max(1,...clients.map(client=>client.events));
    $('overviewClients').innerHTML=clients.map(client=>clientCard(client,max)).join('')||'<div class="empty">Sin actividad</div>';
    $('presentationClients').innerHTML=clients.map(client=>presentationCard(client,max)).join('')||'<div class="empty">Sin actividad</div>';
    $('presentationsCount').textContent=countLabel(clients.length,'presentación','presentaciones');
  }

  function populateClients(clients){
    const select=$('client');
    const current=select.value;
    const names=[...new Set(clients.map(client=>client.client))].sort((a,b)=>a.localeCompare(b,'es'));
    select.innerHTML='<option value="">Todos los clientes</option>'+names.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');
    if(names.includes(current))select.value=current;
  }

  async function load(){
    const params=new URLSearchParams({days:$('days').value});
    if($('client').value)params.set('client',$('client').value);
    if($('type').value)params.set('type',$('type').value);
    $('refresh').disabled=true;
    notice('Actualizando actividad…');
    try{
      const response=await fetch('/presentaciones/control/api/events?'+params,{headers:{accept:'application/json'},cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'No se pudo cargar la actividad');
      state.data=data;
      ['visitors','views','downloads','plays','last24h','events'].forEach(id=>{$(id).textContent=data.summary[id]??0;});
      populateClients(data.clients||[]);
      render();
      const updated=new Intl.DateTimeFormat('es-ES',{timeStyle:'short'}).format(new Date(data.generatedAt));
      $('stamp').textContent=updated;
      $('headerPulse').textContent=countLabel(data.summary.last24h??0,'evento','eventos')+' · 24 h';
      notice('Actualizado a las '+updated+' · '+countLabel((data.events||[]).length,'evento','eventos')+' en el periodo');
    }catch(error){
      $('headerPulse').textContent='Sin conexión';
      notice(error.message||'No se pudo cargar la actividad',true);
      cliPrint('error: '+(error.message||'sin conexión'),'error');
    }finally{$('refresh').disabled=false;}
  }

  function setView(view,announce){
    const allowed=['overview','activity','presentations'];
    if(!allowed.includes(view))return false;
    state.view=view;
    document.querySelectorAll('[data-view-section]').forEach(section=>{section.hidden=section.dataset.viewSection!==view;});
    document.querySelectorAll('[data-view]').forEach(button=>{
      const active=button.dataset.view===view;
      button.classList.toggle('active',active);
      if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    if(announce)notice('Vista activa: '+({overview:'Resumen',activity:'Actividad',presentations:'Presentaciones'}[view]));
    return true;
  }

  const panels={
    options:{panel:$('panelOptions'),toggle:$('toggleOptions')},
    advanced:{panel:$('panelAdvanced'),toggle:$('toggleAdvanced')},
    expert:{panel:$('panelExpert'),toggle:$('toggleExpert')}
  };
  function updateScrim(){
    const any=Object.values(panels).some(item=>item.panel.classList.contains('open'));
    $('panelScrim').classList.toggle('visible',any);
    $('panelScrim').setAttribute('aria-hidden',any?'false':'true');
  }
  function setPanel(key,open,returnFocus){
    const item=panels[key];if(!item)return;
    item.panel.classList.toggle('open',open);
    item.panel.setAttribute('aria-hidden',open?'false':'true');
    item.toggle.setAttribute('aria-expanded',open?'true':'false');
    item.toggle.setAttribute('aria-label',panelNames[key][open?1:0]);
    if('inert' in item.panel)item.panel.inert=!open;
    state.panelStack=state.panelStack.filter(value=>value!==key);
    if(open){
      state.panelStack.push(key);
      const target=key==='expert'?$('cliInput'):item.panel.querySelector('button:not(.panel-close),input,select');
      if(target)setTimeout(()=>target.focus(),40);
    }else if(returnFocus)item.toggle.focus();
    updateScrim();
  }
  function togglePanel(key){setPanel(key,!panels[key].panel.classList.contains('open'));}
  function closeAll(){[...state.panelStack].reverse().forEach(key=>setPanel(key,false,false));}

  function exportCsv(){
    const columns=['timestamp','name','email','client','type','path','target','language','ip','city','country','userAgent'];
    const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const csv=[columns.join(','),...state.events.map(event=>columns.map(column=>quote(event[column])).join(','))].join('\n');
    const anchor=document.createElement('a');
    anchor.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    anchor.download='accesos-presentaciones-'+new Date().toISOString().slice(0,10)+'.csv';
    anchor.click();
    setTimeout(()=>URL.revokeObjectURL(anchor.href),0);
    notice('CSV exportado · '+countLabel(state.events.length,'evento','eventos'));
  }

  function savePreferences(){
    const preferences={};
    preferenceIds.forEach(id=>{preferences[id]=$(id).checked;});
    try{localStorage.setItem('admira-presentation-control-preferences',JSON.stringify(preferences));}catch(_){}
  }
  function applyPreference(id,value){
    $(id).checked=Boolean(value);
    document.documentElement.classList.toggle(preferenceClasses[id],Boolean(value));
  }
  function loadPreferences(){
    let preferences={};
    try{preferences=JSON.parse(localStorage.getItem('admira-presentation-control-preferences')||'{}');}catch(_){}
    if(preferences.reduceMotion===undefined&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)preferences.reduceMotion=true;
    preferenceIds.forEach(id=>applyPreference(id,preferences[id]));
  }
  function resetPreferences(){
    preferenceIds.forEach(id=>applyPreference(id,false));
    try{localStorage.removeItem('admira-presentation-control-preferences');}catch(_){}
    notice('Preferencias de lectura restauradas');
  }
  function scheduleRefresh(){
    if(state.refreshTimer)clearInterval(state.refreshTimer);
    const seconds=Number($('autoRefresh').value)||0;
    if(seconds)state.refreshTimer=setInterval(load,seconds*1000);
  }

  function cliPrint(text,className){
    const line=document.createElement('div');
    line.className='cli-line'+(className?' '+className:'');
    line.textContent=text;
    $('cliOutput').appendChild(line);
    $('cliOutput').scrollTop=$('cliOutput').scrollHeight;
  }
  const help=[
    'comandos disponibles:',
    '  help                         muestra esta ayuda',
    '  resumen                      indicadores del periodo',
    '  vista <resumen|actividad|presentaciones>',
    '  filtro <texto|clear>          busca en la actividad cargada',
    '  cliente <nombre|todos>        filtra y recarga',
    '  tipo <visitas|descargas|reproducciones|todos>',
    '  dias <1|7|30|90|180>          cambia el periodo',
    '  actualizar                    recarga los datos',
    '  exportar                      descarga el CSV filtrado',
    '  privacidad <on|off>           oculta/muestra IP',
    '  clear                         limpia la consola'
  ].join('\n');
  function cliRun(raw){
    const line=raw.trim();if(!line)return;
    cliPrint('admiranext:/presentaciones$ '+line,'command');
    const [command,...parts]=line.split(/\s+/);const argument=parts.join(' ').trim();
    switch(command.toLowerCase()){
      case 'help':case '?':cliPrint(help);break;
      case 'resumen':case 'summary':{
        if(!state.data){cliPrint('sin datos cargados','error');break;}
        const summary=state.data.summary;
        cliPrint('personas '+summary.visitors+' · visitas '+summary.views+' · descargas '+summary.downloads+' · reproducciones '+summary.plays+' · total '+summary.events);
        break;
      }
      case 'vista':case 'view':{
        const map={resumen:'overview',overview:'overview',actividad:'activity',activity:'activity',presentaciones:'presentations',presentations:'presentations'};
        if(map[argument.toLowerCase()]&&setView(map[argument.toLowerCase()],true))cliPrint('vista → '+argument.toLowerCase());else cliPrint('uso: vista <resumen|actividad|presentaciones>','error');
        break;
      }
      case 'filtro':case 'filter':
        $('search').value=/^(clear|limpiar)$/i.test(argument)?'':argument;render();cliPrint('filtro → '+($('search').value||'ninguno'));break;
      case 'cliente':case 'client':{
        const option=[...$('client').options].find(item=>item.value.toLowerCase()===argument.toLowerCase());
        if(/^(todos|all|clear)$/i.test(argument))$('client').value='';else if(option)$('client').value=option.value;else{cliPrint('cliente no disponible','error');break;}load();cliPrint('cliente → '+($('client').value||'todos'));break;
      }
      case 'tipo':case 'type':{
        const map={todos:'',all:'',visitas:'page_view',visita:'page_view',descargas:'download',descarga:'download',reproducciones:'media_play',reproduccion:'media_play',reproducción:'media_play',accesos:'login_success',fallidos:'login_failed'};
        if(map[argument.toLowerCase()]===undefined){cliPrint('uso: tipo <visitas|descargas|reproducciones|todos>','error');break;}
        $('type').value=map[argument.toLowerCase()];load();cliPrint('tipo → '+(argument||'todos'));break;
      }
      case 'dias':case 'days':
        if(['1','7','30','90','180'].includes(argument)){$('days').value=argument;load();cliPrint('periodo → '+argument+' días');}else cliPrint('uso: dias <1|7|30|90|180>','error');break;
      case 'actualizar':case 'refresh':load();cliPrint('actualizando…');break;
      case 'exportar':case 'export':exportCsv();cliPrint('CSV preparado');break;
      case 'privacidad':case 'privacy':
        if(!['on','off'].includes(argument.toLowerCase())){cliPrint('uso: privacidad <on|off>','error');break;}
        applyPreference('maskTechnical',argument.toLowerCase()==='on');savePreferences();render();cliPrint('privacidad → '+argument.toLowerCase());break;
      case 'clear':$('cliOutput').innerHTML='';break;
      default:cliPrint('comando no reconocido · escribe help','error');
    }
  }

  Object.entries(panels).forEach(([key,item])=>{
    if('inert' in item.panel)item.panel.inert=true;
    item.toggle.addEventListener('click',()=>togglePanel(key));
  });
  document.querySelectorAll('[data-close-panel]').forEach(button=>button.addEventListener('click',()=>setPanel(button.dataset.closePanel,false,true)));
  $('panelScrim').addEventListener('click',closeAll);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{setView(button.dataset.view,true);if(innerWidth<760)setPanel('options',false,false);}));
  $('openFilters').addEventListener('click',()=>setPanel('advanced',true));
  $('refresh').addEventListener('click',load);
  $('export').addEventListener('click',exportCsv);
  $('search').addEventListener('input',render);
  ['client','type','days'].forEach(id=>$(id).addEventListener('change',load));
  $('autoRefresh').addEventListener('change',scheduleRefresh);
  preferenceIds.forEach(id=>$(id).addEventListener('change',()=>{applyPreference(id,$(id).checked);savePreferences();render();}));
  $('resetPreferences').addEventListener('click',resetPreferences);
  $('clearConsole').addEventListener('click',()=>{$('cliOutput').innerHTML='';$('cliInput').focus();});
  $('cliInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();cliRun(event.currentTarget.value);event.currentTarget.value='';}});
  $('filterForm').addEventListener('submit',event=>{event.preventDefault();load();});

  document.addEventListener('keydown',event=>{
    const typing=/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)||event.target.isContentEditable;
    if(event.key==='Escape'&&state.panelStack.length){event.preventDefault();const key=state.panelStack[state.panelStack.length-1];setPanel(key,false,true);return;}
    if(typing)return;
    if(event.key==='/'){event.preventDefault();setPanel('advanced',true);setTimeout(()=>$('search').focus(),60);return;}
    const key=event.key.toLowerCase();
    if(key==='o'){event.preventDefault();togglePanel('options');}
    if(key==='a'){event.preventDefault();togglePanel('advanced');}
    if(key==='e'){event.preventDefault();togglePanel('expert');}
    if(key==='r'){event.preventDefault();load();}
    if(key==='?'){event.preventDefault();setPanel('expert',true);cliPrint(help);}
  });

  loadPreferences();
  setView('overview',false);
  scheduleRefresh();
  load();
})();
