/* AdmiraNeXT presence: anonymous, visible tabs only; no cookies, IP, query strings or fingerprint. */
(()=>{
  if(navigator.globalPrivacyControl || navigator.doNotTrack==='1')return;
  const endpoint='https://www.admiranext.com/api/presence';
  let sid;try{sid=sessionStorage.getItem('an_presence');if(!/^[a-f0-9-]{36}$/i.test(sid||'')){sid=crypto.randomUUID();sessionStorage.setItem('an_presence',sid)}}catch{sid=crypto.randomUUID()}
  let referrer='';try{const r=new URL(document.referrer);if(['https:','http:'].includes(r.protocol)&&!r.username&&!r.password)referrer=(r.origin+r.pathname).slice(0,1000)}catch{}
  const deviceHint=/MacIntel/.test(navigator.platform) && navigator.maxTouchPoints>1?'tablet':'';
  const page=crypto.randomUUID();let sent=0,lastPath='',stopped=false;
  function send(action){const path=location.pathname;if(action==='ping' && lastPath && lastPath!==path)referrer=location.origin+lastPath;if(path.length>500)return;const body=JSON.stringify({sid,page,action,...(action==='ping'?{path,referrer,deviceHint}:{})});sent=Date.now();lastPath=path;fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'text/plain'},body,keepalive:true}).catch(()=>{});}
  function tick(){if(!stopped && !document.hidden && (Date.now()-sent>=15000 || location.pathname!==lastPath))send('ping')}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)send('leave');else{stopped=false;sent=0;tick()}});
  addEventListener('pagehide',()=>{stopped=true;send('leave')});addEventListener('pageshow',()=>{stopped=false;sent=0;tick()});addEventListener('popstate',()=>{sent=0;tick()});
  setInterval(tick,1000);tick();
})();
