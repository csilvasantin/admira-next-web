(function(){
  'use strict';
  const form=document.getElementById('generator'),status=document.getElementById('status'),submit=document.getElementById('submit'),result=document.getElementById('result');
  const display=document.getElementById('displayName'),slug=document.getElementById('slug'); let slugTouched=true;
  function slugify(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)}
  slug.addEventListener('input',()=>{slugTouched=Boolean(slug.value)}); display.addEventListener('input',()=>{if(!slugTouched)slug.value=slugify(display.value)});
  function message(value,error){status.textContent=value;status.className=`status${error?' error':''}`}
  form.addEventListener('submit',async event=>{
    event.preventDefault(); submit.disabled=true; result.classList.remove('show'); message('Analizando el problema y construyendo la presentación…');
    const data=Object.fromEntries(new FormData(form).entries()); data.overwrite=document.getElementById('overwrite').checked;
    try{
      const response=await fetch('/presentaciones/api/generate',{method:'PUT',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(data)});
      const body=await response.json().catch(()=>({})); if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
      const absolute=new URL(body.url,location.origin).href; document.getElementById('resultUrl').textContent=absolute; document.getElementById('resultPassword').textContent=body.password;
      document.getElementById('openIdeas').href=body.ideasUrl; document.getElementById('openDeck').href=body.deckUrl; result.classList.add('show'); result.scrollIntoView({behavior:'smooth',block:'center'}); message(`Creada: ${body.displayName}`);
    }catch(error){message(error.message,true)}finally{submit.disabled=false}
  });
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;const node=document.getElementById(button.dataset.copy);try{await navigator.clipboard.writeText(node.textContent);const before=button.textContent;button.textContent='Copiado';setTimeout(()=>button.textContent=before,1200)}catch(_){}});
})();
