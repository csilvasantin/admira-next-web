(function(){
  var sel=document.getElementById('rmc-sel'),out=document.getElementById('rmc-out'),meta=document.getElementById('rmc-meta');
  if(!sel)return;
  var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  fetch('/data/roadmap/proyectos.json',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
    var byId={};d.proyectos.forEach(function(p){byId[p.id]=p});
    var opt=function(p){return '<option value="'+p.id+'">'+esc(p.nombre)+(p.descripcion?' · '+esc(p.descripcion):'')+'</option>'};
    var grupos={};d.proyectos.forEach(function(p){if(p.grupo)(grupos[p.grupo]=grupos[p.grupo]||[]).push(p)});
    sel.innerHTML='<optgroup label="Pilares">'+d.proyectos.filter(function(p){return !p.grupo}).map(opt).join('')+'</optgroup>'+Object.keys(grupos).map(function(g){return '<optgroup label="'+esc(g)+'">'+grupos[g].map(opt).join('')+'</optgroup>'}).join('');
    var q=new URLSearchParams(location.search).get('p');if(byId[q])sel.value=q;
    function render(){
      var p=byId[sel.value];
      meta.innerHTML='Responsable: <b>'+esc(p.responsable)+'</b> · <a href="'+p.web+'">'+esc(p.web.replace(/^https?:\/\/(www\.)?/,''))+'</a> · <span class="rmc-borrador">'+esc(d.estado)+'</span>';
      out.innerHTML=d.horizontes.map(function(h){
        var items=[];
        (p.roadmap[h]||[]).slice(0,3).forEach(function(t){items.push({t:t.t,s:t.s||[],o:t.o&&byId[t.o]?byId[t.o].nombre:''})});
        return '<article class="rmc-h"><h3>'+esc(d.etiquetas[h])+'</h3><ol class="rmc-123">'+items.map(function(i,n){return '<li><details><summary>'+(i.o?'<span class="rmc-o">'+esc(i.o.replace('Admira.',''))+'</span> ':'')+esc(i.t)+'</summary><ul class="rmc-abc">'+i.s.map(function(x,k){return '<li><b>'+(n+1)+'abc'[k]+'</b> '+esc(x)+'</li>'}).join('')+'</ul></details></li>'}).join('')+'</ol></article>';
      }).join('');
    }
    sel.addEventListener('change',function(){var u=new URL(location.href);u.searchParams.set('p',sel.value);history.replaceState(null,'',u);render()});
    render();
  }).catch(function(){out.innerHTML='<p class="rmc-err">No se pudo leer el roadmap por proyecto.</p>'});
})();
