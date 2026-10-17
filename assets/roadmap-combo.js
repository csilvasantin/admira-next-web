/* Roadmap por proyecto · regla del 123 y el abc · editable (16-10-2026).
   Lee /api/roadmap-combo (KV) y cae a /data/roadmap/proyectos.json en solo lectura.
   Avance: subobjetivos a/b/c (0/33/67/100) o % manual; un objetivo con vínculos "de"
   toma la media de los objetivos de horizontes inferiores; horizonte = media de sus
   objetivos; proyecto = media de Hoy…Trimestre; Admira.TV usa referencias a los pilares. */
(function(){
  var sel=document.getElementById('rmc-sel'),out=document.getElementById('rmc-out'),meta=document.getElementById('rmc-meta');
  if(!sel)return;
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var D=null,byId={},items={},editando=null,puede=false,csrf='',aviso='';
  var ORDEN=['hoy','manana','semana','mes','trimestre'],INFER={semana:['hoy'],mes:['hoy','semana'],trimestre:['hoy','semana','mes']};
  function indexar(){byId={};items={};D.proyectos.forEach(function(p){byId[p.id]=p;Object.keys(p.roadmap).forEach(function(h){p.roadmap[h].forEach(function(i){if(i.id)items[i.id]={i:i,p:p.id,h:h}})})})}
  function real(i){return i&&i.ref?(items[i.ref]&&items[i.ref].i):i}
  function avance(i,vis){i=real(i);if(!i)return 0;vis=vis||{};if(i.id){if(vis[i.id])return 0;vis[i.id]=1}
    if(i.pct!=null&&i.pct!=='')return +i.pct;
    var de=(i.de||[]).filter(function(x){return items[x]});
    if(de.length)return Math.round(de.reduce(function(a,x){return a+avance(items[x].i,vis)},0)/de.length);
    var s=i.s||[];if(!s.length)return 0;var h=(i.hs||[]).filter(Boolean).length;return Math.round(h*100/s.length)}
  function media(l){return l.length?Math.round(l.reduce(function(a,b){return a+b},0)/l.length):0}
  function avanceH(p,h){return media((p.roadmap[h]||[]).filter(real).map(function(i){return avance(i)}))}
  function avanceP(p){return media(ORDEN.filter(function(h){return (p.roadmap[h]||[]).length}).map(function(h){return avanceH(p,h)}))}
  function barra(v){return '<span class="rmc-bar" title="'+v+'%"><i style="width:'+v+'%"></i></span>'}
  function cargar(){
    return fetch('/api/roadmap-combo',{cache:'no-store',credentials:'same-origin'}).then(function(r){if(!r.ok)throw r;return r.json()}).then(function(d){puede=!!d.puedeEditar;csrf=d.csrf||'';delete d.puedeEditar;delete d.csrf;return d})
    .catch(function(){puede=false;return fetch('/data/roadmap/proyectos.json',{cache:'no-store'}).then(function(r){return r.json()})});
  }
  cargar().then(function(d){
    D=d;indexar();
    var modo=document.getElementById('rmc-modo'),PAR={proyecto:'p',agente:'a',consejero:'c'};
    var opt=function(p){return '<option value="'+p.id+'">'+esc(p.nombre)+(p.descripcion?' · '+esc(p.descripcion):p.info?' · '+esc(p.info):'')+'</option>'};
    function opciones(){
      var m=modo?modo.value:'proyecto';
      if(m==='proyecto'){var proy=D.proyectos.filter(function(p){return !p.tipo});var grupos={};proy.forEach(function(p){if(p.grupo)(grupos[p.grupo]=grupos[p.grupo]||[]).push(p)});
        sel.innerHTML='<optgroup label="Pilares">'+proy.filter(function(p){return !p.grupo}).map(opt).join('')+'</optgroup>'+Object.keys(grupos).map(function(g){return '<optgroup label="'+esc(g)+'">'+grupos[g].map(opt).join('')+'</optgroup>'}).join('');}
      else sel.innerHTML=D.proyectos.filter(function(p){return p.tipo===m}).map(opt).join('');
    }
    var qs=new URLSearchParams(location.search),ini='proyecto';
    if(qs.get('c')&&byId[qs.get('c')])ini='consejero';else if(qs.get('a')&&byId[qs.get('a')])ini='agente';
    if(modo)modo.value=ini;opciones();var q=qs.get(PAR[ini]);if(byId[q])sel.value=q;
    function url(){var u=new URL(location.href);['p','a','c'].forEach(function(k){u.searchParams.delete(k)});u.searchParams.set(PAR[modo?modo.value:'proyecto'],sel.value);history.replaceState(null,'',u)}
    if(modo)modo.addEventListener('change',function(){editando=null;opciones();url();render()});
    sel.addEventListener('change',function(){editando=null;url();render()});
    render();
  }).catch(function(){out.innerHTML='<p class="rmc-err">No se pudo leer el roadmap por proyecto.</p>'});

  function marcaRev(i){var h='';if(i.dec){var ev=String(i.dec.evidencia||'');h+=' <span class="rmc-dec" title="Declarado por '+esc(i.dec.por)+' · '+esc(String(i.dec.en||'').slice(0,16).replace('T',' '))+' UTC">◷ declarado'+(/^https?:\/\//.test(ev)?' · <a href="'+esc(ev)+'" target="_blank" rel="noopener">evidencia</a>':' · '+esc(ev.slice(0,40)))+'</span>'}if(i.sel){h+=' <span class="rmc-sel rmc-sel-'+esc(i.sel.veredicto)+'" title="'+esc(i.sel.nota||'')+'">'+(i.sel.veredicto==='ok'?'✔ sello ':'✗ rechazado · ')+esc(i.sel.nombre||i.sel.por)+'</span>'}else if(i.dec)h+=' <span class="rmc-pend">pendiente de sello</span>';return h}
    function vista(p,h){
    var editable=puede&&(D.editables||ORDEN).indexOf(h)>=0;
    var l=(p.roadmap[h]||[]).slice(0,3),conAv=h!=='ayer';
    return '<article class="rmc-h"><h3>'+esc(D.etiquetas[h])+(conAv?' <span class="rmc-hp">'+avanceH(p,h)+'%</span>':'')+(editable?'<button type="button" class="rmc-lapiz" data-h="'+h+'" title="Editar '+esc(D.etiquetas[h])+'">✎</button>':'')+'</h3>'+(l.length?'':'<p class="rmc-sr">—</p>')+'<ol class="rmc-123">'+l.map(function(raw,n){
      var i=real(raw);if(!i)return '';var o=raw.ref?byId[items[raw.ref].p].nombre:'';var s=i.s||[];
      return '<li>'+(s.length?'<details><summary>':'<span class="rmc-sr">')+(i.e?'<span class="rmc-e rmc-e-'+i.e+'" title="'+i.e+'">'+(D.estados[i.e]||'')+'</span> ':'')+(o?'<span class="rmc-o">'+esc(o.replace('Admira.',''))+'</span> ':'')+esc(i.t)+marcaRev(i)+(s.length?'</summary><ul class="rmc-abc">'+s.map(function(x,k){return '<li class="'+((i.hs||[])[k]?'is-ok':'')+'"><b>'+(n+1)+'abc'[k]+'</b> '+((i.hs||[])[k]?'✓ ':'')+esc(x)+'</li>'}).join('')+'</ul></details>':'</span>')+(conAv?barra(avance(raw)):'')+'</li>'}).join('')+'</ol></article>';
  }
  function form(p,h){
    var l=JSON.parse(JSON.stringify(p.roadmap[h]||[]));editando={p:p.id,h:h,l:l};return formHtml(p,h,l);
  }
  function formHtml(p,h,l){
    var lower=[];(INFER[h]||[]).forEach(function(hh){(p.roadmap[hh]||[]).forEach(function(x){x=real(x);if(x&&x.id)lower.push({id:x.id,t:x.t,h:hh})})});
    return '<article class="rmc-h rmc-edit"><h3>'+esc(D.etiquetas[h])+' · editando</h3>'+l.map(function(i,n){
      if(i.ref){var r=real(i);return '<div class="rmc-ei"><b>'+(n+1)+'</b> '+esc(r?r.t:i.ref)+' <span class="rmc-sr">(se edita en su pilar)</span> <button type="button" data-a="del" data-n="'+n+'">✕</button></div>'}
      var s=i.s||[];while(s.length<3)s.push('');i.s=s;
      return '<div class="rmc-ei" data-n="'+n+'"><div class="rmc-er"><b>'+(n+1)+'</b><input data-f="t" value="'+esc(i.t)+'" maxlength="120" aria-label="Objetivo '+(n+1)+'"><button type="button" data-a="del" data-n="'+n+'" title="Quitar">✕</button></div>'+
        s.map(function(x,k){return '<div class="rmc-er"><label><input type="checkbox" data-f="hs" data-k="'+k+'"'+((i.hs||[])[k]?' checked':'')+'> '+(n+1)+'abc'[k]+'</label><input data-f="s" data-k="'+k+'" value="'+esc(x)+'" maxlength="200"></div>'}).join('')+
        '<div class="rmc-er"><label>% manual <input type="number" min="0" max="100" data-f="pct" value="'+(i.pct==null?'':i.pct)+'" placeholder="auto" style="width:70px"></label>'+
        (h==='manana'?' <label>Mover a <select data-f="mover"><option value="">—</option><option value="hoy">Hoy</option><option value="semana">Semana</option></select></label>':'')+'</div>'+
        (lower.length?'<div class="rmc-er rmc-links">Suma de: '+lower.map(function(x){return '<label title="'+esc(D.etiquetas[x.h])+'"><input type="checkbox" data-f="de" value="'+x.id+'"'+((i.de||[]).indexOf(x.id)>=0?' checked':'')+'> '+esc(x.t.slice(0,28))+'</label>'}).join('')+'</div>':'')+'</div>'}).join('')+
      '<div class="rmc-er">'+(l.length<3?'<button type="button" data-a="add">+ idea</button>':'')+'<button type="button" data-a="ok" class="rmc-ok">Guardar</button><button type="button" data-a="no">Cancelar</button></div>'+(aviso?'<p class="rmc-err">'+esc(aviso)+'</p>':'')+'</article>';
  }
  function leerForm(card){
    var l=editando.l;card.querySelectorAll('.rmc-ei[data-n]').forEach(function(div){var i=l[+div.dataset.n];
      i.t=div.querySelector('[data-f=t]').value.trim();
      i.s=[].map.call(div.querySelectorAll('[data-f=s]'),function(x){return x.value.trim()});
      i.hs=[].map.call(div.querySelectorAll('[data-f=hs]'),function(x){return x.checked});
      var keep=i.s.map(function(x){return !!x});i.hs=i.hs.filter(function(_,k){return keep[k]});i.s=i.s.filter(Boolean);
      var pc=div.querySelector('[data-f=pct]').value;if(pc==='')delete i.pct;else i.pct=Math.max(0,Math.min(100,+pc));
      i.de=[].filter.call(div.querySelectorAll('[data-f=de]'),function(x){return x.checked}).map(function(x){return x.value});if(!i.de.length)delete i.de;
      var mv=div.querySelector('[data-f=mover]');i._mover=mv&&mv.value||'';
    });
  }
  function guardar(){
    var p=byId[editando.p],h=editando.h,l=editando.l;
    if(l.some(function(i){return !i.ref&&!i.t})){aviso='Cada idea necesita título.';return render()}
    var antes=JSON.stringify(D);
    var cupo={};l.forEach(function(i){if(i._mover)cupo[i._mover]=(cupo[i._mover]||(p.roadmap[i._mover]||[]).length)+1});
    if(Object.keys(cupo).some(function(k){return cupo[k]>3})){aviso='Ese horizonte ya tiene 3 ideas (regla del 123).';return render()}
    var quedan=[];l.forEach(function(i){var m=i._mover;delete i._mover;if(m){if((p.roadmap[m]||[]).length>=3){aviso='Ese horizonte ya tiene 3 ideas (regla del 123).';quedan.push(i)}else p.roadmap[m].push(i)}else quedan.push(i)});
    if(aviso){return render()}
    p.roadmap[h]=quedan;indexar();editando=null;aviso='';render();
    enviar(antes);
  }
  function enviar(antes){
    if(!csrf)return;
    fetch('/api/roadmap-combo',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json','X-Admira-CSRF':csrf},body:JSON.stringify(D)})
      .then(function(r){return r.json().then(function(j){if(!r.ok)throw j;D.rev=j.rev;estado('Guardado ✓')})})
      .catch(function(e){D=JSON.parse(antes);indexar();render();estado('No se guardó: '+((e&&e.error)||'error'),true)});
  }
  function estado(t,mal){var e=document.getElementById('rmc-estado');if(e){e.textContent=t;e.className=mal?'rmc-err':'rmc-okt'}}
  function render(){
    var p=byId[sel.value];
    var pil=p.id==='tv'?' · pilares '+media(['studio','store','app','biz'].filter(function(x){return byId[x]}).map(function(x){return avanceP(byId[x])}))+'%':'';
    var vacio=D.horizontes.every(function(h){return !(p.roadmap[h]||[]).length});
    if(p.tipo){meta.innerHTML='<b>'+esc(p.nombre)+'</b> · '+esc(p.info||'')+' · avance <b>'+avanceP(p)+'%</b>'+(p.tipo==='consejero'?' · <span class="rmc-apr rmc-apr-'+(p.aprobacion||'propuesto')+'">'+(p.aprobacion==='ok'?'OK Carlos':'propuesto · aprobado salvo objeción de Carlos')+'</span>'+(puede?' <button type="button" class="rmc-aprb">'+(p.aprobacion==='ok'?'↺ propuesto':'✓ OK Carlos')+'</button>':''):'')+(vacio?' · <span class="rmc-sr">'+esc(D.sinPlan||'Sin plan registrado')+'</span>':'')+' <span id="rmc-estado"></span>';}
    else meta.innerHTML='Responsable: <b>'+esc(p.responsable)+'</b> · <a href="'+p.web+'">'+esc(p.web.replace(/^https?:\/\/(www\.)?/,''))+'</a> · avance <b>'+avanceP(p)+'%</b>'+pil+' · <span class="rmc-borrador">'+esc(D.estado)+'</span> <span id="rmc-estado"></span>';
    out.innerHTML=D.horizontes.map(function(h){return editando&&editando.p===p.id&&editando.h===h?formHtml(p,h,editando.l):vista(p,h)}).join('');
    var g=document.querySelector('#rm-detalle>summary');if(g){g.dataset.base=g.dataset.base||g.textContent;g.textContent=g.dataset.base+' · '+p.nombre+' '+avanceP(p)+'% (Hoy '+avanceH(p,'hoy')+'% · Semana '+avanceH(p,'semana')+'% · Mes '+avanceH(p,'mes')+'% · Trimestre '+avanceH(p,'trimestre')+'%)'}
  }
  meta.addEventListener('click',function(ev){var b=ev.target.closest('.rmc-aprb');if(!b)return;var p=byId[sel.value];var antes=JSON.stringify(D);p.aprobacion=p.aprobacion==='ok'?'propuesto':'ok';render();enviar(antes)});
  out.addEventListener('click',function(ev){
    var b=ev.target.closest('button');if(!b)return;
    if(b.classList.contains('rmc-lapiz')){aviso='';var p=byId[sel.value];out.innerHTML='';form(p,b.dataset.h);return render()}
    var card=b.closest('.rmc-edit');if(!card||!editando)return;leerForm(card);
    var a=b.dataset.a;
    if(a==='no'){editando=null;aviso='';return render()}
    if(a==='del'){editando.l.splice(+b.dataset.n,1);return render()}
    if(a==='add'&&editando.l.length<3){editando.l.push({id:editando.p+'-'+editando.h+'-'+Date.now().toString(36),t:'',s:[],hs:[]});return render()}
    if(a==='ok')guardar();
  });
})();
