(function(){
  var sel=document.getElementById('rmc-sel'),out=document.getElementById('rmc-out'),meta=document.getElementById('rmc-meta');
  if(!sel)return;
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  fetch('/data/roadmap/proyectos.json',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
    var byId={};d.proyectos.forEach(function(p){byId[p.id]=p});
    sel.innerHTML=d.proyectos.map(function(p){return '<option value="'+p.id+'">'+esc(p.nombre)+(p.descripcion?' · '+esc(p.descripcion):'')+'</option>'}).join('');
    var q=new URLSearchParams(location.search).get('p');if(byId[q])sel.value=q;
    function render(){
      var p=byId[sel.value];
      meta.innerHTML='Responsable: <b>'+esc(p.responsable)+'</b> · <a href="'+p.web+'">'+esc(p.web.replace(/^https?:\/\/(www\.)?/,''))+'</a> · <span class="rmc-borrador">'+esc(d.estado)+'</span>';
      out.innerHTML=d.horizontes.map(function(h){
        var items=[];
        (p.suma||[]).forEach(function(id){(byId[id].roadmap[h]||[]).forEach(function(t){items.push({t:t.t,d:t.d,o:byId[id].nombre})})});
        (p.roadmap[h]||[]).forEach(function(t){items.push({t:t.t,d:t.d,o:p.suma?p.nombre:''})});
        return '<article class="rmc-h"><h3>'+esc(d.etiquetas[h])+'</h3><ul>'+items.map(function(i){return '<li><details><summary>'+(i.o?'<span class="rmc-o">'+esc(i.o.replace('Admira.',''))+'</span> ':'')+esc(i.t)+'</summary><p>'+esc(i.d)+'</p></details></li>'}).join('')+'</ul></article>';
      }).join('');
    }
    sel.addEventListener('change',function(){var u=new URL(location.href);u.searchParams.set('p',sel.value);history.replaceState(null,'',u);render()});
    render();
  }).catch(function(){out.innerHTML='<p class="rmc-err">No se pudo leer el roadmap por proyecto.</p>'});
})();
