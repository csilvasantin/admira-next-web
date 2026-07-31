(function(){
  "use strict";
  const API="https://admira-telegram.csilvasantin.workers.dev";
  const feed=document.getElementById("tgFeed"),status=document.getElementById("tgStatus"),form=document.getElementById("missionForm");
  const esc=s=>String(s==null?"":s).replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
  const clock=ts=>new Date((+ts||0)*1000).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
  let first=true,busy=false;
  function messageHtml(m){const mine=m.direction==="out",media=m.media_type?`<img loading="lazy" src="${API}/api/media?id=${m.id}" alt="Imagen de Telegram">`:"";return `<article class="tg-msg ${mine?"out":"in"}"><header><b>${esc(m.from_name||"AgoraMatrix")}</b><time>${clock(m.date)}</time></header>${media}<p>${esc(m.text||"").replace(/\n/g,"<br>")}</p></article>`;}
  async function loadFeed(){if(busy)return;busy=true;try{const r=await fetch(`${API}/api/messages?tail=24`,{cache:"no-store"});if(!r.ok)throw new Error();const d=await r.json();feed.innerHTML=(d.messages||[]).map(messageHtml).join("")||'<p class="tg-loading">Todavía no hay mensajes.</p>';status.textContent="en línea · "+(d.messages||[]).length+" mensajes recientes";if(first){feed.scrollTop=feed.scrollHeight;first=false;}}catch(e){status.textContent="sin conexión · reintentando";}finally{busy=false;}}
  const file=document.getElementById("missionImage"),fileName=document.getElementById("fileName");
  file.addEventListener("change",()=>{fileName.textContent=file.files[0]?file.files[0].name:"opcional · máx. 5 MB";});
  const readImage=f=>new Promise((resolve,reject)=>{if(!f)return resolve("");if(f.size>5*1024*1024)return reject(new Error("La imagen supera 5 MB"));const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=()=>reject(new Error("No se pudo leer la imagen"));rd.readAsDataURL(f);});
  form.addEventListener("submit",async e=>{e.preventDefault();const text=document.getElementById("missionText").value.trim(),feedback=document.getElementById("missionFeedback"),send=document.getElementById("missionSend");if(!text)return;send.disabled=true;feedback.textContent="Enviando a AgoraMatrix…";try{const [persona,machine]=document.getElementById("missionTarget").value.split("|");const image=await readImage(file.files[0]);const r=await fetch(`${API}/api/bot-inbox`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({target_persona:persona==="auto"?"":persona,target_machine:machine,text,from:"admiranext.com/telegram",image_data:image})});const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo enviar");feedback.innerHTML=`✓ Encargo Telegram #${esc(d.id)} creado · <a href="https://www.yokup.com/misiones" target="_blank" rel="noopener">seguir en YOKUP ↗</a>`;form.reset();fileName.textContent="opcional · máx. 5 MB";first=true;await loadFeed();}catch(err){feedback.textContent="⚠ "+err.message;}finally{send.disabled=false;}});
  loadFeed();setInterval(loadFeed,5000);
})();
