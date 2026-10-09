/* Native Suite Admira walkthrough. Runs only after an explicit launch URL.
 * Fixed, reviewed DOM actions; no arbitrary commands or provider requests.
 * The visible pointer belongs to the page, not the operating system.
 */
(function (G) {
  'use strict';
  if (G.AdmiraDemoControl) return;
  var D = document, query = new URLSearchParams(location.search), platform = query.get('ax_demo');
  if (G.top !== G.self) return;
  var hosts = {studio:['admira.studio','pixeria.com'],store:['admira.store','xpaceos.com'],tv:['admira.tv'],biz:['admira.biz','clearchannel.tv'],app:['admira.app','yokup.com']};
  var host = location.hostname.replace(/^www\./,''), EN = (query.get('lang') || D.documentElement.lang || '').slice(0,2)==='en';
  var preview = /^(localhost|127\.0\.0\.1)$/.test(host) && query.get('ax_preview')===platform;
  if (!hosts[platform] || (hosts[platform].indexOf(host)<0&&!preview)) {
    if (platform === 'hoy') arrancarFuncionHoy();
    else if (platform === 'proyectos' || platform === 'idioma' || platform === 'marcas' || platform === 'roadmap') arrancarFuncionPagina(platform);
    return;
  }
  function enAhora(){ return (D.documentElement.lang || query.get('lang') || '').slice(0,2)==='en'; }
  function rutaIdioma(path){
    if (platform !== 'studio' || !path) return path;
    var base = String(path).replace(/^\/en(?=\/|$)/, '') || '/';
    if (base.charAt(0) !== '/') base = '/' + base;
    return enAhora() && base !== '/' ? '/en' + base : base;
  }
  function mismoPath(a, b){
    function norm(p){ return String(p || '').replace(/^\/en(?=\/|$)/, '').replace(/\/$/, '') || '/'; }
    return norm(a) === norm(b);
  }
  // El texto se elige al pintarlo: /idioma cambia html.lang y el mismo paso sigue, en el otro idioma.
  var T = function(a,b){
    var frase = {es:a, en:b};
    frase.toString = function(){ return enAhora() ? frase.en : frase.es; };
    frase.valueOf = frase.toString;
    return frase;
  }, steps = [], run = query.get('ax_run') || 'direct', key='admira-native-demo-v1:'+platform;
  function add(action, selector, text, value, path) { steps.push({action:action,selector:selector || '',text:text,value:value,path:path || ''}); }
  function point(s,t,p){add('point',s,t,null,p);} function click(s,t,p){add('click',s,t,null,p);} function fill(s,v,t,p){add('fill',s,t,v,p);} function select(s,v,t,p){add('select',s,t,v,p);}
  function reel(id,p){add('video','',T('Veamos el resultado preparado de esta función.','Let us see the prepared result of this feature.'),'https://www.admiranext.com/assets/demos/suite-v1/'+platform+'-'+id+'.mp4',p);}
  if(platform==='studio'){
    var audio='/audio',music='/musica',image='/imagenes',video='/video',adapt='/adaptaciones/';
    fill('#proj-cliente','Alsea · Starbucks · demostración',T('Prepararemos el mensaje de bienvenida de la cafetería.','We will prepare the coffee shop welcome message.'),audio);
    fill('#a-personaje','Voz adulta cálida y cercana',T('Definimos la identidad de la voz.','We define the voice identity.'),audio);
    select('#a-idioma','Espanol (ES)',T('Elegimos el idioma de la locución.','We choose the voiceover language.'),audio);
    select('#a-tono','Cercano',T('Elegimos un tono cercano al cliente.','We choose a warm tone.'),audio);
    fill('#a-guion','Bienvenidos a nuestra cafetería. Haz una pausa y disfruta de un café recién hecho.',T('Escribimos el texto que escucharía el cliente en tienda.','We write the message the customer would hear in store.'),audio);
    point('#playOutput',T('Este botón genera una locución nueva. En este recorrido escuchamos una ya preparada.','This button generates a new voiceover. Here we play a prepared one.'),audio);reel('voz',audio);
    select('#m-versiones','Loop instrumental ~15s',T('Para el ambiente de tienda elegimos un loop instrumental.','For the store atmosphere we choose an instrumental loop.'),music);
    select('#m-style','blues',T('Escogemos el estilo musical.','We choose the musical style.'),music);
    fill('#m-titulo','Una pausa con café',T('Damos nombre a la pieza.','We name the piece.'),music);
    fill('#m-letra','[Instrumental]\nPiano cálido, guitarra suave y contrabajo. Sin voz.',T('Describimos instrumentos y ambiente, sin letra cantada.','We describe the instruments and atmosphere, without sung lyrics.'),music);
    point('#playOutput',T('Aquí se solicita la música. Escuchemos la muestra preparada.','Music is requested here. Let us hear the prepared sample.'),music);reel('musica',music);
    fill('#proj-cliente','Alsea · Starbucks · demostración',T('La creatividad conserva el contexto del proyecto.','The creative retains the project context.'),image);
    fill('#i-prompt','Fotografía publicitaria de café humeante en una taza de cerámica, barra de madera, luz cálida de mañana, fondo de cafetería desenfocado, sin texto.',T('Describimos producto, luz y composición.','We describe the product, light and composition.'),image);
    point('#playOutput',T('Aquí comienza la creación de imagen; ahora vemos el resultado preparado.','Image creation starts here; we now show the prepared result.'),image);reel('imagen',image);
    fill('#clip-stock','1791230658801-jnv969',T('Partimos de una imagen preparada de la biblioteca.','We start with a prepared library image.'),video);
    fill('#clip-prompt','La cámara se acerca lentamente al café y el vapor asciende suavemente. Conserva la taza y el fondo, sin texto.',T('Definimos el movimiento sin cambiar el producto.','We define motion without changing the product.'),video);
    point('#clip-one',T('Este control solicita el clip. Veamos el movimiento del ejemplo preparado.','This control requests the clip. Let us see the prepared example in motion.'),video);reel('video',video);
    click('#stock-pick',T('Abrimos la biblioteca para elegir un contenido existente.','We open the library to choose existing content.'),adapt);
    add('stock','#stock-list li[role="option"]',T('Elegimos el anuncio de café de la demostración.','We choose the coffee ad prepared for this demonstration.'),'Un anuncio elegante de café recién hecho',adapt);
    click('#btn-adaptar',T('Abrimos los formatos de salida de esta pieza.','We open the output formats for this content.'),adapt);
    point('#grid',T('La misma pieza se adapta a pantallas horizontales, verticales y otros tamaños.','The same content adapts to landscape, portrait and other screen sizes.'),adapt);
    point('#export-all',T('La exportación produciría los archivos. Comparemos las cuatro variantes ya preparadas.','Export would produce the files. Let us compare the four prepared variants.'),adapt);reel('adaptar',adapt);
  }

  if(platform==='store'){
    add('open','#pfOptions',T('Abrimos las opciones de gestión del local.','We open the store management options.'));
    add('open','[data-option-id="megafonia"]',T('Abrimos la gestión de locuciones.','We open voiceover management.'));
    select('#announcementVoice','browser',T('La voz local permite ensayar el mensaje.','A local voice allows us to rehearse the message.'));
    fill('#announcementText','Bienvenidos a Starbucks. Haz una pausa y disfruta de tu café.',T('Preparamos el aviso que escucharía el cliente.','We prepare the message the customer would hear.'));
    point('[data-xp-do="mega"]',T('Este control emitiría el aviso. Ahora mostramos el ejemplo preparado.','This control would broadcast the message. We now show the prepared example.'));reel('voz');
    add('open','[data-option-id="music"]',T('Pasamos al hilo musical del local.','We move to the store background music.'));
    point('[data-pixeria-library="music"]',T('La biblioteca conecta música de Studio con el local.','The library connects Studio music to the store.'));
    add('details','[data-options-playlist="music"]',T('Abrimos la playlist actual para revisar su orden.','We open the current playlist to review its order.'));reel('musica');
    add('open','[data-option-id="pixerai"]',T('Abrimos las imágenes disponibles para esta tienda.','We open the images available for this store.'));
    point('[data-pixeria-library="image"]',T('Aquí se eligen las creatividades de la biblioteca.','Library creatives are chosen here.'));reel('imagenes');
    add('open','[data-option-id="video"]',T('La gestión de vídeo utiliza la misma biblioteca.','Video management uses the same library.'));
    add('details','[data-options-playlist="screens"]',T('Revisamos la playlist de las pantallas.','We review the screen playlist.'));reel('video');
    add('close','#pfOptions',T('Volvemos al gemelo para mostrar el punto de venta.','We return to the digital twin to show the point of sale.'));
    point('[data-pos-register="starbucks-tpv-01"]',T('La caja del gemelo conecta pedidos, audio y pantallas.','The twin register connects orders, audio and screens.'));reel('tpv');
  }

  if(platform==='biz'){
    add('dismiss','#splash-close',T('Abrimos el mapa de espacios comerciales.','We open the commercial spaces map.'));
    add('open','#header-advanced-toggle',T('Abrimos las herramientas avanzadas del mapa.','We open the advanced map tools.'));
    add('reveal','#header-circuit-btn',T('Abrimos el selector de circuitos.','We open the circuit selector.'),'#circuit-panel');
    select('#circuit-scope-select','national',T('Elegimos el alcance del circuito.','We choose the circuit scope.'));
    select('#circuit-select','alsea_starbucks',T('Seleccionamos el circuito Alsea Starbucks.','We select the Alsea Starbucks circuit.'));
    point('#circuit-list',T('Revisamos los puntos DooH asociados al circuito.','We review the DooH locations linked to the circuit.'));reel('circuito');
    add('open','#header-advanced-toggle',T('Volvemos a las herramientas de campaña.','We return to the campaign tools.'));
    click('#header-planner-btn',T('Abrimos el planificador de campaña.','We open the campaign planner.'));
    fill('#plan-start','2026-10-08',T('Definimos la fecha de inicio del vuelo de ejemplo.','We define the example flight start date.'));
    fill('#plan-end','2026-10-15',T('Definimos el final del vuelo.','We define the flight end date.'));
    select('#plan-passes','500',T('Preparamos la frecuencia de pases de ejemplo.','We prepare the example playback frequency.'));
    select('#plan-duration','15',T('Elegimos la duración de la creatividad.','We choose the creative duration.'));
    point('#planner-modal',T('El planificador permite revisar el plan antes de contratar.','The planner lets us review the plan before booking.'));reel('proyecto');
    add('dismiss','#plan-close',T('Volvemos al circuito de la propuesta.','We return to the proposed circuit.'));
    add('open','#header-advanced-toggle',T('Volvemos a las herramientas del circuito.','We return to the circuit tools.'));
    add('reveal','#header-circuit-btn',T('Mostramos los puntos del circuito.','We show the circuit locations.'),'#circuit-panel');
    point('#circuit-list',T('Cada punto conecta con su gemelo y su catálogo de superficies.','Each location connects to its twin and surface catalogue.'));reel('gemelo');
    point('#circuit-sel-count',T('Los dispositivos soportan la red de pantallas del circuito. Veamos la propuesta preparada de IoT.','Devices support the circuit screen network. Let us see the prepared IoT proposal.'));reel('iot');
    point('#circuit-select',T('La operación se completa con inventario y trazabilidad. Veamos el ejemplo preparado de ITIL.','Operations are completed with inventory and traceability. Let us see the prepared ITIL example.'));reel('itil');
  }
  if(platform==='tv'){
    add('open','#ui-toggle',T('Desplegamos los controles de la vista de calle.','We reveal the street view controls.'));
    click('#human-inspect',T('Inspeccionamos la pantalla de este emplazamiento.','We inspect the screen at this location.'));
    point('#human-support-card',T('Esta ficha relaciona el soporte con el emplazamiento.','This card links the display support to the location.'));
    click('#human-inspect-close',T('Cerramos la ficha para ver de nuevo la calle.','We close the card to return to the street.'));
    click('#human-exit',T('Pasamos de la vista de calle al mapa tridimensional.','We move from street view to the three dimensional map.'));
    click('#universe-center',T('Encuadramos la red para comprender su alcance.','We frame the network to understand its scope.'));
  }

  if(platform==='app'){
    point('#workspace',T('Este es el portal del comercio: establecimientos, equipos e incidencias autorizados.','This is the retailer portal: authorized locations, devices and incidents.'),'/retailer');
    point('.retailer-locations',T('Revisamos los establecimientos vinculados a la cuenta.','We review the locations linked to the account.'),'/retailer');
    fill('#site-search','Starbucks',T('Buscamos los establecimientos de la demostración. Si tu cuenta no los tiene, la búsqueda lo muestra.','We search for the demonstration locations. If your account does not contain them, the search shows that.'),'/retailer');
    fill('#site-search','',T('Volvemos a mostrar todos tus establecimientos.','We return to all your locations.'),'/retailer');
    select('#site-filter','',T('El inventario permite filtrar los equipos por establecimiento.','The inventory lets us filter equipment by location.'),'/retailer');
    select('#device-state','maintenance',T('Revisamos los equipos con mantenimiento pendiente.','We review devices with pending maintenance.'),'/retailer');
    select('#device-state','',T('Volvemos al inventario completo autorizado.','We return to the complete authorized inventory.'),'/retailer');
    click('[data-filter="active"]',T('Consultamos las incidencias en curso.','We review ongoing incidents.'),'/retailer');
    point('.status-filters',T('Aquí se sigue el estado de cada intervención.','Intervention status is tracked here.'),'/retailer');
    click('[data-filter="rate"]',T('Consultamos las intervenciones pendientes de valoración.','We review interventions awaiting a rating.'),'/retailer');
    click('[data-filter="all"]',T('Recuperamos la vista de todas las incidencias.','We return to all incidents.'),'/retailer');
    click('#refresh',T('Actualizamos la consulta de estado.','We refresh the status query.'),'/retailer');
    point('#itil',T('El inventario ITIL relaciona grupos, posiciones y códigos de los equipos.','The ITIL inventory links device groups, positions and codes.'),'/retailer');
    point('.itil-controls',T('La operación conecta el equipo de cada tienda con su mantenimiento.','Operations connect each store device to its maintenance.'),'/retailer');
  }
  var state={run:run,index:0,active:true,paused:false,muted:false,voice:true,error:'',audioNote:'',pending:false}, saved;
  try{saved=JSON.parse(G.sessionStorage.getItem(key)||'null');if(saved && saved.run===run && Number.isInteger(saved.index) && saved.index>=0 && saved.index<=steps.length){state.index=saved.index;state.paused=!!saved.paused;state.active=!!saved.active;state.muted=!!saved.muted;state.voice=saved.voice!==false;}}catch(_){}
  if(!steps.length)return;
  var generation=0,timer=0,waitResolve=null,utterance=null,videoEl=null,originals=[],target=null,nativeFrame=null;
  function pageDocument(){var doc=nativeFrame?nativeFrame.contentDocument:D;if(nativeFrame&&doc&&doc.head&&!doc.querySelector('#admira-native-target-style')){var st=doc.createElement('style');st.id='admira-native-target-style';st.textContent='.admira-demo-target{outline:3px solid #9be4ba!important;outline-offset:5px!important}';doc.head.appendChild(st);}return doc;}
  function pagePath(){return nativeFrame?nativeFrame.contentWindow.location.pathname:location.pathname;}
  var panel=D.createElement('section');panel.id='admira-native-demo';panel.setAttribute('role','region');panel.setAttribute('aria-label',T('Demostración autónoma en vivo','Autonomous live walkthrough'));
  var style=D.createElement('style');style.textContent='#admira-native-demo{position:fixed;z-index:2147483200;left:14px;right:14px;bottom:14px;background:#10201c;color:#f1f5ef;border:1px solid #9bd6bc;border-radius:12px;padding:12px 16px;box-shadow:0 8px 40px #0008;font:14px/1.45 system-ui;max-height:34vh;overflow:auto}#admira-native-demo p{margin:3px 0 9px}#admira-native-demo strong{color:#a4dfc3}#admira-native-demo button{background:#223c32;color:#fff;border:1px solid #759d88;border-radius:6px;padding:7px 12px;margin:3px 5px 0 0;font:inherit;cursor:pointer}#admira-native-demo button:disabled{opacity:.5}#admira-demo-pointer{position:fixed;z-index:2147483199;pointer-events:none;width:27px;height:34px;transition:left .55s ease,top .55s ease;filter:drop-shadow(1px 2px 2px #000)}.admira-demo-target{outline:3px solid #9be4ba!important;outline-offset:5px!important}#admira-native-cinema{position:fixed;z-index:2147483198;inset:12px 16px 190px;display:flex;align-items:center;justify-content:center;background:#07120feb;border-radius:12px;padding:12px}#admira-native-cinema[hidden]{display:none}#admira-native-cinema video{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}@media(max-width:600px){#admira-native-demo{left:5px;right:5px;bottom:5px;padding:9px;max-height:40vh;font-size:12px}#admira-native-cinema{inset:5px 5px 230px}#admira-native-demo button{padding:6px 9px}}';D.head.appendChild(style);
  if(platform==='studio'){nativeFrame=D.createElement('iframe');nativeFrame.id='admira-native-studio';nativeFrame.title=T('Interfaz real de Admira Studio','Actual Admira Studio interface');nativeFrame.style.cssText='position:fixed;inset:0 0 180px;width:100%;height:calc(100% - 180px);border:0;background:#07120f;z-index:2147483197';D.body.appendChild(nativeFrame);}
  var title=D.createElement('strong'),status=D.createElement('p'),caption=D.createElement('p'),bar=D.createElement('div');status.setAttribute('aria-live','polite');caption.setAttribute('data-demo-phase','');title.textContent=(preview?T('VISTA LOCAL · ','LOCAL PREVIEW · '):T('EN VIVO · ','LIVE · '))+platform.toUpperCase();panel.appendChild(title);panel.appendChild(status);panel.appendChild(caption);panel.appendChild(bar);
  function button(label,fn){var b=D.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;bar.appendChild(b);return b;}
  var pauseBtn=button('',function(){control(state.paused?'resume':'pause');}),muteBtn=button('',function(){control('mute');}),voiceBtn=button('',function(){state.voice=!state.voice;state.audioNote='';persist();if(!state.voice&&G.speechSynthesis)G.speechSynthesis.cancel();paint();}),nextBtn=button(T('Siguiente','Next'),function(){control('next');}),stopBtn=button(T('Devolver control','Return control'),function(){var href=nativeFrame&&nativeFrame.contentWindow?nativeFrame.contentWindow.location.href:'';control('stop');if(href&&new URL(href).origin===location.origin)location.assign(href);});
  var pointer=D.createElement('div');pointer.id='admira-demo-pointer';pointer.setAttribute('aria-hidden','true');pointer.innerHTML='<svg viewBox="0 0 27 34" xmlns="http://www.w3.org/2000/svg"><path d="M2 2v26l7-7 6 11 5-3-6-10h10Z" fill="#a8edc6" stroke="#10201c" stroke-width="2"/></svg>';
  var cinema=D.createElement('div');cinema.id='admira-native-cinema';cinema.hidden=true;D.body.appendChild(cinema);D.body.appendChild(pointer);D.body.appendChild(panel);
  function persist(){try{G.sessionStorage.setItem(key,JSON.stringify({run:run,index:state.index,active:state.active,paused:state.paused,muted:state.muted,voice:state.voice}));}catch(_){} }
  function paint(){panel.dataset.state=state.active?(state.paused?'paused':'running'):'complete';status.textContent=state.error||(state.audioNote?state.audioNote+' · ':'')+T('Paso ','Step ')+Math.min(state.index+1,steps.length)+'/'+steps.length+' · '+(state.active?(state.paused?T('En pausa','Paused'):T('Recorriendo la interfaz','Walking through the interface')):T('Recorrido terminado · tienes el control','Walkthrough complete · you have control'));caption.textContent=steps[state.index]?String(steps[state.index].text):String(T('La Suite conecta creación, gestión, emisión y operación del retail.','The Suite connects content creation, management, broadcasting and retail operations.'));pauseBtn.textContent=state.paused?T('Reanudar','Resume'):T('Pausar','Pause');pauseBtn.disabled=nextBtn.disabled=!state.active;muteBtn.textContent=state.muted?T('Activar sonido','Enable sound'):T('Silenciar demo','Mute demo');muteBtn.setAttribute('aria-pressed',String(state.muted));voiceBtn.textContent=state.voice?T('Voz: activa','Voice: on'):T('Voz: apagada','Voice: off');}
  function cancel(){generation++;clearTimeout(timer);if(waitResolve){waitResolve(false);waitResolve=null;}if(G.speechSynthesis)G.speechSynthesis.cancel();if(videoEl)videoEl.pause();}
  function cleanupTarget(){if(target)target.classList.remove('admira-demo-target');target=null;pointer.hidden=true;}
  function restore(){originals.forEach(function(o){if(o.el.isConnected&&o.el.value===o.written){o.el.value=o.value;o.el.dispatchEvent(new Event('input',{bubbles:true}));o.el.dispatchEvent(new Event('change',{bubbles:true}));}});originals=[];}
  function control(c){if(c==='stop'){cancel();state.active=false;state.paused=false;state.error='';restore();cleanupTarget();cinema.hidden=true;try{G.sessionStorage.removeItem(key);var u=new URL(location.href);u.searchParams.delete('ax_demo');u.searchParams.delete('ax_run');G.history.replaceState(null,'',u);}catch(_){}panel.remove();pointer.remove();cinema.remove();style.remove();if(nativeFrame)nativeFrame.remove();return getState();}if(c==='mute'){state.muted=!state.muted;if(videoEl)videoEl.muted=state.muted;if(state.muted&&G.speechSynthesis)G.speechSynthesis.cancel();persist();paint();return getState();}if(!state.active)return getState();if(c==='next'){cancel();cinema.hidden=true;state.index++;state.pending=false;state.error='';state.paused=false;persist();paint();execute();return getState();}if(c==='pause'){cancel();state.paused=true;persist();paint();}if(c==='resume'){state.paused=false;state.error='';if(state.audioNote){state.voice=true;state.audioNote='';}persist();paint();execute();}return getState();}
  function fail(msg){cancel();state.paused=true;state.error=msg;persist();paint();}
  function getState(){return {activo:state.active,pausado:state.paused,demo:platform,fase:Math.min(state.index+1,steps.length),fases:steps.length,numero:1,total:1,error:state.error,control:'interfaz'};}
  function delay(ms,token){return new Promise(function(resolve){if(token!==generation||state.paused)return resolve(false);waitResolve=resolve;timer=setTimeout(function(){waitResolve=null;resolve(token===generation&&!state.paused);},ms);});}
  function visible(el){if(!el||!el.isConnected)return false;var r=el.getBoundingClientRect(),s=(el.ownerDocument?.defaultView||G).getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';}
  async function find(step,token){for(var n=0;n<80;n++){if(platform==='app'&&pageDocument().querySelector('#workspace')?.hidden){throw new Error(T('Entra en tu cuenta del comercio y pulsa Reanudar para mostrar tu inventario e incidencias.','Sign in to your retailer account and press Resume to show inventory and incidents.'));}var list=Array.prototype.slice.call(pageDocument().querySelectorAll(step.selector));if(step.action==='dismiss'&&!list.some(visible))return false;var el=step.action==='stock'?list.filter(function(e){return e.textContent.toLowerCase().indexOf(step.value.toLowerCase())>=0;})[0]:list.filter(visible)[0];var ready=platform!=='tv'||(D.querySelector('#loading')?.classList.contains('done')&&typeof D.querySelector('#human-exit')?.onclick==='function'&&typeof D.querySelector('#universe-center')?.onclick==='function');if(ready&&el&&visible(el)&&(!('disabled'in el)||!el.disabled||step.action==='point'))return el;if(!await delay(250,token))return null;}throw new Error(T('No puedo manejar este control todavía: ','This control is not ready: ')+step.selector+T('. Revisa la pantalla y pulsa Reanudar.','. Check the screen and press Resume.'));}
  async function aim(el,token){cleanupTarget();target=el;el.classList.add('admira-demo-target');el.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});if(!await delay(650,token))return false;var r=el.getBoundingClientRect();pointer.hidden=false;pointer.style.left=Math.max(4,Math.min(innerWidth-30,r.left+r.width/2))+'px';pointer.style.top=Math.max(4,Math.min(innerHeight-40,r.top+r.height/2))+'px';return delay(650,token);}
  async function narrate(text,token){if(!state.voice||state.muted||!G.speechSynthesis||!G.SpeechSynthesisUtterance)return delay(2400,token);return new Promise(function(resolve){var done=false,dicho=String(text);function finish(){if(done)return;done=true;clearTimeout(timer);waitResolve=null;resolve(token===generation&&!state.paused);}waitResolve=function(){done=true;resolve(false);};utterance=new G.SpeechSynthesisUtterance(dicho);utterance.lang=enAhora()?'en-GB':'es-ES';utterance.rate=1;utterance.onend=finish;utterance.onerror=function(e){if(e.error==='not-allowed'){state.voice=false;state.audioNote=T('Voz bloqueada por el navegador; pulsa Voz para activarla','Browser voice blocked; press Voice to enable it');persist();paint();}finish();};G.speechSynthesis.speak(utterance);timer=setTimeout(function(){if(G.speechSynthesis)G.speechSynthesis.cancel();finish();},Math.max(6500,dicho.length*105));});}
  async function playClip(step,token){cleanupTarget();cinema.hidden=false;if(!videoEl){videoEl=D.createElement('video');videoEl.controls=true;videoEl.playsInline=true;videoEl.preload='metadata';cinema.appendChild(videoEl);}if(videoEl.getAttribute('src')!==step.value){videoEl.src=step.value;videoEl.currentTime=0;}videoEl.muted=state.muted;
    return new Promise(function(resolve,reject){var ended=function(){clean();resolve(token===generation&&!state.paused);},error=function(){clean();reject(new Error(T('No se pudo reproducir el vídeo. Pulsa Reanudar para reintentar.','The video could not play. Press Resume to retry.')));};function clean(){videoEl.removeEventListener('ended',ended);videoEl.removeEventListener('error',error);waitResolve=null;}waitResolve=function(){clean();resolve(false);};videoEl.addEventListener('ended',ended);videoEl.addEventListener('error',error);try{var p=videoEl.play();if(p&&p.catch)p.catch(function(e){clean();reject(new Error(e.name==='NotAllowedError'?T('Pulsa Reanudar para activar el vídeo con sonido, o Silenciar demo para continuar sin audio.','Press Resume to enable video sound, or Mute demo to continue without audio.'):T('Error del vídeo; pulsa Reanudar.','Video error; press Resume.')));});}catch(e){error();}});
  }
  async function studioPage(path,token){
    var dest = rutaIdioma(path);
    var cur = '';
    try { cur = nativeFrame.contentWindow && nativeFrame.contentWindow.location ? nativeFrame.contentWindow.location.pathname : ''; } catch (_) {}
    if (cur && (cur === dest || cur.replace(/\/$/, '') === String(dest).replace(/\/$/, ''))) return true;
    restore();cleanupTarget();
    return new Promise(function(resolve,reject){var finished=false;function clean(){nativeFrame.removeEventListener('load',loaded);clearTimeout(timer);waitResolve=null;}function loaded(){if(finished)return;try{var doc=nativeFrame.contentDocument;if(!doc||/^\/auth\//.test(nativeFrame.contentWindow.location.pathname))throw new Error(T('Tu sesión de Studio necesita acceso. Abre Studio, entra y pulsa Reanudar.','Your Studio session needs access. Open Studio, sign in and press Resume.'));pageDocument();finished=true;clean();resolve(token===generation&&!state.paused);}catch(e){finished=true;clean();reject(e);}}
      nativeFrame.addEventListener('load',loaded);waitResolve=function(){finished=true;clean();resolve(false);};timer=setTimeout(function(){finished=true;clean();reject(new Error(T('La herramienta de Studio no ha terminado de cargar. Pulsa Reanudar para reintentar.','The Studio tool did not finish loading. Press Resume to retry.')));},30000);
      var u=new URL(dest,location.origin);['lang','marca','project','cliente'].forEach(function(k){if(query.get(k))u.searchParams.set(k,query.get(k));});nativeFrame.src=u.href;
    });
  }
  async function execute(){if(!state.active||state.paused)return;var token=++generation;paint();try{while(token===generation&&state.active&&!state.paused&&state.index<steps.length){var s=steps[state.index];paint();if(s.path&&!mismoPath(pagePath(),s.path)){if(nativeFrame){if(!await studioPage(s.path,token))return;}else{restore();persist();var u=new URL(rutaIdioma(s.path),location.origin);u.searchParams.set('ax_demo',platform);u.searchParams.set('ax_run',run);['lang','marca','project','cliente','loc','circuit','ax_preview'].forEach(function(k){if(query.get(k))u.searchParams.set(k,query.get(k));});location.assign(u.href);return;}}
      if(s.action==='video'){if(!await playClip(s,token))return;cinema.hidden=true;}
      else{if(!state.pending){var el=await find(s,token);if(el===false){state.index++;persist();continue;}if(!el||!await aim(el,token))return;if(!el.isConnected)continue;if(s.action==='fill'||s.action==='select'){var old=el.value;var record=originals.find(function(o){return o.el===el;});if(!record){record={el:el,value:old,written:old};originals.push(record);}el.focus({preventScroll:true});if(s.action==='select'){var match=Array.prototype.slice.call(el.options||[]).find(function(o){return o.value===s.value||o.textContent.trim()===s.value;});if(!match)throw new Error(T('Esta opción no está disponible: ','This option is unavailable: ')+s.value);el.value=match.value;record.written=el.value;}else{el.value='';for(var i=0;i<s.value.length;i++){if(!await delay(24,token))return;el.value=s.value.slice(0,i+1);record.written=el.value;el.dispatchEvent(new Event('input',{bubbles:true}));}}el.dispatchEvent(new Event('change',{bubbles:true}));}
        if(s.action==='click'||s.action==='stock'||s.action==='dismiss')el.click();if(s.action==='reveal'&&!visible(pageDocument().querySelector(s.value)))el.click();if(s.action==='open'){var acc=el.closest('[data-acc]');if((acc&&!acc.classList.contains('open'))||(!acc&&el.getAttribute('aria-expanded')!=='true'))el.click();}if(s.action==='close'&&el.getAttribute('aria-expanded')==='true')el.click();if(s.action==='details')el.open=true;state.pending=true;}if(!await narrate(s.text,token))return;}
      state.index++;state.pending=false;persist();}
    if(state.index===steps.length){state.active=false;cleanupTarget();restore();persist();paint();}
  }catch(e){if(token===generation)fail(e.message||T('El recorrido se ha detenido.','The walkthrough stopped.'));}}
  D.addEventListener('keydown',function(e){if(e.key==='Escape'&&state.active)control('pause');});
  // /idioma en mitad del recorrido: mismo índice, el marco pasa a /en/… o vuelve, sin reiniciar.
  function aplicarIdioma(l){
    D.documentElement.lang = l === 'en' ? 'en' : 'es';
    paint();
    if (!nativeFrame) return getState();
    var cur = '';
    try { cur = nativeFrame.contentWindow && nativeFrame.contentWindow.location ? nativeFrame.contentWindow.location.pathname : ''; } catch (_) {}
    if (!cur || cur === 'blank' || /^about:/.test(cur)) return getState();
    var dest = rutaIdioma(cur);
    if (dest.replace(/\/$/, '') !== cur.replace(/\/$/, '')) {
      try {
        var u = new URL(dest, location.origin);
        ['lang','marca','project','cliente'].forEach(function(k){ if (query.get(k)) u.searchParams.set(k, query.get(k)); });
        nativeFrame.src = u.href;
      } catch (_) {}
    }
    return getState();
  }
  G.AdmiraDemoControl={control:control,state:getState,idioma:aplicarIdioma,steps:function(){return steps.map(function(s){return Object.assign({},s);});}};
  paint();persist();if(state.active&&!state.paused)execute();

  // /demo hoy · /demo today. Misma pieza de panel (Pausar, Silenciar demo, Siguiente, Devolver control).
  // Cada funcionalidad futura es una lista de pasos {id, es, en, donde}. El motor apunta, comprueba
  // y al final deja bien / mal / pendiente. No lleva claves ni las copia de una respuesta.
  function arrancarFuncionHoy() {
    var permitidos = ['admiranext.com','admira.biz','clearchannel.tv','admira.store','xpaceos.com'];
    if (permitidos.indexOf(host) < 0 && !/^(localhost|127\.0\.0\.1)$/.test(host)) return;
    var EN = (query.get('lang') || D.documentElement.lang || '').slice(0,2)==='en';
    var T = function(a,b){return EN?b:a;};
    var runId = query.get('ax_run') || 'hoy';
    var paso = query.get('ax_paso') || '';
    var plan = [
      {id:'caja', es:'Caja, flechas y datos JSON', en:'Box, arrows and JSON data', action:'comprobar'},
      {id:'idioma', es:'Idioma del organigrama', en:'Org chart language', action:'comprobar'},
      {id:'idioma-pata', es:'Idioma en admira.biz', en:'Language on admira.biz', action:'comprobar'},
      {id:'architecture', es:'/architecture llega en inglés', en:'/architecture lands in English', action:'comprobar'},
      {id:'agentes', es:'Entrada de agentes', en:'Agent entry', action:'comprobar'}
    ];
    function ahora(){ return (G.performance && typeof G.performance.now==='function') ? G.performance.now() : Date.now(); }
    function leerHechos(s){
      var out=['','','','','']; s=String(s||''); if(!/^[bmp-]{0,5}$/.test(s)) return out;
      for(var i=0;i<5;i++){ var c=s.charAt(i); out[i]=c==='b'?'bien':c==='m'?'mal':c==='p'?'pendiente':''; }
      return out;
    }
    function codificar(arr){ return arr.map(function(x){ return x==='bien'?'b':x==='mal'?'m':x==='pendiente'?'p':'-'; }).join(''); }
    function limpiar(s){ return String(s||'').replace(/bearer\s+\S+/ig,'').replace(/\b(token|clave|secret|password)\b\s*[:=]\s*\S+/ig,'').replace(/\s+/g,' ').trim().slice(0,220); }
    function valorarIdioma(muestras, estricto){
      muestras=(muestras||[]).filter(Boolean);
      if(muestras.length<2) return {estado:'mal', detalle:T('No hubo dos idiomas.','Fewer than two languages.')};
      function campo(k){ return muestras.map(function(m){ return String(m[k]||'').replace(/\s+/g,' ').trim(); }); }
      function cambia(arr){ for(var i=1;i<arr.length;i++) if(arr[i]&&arr[i-1]&&arr[i]!==arr[i-1]) return true; return false; }
      var titulos=campo('titulo'), cuerpos=campo('cuerpo'), docs=campo('tituloDoc');
      var todo=titulos.concat(cuerpos, docs).join(' ');
      if(estricto){
        var par=/Organigrama tecnológico/.test(todo) && /Technology org chart/.test(todo);
        var ok=par && cambia(docs.length?docs:titulos) && cambia(cuerpos);
        return {estado:ok?'bien':'mal', detalle:T(ok?'Título y cuerpo en los dos idiomas.':'El título o el cuerpo no cambiaron.', ok?'Title and body in both languages.':'The title or the body did not change.')};
      }
      var ok2=cambia(titulos) && cambia(cuerpos);
      var base=T(ok2?'El título visible y el cuerpo cambian.':'El título visible o el cuerpo no cambiaron.', ok2?'The visible title and the body change.':'The visible title or the body did not change.');
      if(ok2 && docs.some(Boolean) && !cambia(docs)) base+=T(' El título de la pestaña se queda.',' The tab title stays.');
      return {estado:ok2?'bien':'mal', detalle:base};
    }
    function valorarAgente(status, j){
      var nombre=j && typeof j.nombre==='string' && /^[A-Za-z0-9._-]{2,40}$/.test(j.nombre) ? j.nombre : '';
      if(j && j.sesion && nombre && status===200) return {estado:'bien', detalle:'200 · '+nombre};
      if(j && j.desplegado) return {estado:'pendiente', detalle:T('Desplegado. Esta página no tiene sesión de agente; no se muestra ninguna clave.','Deployed. This page has no agent session; no key is shown.')};
      if(status===404 || (j && j.desplegado===false)) return {estado:'pendiente', detalle:T('La entrada de agentes no está desplegada.','Agent entry is not deployed.')};
      return {estado:'pendiente', detalle:T('Sin respuesta del estado de agentes.','No agent-status response.')};
    }
    var hechos=leerHechos(query.get('ax_hechos')), notas=['','','','',''];
    try{
      var guardado=JSON.parse(G.sessionStorage.getItem('admira-funcion-hoy:'+runId)||'null');
      if(guardado){ for(var g=0;g<5;g++){ if(!hechos[g] && guardado.hechos && guardado.hechos[g]) hechos[g]=guardado.hechos[g]; if(guardado.notas && guardado.notas[g]) notas[g]=limpiar(guardado.notas[g]); } }
    }catch(_){}
    function guardar(){ try{ G.sessionStorage.setItem('admira-funcion-hoy:'+runId, JSON.stringify({hechos:hechos, notas:notas})); }catch(_){} }
    function pathDe(){ return (location.pathname||'/').replace(/\/$/,'')||'/'; }
    function sitioActual(){
      var path=pathDe();
      if((host==='admiranext.com' || /^(localhost|127\.0\.0\.1)$/.test(host)) && path==='/arquitectura') return 'arq';
      if(host==='admira.biz' || host==='clearchannel.tv') return 'biz';
      if(host==='admira.store' || host==='xpaceos.com') return 'store';
      return 'otra';
    }
    function salir(url, extra){
      var u=new URL(url, location.href);
      u.searchParams.set('ax_demo','hoy'); u.searchParams.set('ax_run', runId); u.searchParams.set('ax_hechos', codificar(hechos));
      if(!u.searchParams.get('lang')) u.searchParams.set('lang', EN?'en':'es');
      Object.keys(extra||{}).forEach(function(k){ u.searchParams.set(k, extra[k]); });
      guardar(); location.assign(u.href);
    }
    if(sitioActual()==='otra'){
      if(host==='admiranext.com' || /^(localhost|127\.0\.0\.1)$/.test(host)) salir((location.origin||'')+'/arquitectura', {});
      return;
    }
    var state={active:true, paused:false, muted:false, voice:true, index:0, adelantar:false, error:'', puente:null}, timer=0, pointer=null, panel=null, resumen=null, statusEl=null, caption=null, pauseBtn, muteBtn;
    function pintar(){
      if(!panel) return;
      panel.dataset.state=state.active?(state.paused?'paused':'running'):'complete';
      var hechoTxt=function(e){ return e==='bien'?T('bien','ok'):e==='mal'?T('mal','fail'):e==='pendiente'?T('pendiente','pending'):'—'; };
      statusEl.textContent=T('Paso ','Step ')+Math.min(state.index+1,5)+'/5 · '+(state.active?(state.paused?T('En pausa','Paused'):T('Comprobando','Checking')):T('Resumen','Summary'));
      resumen.textContent='';
      plan.forEach(function(p,i){
        var li=D.createElement('li'); li.dataset.estado=hechos[i]||'';
        li.textContent=(i+1)+'. '+T(p.es,p.en)+' · '+hechoTxt(hechos[i])+(notas[i]?' · '+notas[i]:'');
        resumen.appendChild(li);
      });
      caption.textContent=plan[state.index]?T(plan[state.index].es, plan[state.index].en):'';
      pauseBtn.textContent=state.paused?T('Reanudar','Resume'):T('Pausar','Pause');
      pauseBtn.disabled=!state.active;
      muteBtn.textContent=state.muted?T('Activar sonido','Enable sound'):T('Silenciar demo','Mute demo');
    }
    function esperar(ms){
      return new Promise(function(resolve){
        var left=ms;
        function tick(){
          if(!state.active) return resolve(false);
          if(state.adelantar) return resolve(true);
          if(state.paused){ timer=setTimeout(tick, 200); return; }
          if(left<=0) return resolve(true);
          var slice=Math.min(200, left); left-=slice; timer=setTimeout(tick, slice);
        }
        tick();
      });
    }
    async function buscar(sel, ms){
      var limite=ahora()+ms;
      while(ahora()<limite){
        var el=D.querySelector(sel);
        if(el || state.adelantar || !state.active) return el||null;
        if(!await esperar(250)) return null;
      }
      return D.querySelector(sel);
    }
    function apuntar(el){
      if(!el || !pointer || typeof el.getBoundingClientRect!=='function') return;
      try{ el.scrollIntoView({block:'center', inline:'nearest'}); }catch(_){}
      try{ el.classList.add('admira-demo-target'); }catch(_){}
      var r=el.getBoundingClientRect();
      pointer.hidden=false;
      pointer.style.left=Math.max(4, r.left+r.width/2)+'px';
      pointer.style.top=Math.max(4, r.top+r.height/2)+'px';
    }
    function aplicar(l, estricto){
      if(!estricto && typeof G.setLang==='function'){ try{ G.setLang(l); }catch(_){} }
      if(G.AdmiraExperto && typeof G.AdmiraExperto.setLanguage==='function'){ try{ G.AdmiraExperto.setLanguage(l); }catch(_){} }
      else { try{ D.documentElement.lang=l; D.documentElement.setAttribute('lang', l); }catch(_){} }
    }
    function leerMuestra(){
      var h1=D.querySelector('h1'), lead=D.querySelector('[data-t="lead"]');
      var titulo=((h1&&h1.textContent)||D.title||'').replace(/\s+/g,' ').trim();
      var cuerpo=lead&&lead.textContent ? lead.textContent.replace(/\s+/g,' ').trim() : '';
      if(!cuerpo){
        var parts=[], nodes=D.querySelectorAll('[data-i18n]');
        for(var i=0;i<nodes.length && parts.length<12;i++){
          var tx=(nodes[i].textContent||'').replace(/\s+/g,' ').trim();
          if(tx && tx!==titulo) parts.push(tx);
        }
        cuerpo=parts.join(' · ');
      }
      if(!cuerpo){ var p=D.querySelector('main p'); if(p && p!==h1) cuerpo=(p.textContent||'').replace(/\s+/g,' ').trim(); }
      return {titulo:titulo, tituloDoc:(D.title||'').replace(/\s+/g,' ').trim(), cuerpo:cuerpo};
    }
    async function pasoCaja(){
      var nodo=await buscar('#arq-svg .nodo:not(.infra)', 8000);
      if(!nodo) return {estado:'mal', detalle:T('No aparece ninguna caja.','No box appeared.')};
      apuntar(nodo);
      try{ nodo.dispatchEvent(new Event('mouseenter')); }catch(_){}
      await esperar(600);
      var flechas=!!D.querySelector('.arista.on');
      try{ nodo.dispatchEvent(new Event('click')); }catch(_){}
      await esperar(500);
      var ficha=D.getElementById('arq-ficha');
      var abierta=!!(ficha && ficha.querySelector('h3'));
      var enlace=D.querySelector('a.arq-json');
      if(enlace) apuntar(enlace);
      var codigo=0;
      try{ var r=await fetch('/api/arquitectura',{headers:{accept:'application/json'}}); codigo=r&&r.status||0; }catch(_){ codigo=0; }
      var href=enlace?(enlace.getAttribute('href')||''):'';
      var ok=flechas && abierta && /\/api\/arquitectura(?:$|\?)/.test(href) && codigo===200;
      return {estado:ok?'bien':'mal', detalle:T('Flechas '+(flechas?'sí':'no')+' · ficha '+(abierta?'abierta':'cerrada')+' · JSON '+codigo, 'Arrows '+(flechas?'yes':'no')+' · card '+(abierta?'open':'closed')+' · JSON '+codigo)};
    }
    async function pasoIdioma(estricto){
      var orden=EN?['en','es','en']:['es','en','es'], muestras=[];
      for(var i=0;i<orden.length;i++){
        if(!state.active) return {estado:'mal', detalle:''};
        if(state.adelantar && muestras.length>=2) break;
        aplicar(orden[i], estricto);
        apuntar(D.querySelector('h1')||D.querySelector('main')||D.body);
        if(!await esperar(800)) return {estado:'mal', detalle:''};
        muestras.push(leerMuestra());
      }
      return valorarIdioma(muestras, estricto);
    }
    async function pasoPuente(){
      var href='https://www.admiranext.com/arquitectura?lang=en';
      try{ if(G.AdmiraExperto && typeof G.AdmiraExperto.arquitecturaUrl==='function') href=G.AdmiraExperto.arquitecturaUrl('en'); }catch(_){}
      var u; try{ u=new URL(href, location.href); }catch(_){ return {estado:'mal', detalle:T('URL no válida.','Invalid URL.')}; }
      var ok=u.protocol==='https:' && u.hostname==='www.admiranext.com' && u.pathname.replace(/\/$/,'')==='/arquitectura' && u.searchParams.get('lang')==='en';
      state.puente=ok?u:null;
      return {estado:ok?'bien':'mal', detalle:ok?'/arquitectura?lang=en':T('No llega al organigrama en inglés.','It does not reach the org chart in English.')};
    }
    async function pasoAgente(){
      apuntar(D.querySelector('a.arq-json')||D.querySelector('h1')||D.body);
      var j=null, status=0;
      try{
        var r=await fetch('/api/agente-entrada',{headers:{accept:'application/json'}, cache:'no-store'});
        status=r.status; j=await r.json();
      }catch(_){ j=null; }
      if(j && typeof j==='object'){ Object.keys(j).forEach(function(k){ if(!/^(ok|desplegado|sesion|nombre)$/.test(k)) delete j[k]; }); }
      return valorarAgente(status, j);
    }
    async function uno(i, fn){
      if(!state.active) return;
      state.index=i; state.error=''; pintar();
      var t0=ahora(), r;
      try{ r=await fn(); }catch(e){ r={estado:'mal', detalle:limpiar(e&&e.message)}; }
      if(!state.active) return;
      if(!r || (r.estado!=='bien' && r.estado!=='mal' && r.estado!=='pendiente')) r={estado:'mal', detalle:''};
      hechos[i]=r.estado; notas[i]=limpiar(r.detalle||''); guardar(); pintar();
      var queda=12000-(ahora()-t0);
      if(queda>0) await esperar(queda);
      state.adelantar=false;
    }
    function cerrar(){
      state.active=false; state.paused=false; clearTimeout(timer);
      if(panel) panel.remove(); if(pointer) pointer.remove();
      try{ G.sessionStorage.removeItem('admira-funcion-hoy:'+runId); }catch(_){}
    }
    function control(c){
      if(c==='stop'||c==='parar'||c==='off'){ cerrar(); return getState(); }
      if(c==='mute'){ state.muted=!state.muted; if(state.muted && G.speechSynthesis){ try{ G.speechSynthesis.cancel(); }catch(_){} } pintar(); return getState(); }
      if(!state.active) return getState();
      if(c==='pause'||c==='pausa'){ state.paused=true; pintar(); }
      if(c==='resume'||c==='reanudar'||c==='continuar'){ state.paused=false; pintar(); }
      if(c==='next'||c==='siguiente'){ state.adelantar=true; state.paused=false; pintar(); }
      return getState();
    }
    function getState(){ return {activo:state.active, pausado:state.paused, demo:'hoy', fase:Math.min(state.index+1,5), fases:5, numero:1, total:1, error:state.error, control:'interfaz'}; }
    var style=D.createElement('style');
    style.textContent='#admira-native-demo{position:fixed;z-index:2147483200;left:14px;right:14px;bottom:14px;background:#10201c;color:#f1f5ef;border:1px solid #9bd6bc;border-radius:12px;padding:12px 16px;box-shadow:0 8px 40px #0008;font:14px/1.45 system-ui;max-height:40vh;overflow:auto}#admira-native-demo p,#admira-native-demo li{margin:3px 0}#admira-native-demo strong{color:#a4dfc3}#admira-native-demo button{background:#223c32;color:#fff;border:1px solid #759d88;border-radius:6px;padding:7px 12px;margin:3px 5px 0 0;font:inherit;cursor:pointer}#admira-native-demo button:disabled{opacity:.5}#admira-demo-resumen{margin:6px 0 8px;padding-left:1.2em}#admira-demo-resumen li[data-estado="bien"]{color:#9be4ba}#admira-demo-resumen li[data-estado="mal"]{color:#ffb4b4}#admira-demo-resumen li[data-estado="pendiente"]{color:#f0d48a}#admira-demo-pointer{position:fixed;z-index:2147483199;pointer-events:none;width:27px;height:34px;transition:left .55s ease,top .55s ease}.admira-demo-target{outline:3px solid #9be4ba!important;outline-offset:5px!important}';
    D.head.appendChild(style);
    panel=D.createElement('section'); panel.id='admira-native-demo'; panel.setAttribute('role','region'); panel.setAttribute('aria-label',T('Demostración de hoy','Today\'s walkthrough'));
    var title=D.createElement('strong'); title.textContent=T('EN VIVO · HOY','LIVE · TODAY');
    statusEl=D.createElement('p'); statusEl.setAttribute('aria-live','polite');
    resumen=D.createElement('ol'); resumen.id='admira-demo-resumen';
    caption=D.createElement('p');
    var bar=D.createElement('div');
    function button(label, fn){ var b=D.createElement('button'); b.type='button'; b.textContent=label; b.onclick=fn; bar.appendChild(b); return b; }
    pauseBtn=button(T('Pausar','Pause'), function(){ control(state.paused?'resume':'pause'); });
    muteBtn=button(T('Silenciar demo','Mute demo'), function(){ control('mute'); });
    button(T('Siguiente','Next'), function(){ control('next'); });
    button(T('Devolver control','Return control'), function(){ control('stop'); });
    panel.appendChild(title); panel.appendChild(statusEl); panel.appendChild(resumen); panel.appendChild(caption); panel.appendChild(bar);
    pointer=D.createElement('div'); pointer.id='admira-demo-pointer'; pointer.setAttribute('aria-hidden','true'); pointer.hidden=true;
    pointer.innerHTML='<svg viewBox="0 0 27 34" xmlns="http://www.w3.org/2000/svg"><path d="M2 2v26l7-7 6 11 5-3-6-10h10Z" fill="#a8edc6" stroke="#10201c" stroke-width="2"/></svg>';
    D.body.appendChild(pointer); D.body.appendChild(panel);
    D.addEventListener('keydown', function(e){ if(e.key==='Escape' && state.active) control('pause'); });
    G.AdmiraDemoControl={control:control, state:getState, steps:function(){ return plan.map(function(s){ return {id:s.id, action:s.action, text:T(s.es,s.en)}; }); }, valorarIdioma:valorarIdioma, valorarAgente:valorarAgente};
    pintar();
    void (async function correr(){
      var sitio=sitioActual();
      if(sitio==='arq' && paso!=='agente'){
        await uno(0, pasoCaja); await uno(1, function(){ return pasoIdioma(true); });
        if(state.active) salir('https://www.admira.biz/', {ax_paso:'pata', lang:EN?'en':'es'});
        return;
      }
      if(sitio==='biz' || sitio==='store'){
        await uno(2, function(){ return pasoIdioma(false); });
        await uno(3, pasoPuente);
        if(state.active && state.puente) salir(state.puente.href, {ax_paso:'agente', ax_desde:sitio, lang:'en'});
        else if(state.active){ state.active=false; pintar(); }
        return;
      }
      if(!hechos[3]) hechos[3]=(query.get('lang')==='en' && (query.get('ax_desde')==='biz' || query.get('ax_desde')==='store'))?'bien':'mal';
      await uno(4, pasoAgente);
      if(!state.active) return;
      state.active=false; guardar(); pintar();
    })();
  }

  // /demo proyectos|idioma|marcas|roadmap (y el verbo inglés). Misma pieza de panel que /demo hoy.
  // Cada paso comprueba algo de la página y el resumen se queda en bien, mal o pendiente.
  function arrancarFuncionPagina(id) {
    if (host !== 'admiranext.com' && !/^(localhost|127\.0\.0\.1)$/.test(host)) return;
    var EN = (query.get('lang') || D.documentElement.lang || '').slice(0,2)==='en';
    var T = function(a,b){return EN?b:a;};
    var runId = query.get('ax_run') || id;
    var planes = {
      proyectos: [
        {id:'columna', es:'Columna Nº del censo', en:'Census Nº column'},
        {id:'censo', es:'Filas leídas de la API', en:'Rows read from the API'},
        {id:'orden', es:'Ordenar por Nº', en:'Sort by Nº'},
        {id:'numero', es:'Un Nº o la nota de pendiente', en:'A number or the pending note'}
      ],
      idioma: [
        {id:'texto', es:'La portada tiene texto traducible', en:'The homepage has translatable text'},
        {id:'espanol', es:'Pasa a español', en:'Switches to Spanish'},
        {id:'ingles', es:'Pasa a inglés', en:'Switches to English'},
        {id:'vuelta', es:'Vuelve al idioma del recorrido', en:'Returns to the walkthrough language'}
      ],
      marcas: [
        {id:'portada', es:'Portada de marca blanca', en:'White-label homepage'},
        {id:'catalogo', es:'Pieles de cine 81 a 89', en:'Cinema skins 81 to 89'},
        {id:'piel84', es:'Aplicar /marca 84', en:'Apply /brand 84'},
        {id:'apagada', es:'Quitar la piel', en:'Turn the skin off'}
      ],
      roadmap: [
        {id:'titulo', es:'Título RoadMap', en:'RoadMap title'},
        {id:'gantt', es:'El Gantt se desplaza en horizontal', en:'The Gantt scrolls sideways'},
        {id:'hitos', es:'Hitos de /api/roadmap', en:'Milestones from /api/roadmap'},
        {id:'idioma', es:'El corte pasa a inglés', en:'The cut switches to English'}
      ]
    };
    var plan = planes[id];
    if (!plan) return;
    function limpioPath(){
      var p = location.pathname || '/';
      p = p.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
      if (p.length > 1) p = p.replace(/\/$/, '');
      return p || '/';
    }
    var quiere = {proyectos:'/proyectos', idioma:'/', marcas:'/marcablanca', roadmap:'/roadmap'}[id];
    var destino = {proyectos:'/proyectos/', idioma:'/', marcas:'/marcablanca/', roadmap:'/roadmap'}[id];
    if (limpioPath() !== quiere) {
      var u = new URL(destino, location.href);
      u.searchParams.set('ax_demo', id);
      u.searchParams.set('ax_run', runId);
      u.searchParams.set('lang', EN ? 'en' : 'es');
      location.assign(u.href);
      return;
    }
    function ahora(){ return (G.performance && typeof G.performance.now==='function') ? G.performance.now() : Date.now(); }
    function limpiar(s){ return String(s||'').replace(/bearer\s+\S+/ig,'').replace(/\b(token|clave|secret|password)\b\s*[:=]\s*\S+/ig,'').replace(/\s+/g,' ').trim().slice(0,220); }
    var hechos = plan.map(function(){ return ''; });
    var notas = plan.map(function(){ return ''; });
    var state = {active:true, paused:false, muted:false, index:0, adelantar:false, error:''}, timer=0, pointer=null, panel=null, resumen=null, statusEl=null, caption=null, pauseBtn, muteBtn;
    function pintar(){
      if (!panel) return;
      panel.dataset.state = state.active ? (state.paused ? 'paused' : 'running') : 'complete';
      var hechoTxt = function(e){ return e==='bien'?T('bien','ok'):e==='mal'?T('mal','fail'):e==='pendiente'?T('pendiente','pending'):'—'; };
      statusEl.textContent = T('Paso ','Step ') + Math.min(state.index+1, plan.length) + '/' + plan.length + ' · ' + (state.active ? (state.paused ? T('En pausa','Paused') : T('Comprobando','Checking')) : T('Resumen','Summary'));
      resumen.textContent = '';
      plan.forEach(function(p,i){
        var li = D.createElement('li');
        li.dataset.estado = hechos[i] || '';
        li.textContent = (i+1) + '. ' + T(p.es, p.en) + ' · ' + hechoTxt(hechos[i]) + (notas[i] ? ' · ' + notas[i] : '');
        resumen.appendChild(li);
      });
      caption.textContent = plan[state.index] ? T(plan[state.index].es, plan[state.index].en) : '';
      pauseBtn.textContent = state.paused ? T('Reanudar','Resume') : T('Pausar','Pause');
      pauseBtn.disabled = !state.active;
      muteBtn.textContent = state.muted ? T('Activar sonido','Enable sound') : T('Silenciar demo','Mute demo');
    }
    function esperar(ms){
      return new Promise(function(resolve){
        var left = ms;
        function tick(){
          if (!state.active) return resolve(false);
          if (state.adelantar) return resolve(true);
          if (state.paused) { timer = setTimeout(tick, 200); return; }
          if (left <= 0) return resolve(true);
          var slice = Math.min(200, left); left -= slice; timer = setTimeout(tick, slice);
        }
        tick();
      });
    }
    async function buscar(sel, ms){
      var limite = ahora() + ms;
      while (ahora() < limite) {
        var el = D.querySelector(sel);
        if (el || state.adelantar || !state.active) return el || null;
        if (!await esperar(250)) return null;
      }
      return D.querySelector(sel);
    }
    function apuntar(el){
      if (!el || !pointer || typeof el.getBoundingClientRect !== 'function') return;
      try { el.scrollIntoView({block:'center', inline:'nearest'}); } catch (_) {}
      try { el.classList.add('admira-demo-target'); } catch (_) {}
      var r = el.getBoundingClientRect();
      pointer.hidden = false;
      pointer.style.left = Math.max(4, r.left + r.width / 2) + 'px';
      pointer.style.top = Math.max(4, r.top + r.height / 2) + 'px';
    }
    function textoDe(el){ return ((el && el.textContent) || '').replace(/\s+/g,' ').trim(); }
    async function pasoColumna(){
      var th = await buscar('th[data-col="num"]', 4000);
      if (!th) return {estado:'mal', detalle:T('No está la columna Nº.','The Nº column is missing.')};
      apuntar(th);
      var rotulo = textoDe(th.querySelector('button') || th);
      return /Nº|N\.º|No\b/.test(rotulo)
        ? {estado:'bien', detalle:rotulo}
        : {estado:'mal', detalle:rotulo || T('El botón no dice Nº.','The button does not say Nº.')};
    }
    async function pasoCenso(){
      var limite = ahora() + 8000;
      while (ahora() < limite && state.active) {
        var st = D.getElementById('status');
        var tx = textoDe(st);
        if (/No se pudo leer/.test(tx)) return {estado:'pendiente', detalle:limpiar(tx)};
        var n = D.querySelectorAll('#rows tr').length;
        if (tx && !/Leyendo/.test(tx) && n > 0) {
          apuntar(D.querySelector('#rows tr') || st);
          return {estado:'bien', detalle:n + T(' filas',' rows')};
        }
        if (!await esperar(300)) return {estado:'mal', detalle:''};
      }
      var fallo = textoDe(D.getElementById('status'));
      if (/No se pudo leer/.test(fallo)) return {estado:'pendiente', detalle:limpiar(fallo)};
      return {estado:'mal', detalle:T('El censo no llegó.','The census did not arrive.')};
    }
    async function pasoOrden(){
      var th = D.querySelector('th[data-col="num"]');
      var btn = th && th.querySelector('button');
      if (!th) return {estado:'mal', detalle:T('No está la columna Nº.','The Nº column is missing.')};
      apuntar(btn || th);
      try { (btn || th).click(); } catch (_) {}
      await esperar(200);
      var sort = th.getAttribute('aria-sort') || '';
      return sort === 'ascending'
        ? {estado:'bien', detalle:'aria-sort=ascending'}
        : {estado:'mal', detalle:'aria-sort=' + (sort || '—')};
    }
    async function pasoNumero(){
      var celdas = D.querySelectorAll('#rows td.num');
      var alguno = false;
      for (var i = 0; i < celdas.length; i++) if (/^\d+$/.test(textoDe(celdas[i]))) alguno = true;
      var nota = /Nº pendiente/.test(textoDe(D.getElementById('status')));
      if (alguno) return {estado:'bien', detalle:T('Hay un número de proyecto.','A project number is present.')};
      if (nota) return {estado:'bien', detalle:T('Nº pendiente: la API no publica el número.','Nº pending: the API does not publish the number.')};
      if (!celdas.length) return {estado:'pendiente', detalle:T('Sin filas que numerar.','No rows to number.')};
      return {estado:'mal', detalle:T('Ni número ni nota de pendiente.','Neither a number nor a pending note.')};
    }
    function frasePortada(){
      var nodo = D.querySelector('[data-i18n="manifesto.who.value"]') || D.querySelector('[data-i18n="boot.l1"]') || D.querySelector('[data-i18n]');
      return textoDe(nodo);
    }
    function ponerPortada(l){
      try { if (typeof G.setLang === 'function') G.setLang(l); } catch (_) {}
      try { D.documentElement.lang = l; D.documentElement.setAttribute('lang', l); } catch (_) {}
    }
    async function pasoTextoIdioma(){
      var limite = ahora() + 8000;
      while (ahora() < limite && state.active) {
        var nodo = D.querySelector('[data-i18n]');
        if (nodo && typeof G.setLang === 'function') { apuntar(nodo); return {estado:'bien', detalle:T('Texto con idioma.','Text with a language.')}; }
        if (!await esperar(250)) return {estado:'mal', detalle:''};
      }
      return {estado:'mal', detalle:T('La portada no expone el idioma.','The homepage does not expose the language.')};
    }
    async function esperarFrase(re){
      var limite = ahora() + 4000;
      var frase = '';
      while (ahora() < limite && state.active) {
        frase = frasePortada();
        if (re.test(frase)) return frase;
        if (!await esperar(200)) return frase;
      }
      return frasePortada();
    }
    async function pasoEspanol(){
      ponerPortada('es');
      apuntar(D.querySelector('[data-i18n="manifesto.who.value"]') || D.querySelector('h1') || D.body);
      var frase = await esperarFrase(/Conectan|Iniciando sistema|Manifiesto|Quiénes/i);
      return /Conectan|Iniciando sistema|Manifiesto|Quiénes/i.test(frase)
        ? {estado:'bien', detalle:limpiar(frase)}
        : {estado:'mal', detalle:limpiar(frase) || T('No apareció el español.','Spanish did not appear.')};
    }
    async function pasoIngles(){
      ponerPortada('en');
      apuntar(D.querySelector('[data-i18n="manifesto.who.value"]') || D.querySelector('h1') || D.body);
      var frase = await esperarFrase(/connect to the Internet|Booting portfolio|Manifesto|\bWho\b/i);
      return /connect to the Internet|Booting portfolio|Manifesto|\bWho\b/i.test(frase)
        ? {estado:'bien', detalle:limpiar(frase)}
        : {estado:'mal', detalle:limpiar(frase) || T('No apareció el inglés.','English did not appear.')};
    }
    async function pasoVuelta(){
      var destinoLang = EN ? 'en' : 'es';
      ponerPortada(destinoLang);
      var re = destinoLang === 'en' ? /connect to the Internet|Booting portfolio|Manifesto|\bWho\b/i : /Conectan|Iniciando sistema|Manifiesto|Quiénes/i;
      var frase = await esperarFrase(re);
      return re.test(frase)
        ? {estado:'bien', detalle:destinoLang + ' · ' + limpiar(frase)}
        : {estado:'mal', detalle:limpiar(frase) || destinoLang};
    }
    async function pasoPortadaMarca(){
      var h1 = await buscar('h1', 4000);
      if (!h1) return {estado:'mal', detalle:T('No hay título.','There is no title.')};
      apuntar(h1);
      return {estado:'bien', detalle:limpiar(textoDe(h1))};
    }
    async function pasoCatalogo(){
      var j = null, status = 0;
      try {
        var r = await fetch('/marcablanca/clientes/index.json', {headers:{accept:'application/json'}});
        status = r.status;
        j = r.ok ? await r.json() : null;
      } catch (_) { j = null; }
      var lista = j && (j.clientes || j);
      var ids = {};
      if (Array.isArray(lista)) lista.forEach(function(x){ if (x && x.id != null) ids[String(x.id)] = true; });
      var faltan = [];
      for (var n = 81; n <= 89; n++) if (!ids[String(n)]) faltan.push(String(n));
      if (!faltan.length) return {estado:'bien', detalle:'81–89'};
      if (!status || status >= 500) return {estado:'pendiente', detalle:T('El catálogo no respondió.','The catalog did not respond.') + ' ' + status};
      return {estado:'mal', detalle:T('Faltan ','Missing ') + faltan.join(',')};
    }
    function asegurarMarca(){
      if (G.AdmiraMarca && typeof G.AdmiraMarca.activar === 'function') return Promise.resolve(G.AdmiraMarca);
      return new Promise(function(resolve){
        var s = D.createElement('script');
        var listo = false;
        function fin(){ if (listo) return; listo = true; resolve(G.AdmiraMarca || null); }
        s.src = '/assets/marca-blanca.js?v=20261009-demo-5446';
        s.onload = fin; s.onerror = fin;
        (D.head || D.documentElement).appendChild(s);
        setTimeout(fin, 8000);
      });
    }
    async function pasoPiel(){
      var api = await asegurarMarca();
      if (!api) return {estado:'pendiente', detalle:T('El cargador de marca no llegó.','The brand loader did not arrive.')};
      var r = null;
      try { r = await api.activar('84'); } catch (e) { r = {ok:false, reason:limpiar(e && e.message)}; }
      var guardada = '';
      try { guardada = G.sessionStorage.getItem('mb:marca') || ''; } catch (_) {}
      var actual = '';
      try { actual = (api.actual && api.actual() && api.actual().id) || ''; } catch (_) {}
      if (r && r.ok && (guardada === '84' || actual === '84' || r.id === '84')) {
        apuntar(D.querySelector('h1') || D.body);
        return {estado:'bien', detalle:'/marca 84 · ' + (r.nombre || '84')};
      }
      if (r && (r.reason === 'network' || r.reason === 'unknown')) return {estado:'pendiente', detalle:T('La API de marcas no aplicó el 84 (','The brand API did not apply 84 (') + r.reason + ').'};
      return {estado:'mal', detalle:limpiar((r && (r.reason || r.id)) || T('Sin piel.','No skin.'))};
    }
    async function pasoApagada(){
      var api = G.AdmiraMarca;
      if (api && typeof api.desactivar === 'function') { try { api.desactivar(); } catch (_) {} }
      else { try { G.sessionStorage.removeItem('mb:marca'); } catch (_) {} }
      var guardada = 'x';
      try { guardada = G.sessionStorage.getItem('mb:marca'); } catch (_) { guardada = null; }
      var queda = '';
      try { queda = api && api.actual && api.actual() ? api.actual().id : ''; } catch (_) {}
      if (!guardada && !queda) return {estado:'bien', detalle:T('Sin piel activa.','No active skin.')};
      return {estado:'mal', detalle:T('Siguió la piel ','The skin stayed ') + (guardada || queda)};
    }
    async function pasoTitulo(){
      var h1 = await buscar('h1', 4000);
      var tx = textoDe(h1);
      if (/RoadMap/i.test(tx)) { apuntar(h1); return {estado:'bien', detalle:tx}; }
      return {estado:'mal', detalle:tx || T('No está el título.','The title is missing.')};
    }
    async function pasoGantt(){
      var wrap = await buscar('.rm-gantt-wrap', 4000);
      if (!wrap) return {estado:'mal', detalle:T('No está el Gantt.','The Gantt is missing.')};
      apuntar(wrap);
      var ox = '';
      try { ox = (G.getComputedStyle(wrap).overflowX || G.getComputedStyle(wrap).overflow || ''); } catch (_) {}
      return /auto|scroll|overlay/.test(ox)
        ? {estado:'bien', detalle:'overflow-x:' + ox}
        : {estado:'mal', detalle:'overflow-x:' + (ox || '—')};
    }
    async function pasoHitos(){
      var limite = ahora() + 8000;
      while (ahora() < limite && state.active) {
        var live = textoDe(D.getElementById('rm-live'));
        if (D.getElementById('rm-gantt') || /\/api\/roadmap · \d+/.test(live)) {
          apuntar(D.getElementById('rm-gantt') || D.getElementById('rm-live'));
          return {estado:'bien', detalle:limpiar(live) || 'gantt'};
        }
        if (/no responde|No se pudo leer/.test(live) || /No se pudo leer/.test(textoDe(D.getElementById('rm-gantt-wrap')))) {
          return {estado:'pendiente', detalle:limpiar(live || textoDe(D.getElementById('rm-gantt-wrap')))};
        }
        if (!await esperar(300)) return {estado:'mal', detalle:''};
      }
      return {estado:'mal', detalle:T('El Gantt no se asentó.','The Gantt did not settle.')};
    }
    function ponerArmazon(l){
      try {
        if (G.AdmiraExperto && typeof G.AdmiraExperto.setLanguage === 'function') G.AdmiraExperto.setLanguage(l);
        else { D.documentElement.lang = l; D.documentElement.setAttribute('lang', l); }
      } catch (_) { try { D.documentElement.setAttribute('lang', l); } catch (e) {} }
    }
    async function pasoIdiomaRoad(){
      ponerArmazon('en');
      var limite = ahora() + 5000;
      var tx = '';
      while (ahora() < limite && state.active) {
        tx = textoDe(D.querySelector('h2.corte-h')) + ' ' + textoDe(D.getElementById('rm-live'));
        if (/Cut by period|reading \/api\/roadmap/.test(tx)) {
          apuntar(D.querySelector('h2.corte-h') || D.getElementById('rm-live'));
          return {estado:'bien', detalle:limpiar(tx)};
        }
        if (!await esperar(250)) return {estado:'mal', detalle:''};
      }
      return {estado:'mal', detalle:limpiar(tx) || T('El corte no pasó a inglés.','The cut did not switch to English.')};
    }
    var acciones = {
      proyectos: [pasoColumna, pasoCenso, pasoOrden, pasoNumero],
      idioma: [pasoTextoIdioma, pasoEspanol, pasoIngles, pasoVuelta],
      marcas: [pasoPortadaMarca, pasoCatalogo, pasoPiel, pasoApagada],
      roadmap: [pasoTitulo, pasoGantt, pasoHitos, pasoIdiomaRoad]
    };
    async function uno(i, fn){
      if (!state.active) return;
      state.index = i; state.error = ''; pintar();
      var t0 = ahora(), r;
      try { r = await fn(); } catch (e) { r = {estado:'mal', detalle:limpiar(e && e.message)}; }
      if (!state.active) return;
      if (!r || (r.estado !== 'bien' && r.estado !== 'mal' && r.estado !== 'pendiente')) r = {estado:'mal', detalle:''};
      hechos[i] = r.estado; notas[i] = limpiar(r.detalle || ''); pintar();
      var queda = 2200 - (ahora() - t0);
      if (queda > 0) await esperar(queda);
      state.adelantar = false;
    }
    function cerrar(){
      state.active = false; state.paused = false; clearTimeout(timer);
      if (panel) panel.remove(); if (pointer) pointer.remove();
    }
    function control(c){
      if (c === 'stop' || c === 'parar' || c === 'off') { cerrar(); return getState(); }
      if (c === 'mute') { state.muted = !state.muted; pintar(); return getState(); }
      if (!state.active) return getState();
      if (c === 'pause' || c === 'pausa') { state.paused = true; pintar(); }
      if (c === 'resume' || c === 'reanudar' || c === 'continuar') { state.paused = false; pintar(); }
      if (c === 'next' || c === 'siguiente') { state.adelantar = true; state.paused = false; pintar(); }
      return getState();
    }
    function getState(){ return {activo:state.active, pausado:state.paused, demo:id, fase:Math.min(state.index+1, plan.length), fases:plan.length, numero:1, total:1, error:state.error, control:'interfaz'}; }
    var style = D.createElement('style');
    style.textContent = '#admira-native-demo{position:fixed;z-index:2147483200;left:14px;right:14px;bottom:14px;background:#10201c;color:#f1f5ef;border:1px solid #9bd6bc;border-radius:12px;padding:12px 16px;box-shadow:0 8px 40px #0008;font:14px/1.45 system-ui;max-height:40vh;overflow:auto}#admira-native-demo p,#admira-native-demo li{margin:3px 0}#admira-native-demo strong{color:#a4dfc3}#admira-native-demo button{background:#223c32;color:#fff;border:1px solid #759d88;border-radius:6px;padding:7px 12px;margin:3px 5px 0 0;font:inherit;cursor:pointer}#admira-native-demo button:disabled{opacity:.5}#admira-demo-resumen{margin:6px 0 8px;padding-left:1.2em}#admira-demo-resumen li[data-estado="bien"]{color:#9be4ba}#admira-demo-resumen li[data-estado="mal"]{color:#ffb4b4}#admira-demo-resumen li[data-estado="pendiente"]{color:#f0d48a}#admira-demo-pointer{position:fixed;z-index:2147483199;pointer-events:none;width:27px;height:34px;transition:left .55s ease,top .55s ease}.admira-demo-target{outline:3px solid #9be4ba!important;outline-offset:5px!important}';
    D.head.appendChild(style);
    panel = D.createElement('section');
    panel.id = 'admira-native-demo';
    panel.setAttribute('data-yk-no-traducir', '');
    panel.setAttribute('role','region');
    panel.setAttribute('aria-label', T('Demostración de la página','Page walkthrough'));
    var titulos = {
      proyectos: ['EN VIVO · PROYECTOS','LIVE · PROJECTS'],
      idioma: ['EN VIVO · IDIOMA','LIVE · LANGUAGE'],
      marcas: ['EN VIVO · MARCAS','LIVE · BRANDS'],
      roadmap: ['EN VIVO · ROADMAP','LIVE · ROADMAP']
    };
    var title = D.createElement('strong');
    title.textContent = T(titulos[id][0], titulos[id][1]);
    statusEl = D.createElement('p'); statusEl.setAttribute('aria-live','polite');
    resumen = D.createElement('ol'); resumen.id = 'admira-demo-resumen';
    caption = D.createElement('p');
    var bar = D.createElement('div');
    function button(label, fn){ var b = D.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; bar.appendChild(b); return b; }
    pauseBtn = button(T('Pausar','Pause'), function(){ control(state.paused ? 'resume' : 'pause'); });
    muteBtn = button(T('Silenciar demo','Mute demo'), function(){ control('mute'); });
    button(T('Siguiente','Next'), function(){ control('next'); });
    button(T('Devolver control','Return control'), function(){ control('stop'); });
    panel.appendChild(title); panel.appendChild(statusEl); panel.appendChild(resumen); panel.appendChild(caption); panel.appendChild(bar);
    pointer = D.createElement('div'); pointer.id = 'admira-demo-pointer'; pointer.setAttribute('aria-hidden','true'); pointer.hidden = true;
    pointer.innerHTML = '<svg viewBox="0 0 27 34" xmlns="http://www.w3.org/2000/svg"><path d="M2 2v26l7-7 6 11 5-3-6-10h10Z" fill="#a8edc6" stroke="#10201c" stroke-width="2"/></svg>';
    D.body.appendChild(pointer); D.body.appendChild(panel);
    D.addEventListener('keydown', function(e){ if (e.key === 'Escape' && state.active) control('pause'); });
    G.AdmiraDemoControl = {control:control, state:getState, steps:function(){ return plan.map(function(s){ return {id:s.id, action:'comprobar', text:T(s.es, s.en)}; }); }};
    pintar();
    void (async function correr(){
      var fns = acciones[id];
      for (var i = 0; i < fns.length; i++) {
        await uno(i, fns[i]);
        if (!state.active) return;
      }
      state.active = false; pintar();
    })();
  }
})(window);
