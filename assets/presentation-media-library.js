(function(){
  'use strict';
  const result=document.getElementById('result');
  if(!result)return;
  const section=document.createElement('section');
  section.className='media-library';
  section.hidden=true;
  section.setAttribute('aria-labelledby','mediaLibraryTitle');
  section.innerHTML='<div class="media-library__head"><div><h3 id="mediaLibraryTitle">Biblioteca multimedia</h3><p>Sube imágenes, audio o vídeo a la zona privada de esta presentación. Previsualiza el inventario y arrastra cualquier recurso sobre una diapositiva para asignarlo.</p></div></div><div class="media-library__upload"><div class="media-library__drop" role="button" tabindex="0" aria-describedby="mediaLibraryLimits">Arrastra archivos aquí o pulsa para seleccionarlos<br><small id="mediaLibraryLimits">Imágenes 10 MB · audio 25 MB · vídeo 40 MB</small></div><label class="media-library__accept"><input type="checkbox" checked> Aceptado por Carlos · autoridad final</label></div><input class="media-library__input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,audio/mp4,video/mp4,video/webm" multiple hidden><div class="media-library__status" role="status" aria-live="polite"></div><div class="media-library__grid" aria-label="Inventario multimedia"></div><div class="media-library__slides" aria-label="Diapositivas disponibles"></div>';
  result.appendChild(section);
  const input=section.querySelector('.media-library__input');
  const drop=section.querySelector('.media-library__drop');
  const accepted=section.querySelector('.media-library__accept input');
  const status=section.querySelector('.media-library__status');
  const grid=section.querySelector('.media-library__grid');
  const slides=section.querySelector('.media-library__slides');
  let client='',selectedAssetId='',state={assets:[],slides:[],slideMedia:[]};
  const escape=value=>String(value==null?'':value).replace(/[<>&"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[char]));
  const size=value=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:`${Math.ceil(value/1024)} KB`;
  function message(value,error=false){status.textContent=value;status.className=`media-library__status${error?' error':''}`}
  function assigned(slide){const entry=state.slideMedia.find(item=>item.slide===slide);return entry?state.assets.find(item=>item.url===entry.effectiveSrc||item.url===entry.src):null}
  function preview(asset){
    if(asset.kind==='image')return `<img src="${escape(asset.url)}" alt="Previsualización de ${escape(asset.name)}" loading="lazy">`;
    if(asset.kind==='video')return `<video src="${escape(asset.url)}" controls preload="metadata" aria-label="Previsualización de ${escape(asset.name)}"></video>`;
    return `<audio src="${escape(asset.url)}" controls preload="metadata" aria-label="Previsualización de ${escape(asset.name)}"></audio>`;
  }
  function render(){
    grid.innerHTML=state.assets.length?state.assets.map(asset=>`<article class="media-asset${selectedAssetId===asset.id?' selected':''}" draggable="true" data-media-asset="${escape(asset.id)}"><div class="media-asset__preview">${preview(asset)}</div><div class="media-asset__meta"><strong title="${escape(asset.name)}">${escape(asset.name)}</strong><span>${escape(asset.kind.toUpperCase())} · ${size(asset.size)} · ✓ Carlos</span><button type="button" data-select-media aria-pressed="${selectedAssetId===asset.id}">${selectedAssetId===asset.id?'Seleccionado':'Seleccionar para asignar'}</button></div></article>`).join(''):'<div class="media-library__status">Aún no hay recursos. La biblioteca se conserva con la presentación.</div>';
    slides.innerHTML=state.slides.map((slide,index)=>{const asset=assigned(slide.id);return `<div class="media-slide-target" role="button" tabindex="0" data-media-slide="${escape(slide.id)}" aria-label="${escape(slide.title)}. ${asset?`Asignado: ${escape(asset.name)}`:'Sin recurso asignado'}"><b>${String(index+1).padStart(2,'0')}</b><span>${escape(slide.title)}</span><em>${asset?escape(asset.name):selectedAssetId?'Pulsa Intro para asignar':'Suelta un recurso aquí'}</em></div>`}).join('');
  }
  async function request(path,options){
    const response=await fetch(path,{headers:{accept:'application/json',...(options?.headers||{})},cache:'no-store',...options});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }
  async function load(){
    state=await request(`/presentaciones/api/media-library?client=${encodeURIComponent(client)}`);
    render();
  }
  async function upload(files){
    if(!accepted.checked){message('Marca “Aceptado por Carlos” antes de incorporar el recurso.',true);return}
    for(const file of files){
      message(`Subiendo ${file.name}…`);
      const form=new FormData();
      form.set('client',client);
      form.set('acceptedByCarlos','true');
      form.set('approvalNote','Aceptado por Carlos desde el generador de presentaciones.');
      form.set('file',file,file.name);
      state=await request('/presentaciones/api/media-library',{method:'POST',body:form});
      render();
    }
    message(`${files.length} recurso${files.length===1?'':'s'} incorporado${files.length===1?'':'s'} a la biblioteca privada.`);
  }
  async function assign(assetId,slide){
    const asset=state.assets.find(item=>item.id===assetId);
    if(!asset)return;
    message(`Asignando ${asset.name}…`);
    state=await request('/presentaciones/api/media-library',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({client,assetId,slide})});
    render();
    message(`${asset.name} asignado a la diapositiva.`);
  }
  function choose(){input.value='';input.click()}
  drop.addEventListener('click',choose);
  drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose()}});
  input.addEventListener('change',()=>{const files=[...(input.files||[])];if(files.length)upload(files).catch(error=>message(error.message,true))});
  for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('drag-over')});
  for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('drag-over')});
  drop.addEventListener('drop',event=>{const files=[...(event.dataTransfer?.files||[])];if(files.length)upload(files).catch(error=>message(error.message,true))});
  function selectAsset(card){
    selectedAssetId=card?.dataset.mediaAsset||'';
    render();
    const asset=state.assets.find(item=>item.id===selectedAssetId);
    if(asset)message(`${asset.name} seleccionado. Pulsa Intro sobre una diapositiva para asignarlo.`);
  }
  grid.addEventListener('click',event=>{const button=event.target.closest('[data-select-media]');if(button)selectAsset(button.closest('[data-media-asset]'))});
  grid.addEventListener('dragstart',event=>{const card=event.target.closest('[data-media-asset]');if(card){selectedAssetId=card.dataset.mediaAsset;event.dataTransfer?.setData('text/plain',selectedAssetId)}});
  slides.addEventListener('dragover',event=>{const target=event.target.closest('[data-media-slide]');if(!target)return;event.preventDefault();target.classList.add('drag-over')});
  slides.addEventListener('dragleave',event=>{const target=event.target.closest('[data-media-slide]');if(target&&!target.contains(event.relatedTarget))target.classList.remove('drag-over')});
  slides.addEventListener('drop',event=>{const target=event.target.closest('[data-media-slide]');if(!target)return;event.preventDefault();target.classList.remove('drag-over');const assetId=event.dataTransfer?.getData('text/plain');if(assetId)assign(assetId,target.dataset.mediaSlide).catch(error=>message(error.message,true))});
  slides.addEventListener('keydown',event=>{const target=event.target.closest('[data-media-slide]');if(target&&selectedAssetId&&(event.key==='Enter'||event.key===' ')){event.preventDefault();assign(selectedAssetId,target.dataset.mediaSlide).catch(error=>message(error.message,true))}});
  window.addEventListener('admira:presentation-created',event=>{
    client=String(event.detail?.slug||'');
    if(!client)return;
    section.hidden=false;
    message('Cargando la biblioteca de esta presentación…');
    load().catch(error=>message(error.message,true));
  });
})();
