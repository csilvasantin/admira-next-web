const $ = id => document.getElementById(id);
const data = await fetch('./data.json', {cache:'no-store'}).then(r => {if(!r.ok) throw Error('data'); return r.json();});
let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'es';
let index = 0, playing = new URLSearchParams(location.search).get('run') === '1', timer = null, finished = false;
const audio = $('narration'), video = $('full-video');
const words = {
  es:{headline:'Novedades, de Creador al gemelo 360',intro:'Recorrido preparado con las mejoras publicadas hoy.',editor:'← Editor de demos',video:'Ver vídeo completo',title:'Vídeo completo',note:'Recorrido preparado con narración. No ejecuta una nueva generación.',sound:'Escuchar explicación',previous:'← Anterior',next:'Siguiente →',restart:'Reiniciar',start:'▶ Reproducir recorrido',resume:'▶ Continuar',pause:'Ⅱ Pausar',feature:'Abrir la función ↗',temporary:'Se conserva en el editor hasta que quieras borrarla desde la sección de demos.',guide:'Guía y tutorial ES/EN',active:'Reproduciendo',paused:'En pausa',ready:'Listo para reproducir',end:'Recorrido terminado · puedes abrir el gemelo 360 o volver al editor.',load:'No se pudo cargar la captura. Puedes abrir la función para revisarla.',audio:'No se pudo reproducir la voz. El recorrido continúa con el texto visible.'},
  en:{headline:'Updates, from Creator to the 360 twin',intro:'A prepared tour of improvements published today.',editor:'← Demo editor',video:'Watch full video',title:'Full video',note:'Prepared, narrated tour. No new generation is executed.',sound:'Listen to narration',previous:'← Previous',next:'Next →',restart:'Restart',start:'▶ Play tour',resume:'▶ Resume',pause:'Ⅱ Pause',feature:'Open feature ↗',temporary:'Stays in the editor until you delete it from the demos section.',guide:'ES/EN guide and tutorial',active:'Playing',paused:'Paused',ready:'Ready to play',end:'Tour completed · open the 360 twin or return to the editor.',load:'The screenshot could not load. Open the feature to review it.',audio:'Narration could not play. The tour continues with visible text.'}
};
function clear(){clearTimeout(timer);timer=null;audio.pause();}
function status(){return {activo:playing,paused:!playing,chapter:index+1,total:data.chapters.length,finished,language};}
function schedule(){if(!playing)return; const delay=(data.chapters[index].seconds?.[language] || 23)*1000; timer=setTimeout(()=>advance(),delay); if($('sound').checked){audio.currentTime=0;audio.play().catch(()=>{$('state').textContent=words[language].audio;});}}
function paint(){
  clear(); const t=words[language], chapter=data.chapters[index], copy=chapter[language]; document.documentElement.lang=language;
  for(const [id,key] of Object.entries({headline:'headline',intro:'intro',editor:'editor','video-toggle':'video','video-title':'title','video-note':'note','sound-label':'sound',previous:'previous',next:'next',restart:'restart','open-feature':'feature',temporary:'temporary',guide:'guide'})) $(id).textContent=t[key];
  $('language').textContent=language==='es'?'English':'Español';$('progress').textContent=`${index+1} / ${data.chapters.length} · 09.10.2026`;
  $('chapter-title').textContent=copy.title;$('copy').textContent=copy.text;$('preview').src='./media/'+chapter.image;$('preview').alt=copy.title;
  $('load-error').hidden=true;const target=new URL(chapter.url);target.searchParams.set('lang',language);$('open-feature').href=target.href;
  audio.src=`./media/${chapter.id}-${language}.mp3`;const src=`./media/pixeria-novedades-${language}.mp4`;if(video.getAttribute('src')!==src){video.pause();video.src=src;}
  $('previous').disabled=index===0;$('next').disabled=index===data.chapters.length-1;$('play').textContent=playing?t.pause:(index===0&&!finished?t.start:t.resume);
  $('state').textContent=finished?t.end:(playing?t.active:(index===0?t.ready:t.paused));
  $('chapters').replaceChildren(...data.chapters.map((c,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${i+1}. ${c[language].title}`;if(i===index)b.setAttribute('aria-current','step');b.onclick=()=>{index=i;finished=false;paint();};return b;}));schedule();
}
function advance(){if(index===data.chapters.length-1){playing=false;finished=true;paint();return;}index++;finished=false;paint();}
function control(action){if(action==='pause'||action==='stop'){playing=false;paint();}else if(action==='resume'){if(finished){index=0;finished=false;}playing=true;paint();}else if(action==='next')advance();else if(action==='restart'){index=0;finished=false;paint();}return status();}
$('play').onclick=()=>control(playing?'pause':'resume');$('next').onclick=advance;$('previous').onclick=()=>{if(index>0){index--;finished=false;paint();}};$('restart').onclick=()=>control('restart');
$('sound').onchange=()=>{if(!playing){if($('sound').checked)audio.play().catch(()=>{$('state').textContent=words[language].audio;});else audio.pause();}else paint();};
$('language').onclick=()=>{language=language==='es'?'en':'es';const u=new URL(location.href);u.searchParams.set('lang',language);history.replaceState(null,'',u);paint();};
$('video-toggle').onclick=()=>{control('pause');$('video-section').hidden=!$('video-section').hidden;if($('video-section').hidden)video.pause();};
$('preview').onerror=()=>{$('load-error').textContent=words[language].load;$('load-error').hidden=false;};
document.addEventListener('admiranext:lang',e=>{const next=e.detail?.lang==='en'?'en':'es';if(next!==language){language=next;paint();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;paint();video.pause();}});
addEventListener('pagehide',()=>{playing=false;clear();video.pause();});
window.PixeriaUpdatesDemo={control,state:status};
paint();
