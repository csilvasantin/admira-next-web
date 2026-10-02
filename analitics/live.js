async function loadPresence(){
  const querySite=selected;$('refresh').disabled=true;$('message').className='';
  try{
    const r=await fetch('/api/presence?site='+encodeURIComponent(selected),{credentials:'same-origin',cache:'no-store'});
    const result=await r.json();if(days!==-1 || querySite!==selected)return;if(!r.ok || !result.ok)throw Error(result.error||'No se pudo consultar la presencia.');
    trafficGlobeUpdate({mode:'live',visitors:result.visitors,scope:selected || 'Todo el grupo'});$('live').hidden=false;$('comparison').hidden=true;$('detail').hidden=true;document.querySelector('.activity').hidden=true;
    $('visits').closest('article').querySelector('p').textContent='SESIONES ACTIVAS';text('visits',number(result.online));text('views',number(result.pages.length));$('views').closest('article').querySelector('p').textContent='PÁGINAS ABIERTAS';text('depth','15 s');$('depth').closest('article').querySelector('p').textContent='SEÑAL DE PRESENCIA';text('coverage','45 s');$('coverage').closest('article').querySelector('p').textContent='VENTANA DE ACTIVIDAD';
    $('visits').closest('article').querySelector('small').textContent='Sesiones con pestaña visible y señal reciente';$('views').closest('article').querySelector('small').textContent='Rutas distintas con sesiones activas';$('depth').closest('article').querySelector('small').textContent='Cada página envía una señal cada 15 s';text('coverageNote','Una sesión caduca a los 45 s sin señal');
    text('connection','En directo');text('freshness','Última lectura: '+new Date(result.updatedAt).toLocaleTimeString('es-ES'));text('refreshNote','Cada 5 segundos');text('message',result.truncated?'Más de 500 entradas: se muestra una lista parcial.':'Ahora · lectura cada 5 s · sesiones anónimas · sólo sites con el medidor de presencia instalado');text('note',result.note);
    const country=c=>{try{return c?new Intl.DisplayNames(['es'],{type:'region'}).of(c):'País no disponible'}catch{return c}};
    $('liveVisitors').replaceChildren();$('livePages').replaceChildren();
    for(const v of result.visitors){const row=el('div',undefined,'live-row');row.append(el('strong',v.visitor),el('span',v.host+v.path),el('small',`${country(v.country)} · ${v.device} · señal hace ${v.ageSeconds} s`));$('liveVisitors').append(row)}
    for(const p of result.pages){const row=el('div',undefined,'breakdown');row.append(el('span',p.host+p.path),el('b',number(p.online)+' activas'));$('livePages').append(row)}
    if(!result.online){$('liveVisitors').append(el('p','No hay sesiones visibles con señal reciente.','status'));$('livePages').append(el('p','Abre una página de un site conectado para ver su presencia aquí.','status'))}
  }catch(e){if(days!==-1 || querySite!==selected)return;trafficGlobeUpdate({mode:'live',scope:selected || 'Todo el grupo',error:true});text('message',e.message);$('message').className='error';text('connection','Sin conexión');['visits','views','depth','coverage'].forEach(id=>text(id,'—'));$('liveVisitors').replaceChildren();$('livePages').replaceChildren()}
  finally{$('refresh').disabled=false}
}
setInterval(()=>{if(days===-1 && !document.hidden)loadPresence()},5000);
