/* Mount the one suite engine on an existing Expert console. No login UI is created. */
(function(G,D){
  'use strict';
  if(G.__admiraCommandsLoader)return;G.__admiraCommandsLoader=true;
  var observer;
  function mount(){
    if(G.AdmiraExperto){if(observer)observer.disconnect();return true;}
    if(D.querySelector('script[src*="/suite/experto.js"]'))return false;
    var profiles=[
      {panel:'.yk-expert',form:'.yk-cli-form',input:'.yk-cli-input',log:'.yk-cli-out',body:'.yk-cli',header:'.yk-expert-head'},
      {panel:'#telegramDock',form:'#admira-command-form',input:'#telegramComposer',log:'#admira-command-log',body:'.expert-workspace',header:'.tg-head',dock:'off'},
      {panel:'.pf-cli',form:'.pf-cli-form',input:'#pf-cli-input',log:'#pf-cli-output'},
      {panel:'#expert-panel',form:'#expert-command-form',input:'#expert-command',log:'#expert-command-result'},
      {panel:'#xpaceShell',form:'#xsCliForm',input:'#xsCli',log:'#xsLog'}
    ];
    for(var i=0;i<profiles.length;i++){
      var p=profiles[i],panel=D.querySelector(p.panel),input=panel&&panel.querySelector(p.input);if(!input)continue;
      if(p.input==='#telegramComposer'){
        var form=D.createElement('form');form.id='admira-command-form';form.autocomplete='off';input.parentNode.insertBefore(form,input);form.appendChild(input);
        var log=D.createElement('ol');log.id='admira-command-log';log.setAttribute('role','log');log.setAttribute('aria-live','polite');form.parentNode.insertBefore(log,form);
        G.addEventListener('keydown',function(e){if(e.target!==input||e.key!=='Enter'||e.shiftKey||e.isComposing)return;if(!String(input.value).trim().startsWith('/'))return;e.preventDefault();e.stopImmediatePropagation();form.requestSubmit();},true);
      }
      if(!panel.querySelector(p.form)||!panel.querySelector(p.log))continue;
      var script=D.createElement('script');script.src='https://www.admiranext.com/suite/experto.js?v=20261012-unified-1';script.id='admira-command-engine';
      Object.keys(p).forEach(function(k){script.dataset[k]=p[k];});script.dataset.min='hide';script.dataset.toggle='none';
      var css=D.createElement('link');css.rel='stylesheet';css.href='https://www.admiranext.com/suite/experto.css?v=20261012-unified-1';D.head.appendChild(css);D.head.appendChild(script);
      if(observer)observer.disconnect();return true;
    }return false;
  }
  if(!mount()){observer=new MutationObserver(mount);observer.observe(D.documentElement,{childList:true,subtree:true});G.setTimeout(function(){if(observer)observer.disconnect();},30000);}
})(window,document);
