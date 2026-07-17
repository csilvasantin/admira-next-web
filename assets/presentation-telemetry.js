(function(){
  'use strict';
  var match=location.pathname.match(/^\/(?:presentaciones|presentations)\/([^/]+)/i);
  if(!match)return;
  var client=decodeURIComponent(match[1]).toLowerCase();
  if(['api','control','generador'].indexOf(client)!==-1)return;
  var endpoint='/presentaciones/'+encodeURIComponent(client)+'/api/access';
  var sent=new Set();
  function language(){return document.documentElement.lang||new URL(location.href).searchParams.get('lang')||''}
  function send(type,target,extra){
    var key=[type,target||'',extra||''].join('|'); if(sent.has(key)&&type!=='language_change')return; sent.add(key);
    var body=JSON.stringify({type:type,target:target||'',language:language(),detail:extra||'',path:location.pathname});
    if(navigator.sendBeacon){try{navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'}));return}catch(_){}}
    fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',keepalive:true,body:body}).catch(function(){});
  }
  document.addEventListener('click',function(event){
    var link=event.target.closest('a[href]');
    if(link){
      var url=new URL(link.href,location.href); var downloadable=link.hasAttribute('download')||/\.(pdf|pptx|docx|xlsx|zip|txt|csv|png|jpe?g|mp4|m4a|mp3)$/i.test(url.pathname);
      if(downloadable)send('download',url.pathname,link.textContent.trim().slice(0,100));
      else if(url.origin!==location.origin)send('external_link',url.href,link.textContent.trim().slice(0,100));
    }
    var fullscreen=event.target.closest('[data-video-fullscreen]'); if(fullscreen)send('fullscreen','video');
  },true);
  document.addEventListener('play',function(event){
    var media=event.target;if(media&&/^(AUDIO|VIDEO)$/.test(media.tagName))send('media_play',new URL(media.currentSrc||media.src,location.href).pathname,media.tagName.toLowerCase());
  },true);
  window.addEventListener('admira-language-change',function(event){send('language_change',location.pathname,event.detail&&event.detail.language||language())});
})();
