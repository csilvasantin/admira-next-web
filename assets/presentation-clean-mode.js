(function(){
  'use strict';
  if(document.documentElement.classList.contains('presenter-remote-mode'))return;

  function setCleanMode(active){
    var root=document.documentElement;
    root.classList.toggle('presentation-clean-mode',Boolean(active));
    root.dataset.cleanMode=active?'true':'false';
    document.dispatchEvent(new CustomEvent('admira:clean-mode',{detail:{active:Boolean(active)}}));
    return Boolean(active);
  }
  function toggleCleanMode(){
    return setCleanMode(!document.documentElement.classList.contains('presentation-clean-mode'));
  }

  window.__ADMIRA_SET_CLEAN_MODE__=setCleanMode;
  window.__ADMIRA_TOGGLE_CLEAN_MODE__=toggleCleanMode;
  addEventListener('keydown',function(event){
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.target?.isContentEditable||event.target?.closest?.('input,textarea,select'))return;
    if(String(event.key).toLowerCase()!=='h')return;
    event.preventDefault();
    toggleCleanMode();
  });
}());
