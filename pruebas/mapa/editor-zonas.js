(function (G,d) {
  'use strict';
  var KEY = 'admiranext:mapa:zonas:v1';
  var MAX_FILE_BYTES = 16 * 1024;
  var TAG = /^[a-z0-9][a-z0-9-]{0,47}$/;
  var defaults = {version:1,zones:[
    {id:'gracia',name:'Gràcia',tag:'retail',lat:41.4043,lon:2.1582,radius:450},
    {id:'eixample',name:'Eixample',tag:'tecnologia',lat:41.389,lon:2.1645,radius:450}
  ],outside:{tag:'creatividad'}};
  // Owner-confirmed offices, all in 08012 Barcelona. Address geocodes, not tag fixes.
  // ICGC: Aulèstia21, Bretón9, Planeta7. GeoBCN: Rosa Puig-Rodon Pla4/19
  // (formerly Santa Rosa, city decree S1/D/2024-00332). See docs/mapa-simulador.md.
  var offices = {version:1,zones:[
    {id:'pixeria',name:'Pixería',address:'Aulèstia i Pijoan 21 · 08012 Barcelona',tag:'creatividad',lat:41.40300208,lon:2.15095625,radius:50},
    {id:'university',name:'Admira University',address:'Bretón de los Herreros 9 · 08012 Barcelona',tag:'educacion',lat:41.4023751,lon:2.1519882,radius:50},
    {id:'garage',name:'Garage',address:'Santa Rosa 4 · actual Rosa Puig-rodon Pla · 08012',tag:'devops',lat:41.40316442,lon:2.15276479,radius:50},
    {id:'sneaker-store',name:'Sneaker Store',address:'Santa Rosa 19 · actual Rosa Puig-rodon Pla · 08012',tag:'retail',lat:41.40347899,lon:2.15370648,radius:50},
    {id:'la-nave',name:'La Nave',address:'Planeta 7 · 08012 Barcelona',tag:'emprendimiento',lat:41.40134534,lon:2.1558339,radius:50}
  ],outside:{tag:'publicidad'}};
  var copy = function (value) {return JSON.parse(JSON.stringify(value));};
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.zones) || value.zones.length > 8 || !value.outside || typeof value.outside.tag !== 'string' || !TAG.test(value.outside.tag)) return null;
    var ids = new Set();
    var zones = [];
    for (var zone of value.zones) {
      if (!zone || typeof zone.id !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(zone.id) || zone.id === 'exterior' || ids.has(zone.id) ||
          typeof zone.name !== 'string' || !zone.name.trim() || zone.name.length > 48 || /[\u0000-\u001f\u007f]/.test(zone.name) ||
          (zone.address != null && (typeof zone.address !== 'string' || zone.address.length>160 || /[\u0000-\u001f\u007f]/.test(zone.address))) ||
          typeof zone.tag !== 'string' || !TAG.test(zone.tag) || !Number.isFinite(zone.lat) || Math.abs(zone.lat) > 85 ||
          !Number.isFinite(zone.lon) || Math.abs(zone.lon) > 180 || !Number.isFinite(zone.radius) || zone.radius < 50 || zone.radius > 5000) return null;
      ids.add(zone.id);
      var normalized={id:zone.id,name:zone.name.trim(),tag:zone.tag,lat:zone.lat,lon:zone.lon,radius:Math.round(zone.radius)};
      if (zone.address) normalized.address=zone.address.trim();
      zones.push(normalized);
    }
    return {version:1,zones:zones,outside:{tag:value.outside.tag}};
  }
  function parseTransfer(text) {
    if (typeof text !== 'string') throw new Error('archivo_invalido');
    if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new Error('archivo_demasiado_grande');
    var parsed;
    try {parsed=validate(JSON.parse(text.replace(/^\uFEFF/,'')));} catch (_) {}
    if (!parsed) throw new Error('archivo_invalido');
    return parsed;
  }
  function serializeTransfer(value) {
    var normalized=validate(value);
    if (!normalized) throw new Error('configuracion_invalida');
    var text=JSON.stringify(normalized,null,2)+'\n';
    if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) throw new Error('archivo_demasiado_grande');
    return text;
  }
  function normalizeTag(tag) {
    if (typeof tag!=='string') return null;
    tag=tag.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,'-');
    tag=({music:'musica',technology:'tecnologia',tech:'tecnologia',creativity:'creatividad',business:'negocio'})[tag] || tag;
    return TAG.test(tag)?tag:null;
  }
  function catalogItems(data) {
    if (!data || !Array.isArray(data.items)) throw new Error('catalogo_invalido');
    var kinds=/^(image|video|animation|audio|music|locucion|interactive|xperiencia)$/;
    return data.items.slice(0,5000).flatMap(function (item) {
      if (!item || typeof item.type!=='string' || !kinds.test(item.type) || !Array.isArray(item.tags)) return [];
      var tags=Array.from(new Set(item.tags.slice(0,100).map(normalizeTag).filter(Boolean)));
      if (!tags.length) return [];
      var title=typeof item.title==='string'?item.title.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160):'';
      // Text metadata only: no media URLs, identifiers or untrusted markup.
      return [{title:title,type:item.type,tags:tags}];
    });
  }
  function catalogThemes(items) {
    var counts=new Map();
    items.forEach(function (item) {item.tags.forEach(function (tag) {counts.set(tag,(counts.get(tag)||0)+1);});});
    return Array.from(counts,function (entry) {return {tag:entry[0],count:entry[1]};}).sort(function (a,b) {return b.count-a.count || a.tag.localeCompare(b.tag);}).slice(0,300);
  }
  function catalog(data) {return catalogThemes(catalogItems(data));}
  function edge(zone) {
    var rad = Math.PI/180, angle = zone.radius/6371000, lat = zone.lat*rad;
    var nextLat=Math.asin(Math.sin(lat)*Math.cos(angle));
    // El tirador queda al oeste para poder usarlo junto al player flotante.
    return {lat:nextLat/rad,lng:wrap(zone.lon - Math.atan2(Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(nextLat))/rad)};
  }
  function wrap(lon) {return ((lon+180)%360+360)%360-180;}
  function metres(a,b) {
    var rad = Math.PI/180, h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;
    return 12742000*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
  }
  function create(options) {
    var map = options.map, L = options.L, byId = function (id) {return d.getElementById(id);};
    var T = function (es,en) {return /^en/i.test(d.documentElement.lang || '') ? en : es;};
    var config = copy(defaults), selected = config.zones[0].id, saved, undo = [], saveState = 'default';
    var raw=null;
    try {raw=G.localStorage.getItem(KEY);} catch (_) {saveState='unavailable';}
    if (raw) {
      try {var restored=raw.length<=16384&&validate(JSON.parse(raw));if (restored) {config=restored;saveState='saved';} else saveState='broken';}
      catch (_) {saveState='broken';}
    }
    selected = config.zones[0] ? config.zones[0].id : 'exterior';
    saved = JSON.stringify(config);
    var active = false, opened = false, shapes, handles, circles = new Map(), centreHandle, radiusHandle, position;
    var dragBefore = null, themes = [{tag:'retail'},{tag:'tecnologia'},{tag:'creatividad'},{tag:'educacion'},{tag:'devops'},{tag:'emprendimiento'},{tag:'publicidad'}], catalogState = 'idle', catalogRequest = null, catalogTimer=null, pieces=[], catalogLoaded=false;
    var transferState='idle', importBusy=false, importTicket=0, importedCount=0;
    function current() {return selected === 'exterior' ? config.outside : config.zones.find(function (z) {return z.id === selected;});}
    function label(tag) {
      var names = {retail:T('Comercio','Retail'),tecnologia:T('Tecnología','Technology'),creatividad:T('Creatividad','Creativity'),educacion:T('Educación','Education'),devops:T('Desarrollo de software','Software development'),emprendimiento:T('Emprendimiento','Entrepreneurship'),negocio:T('Negocio','Business'),musica:T('Música','Music'),publicidad:T('Publicidad','Advertising'),robots:T('Robots','Robots')};
      return names[tag] || tag.replace(/-/g,' ');
    }
    function option(select,value,text) {var node=d.createElement('option');node.value=value;node.textContent=text;select.appendChild(node);}
    function renderPieces() {
      var zone=current(), tag=normalizeTag(zone.tag), matches=pieces.filter(function (item) {return item.tags.indexOf(tag)>=0;});
      var names={image:T('Imagen','Image'),video:T('Vídeo','Video'),animation:T('Animación','Animation'),audio:T('Audio','Audio'),music:T('Música','Music'),locucion:T('Locución','Voice-over'),interactive:T('Interactivo','Interactive'),xperiencia:T('Experiencia','Experience')};
      byId('simulador-piezas-titulo').textContent=T('Piezas encontradas · ','Matching items · ')+(selected==='exterior'?T('Fuera de las zonas','Outside the zones'):zone.name)+' · '+label(zone.tag);
      byId('simulador-piezas-ayuda').textContent=T('Muestra orientativa del catálogo: se solicitan hasta 300 piezas y aquí se muestran como máximo cinco coincidencias. El player decide la selección y el orden dentro del tema.','Indicative catalogue sample: up to 300 items requested, with at most five matches shown here. The player decides selection and order within the topic.');
      byId('simulador-piezas-estado').textContent=catalogState==='loading'?T('Consultando las piezas de este tema…','Looking up items for this topic…'):catalogState==='error'?T('No se pudo consultar. Conserva el tema elegido y vuelve a actualizar el catálogo.','Could not load the query. Keep the selected topic and refresh the catalogue again.'):catalogState!=='ready'?T('Abre o actualiza el catálogo para consultar las piezas.','Open or refresh the catalogue to query items.'):!matches.length?T('Sin coincidencias en esta consulta. El tema elegido se conserva.','No matches in this query. The selected topic is kept.'):T(matches.length===1?'1 coincidencia en esta consulta · se muestra 1.':matches.length+' coincidencias en esta consulta · se muestran '+Math.min(5,matches.length)+'.',matches.length===1?'1 match in this query · showing 1.':matches.length+' matches in this query · showing '+Math.min(5,matches.length)+'.');
      var list=byId('simulador-piezas-lista');list.replaceChildren();
      if (catalogState!=='ready') return;
      matches.slice(0,5).forEach(function (item) {
        var row=d.createElement('li'),title=d.createElement('span'),kind=d.createElement('span');
        title.textContent=item.title || T('Sin título disponible','No title available');kind.textContent=names[item.type];
        row.appendChild(title);row.appendChild(kind);list.appendChild(row);
      });
    }
    function fields() {
      var zone=current(), outside=selected==='exterior';
      var select=byId('simulador-zona-elegida');select.replaceChildren();
      config.zones.forEach(function (z,i) {option(select,z.id,(i+1)+'. '+z.name);});
      option(select,'exterior',T('Fuera de las zonas','Outside the zones'));select.value=selected;
      if (d.activeElement!==byId('simulador-nombre')) byId('simulador-nombre').value=outside?T('Fuera de las zonas','Outside the zones'):zone.name;
      byId('simulador-nombre').disabled=outside;
      if (d.activeElement!==byId('simulador-radio')) byId('simulador-radio').value=outside?'':zone.radius;
      byId('simulador-radio').disabled=outside;
      byId('simulador-centro-aqui').disabled=outside;
      byId('simulador-eliminar').disabled=outside;
      var priority=config.zones.findIndex(function (item) {return item.id===selected;});
      byId('simulador-subir').disabled=outside || priority<=0;
      byId('simulador-bajar').disabled=outside || priority<0 || priority>=config.zones.length-1;
      byId('simulador-prioridad').textContent=outside?T('El exterior se aplica cuando no se entra en ninguna zona.','Outside content applies when no zone is entered.'):T('Prioridad '+(priority+1)+' de '+config.zones.length+'. La primera zona coincidente decide el contenido.','Priority '+(priority+1)+' of '+config.zones.length+'. The first matching zone selects the content.');
      byId('simulador-direccion').textContent=outside?'':zone.address?T('Referencia: ','Reference: ')+zone.address:'';
      byId('simulador-anadir').disabled=config.zones.length>=8;
      byId('simulador-deshacer').disabled=!undo.length;
      var content=byId('simulador-tema');
      var list=themes.slice();if (!list.some(function (item) {return item.tag===zone.tag;})) list.unshift({tag:zone.tag});
      if (d.activeElement!==content) {
        content.replaceChildren();list.forEach(function (item) {option(content,item.tag,label(item.tag)+(item.count == null?'':' · '+item.count+' '+T('piezas','items')));});
        content.value=zone.tag;
      }
      byId('simulador-catalogo').disabled=catalogState==='loading';
      byId('simulador-importar').disabled=importBusy;
      renderPieces();
    }
    function renderText() {
      if (!active) return;
      byId('simulador-editar').textContent=opened?T('Terminar edición','Finish editing'):T('Editar zonas y contenido','Edit zones and content');
      byId('simulador-oficinas').textContent=T('Cargar cinco oficinas','Load five offices');
      byId('simulador-oficinas-ayuda').textContent=T('Sedes de 08012 Barcelona, con temas de prueba distintos y radios ajustables de 50 m. Cargar sustituye las zonas de esta sesión; puedes deshacerlo en el editor.','Offices in 08012 Barcelona, with distinct trial topics and adjustable 50 m areas. Loading replaces this session’s zones; you can undo it in the editor.');
      var text={
        'editor-titulo':T('Zonas y contenido','Zones and content'),
        'editor-ayuda':T('Arrastra el centro o el borde de la zona seleccionada. Si se solapan, manda la primera de la lista.','Drag the centre or edge of the selected zone. If zones overlap, the first in the list wins.'),
        'label-zona':T('Zona','Zone'),'label-nombre':T('Nombre','Name'),'label-radio':T('Radio en metros','Radius in metres'),
        'label-tema':T('Contenido de admira.tv','Content from admira.tv'),
        'tema-ayuda':T('Se reproducen las piezas del catálogo con el tema elegido.','Plays catalogue items with the selected topic.'),
        'centro-aqui':T('Situar zona en el simulador','Centre zone on simulator'),'anadir':T('Añadir zona','Add zone'),
        'eliminar':T('Eliminar zona','Delete zone'),'deshacer':T('Deshacer','Undo'),'catalogo':T('Actualizar catálogo','Refresh catalogue'),
        'subir':T('Subir prioridad','Move priority up'),'bajar':T('Bajar prioridad','Move priority down'),
        'guardar':T('Guardar zonas','Save zones'),'restaurar':T('Restaurar ejemplos','Restore examples'),
        'exportar':T('Exportar zonas','Export zones'),'importar':T('Importar zonas','Import zones'),
        'intercambio-ayuda':T('El archivo conserva las zonas, su orden y los temas asignados. En otro navegador, impórtalo y pulsa Guardar zonas.','The file keeps zones, their order and assigned topics. In another browser, import it and choose Save zones.')
      };
      Object.keys(text).forEach(function (id) {byId('simulador-'+id).textContent=text[id];});
      var dirty=JSON.stringify(config)!==saved;
      byId('simulador-guardado').textContent=saveState==='invalid'?T('Revisa el nombre y el radio (50–5000 m).','Check the name and radius (50–5000 m).'):saveState==='error'?T('No se pudo guardar. Los cambios siguen en esta sesión.','Could not save. Changes remain in this session.'):dirty?T('Cambios sin guardar.','Unsaved changes.'):saveState==='saved'?T('Guardado en este navegador.','Saved in this browser.'):saveState==='broken'?T('La configuración guardada no era válida. Se han cargado los ejemplos.','Saved configuration was invalid. Examples were loaded.'):T('Las zonas se guardan sólo en este navegador.','Zones are saved only in this browser.');
      byId('simulador-catalogo-estado').textContent=catalogState==='loading'?T('Consultando catálogo…','Loading catalogue…'):catalogState==='error'?T('Catálogo no disponible. Puedes usar los temas ya cargados.','Catalogue unavailable. You can use topics already loaded.'):catalogState==='ready'?T('Temas encontrados en la consulta actual de admira.tv.','Topics found in the current admira.tv query.'):'';
      var importedText=!dirty&&saveState==='saved'?T('Archivo importado: '+importedCount+' zonas. Guardado en este navegador.','File imported: '+importedCount+' zones. Saved in this browser.'):T('Archivo importado: '+importedCount+' zonas. Revisa el resultado y pulsa Guardar zonas.','File imported: '+importedCount+' zones. Review the result and choose Save zones.');
      var transferText={idle:'',reading:T('Abriendo archivo…','Opening file…'),download:T('Descarga iniciada. Incluye los cambios de esta sesión.','Download started. Includes changes from this session.'),imported:importedText,large:T('El archivo supera el máximo de 16 KB. La configuración actual se conserva.','The file exceeds 16 KB. Current configuration is unchanged.'),invalid:T('El archivo no contiene una configuración válida. La configuración actual se conserva.','The file does not contain a valid configuration. Current configuration is unchanged.'),readError:T('No se pudo abrir el archivo. La configuración actual se conserva.','Could not open the file. Current configuration is unchanged.'),downloadError:T('No se pudo iniciar la descarga. La configuración actual se conserva.','Could not start the download. Current configuration is unchanged.')};
      byId('simulador-intercambio-estado').textContent=transferText[transferState] || '';
      byId('simulador-archivo').setAttribute('aria-label',T('Archivo de zonas','Zone file'));
      if (opened) fields();
    }
    function drawShapes() {
      if (!active) return;
      shapes.clearLayers();circles.clear();
      config.zones.forEach(function (zone) {
        var tooltip=d.createElement('span');tooltip.textContent=zone.name;
        var circle=L.circle([zone.lat,zone.lon],{radius:zone.radius,color:'#bc85ec',weight:opened&&zone.id===selected?3:1,fillOpacity:0.06,interactive:false}).addTo(shapes).bindTooltip(tooltip,{permanent:true,direction:'top',offset:[0,-45],className:'mapa-sim-zone'});
        circles.set(zone.id,circle);
      });
    }
    function remember(before) {if (before!==JSON.stringify(config)) {undo.push(before);if (undo.length>20) undo.shift();if (saveState==='error'||saveState==='invalid') saveState='default';}}
    function changed(before,change) {remember(before);if (transferState!=='reading') transferState='idle';drawShapes();drawHandles();renderText();options.onChange(change);}
    function edit(update,change) {var before=JSON.stringify(config);update();if (!current()) selected=config.zones[0]?config.zones[0].id:'exterior';changed(before,change);}
    function geometry(draggingRadius) {
      var zone=current(), circle=circles.get(selected);
      if (circle) circle.setLatLng([zone.lat,zone.lon]).setRadius(zone.radius);
      if (centreHandle) centreHandle.setLatLng([zone.lat,zone.lon]);
      if (radiusHandle&&!draggingRadius) radiusHandle.setLatLng(edge(zone));
      byId('simulador-radio').value=zone.radius;
    }
    function drawHandles() {
      if (!active) return;
      handles.clearLayers();centreHandle=null;radiusHandle=null;
      if (!opened||selected==='exterior') return;
      var zone=current();
      function handle(point,kind,symbol,title) {
        return L.marker(point,{draggable:true,autoPan:true,bubblingMouseEvents:false,icon:L.divIcon({className:'mapa-zone-handle is-'+kind,html:'<span aria-hidden="true">'+symbol+'</span>',iconSize:[28,28],iconAnchor:[14,14]}),alt:title,title:title}).addTo(handles);
      }
      centreHandle=handle([zone.lat,zone.lon],'centre','＋',T('Centro de ','Centre of ')+zone.name);
      radiusHandle=handle(edge(zone),'radius','↔',T('Borde de ','Edge of ')+zone.name);
      [centreHandle,radiusHandle].forEach(function (handle) {
        handle.on('dragstart',function () {dragBefore=JSON.stringify(config);});
        handle.on('dragend',function () {changed(dragBefore||JSON.stringify(config));dragBefore=null;});
      });
      centreHandle.on('drag',function () {var p=centreHandle.getLatLng();if (!Number.isFinite(p.lat)||!Number.isFinite(p.lng)) return;zone.lat=Math.max(-85,Math.min(85,p.lat));zone.lon=wrap(p.lng);geometry(false);});
      radiusHandle.on('drag',function () {var p=radiusHandle.getLatLng();if (!Number.isFinite(p.lat)||!Number.isFinite(p.lng)) return;zone.radius=Math.max(50,Math.min(5000,Math.round(metres({lat:zone.lat,lng:zone.lon},p))));geometry(true);});
    }
    async function loadCatalog() {
      if (catalogRequest) return;
      catalogState='loading';renderText();
      var controller=new AbortController(), timeout=setTimeout(function () {controller.abort();},15000);
      catalogRequest=controller;catalogTimer=timeout;
      try {
        var response=await G.fetch('https://api.admira.store/stock/list?limit=300',{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal});
        if (catalogRequest!==controller) return;
        if (!response.ok) throw new Error('catalogo_no_disponible');
        var next=catalogItems(await response.json());
        if (catalogRequest!==controller) return;
        pieces=next;themes=catalogThemes(next);catalogLoaded=true;catalogState='ready';
      } catch (_) {if (catalogRequest===controller) catalogState='error';}
      finally {clearTimeout(timeout);if (catalogRequest===controller) {catalogRequest=null;catalogTimer=null;renderText();}}
    }
    byId('simulador-editar').addEventListener('click',function () {
      opened=!opened;if (options.onInteraction) options.onInteraction();byId('simulador-editor').hidden=!opened;byId('simulador-editar').setAttribute('aria-expanded',String(opened));
      drawShapes();drawHandles();renderText();if (opened&&catalogState==='idle') loadCatalog();
    });
    byId('simulador-zona-elegida').addEventListener('change',function (event) {
      var id=event.target.value;if (id!=='exterior'&&!config.zones.some(function (zone) {return zone.id===id;})) return;
      selected=id;drawShapes();drawHandles();renderText();
      if (selected!=='exterior') map.panTo([current().lat,current().lon],{animate:false});
    });
    function rename(event) {
      var name=event.target.value.trim();if (selected==='exterior'||!name||name.length>48||/[\u0000-\u001f\u007f]/.test(name)) return;
      if (current().name!==name) edit(function () {current().name=name;});
    }
    function resize(event) {
      var radius=Number(event.target.value);if (selected==='exterior'||!Number.isFinite(radius)||radius<50||radius>5000) return;
      radius=Math.round(radius);if (current().radius!==radius) edit(function () {current().radius=radius;});
    }
    byId('simulador-nombre').addEventListener('input',rename);
    byId('simulador-nombre').addEventListener('change',rename);
    byId('simulador-radio').addEventListener('input',resize);
    byId('simulador-radio').addEventListener('change',resize);
    byId('simulador-tema').addEventListener('change',function (event) {
      var tag=event.target.value;if (!themes.some(function (item) {return item.tag===tag;})) return;
      edit(function () {current().tag=tag;});
    });
    byId('simulador-tema').addEventListener('blur',renderText);
    byId('simulador-centro-aqui').addEventListener('click',function () {
      var point=position();if (selected==='exterior'||!point||!Number.isFinite(point.lat)||Math.abs(point.lat)>85||!Number.isFinite(point.lng)||Math.abs(point.lng)>180) return;
      edit(function () {current().lat=point.lat;current().lon=point.lng;});
    });
    byId('simulador-anadir').addEventListener('click',function () {
      if (config.zones.length>=8) return;
      var point=map.getCenter();if (!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng)) return;
      edit(function () {
        var index=1;while (config.zones.some(function (zone) {return zone.id==='zona-'+index;})) index++;
        selected='zona-'+index;config.zones.push({id:selected,name:T('Zona ','Zone ')+index,tag:'retail',lat:Math.max(-85,Math.min(85,point.lat)),lon:wrap(point.lng),radius:450});
      });
    });
    byId('simulador-eliminar').addEventListener('click',function () {if (selected!=='exterior') edit(function () {config.zones=config.zones.filter(function (zone) {return zone.id!==selected;});});});
    function reorder(step) {
      var from=config.zones.findIndex(function (zone) {return zone.id===selected;}), to=from+step;
      if (selected==='exterior' || from<0 || to<0 || to>=config.zones.length || !validDraft()) return;
      edit(function () {var moved=config.zones.splice(from,1)[0];config.zones.splice(to,0,moved);});
    }
    byId('simulador-subir').addEventListener('click',function () {reorder(-1);});
    byId('simulador-bajar').addEventListener('click',function () {reorder(1);});
    byId('simulador-deshacer').addEventListener('click',function () {if (!undo.length) return;config=JSON.parse(undo.pop());transferState='idle';if (!current()) selected=config.zones[0]?config.zones[0].id:'exterior';drawShapes();drawHandles();renderText();options.onChange();});
    byId('simulador-restaurar').addEventListener('click',function () {edit(function () {config=copy(defaults);});});
    byId('simulador-oficinas').addEventListener('click',function () {
      if (!active) return;
      // Cancel a pending file read so it cannot replace an explicitly chosen preset.
      importTicket++;importBusy=false;transferState='idle';
      edit(function () {config=copy(offices);selected=config.zones[0].id;},{preset:'offices'});
    });
    function validDraft() {
      if (selected!=='exterior') {
        var name=byId('simulador-nombre').value.trim(), radius=Number(byId('simulador-radio').value);
        if (!name||name.length>48||/[\u0000-\u001f\u007f]/.test(name)||!Number.isFinite(radius)||radius<50||radius>5000) {saveState='invalid';renderText();return false;}
      }
      return true;
    }
    byId('simulador-guardar').addEventListener('click',function () {
      if (!validDraft()) return;
      try {var next=validate(config);if (!next) throw new Error('configuracion_invalida');var raw=JSON.stringify(next);G.localStorage.setItem(KEY,raw);saved=JSON.stringify(config);saveState='saved';}
      catch (_) {saveState='error';}renderText();
    });
    byId('simulador-exportar').addEventListener('click',function () {
      if (!validDraft()) return;
      var url=null, link=null;
      try {
        var text=serializeTransfer(config);
        url=G.URL.createObjectURL(new G.Blob([text],{type:'application/json;charset=utf-8'}));
        link=d.createElement('a');link.href=url;link.download='admira-zonas.json';link.hidden=true;
        d.body.appendChild(link);link.click();transferState='download';
      } catch (_) {transferState='downloadError';}
      finally {if (link) link.remove();if (url) setTimeout(function () {G.URL.revokeObjectURL(url);},1000);renderText();}
    });
    byId('simulador-importar').addEventListener('click',function () {if (!importBusy) {if (options.onInteraction) options.onInteraction();byId('simulador-archivo').click();}});
    byId('simulador-archivo').addEventListener('change',async function (event) {
      var file=event.target.files && event.target.files[0];event.target.value='';if (!file) return;
      var ticket=++importTicket;importBusy=true;transferState='reading';if (options.onInteraction) options.onInteraction();renderText();
      try {
        if (!Number.isFinite(file.size)||file.size>MAX_FILE_BYTES||file.size<1) throw new Error(file.size>MAX_FILE_BYTES?'archivo_demasiado_grande':'archivo_invalido');
        var text;
        try {text=await file.text();} catch (_) {throw new Error('lectura_fallida');}
        if (ticket!==importTicket||!active) return;
        var next=parseTransfer(text);
        edit(function () {config=next;selected=config.zones[0]?config.zones[0].id:'exterior';});
        importedCount=next.zones.length;transferState='imported';
        if (next.zones[0]) map.panTo([next.zones[0].lat,next.zones[0].lon],{animate:false});
      } catch (error) {
        if (ticket===importTicket&&active) transferState=error.message==='archivo_demasiado_grande'?'large':error.message==='lectura_fallida'?'readError':'invalid';
      } finally {if (ticket===importTicket) {importBusy=false;if (options.onInteraction) options.onInteraction();renderText();}}
    });
    byId('simulador-catalogo').addEventListener('click',loadCatalog);
    return {
      getConfig:function () {return copy(config);},isEditing:function () {return active&&(opened||importBusy);},label:label,renderText:renderText,
      activate:function (parent,getPosition) {active=true;position=getPosition;shapes=L.layerGroup().addTo(parent);handles=L.layerGroup().addTo(parent);drawShapes();drawHandles();renderText();},
      deactivate:function () {active=false;opened=false;if (catalogRequest) {catalogRequest.abort();catalogRequest=null;clearTimeout(catalogTimer);catalogTimer=null;catalogState=catalogLoaded?'ready':'idle';}importTicket++;importBusy=false;if (transferState==='reading') transferState='idle';if (shapes) shapes.clearLayers();if (handles) handles.clearLayers();circles.clear();centreHandle=null;radiusHandle=null;byId('simulador-editor').hidden=true;byId('simulador-editar').setAttribute('aria-expanded','false');}
    };
  }
  G.AdmiraMapaZonas={create:create,validate:validate,parseTransfer:parseTransfer,serializeTransfer:serializeTransfer,maxFileBytes:MAX_FILE_BYTES,catalog:catalog,catalogItems:catalogItems,edge:edge,defaults:copy(defaults),officePreset:copy(offices),storageKey:KEY};
})(window,document);
